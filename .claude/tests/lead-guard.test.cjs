// Offline test for netlify/functions/submission-created.js with the shared lead
// guard (netlify/functions/_lib/lead-guard.js + js/human-check.js), the same
// pattern on every Netlify Forms site Jacob runs.
//   node .claude/tests/lead-guard.test.cjs
// fetch and https.request are replaced with recorders BEFORE the function loads,
// and the env holds fake values: nothing leaves this machine, no real ntfy
// topic, key or phone number is ever used.
'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const https = require('https');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');

// ---- this site ----
const SITE = {
  env: { NTFY_TOPIC: 'offline-test-topic-not-real' },
  pages: ['index.html', '404.html'],
  forms: [
    { form: 'waitlist', lead: { name: 'Pat Example', email: 'pat@example.test', units: '4-12' } },
  ],
  // No message box on the waitlist: a bot puts its text in whatever field it
  // finds. The price template is matched only in a message box, so here it is
  // the missing token that stops it (tested below).
  spamField: 'units',
  priceCaughtByContent: false,
};

// ---------------------------------------------------------------------------
// Recorders: every outbound call the function makes counts as one push.
const calls = [];
global.fetch = async (url) => {
  calls.push(String(url));
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};
https.request = (opts, cb) => {
  calls.push(`https://${opts.hostname}${opts.path}`);
  const req = new EventEmitter();
  req.write = () => {};
  req.end = () => {
    const res = new EventEmitter();
    res.statusCode = 201;
    cb(res);
    res.emit('data', '{}');
    res.emit('end');
  };
  return req;
};
const logs = [];
const out = (s) => process.stdout.write(`${s}\n`);
console.log = (...a) => logs.push(a.join(' '));
console.error = (...a) => logs.push(a.join(' '));

Object.assign(process.env, SITE.env);
const { handler } = require(path.join(ROOT, 'netlify/functions/submission-created.js'));
const { mintHumanToken, humanProblem } = require(path.join(ROOT, 'netlify/functions/_lib/lead-guard.js'));

const token = (data) => mintHumanToken(data.email, data.phone);
const withToken = (data) => ({ ...data, human: token(data) });

async function submit(form, data) {
  calls.length = 0;
  logs.length = 0;
  const payload = {
    form_name: form,
    created_at: '2026-10-25T15:00:00.000Z',
    data: { ip: '203.0.113.9', user_agent: 'offline-test', referrer: 'https://example.test/', 'form-name': form, ...data },
  };
  const res = await handler({ body: JSON.stringify({ payload }) });
  assert.strictEqual(res.statusCode, 200, `status for ${form}`);
  return calls.length;
}

// The bot run as it reached Jacob's phones in October 2026.
const SPANISH = 'Hola, quería saber tu precio.';
const CYRILLIC = 'Привет, я хотел узнать твой прайс.';
const PRICE = 'Hi, I wanted to know your price';
const CASINO = 'Best online casino bonus, claim your free spins today';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('a real lead with a human-check token pushes exactly once (every form)', async () => {
  for (const { form, lead } of SITE.forms) {
    assert.strictEqual(await submit(form, withToken(lead)), 1, form);
    assert.ok(!logs.some((l) => /lead guard/.test(l)), `${form}: delivered leads are not flagged`);
  }
});

