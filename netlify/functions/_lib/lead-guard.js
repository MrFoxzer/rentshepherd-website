// Lead guard: the invisible human check + spam/language triage shared by every
// lead function Jacob runs (Home Match, Hitch & Host, Revisions Unlimited,
// Style Marking and the Netlify Forms sites). Pure functions, no dependencies;
// the same file is copied into each repo, so change it everywhere at once.
//
// Why (2026-10-25): bot runs ("Robertupsex", "Billylef": "Hi, I wanted to know
// your price" in 30 languages, fake phones, adult and casino spam) reached
// Janet's and Jacob's phones on every business. Jacob: "if it's a different
// language I don't even wanna get to see it" and "we need to put in a
// verification somehow before someone submits a lead".
//
// 1. Human check (js/human-check.js in the browser). When the visitor presses
//    Submit, the page spends ~0.1 s finding a nonce so that
//      sha256("v1|<ts>|<contact>|<nonce>")
//    starts with HUMAN_BITS zero bits, where <contact> is contactKey() of the
//    email + phone being sent. It posts "v1.<ts>.<nonce>.<msOnPage>" as `human`.
//    Form-spam bots post the HTML form without running JavaScript, so they
//    never have a token; a token cannot be reused for another email or phone,
//    and it expires after a day. No puzzle, no checkbox, no third-party
//    account or key: nothing for a real visitor to do.
// 2. triage() sorts every post into
//      'drop'    certain spam: nothing is sent or pushed (the sender still gets
//                a normal "thanks", so a bot learns nothing)
//      'quiet'   doubtful: no phone push, SMS or auto-reply; the email (tagged)
//                and the ledger still get it, so a real lead is never lost
//      'deliver' everything else, exactly as before
//
// Non-English: 'drop' everywhere except where a caller passes
// { nonEnglish: 'quiet' }. Home Match does, because a real estate broker must
// not turn away an inquiry over the language it is written in (Fair Housing:
// national origin), so those still reach Janet's email, just never her phone.

const crypto = require('crypto');

const HUMAN_BITS = 12;                       // ~4,096 hashes: ~0.1 s on a phone
const HUMAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const HUMAN_MAX_SKEW_MS = 10 * 60 * 1000;    // the visitor's clock may run ahead
const HUMAN_MIN_ON_PAGE_MS = 2500;           // nobody fills a lead form in 2.5 s

// The email and phone the token is bound to. The browser computes the same key.
function contactKey(email, phone) {
  return `${String(email || '').trim().toLowerCase()}|${String(phone || '').replace(/\D/g, '')}`;
}

function leadingZeroBits(buf) {
  let n = 0;
  for (const byte of buf) {
    if (byte === 0) { n += 8; continue; }
    return n + Math.clz32(byte) - 24;
  }
  return n;
}

// null when the token is good, else the reason it is not.
function humanProblem(token, email, phone, now = Date.now()) {
  if (!token || typeof token !== 'string') return 'no human-check token (JavaScript off, or a bot)';
  const m = /^v1\.(\d{12,14})\.(\d{1,12})\.(\d{1,10})$/.exec(token.trim());
  if (!m) return 'malformed human-check token';
  const ts = Number(m[1]);
  const onPage = Number(m[3]);
  if (now - ts > HUMAN_MAX_AGE_MS) return 'stale human-check token';
  if (ts - now > HUMAN_MAX_SKEW_MS) return 'human-check token from the future';
  if (onPage < HUMAN_MIN_ON_PAGE_MS) return `form sent ${onPage} ms after the page opened`;
  const digest = crypto.createHash('sha256').update(`v1|${m[1]}|${contactKey(email, phone)}|${m[2]}`).digest();
  if (leadingZeroBits(digest) < HUMAN_BITS) return 'human-check proof does not match this email/phone';
  return null;
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

const NON_LATIN = /[\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Greek}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Ethiopic}]/gu;

