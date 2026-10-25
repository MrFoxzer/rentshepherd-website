// Offline tests for netlify/functions/_lib/lead-guard.js and its browser half
// js/human-check.js (the same pair runs on all of Jacob's sites).
//   node .claude/tests/lead-guard.test.cjs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const G = require(path.join(ROOT, 'netlify/functions/_lib/lead-guard.js'));
const { triage, humanProblem, mintHumanToken } = G;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const human = (email, phone, o) => mintHumanToken(email, phone, o);
const real = (o = {}) => {
  const f = { name: 'Pat Example', email: 'pat@example.test', phone: '320-555-2671', message: 'We would like to see the Cedar St house this weekend.', ...o };
  return [f, { human: human(f.email, f.phone) }];
};
const verdict = (f, opts) => triage(f, opts).action;

// The bot run's template, as it arrived on Jacob's sites in October 2026.
const PRICE_RUN = [
  'Hola, quería saber tu precio.',
  'Hallo, ich wollte Ihren Preis wissen.',
  'Ciao, volevo sapere il tuo prezzo.',
  'Bonjour, je voulais connaître votre prix.',
  'Olá, queria saber o seu preço.',
  'Hej, jeg ønskede at kende din pris.',
  'Hej, jag ville veta ditt pris.',
  'Hoi, ik wilde uw prijs weten.',
  'Cześć, chciałem poznać twoją cenę.',
  'Ahoj, chtěl jsem znát vaši cenu.',
  'Zdravo, htio sam znati vašu cijenu.',
  'Szia, meg akartam kérdezni az árát.',
  'Sveiki, norėjau sužinoti jūsų kainą.',
  'Labdien, es gribēju uzzināt jūsu cenu.',
  'Tere, ma tahtsin teada teie hinda.',
  'Hei, halusin tietää hintasi.',
  'Përshëndetje, doja të di çmimin tuaj.',
  'Dia duit, theastaigh uaim do phraghas a fháil.',
  'Kaixo, zure prezioa jakin nahi nuen.',
  'Merhaba, fiyatınızı öğrenmek istedim.',
  'Halo, saya ingin tahu harga Anda.',
  'Xin chào, tôi muốn biết giá của bạn.',
  'Salut, ți-am vrut să-ți aflu prețul.',
  'Привет, я хотел узнать твой прайс.',
  'Γεια σου, ήθελα να μάθω την τιμή σας.',
  'こんにちは、価格を知りたかったです。',
  '你好，我想知道你的价格。',
  'مرحبا، أردت أن أعرف سعرك.',
];

test('a real English lead with a token is delivered', () => {
  const [f, o] = real();
  assert.deepStrictEqual(triage(f, o), { action: 'deliver', reason: null });
});

test('human check: missing, stale, future, too fast, wrong contact, malformed -> quiet', () => {
  const [f] = real();
  const now = Date.now();
  for (const [tok, why] of [
    ['', /no human-check token/],
    [human(f.email, f.phone, { ts: now - 8 * 86400e3 }), /stale/],
    [human(f.email, f.phone, { ts: now + 8 * 86400e3 }), /future/],
    [human(f.email, f.phone, { onPage: 300 }), /300 ms/],
    [human('someone@else.test', f.phone), /does not match/],
    [human(f.email, '320-555-0000'), /does not match/],
    ['v1.abc.1.5000', /malformed/],
  ]) {
    const r = triage(f, { human: tok, now });
    assert.strictEqual(r.action, 'quiet', tok);
    assert.match(r.reason, why);
  }
});

test('the token ignores email case/spaces and phone punctuation', () => {
  const tok = human('pat@example.test', '3205552671');
  assert.strictEqual(humanProblem(tok, '  PAT@Example.test ', '(320) 555-2671'), null);
});