test('no token (a bot that never ran the page JavaScript) -> no push, PII-free log line', async () => {
  for (const { form, lead } of SITE.forms) {
    assert.strictEqual(await submit(form, lead), 0, form);
    const line = logs.find((l) => /lead guard/.test(l));
    assert.match(line || '', /lead guard: quiet \(no human-check token/, form);
    for (const v of Object.values(lead)) {
      if (String(v).length >= 4) assert.ok(!line.includes(String(v)), `${form}: log leaks ${v}`);
    }
  }
});

test('a token minted for another email or phone -> no push', async () => {
  for (const { form, lead } of SITE.forms) {
    const forged = { ...lead, human: mintHumanToken('someone-else@example.test', lead.phone) };
    assert.strictEqual(await submit(form, forged), 0, form);
  }
});

test('Spanish / Cyrillic / casino spam (and the price template in the message box) -> no push even WITH a token', async () => {
  const { form, lead } = SITE.forms[0];
  const texts = [SPANISH, CYRILLIC, CASINO].concat(SITE.priceCaughtByContent ? [PRICE] : []);
  for (const t of texts) {
    assert.strictEqual(await submit(form, withToken({ ...lead, [SITE.spamField]: t })), 0, t);
    assert.ok(logs.some((l) => /lead guard: drop/.test(l)), `${t}: dropped`);
  }
});

test('the same spam from a bot (no token): Spanish, Cyrillic, "I wanted to know your price", casino -> no push', async () => {
  for (const { form, lead } of SITE.forms) {
    for (const t of [SPANISH, CYRILLIC, PRICE, CASINO]) {
      assert.strictEqual(await submit(form, { ...lead, name: 'Billylef', [SITE.spamField]: t }), 0, `${form}: ${t}`);
    }
  }
});

test('a filled honeypot -> no push', async () => {
  const { form, lead } = SITE.forms[0];
  assert.strictEqual(await submit(form, withToken({ ...lead, 'bot-field': 'x' })), 0);
});

for (const [name, fn] of SITE.extra || []) test(name, fn);

test('every Netlify form has a static hidden `human` input (Netlify stores only fields in the deployed HTML), the page loads human-check.js, and the token is set', () => {
  const fetchForms = SITE.fetchForms || [];
  for (const page of SITE.pages) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const forms = html.match(/<form\b[^>]*\bdata-netlify="true"[^>]*>[\s\S]*?<\/form>/g) || [];
    assert.ok(forms.length > 0, `${page}: no Netlify form found`);
    for (const f of forms) {
      const name = (/^<form\b[^>]*\bname="([^"]+)"/.exec(f) || [])[1];
      assert.match(f, /<input type="hidden" name="human">/, `${page}: ${name} has no static human input`);
      if (fetchForms.includes(name)) {
        // Posted by the site's own fetch handler, which sets `human` itself.
        // data-human-check here would make attach() swallow the first click.
        assert.doesNotMatch(f, /^<form\b[^>]*\bdata-human-check\b/, `${page}: ${name} posts by fetch, drop data-human-check`);
      } else {
        assert.match(f, /^<form\b[^>]*\bdata-human-check\b/, `${page}: ${name} has no data-human-check`);
      }
    }
    assert.match(html, /<script src="\/js\/human-check\.js(\?v=\d+)?" defer><\/script>/, `${page}: human-check.js not loaded`);
  }
  if (fetchForms.length) {
    const handler = fs.readFileSync(path.join(ROOT, SITE.fetchHandler), 'utf8');
    assert.match(handler, /\.set\('human', await window\.HumanCheck\.token\(/, `${SITE.fetchHandler} does not set the token`);
  }
});

test('js/human-check.js mints tokens the server accepts (same algorithm both sides)', async () => {
  let clock = 1_800_000_000_000;
  const sandbox = {
    window: { crypto: require('crypto').webcrypto, TextEncoder },
    document: { readyState: 'complete', querySelectorAll: () => [], addEventListener: () => {} },
    Date: { now: () => clock }, Math, String, Promise, Uint8Array,
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/human-check.js'), 'utf8'), sandbox);
  clock += 6000; // six seconds on the page
  const tok = await sandbox.window.HumanCheck.token(' Pat@Example.test', '(320) 555-2671');
  assert.match(tok, /^v1\.\d+\.\d+\.6000$/);
  assert.strictEqual(humanProblem(tok, 'pat@example.test', '320-555-2671', clock + 1000), null);
  assert.match(humanProblem(tok, 'pat@example.test', '320-555-2672', clock + 1000), /does not match/);
});

(async () => {
  let pass = 0;
  for (const t of tests) {
    try { await t.fn(); pass += 1; out(`ok    ${t.name}`); }
    catch (e) { out(`FAIL  ${t.name}\n      ${String(e.message).split('\n').join('\n      ')}`); }
  }
  out(`\n${pass}/${tests.length} passed`);
  process.exit(pass === tests.length ? 0 : 1);
})();
