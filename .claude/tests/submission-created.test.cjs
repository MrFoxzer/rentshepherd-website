// Offline test for netlify/functions/submission-created.js with the shared lead
// guard v2 (netlify/functions/_lib/lead-guard.js + js/human-check.js), the same
// pattern on every Netlify Forms site Jacob runs. The guard's own unit tests and
// the 361-post genuine-lead corpus are in lead-guard.test.cjs.
//   node .claude/tests/submission-created.test.cjs
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
// Recorders: every outbound call the function makes is recorded, never sent.
const calls = [];
global.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), body: typeof init.body === 'string' ? init.body : '' });
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};
https.request = (opts, cb) => {
  calls.push({ url: `https://${opts.hostname}${opts.path}`, body: '' });
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

// The guard's verdict, read from the function's one log line (none = deliver).
const guardLine = () => logs.find((l) => /^lead guard: /.test(l)) || '';
const verdictOf = () => (/^lead guard: (drop|quiet) \(/.exec(guardLine()) || [, 'deliver'])[1];
const subjectOf = (c) => { try { return JSON.parse(c.body).subject || ''; } catch { return ''; } };

// What each verdict sends on this site:
//   deliver  exactly one push/email, untagged
//   quiet    no push. An email-only site (SITE.quietEmails) still sends its one
//            email, tagged "[filtered] <reason>". The submission is in the
//            Netlify Forms dashboard either way.
//   drop     nothing at all
async function expectVerdict(form, data, want, label = form) {
  await submit(form, data);
  const got = verdictOf();
  assert.strictEqual(got, want, `${label}: expected ${want}, got ${got} (${guardLine()})`);
  if (want === 'deliver') {
    assert.strictEqual(calls.length, 1, `${label}: a delivered lead sends exactly once`);
    if (SITE.quietEmails) assert.doesNotMatch(subjectOf(calls[0]), /\[filtered\]/, `${label}: delivered email is not tagged`);
  } else if (want === 'quiet' && SITE.quietEmails) {
    assert.strictEqual(calls.length, 1, `${label}: a quiet lead is still emailed once`);
    assert.match(subjectOf(calls[0]), /^\[filtered\] \S/, `${label}: quiet email is tagged [filtered] with the reason`);
  } else {
    assert.strictEqual(calls.length, 0, `${label}: ${want} sends nothing`);
  }
}

// The bot run as it reached Jacob's phones in October 2026.
const SPANISH = 'Hola, quería saber tu precio.';
const CYRILLIC = 'Привет, я хотел узнать твой прайс.';
const PRICE = 'Hi, I wanted to know your price';
const CASINO = 'Best online casino bonus, claim your free spins today';
const SHORTENER = 'Special deal for you at https://bit.ly/xyz';
// Wording v1 dropped from real customers (the 2026-10-25 review); v2 delivers it.
const EVERYDAY = SITE.everyday || [
  'Do you have any time slots open next week?', 'Is there an RV hookup or a water hookup on site?',
  'Casino night fundraiser at our church', 'I work at Grand Casino Mille Lacs', 'We are a same-sex couple',
  'Pin: https://maps.app.goo.gl/AbCdEf', 'Here is the Zillow link: https://www.zillow.com/homedetails/x',
];
const jobForm = (form) => (SITE.jobForms || []).includes(form);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('a real lead with a human-check token is delivered exactly once (every form)', async () => {
  for (const { form, lead } of SITE.forms) {
    await expectVerdict(form, withToken(lead), 'deliver');
    assert.ok(!logs.some((l) => /lead guard/.test(l)), `${form}: delivered leads are not flagged`);
  }
});

test('v2: a verified visitor is never dropped over everyday wording (time slot, RV hookup, casino night, ...)', async () => {
  const { form, lead } = SITE.forms[0];
  for (const t of EVERYDAY) await expectVerdict(form, withToken({ ...lead, [SITE.spamField]: t }), 'deliver', t);
});

test('no token (a bot, or a visitor with JavaScript off) -> quiet: no push, PII-free log line', async () => {
  for (const { form, lead } of SITE.forms) {
    await expectVerdict(form, lead, 'quiet');
    const line = guardLine();
    assert.match(line, /lead guard: quiet \(no human-check token/, form);
    for (const v of Object.values(lead)) {
      if (String(v).length >= 4) assert.ok(!line.includes(String(v)), `${form}: log leaks ${v}`);
    }
  }
});

test('a token minted for another email or phone -> quiet (no push)', async () => {
  for (const { form, lead } of SITE.forms) {
    const forged = { ...lead, human: mintHumanToken('someone-else@example.test', lead.phone) };
    await expectVerdict(form, forged, 'quiet');
    assert.match(guardLine(), /does not match/, form);
  }
});

// The forms with a free-text box (spamField). A bot fills every field; a form
// whose only text is English (company, markets) reads as English to the guard.
const textForms = () => SITE.forms.filter((f) => SITE.spamField in f.lead && !jobForm(f.form));

test('non-English WITH a token: Spanish and Cyrillic are dropped (nonEnglish: drop)', async () => {
  for (const { form, lead } of textForms()) {
    for (const t of [SPANISH, CYRILLIC]) await expectVerdict(form, withToken({ ...lead, [SITE.spamField]: t }), 'drop', `${form}: ${t}`);
  }
});

test('pitch, link-shortener and price-template spam WITH a token -> quiet, never dropped (no push)', async () => {
  const { form, lead } = SITE.forms[0];
  for (const t of [CASINO, SHORTENER].concat(SITE.priceCaughtByContent ? [PRICE] : [])) {
    await expectVerdict(form, withToken({ ...lead, [SITE.spamField]: t }), 'quiet', t);
  }
});

test('adult/drug spam and a filled honeypot -> dropped even WITH a token', async () => {
  const { form, lead } = SITE.forms[0];
  await expectVerdict(form, withToken({ ...lead, [SITE.spamField]: 'Cheap viagra and cialis, no prescription needed' }), 'drop', 'drugs');
  await expectVerdict(form, withToken({ ...lead, [SITE.spamField]: 'Hot singles want to meet you' }), 'drop', 'adult');
  await expectVerdict(form, withToken({ ...lead, 'bot-field': 'x' }), 'drop', 'honeypot');
});

test('the same spam from a bot (no token): Spanish, Cyrillic, "I wanted to know your price", casino -> nothing delivered', async () => {
  for (const { form, lead } of SITE.forms) {
    for (const t of [SPANISH, CYRILLIC, PRICE, CASINO]) {
      const bot = { ...lead, name: 'Billylef', [SITE.spamField]: t };
      await submit(form, bot);
      assert.notStrictEqual(verdictOf(), 'deliver', `${form}: ${t}`);
      if (!SITE.quietEmails || verdictOf() === 'drop') assert.strictEqual(calls.length, 0, `${form}: ${t} sent something`);
    }
    // Content signals, and non-English in a free-text box (not on a job form), drop a tokenless post outright.
    await expectVerdict(form, { ...lead, name: 'Billylef', [SITE.spamField]: CASINO }, 'drop', `${form}: bot casino`);
    if (textForms().some((f) => f.form === form)) {
      await expectVerdict(form, { ...lead, name: 'Billylef', [SITE.spamField]: SPANISH }, 'drop', `${form}: bot Spanish`);
    }
  }
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