const SPAM = [
  'Best online casino bonus, free spins today', 'Crypto recovery: we recover your lost bitcoin',
  'We sell backlinks for your site', 'Guest posting on high DA blogs', 'Our SEO services will rank your website',
  'I visited your website and noticed it is not on the first page of Google',
  'Merchant cash advance, same-day funding up to $500k', 'Notice of copyright infringement (DMCA) on your images',
  'see https://a.example https://b.example https://c.example', 'deal at https://bit.ly/xyz', 'visit https://cheap-stuff.ru today',
  'hxxps://evil[.]example/login', 'Our cаsino is the best',   // Cyrillic "а"
];

test('honeypot and unambiguous adult/drug spam drop even with a valid token', () => {
  const [f, o] = real();
  assert.strictEqual(verdict(f, { ...o, honeypot: 'x' }), 'drop');
  for (const message of ['Hot singles want to meet you', 'Cheap viagra and cialis', 'Buy tramadol without prescription',
    'Visit my onlyfans', 'Cheap V\u200Biagra']) {
    const [g, p] = real({ message: message.replace('\\u200B', '\u200B') });
    assert.strictEqual(verdict(g, p), 'drop', message);
  }
});

test('pitch, scam and link spam: drop without a token, quiet (email only) with one', () => {
  for (const message of SPAM) {
    const [f, o] = real({ message });
    assert.strictEqual(verdict(f, {}), 'drop', message);
    assert.strictEqual(verdict(f, o), 'quiet', message);
  }
});

test('"I wanted to know your price": drop from a bot, quiet from a verified visitor', () => {
  for (const message of ['Hi, I wanted to know your price.', 'Hello I want to know your price', 'I wanted to know your price',
    'I am writing about your prices']) {
    const [f, o] = real({ name: 'Robertupsex', message });
    assert.strictEqual(verdict(f, {}), 'drop', message);
    assert.strictEqual(verdict(f, o), 'quiet', message);
  }
});

test('every translation of the run is "not English": drop by default, quiet for Home Match', () => {
  for (const message of PRICE_RUN) {
    const [f, o] = real({ name: 'Billylef', message });
    assert.strictEqual(verdict(f, o), 'drop', message);
    const q = triage(f, { ...o, nonEnglish: 'quiet' });
    assert.strictEqual(q.action, 'quiet', message);
    assert.match(q.reason, /not English/);
    // The real run: no token and a fake phone. Dropped even on Home Match.
    const bot = { ...f, phone: '0123456789' };
    assert.strictEqual(verdict(bot, { nonEnglish: 'quiet' }), 'drop', message);
  }
});

test('the name never decides the language; foreign greetings in English messages are English', () => {
  for (const [name, message] of [['Les Vos', 'Graduation party June 12th, need 80 chairs'], ['Xin Chao', ''],
    ['Олександр Коваленко', 'Call me'], ['王小明', 'Interested!'], ['Della Del Rio', 'Water slide + castle, Del Ray Park'],
    ['Pat Olson', 'Concrete pour for garage slab, est 24x24'], ['Pat Olson', 'Chicago IL buyer. Call after 6 EST.'],
    ['Pat Olson', 'Hola buenas tardes, water slide for Saturday?'], ['Pat Olson', 'Xin chao. Water slide Saturday?']]) {
    const [f, o] = real({ name, message });
    assert.strictEqual(verdict(f, o), 'deliver', `${name}: ${message}`);
  }
});

test('genuine-lead corpus (361 posts from the 2026-10-25 review): never dropped; quiet only for known reasons', () => {
  const { C, D } = require('./fixtures/lead-guard-genuine.cjs');
  const allowedQuiet = /bot template|sales pitch|fictional 555-01xx|bot email pattern/;
  for (const c of C) {
    const name = c.name || D.name, email = c.email || D.email, phone = c.phone || D.phone;
    const f = { name, email, phone, message: c.message, text: c.text || '' };
    const tok = human(email, phone);
    for (const nonEnglish of ['drop', 'quiet']) {
      const r = triage(f, { human: tok, nonEnglish });
      assert.notStrictEqual(r.action, 'drop', `[${c.biz}] ${name} | ${c.message} | ${c.text || ''} -> ${r.reason}`);
      if (r.action === 'quiet') assert.match(r.reason, allowedQuiet, `[${c.biz}] ${name} | ${c.message} -> ${r.reason}`);
    }
  }
});