// High-frequency words of the languages these runs use that are NOT English
// words (so "die", "door", "pat", "son" are left out on purpose).
const FOREIGN = new Set((
  // es / pt / gl / ca
  'hola quería queria quiero saber precio precios cuánto cuanto usted ustedes gracias señor buenos buenas ' +
  'por para con una del los las sus como pero también tambien está esta estoy qué cuál ' +
  'olá ola você voce preço preco seu sua não nao obrigado gostaria ' +
  // fr
  'bonjour je voulais vouloir connaître connaitre votre vos prix vous avec pour les des est merci ' +
  'salut bonsoir combien ' +
  // it
  'ciao volevo sapere il tuo tua prezzo sono che della grazie salve quanto ' +
  // de / nl
  'hallo ich wollte ihren ihre preis wissen und der das nicht mit ist bitte danke guten wie viel ' +
  'hoi wilde uw prijs weten het een niet graag ' +
  // pl / cs / sk / sl / hr / sr / bs
  'cześć czesc chciałem chcialem poznać poznac twoją twoja cenę cene jest nie się sie dzień ' +
  'ahoj chtěl chtel jsem znát vaši vasi cenu chcel som poznať vašu ' +
  'živjo zivjo želel zelel sem izvedeti vašo ceno zdravo htio htjela znati cijenu želim ' +
  // ro / hu / sq
  'bună buna ți ti vrut să aflu prețul pretul și ' +
  'szia szeretném szeretnem akartam árát arat és kérdezni ' +
  'përshëndetje pershendetje doja të di çmimin cmimin tuaj ' +
  // lt / lv / et / fi
  'sveiki norėjau norejau sužinoti suzinoti jūsų jusu kainą kaina ' +
  'labdien gribēju gribeju uzzināt uzzinat jūsu cenu ' +
  'tere tahtsin teada teie hinda hei halusin tietää tietaa hintasi ' +
  // da / no / sv / is
  'hej jeg ønskede onskede kende ville vite jag veta ditt hinta ég vildi vita verð þitt ' +
  // ga / eu / tr / id / ms / vi / tl
  'duit theastaigh uaim phraghas fháil fhail kaixo zure prezioa jakin nahi nuen ' +
  'merhaba fiyatınızı fiyatinizi öğrenmek ogrenmek istedim ' +
  'saya ingin tahu harga anda terima kasih ' +
  'xin chào chao tôi toi muốn muon biết biet giá của cua bạn ' +
  'kumusta gusto kong malaman presyo'
).split(/\s+/));

const ENGLISH = new Set((
  'i im i\'m you your the a an to and of in on for is are am my me we our us it its this that these those ' +
  'with have has had would like want wanted know can could please home homes house houses price ' +
  'looking interested thanks thank hi hello hey what when where how about at be do does if not will ' +
  'just sell selling buy buying call text me there here from see showing listing property lake land ' +
  'need get got was were been any some more much many time today tomorrow week yes no also so but or'
).split(/\s+/));

// 'non-latin' | 'foreign' | null
function language(text) {
  const t = String(text || '');
  const letters = t.match(/\p{L}/gu) || [];
  if (letters.length >= 6 && (t.match(NON_LATIN) || []).length / letters.length > 0.3) return 'non-latin';
  const words = (t.toLowerCase().match(/[\p{L}']+/gu) || []);
  if (words.length < 3) return null;
  let foreign = 0;
  let english = 0;
  for (const w of words) {
    if (ENGLISH.has(w)) english += 1;
    else if (FOREIGN.has(w)) foreign += 1;
  }
  return (foreign >= 2 && foreign > english) ? 'foreign' : null;
}

// ---------------------------------------------------------------------------
// Spam signals
// ---------------------------------------------------------------------------

// "Hi, I wanted to know your price." The run's English template (its 30-odd
// translations fall to language() above).
const PRICE_TEMPLATE = /^\W*(hi|hello|hey|greetings)?\W*i\s+(wanted|want)\s+to\s+know\s+your\s+price\W*$/i;

// Whole words only: "Sussex", "Essex", "therapist", "cocktail" never match,
// and a buyer asking about sex offenders near a house is a real question.
const HARD_WORDS = /\b(sex(?!\s*offend)|sexual(?!\s*(offend|predator|orientation|harass))|sexy|porn\w*|erotic\w*|nude\w*|escort\w*|hookup\w*|onlyfans|viagra|cialis|levitra|casino\w*|slots?|betting|gambl\w*|crypto\w*|bitcoin|forex|binance|backlinks?|guest\s+post\w*|seo\s+services?|rank\s+your\s+(site|website)|web\s*traffic|loan\s+offer)\b/i;

const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(ru|su|cn|xyz|top|click|online|site|shop|icu|buzz|live|store|link|info|biz|tk|ml|ga|cf|gq)\b/gi;
const SHORTENER = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|t\.me|telegra\.ph|wa\.me)\b/i;
const BAD_TLD = /\b[a-z0-9-]+\.(ru|su|cn|xyz|top|click|icu|buzz|tk|ml|ga|cf|gq)\b/i;

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org',
  'sharklasers.com', 'trashmail.com', 'throwaway.email', 'maildrop.cc', 'getnada.com', 'fakeinbox.com',
  'dispostable.com', 'mailnesia.com', 'tempmailo.com', 'emailondeck.com', 'mohmal.com', 'moakt.com',
]);