test('English with Spanish/French place names, names and greetings stays English', () => {
  for (const message of [
    'Hola Janet, we want to see the house on Lake Le Homme Dieu this weekend',
    'Is the home near Des Moines Ave still for sale? Thanks, Jose',
    'Bonjour! We are moving from Montreal and need a 3 bed in Alexandria',
    'Interested in Lake Como Circle lot, can you call me after 5',
    'My wife Maria and I are looking for a lake cabin near Osakis',
  ]) {
    const [f, o] = real({ message });
    assert.strictEqual(verdict(f, o), 'deliver', message);
  }
});

test('words that only look like spam terms are delivered', () => {
  for (const message of [
    'We are relocating from Sussex, England', 'Essex Street duplex please', 'I am a physical therapist moving to Willmar',
    'Are there any sex offenders living near this house?', 'Any sexual offender registry concerns in this neighborhood?',
    'Here is the Zillow link: https://www.zillow.com/homedetails/x', 'Two links: https://a.example and https://b.example',
    'Do you have any slots open for Saturday?', 'Do you need a water hookup for the slide?', 'Casino night fundraiser at church',
    'We are a same-sex couple relocating from Chicago', 'I work at Grand Casino Mille Lacs', 'Pin: https://maps.app.goo.gl/AbCdEf',
  ]) {
    const [f, o] = real({ message });
    assert.strictEqual(verdict(f, o), 'deliver', message);
  }
});

test('phones: US and +international pass; impossible US and the bot 11-digit pattern -> quiet', () => {
  for (const phone of ['320-555-2671', '(612) 555-0234', '1-320-219-2488', '+1 320 219 2488', '+44 20 7946 0958', '+52 55 1234 5678',
    '320-555-2671 x123', '(320) 555-2671 ext 4', '555-2671', '44 20 7946 0958', 'cell 320-555-2671 / work 320-555-9876',
    '86327614758']) {   // 11 digits, no "+": the bot runs use these, but so do people abroad; the token decides
    const [f, o] = real({ phone });
    assert.strictEqual(verdict(f, o), 'deliver', phone);
  }
  for (const phone of ['0123456789', '1111111111', '320-155-2671', '12345', '320-555-0150']) {
    const [f, o] = real({ phone });
    assert.strictEqual(verdict(f, o), 'quiet', phone);
  }
});

test('disposable email, dotted bot email, random name + empty message -> quiet', () => {
  for (const o of [
    { email: 'x@mailinator.com' }, { email: 'y.i.h.o.d.u452@gmail.com' },
    { name: 'Ojooq Yrcvvbb', message: '' }, { name: 'Cqbrcrdv Qgicjt', message: 'hello' },
    { message: 'rYlRUuxsdJpIQBtgJdQKSRqe' },
  ]) {
    const [f, p] = real(o);
    assert.strictEqual(verdict(f, p), 'quiet', JSON.stringify(o));
  }
  for (const name of ['Anna Kirchschlager', 'Erik Lindstrom', 'Kim Hirschfeld', 'Mkrtich Mkrtchyan', 'Thao Nguyen', 'Steve Hrbek']) {
    const [f, p] = real({ name, message: '' });
    assert.strictEqual(verdict(f, p), 'deliver', name);
  }
  for (const message of ['karen.johnson@gmail.com', '320-251-9912', 'Congratulations!', 'Interested!!',
    'https://www.zillow.com/homedetails/123-Lake-St/1_zpid/']) {
    const [f, p] = real({ message });
    assert.strictEqual(verdict(f, p), 'deliver', message);
  }
});

test('js/human-check.js mints tokens the server accepts (same algorithm both sides)', async () => {
  let clock = 1_800_000_000_000;
  const FakeDate = { now: () => clock };
  const listeners = {};
  const sandbox = {
    window: { crypto: require('crypto').webcrypto, TextEncoder },
    document: { readyState: 'complete', querySelectorAll: () => [], addEventListener: (k, f) => { listeners[k] = f; } },
    Date: FakeDate, Math, String, Promise, Uint8Array,
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/human-check.js'), 'utf8'), sandbox);
  clock += 6000;    // six seconds on the page
  const tok = await sandbox.window.HumanCheck.token(' Pat@Example.test', '(320) 555-2671');
  assert.match(tok, /^v1\.\d+\.\d+\.6000$/);
  assert.strictEqual(humanProblem(tok, 'pat@example.test', '320-555-2671', clock + 1000), null);
  assert.match(humanProblem(tok, 'pat@example.test', '320-555-2672', clock + 1000), /does not match/);
  const noCrypto = { ...sandbox, window: { TextEncoder } };
  noCrypto.window.window = noCrypto.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/human-check.js'), 'utf8'), noCrypto);
  assert.strictEqual(await noCrypto.window.HumanCheck.token('a@b.test', ''), '');
});

test('attach(): one click -> exactly one submit, carrying the token (Chrome ignores requestSubmit mid-dispatch)', async () => {
  // A synchronous digest (resolved promises only) finishes inside the click's
  // microtask checkpoint, the case that made the first click do nothing.
  const nodeCrypto = require('crypto');
  const subtle = { digest: (alg, data) => Promise.resolve(Uint8Array.from(nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest()).buffer) };
  let clock = 1_800_000_000_000;
  const sandbox = {
    window: { crypto: { subtle }, TextEncoder },
    document: { readyState: 'complete', querySelectorAll: () => [] },
    Date: { now: () => clock }, Math, String, Promise, Uint8Array, setTimeout,
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/human-check.js'), 'utf8'), sandbox);
  clock += 7000;

  const listeners = [];
  const fields = { email: { value: 'pat@example.test' }, phone: { value: '320-555-2671' } };
  let hidden = null, dispatching = false, ignored = 0;
  const sentTokens = [];
  const form = {
    addEventListener: (type, fn) => listeners.push(fn),
    querySelector: (sel) => (sel.includes('"email"') ? fields.email : sel.includes('"phone"') ? fields.phone : sel.includes('"human"') ? hidden : null),
    appendChild: (el) => { hidden = el; },
    requestSubmit() { if (dispatching) { ignored += 1; return; } fire(); },
    submit() { sentTokens.push(hidden && hidden.value); },
  };
  sandbox.document.createElement = () => ({});
  async function fire() {
    const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
    dispatching = true;
    for (const fn of listeners) fn(ev);
    for (let i = 0; i < 20000; i += 1) await null;   // the microtask checkpoint, still inside dispatch
    dispatching = false;
    if (!ev.defaultPrevented) sentTokens.push(hidden && hidden.value);
  }
  sandbox.window.HumanCheck.attach(form);
  await Promise.all([fire(), fire()]);                // a double click
  await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 20000; i += 1) await null;
  assert.strictEqual(ignored, 0, 'requestSubmit() was called while the submit event was still firing');
  assert.strictEqual(sentTokens.length, 1, `expected exactly one submission, got ${sentTokens.length}`);
  assert.strictEqual(humanProblem(sentTokens[0], 'pat@example.test', '320-555-2671', clock + 1000), null);
});

(async () => {
  let pass = 0;
  for (const t of tests) {
    try { await t.fn(); pass += 1; console.log(`ok    ${t.name}`); }
    catch (e) { console.log(`FAIL  ${t.name}\n      ${String(e.message).split('\n').join('\n      ')}`); }
  }
  console.log(`\n${pass}/${tests.length} passed`);
  process.exit(pass === tests.length ? 0 : 1);
})();