// A US/Canada number: 10 digits after an optional leading 1, area code and
// exchange not starting 0/1. A "+" international number (8-15 digits) is
// accepted: relocation buyers call from abroad. The bot runs type 11 random
// digits with no "+" ("86327614758"). null = fine or no phone given.
function phoneProblem(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && !raw.startsWith('+1') && d.length >= 8 && d.length <= 15) return null;
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length !== 10) return 'phone is not a 10-digit US number';
  if (!/^[2-9]\d\d[2-9]\d{6}$/.test(d)) return 'phone has an impossible area code or exchange';
  if (/^(\d)\1{9}$/.test(d) || d === '1234567890' || /^\d{3}55501\d\d$/.test(d)) {
    return 'phone is a placeholder number';
  }
  return null;
}

// A name word that looks keyboard-random: 5+ letters with no vowel (y counts)
// or a run of 5+ consonants. Never a reason to drop; real names vary too much.
function randomName(name) {
  const words = String(name || '').normalize('NFD').replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  return words.some((w) => w.length >= 5 && (!/[aeiouy]/i.test(w) || /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w)));
}

// ---------------------------------------------------------------------------
// triage
// ---------------------------------------------------------------------------

// fields: { name, email, phone, message, text } where text is any other
// free-text the form collects (joined), checked with the message.
// opts:   { human: token, honeypot, nonEnglish: 'drop' | 'quiet', now }
// -> { action: 'drop' | 'quiet' | 'deliver', reason: string | null }
function triage(fields = {}, opts = {}) {
  const name = String(fields.name || '');
  const email = String(fields.email || '');
  const phone = String(fields.phone || '');
  const message = String(fields.message || '');
  const text = [message, fields.text || ''].join('\n').trim();
  const all = `${name}\n${text}`;
  const drop = (reason) => ({ action: 'drop', reason });
  const quiet = (reason) => ({ action: 'quiet', reason });

  if (opts.honeypot) return drop('honeypot field filled');
  if (HARD_WORDS.test(all)) return drop('adult/pharma/casino/crypto/SEO-seller terms');
  if (PRICE_TEMPLATE.test(message.trim())) return drop('"I wanted to know your price" bot template');
  const links = (text.match(LINK) || []).length;
  if (links >= 3) return drop(`${links} links`);
  if (SHORTENER.test(text) || BAD_TLD.test(text)) return drop('link shortener or spam-domain link');

  const lang = language(all);
  if (lang) {
    const why = lang === 'non-latin' ? 'not English (non-Latin script)' : 'not English';
    return opts.nonEnglish === 'quiet' ? quiet(why) : drop(why);
  }

  const human = humanProblem(opts.human, email, phone, opts.now);
  if (human) return quiet(human);

  const domain = email.toLowerCase().split('@')[1] || '';
  if (DISPOSABLE.has(domain)) return quiet('disposable email');
  const local = email.split('@')[0] || '';
  const segs = local.split('.');
  if (segs.length >= 5 && segs.filter((s) => s.length === 1).length >= 3) return quiet('bot email pattern');
  const ph = phoneProblem(phone);
  if (ph) return quiet(ph);
  const words = message.split(/\s+/).filter(Boolean);
  if (words.some((w) => /^[a-z]+$/i.test(w) && w.length >= 8 && !/[aeiouy]/i.test(w))) return quiet('random-letter words');
  if (message.length >= 12 && !/\s/.test(message)) return quiet('message has no spaces');
  if (words.length <= 2 && words.some((w) => w.length >= 12 && (w.match(/[a-z][A-Z]/g) || []).length >= 4)) return quiet('bot mixed case');
  if (randomName(name) && (message.match(/\p{L}{2,}/gu) || []).length < 4) return quiet('random-letter name, near-empty message');
  if (links === 2) return quiet('2 links');
  return { action: 'deliver', reason: null };
}

// What js/human-check.js does, for the offline tests (minting a token is not a
// secret: the check stops bots that never run JavaScript, not a determined human).
function mintHumanToken(email, phone, { ts = Date.now(), onPage = 8000 } = {}) {
  for (let n = 0; ; n += 1) {
    const digest = crypto.createHash('sha256').update(`v1|${ts}|${contactKey(email, phone)}|${n}`).digest();
    if (leadingZeroBits(digest) >= HUMAN_BITS) return `v1.${ts}.${n}.${onPage}`;
  }
}

module.exports = {
  triage, humanProblem, contactKey, language, phoneProblem, randomName, leadingZeroBits, mintHumanToken,
  HUMAN_BITS, HUMAN_MIN_ON_PAGE_MS,
};
