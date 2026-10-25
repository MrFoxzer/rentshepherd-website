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
//    Submit, the page spends a few ms finding a nonce so that
//      sha256("v1|<ts>|<contact>|<nonce>")
//    starts with HUMAN_BITS zero bits, where <contact> is contactKey() of the
//    email + phone being sent. It posts "v1.<ts>.<nonce>.<msOnPage>" as `human`.
//    Form-spam bots post the HTML form without running JavaScript, so they
//    never have a token; a token cannot be reused for another email or phone.
//    No puzzle, no checkbox, no third-party account or key.
// 2. triage() sorts every post into
//      'drop'    certain spam: nothing is sent or pushed (the sender still gets
//                a normal "thanks", so a bot learns nothing)
//      'quiet'   doubtful: no phone push, SMS or auto-reply; the email (tagged)
//                and the ledger still get it, so a real lead is never lost
//      'deliver' everything else, exactly as before
//
// THE RULE (v2, after a 10-agent review found real bookings dropped for "time
// slot", "RV hookup", "casino night", "same-sex couple"): a post that passes
// the human check is never DROPPED over wording a real customer could write.
// Content signals drop only a post with no valid token (a bot); with a token
// they make it quiet at most. The only things that drop a verified post are
// the honeypot, unambiguous adult/drug spam, and (where the caller asks for
// it) a message that is not written in English.
//
// Non-English: 'drop' everywhere except where a caller passes
// { nonEnglish: 'quiet' }. Home Match does, because a real estate broker must
// not turn away an inquiry over the language it is written in (Fair Housing:
// national origin); so should any job-application form (Minnesota Human
// Rights Act). Only the message is judged, never the name.

const crypto = require('crypto');

const HUMAN_BITS = 12;                              // ~4,096 hashes: a few ms
const HUMAN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // visitors' clocks are wrong more often than you think
const HUMAN_MAX_SKEW_MS = 7 * 24 * 60 * 60 * 1000;
const HUMAN_MIN_ON_PAGE_MS = 800;                   // autofill + click is fast; a bot's post is instant

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

// Fold look-alike tricks before any content rule: compatibility forms
// (fullwidth letters, ligatures) and invisible characters.
function normalize(s) {
  return String(s || '').normalize('NFKC').replace(/[​-‏⁠-⁤﻿­]/g, '');
}

// ---------------------------------------------------------------------------
// Language (message text only, never the name)
// ---------------------------------------------------------------------------

// Any letter that is not Latin script: Cyrillic, CJK, Arabic, Indic, Thai, ...
const NON_LATIN = /[^\P{L}\p{Script=Latin}]/gu;

// Distinctive words of the languages these runs use. Words that are also
// English, US abbreviations or common names are left out on purpose (pour, est,
// IL, UW, des, les, los, las, del, con, para, kong, chao, xin, vos, wilde, ...).
const FOREIGN = new Set((
  // es / pt
  'hola quería queria quiero saber precio precios cuánto cuanto usted ustedes gracias señor buenos buenas ' +
  'por una pero también tambien está estoy qué cuál favor ' +
  'olá você voce preço preco seu sua não nao obrigado gostaria ' +
  // fr
  'bonjour je voulais vouloir connaître connaitre votre prix vous avec merci bonsoir combien ' +
  // it
  'ciao volevo sapere tuo tua prezzo sono che della grazie quanto ' +
  // de / nl / lb
  'hallo ich wollte ihren ihre preis wissen und der das nicht ist bitte danke guten wie viel ' +
  'hoi ik uw prijs weten het een niet graag ech wollt äre präis wëssen ' +
  // pl / cs / sk / sl / hr / sr / bs
  'cześć czesc chciałem chcialem poznać poznac twoją twoja cenę jest nie się dzień ' +
  'ahoj chtěl chtel jsem znát vaši vasi cenu chcel poznať vašu ' +
  'živjo zivjo želel zelel izvedeti vašo ceno zdravo htio htjela znati cijenu želim ' +
  // ro / hu / sq
  'bună buna ți vrut să aflu prețul pretul și ' +
  'szia szeretném szeretnem akartam árát arat és kérdezni ' +
  'përshëndetje pershendetje doja të çmimin cmimin tuaj ' +
  // lt / lv / et / fi
  'sveiki norėjau norejau sužinoti suzinoti jūsų jusu kainą kaina ' +
  'labdien gribēju gribeju uzzināt uzzinat jūsu ' +
  'tere tahtsin teada teie hinda hei halusin tietää tietaa hintasi ' +
  // da / no / sv / is / af
  'hej jeg ønskede onskede kende vite jag veta ditt hinta ég vildi verð þitt wou prys weet ' +
  // ga / cy / mt / eo / eu
  'duit theastaigh uaim phraghas fháil fhail roeddwn eisiau gwybod eich bonġu ridt inkun tiegħek ' +
  'saluton volis scii vian prezon kaixo zure prezioa jakin nahi nuen ' +
  // tr / az / uz / id / ms / jv / vi / tl
  'merhaba fiyatınızı fiyatinizi öğrenmek ogrenmek istedim qiymətinizi bilmək istədim ' +
  'sizning narxingizni bilmoqchi edim saya ingin tahu harga anda terima kasih pengin ngerti regane sampeyan ' +
  'chào tôi muốn biết giá của bạn kumusta malaman presyo ' +
  // sw / so / ha / zu / ht / mg / mi
  'nilitaka kujua waxaan rabay inaan ogaado qiimahaaga sannu farashin sawubona bengifuna ukwazi intengo yakho ' +
  'bonjou mwen konnen hahafantatra vidinao hiahia ahau mohio'
).split(/\s+/));

const ENGLISH = new Set((
  'i im i\'m you your the a an to and of in on for is are am my me we our us it its this that these those ' +
  'with have has had would like want wanted know can could please home homes house houses price prices ' +
  'looking interested thanks thank hi hello hey what when where how about at be do does if not will ' +
  'just sell selling buy buying call text there here from see showing listing property lake land ' +
  'need get got was were been any some more much many time today tomorrow week yes no also so but or ' +
  'party rental bounce tent tables chairs quote estimate kitchen bath bathroom basement garage roof deck ' +
  'website site help business saturday sunday friday monday june july august may'
).split(/\s+/));

// 'non-latin' | 'foreign' | null
function language(text) {
  const t = normalize(text);
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
  return (foreign >= 3 && foreign >= 2 * english) ? 'foreign' : null;
}

// ---------------------------------------------------------------------------
// Spam signals
// ---------------------------------------------------------------------------

// Drops even a verified post: only words no customer of these businesses
// writes. Message text only (Thai given names start "Porn"; surnames include
// Gamble, Casino, Slot, Sexton).
const ADULT_DRUGS = /\b(porn|porno|pornhub|xvideos|onlyfans|camgirls?|hot singles|sex dating|adult dating|nude (pics|photos|girls|videos)|sexy (girls|women|singles|ladies)|escort (service|services|girls|agency)|erotic massage|viagra|cialis|levitra|kamagra|sildenafil|tadalafil|xanax|oxycodone|tramadol|without (a )?prescription|no prescription needed)\b/i;

// "Hi, I wanted to know your price." (the run's English template) and the
// same run's "I am writing about your prices". A terse real customer can type
// these, so they are a signal, not a verdict.
const PRICE_TEMPLATE = /^\W*(hi|hello|hey|greetings)?\W*i\s+(wanted|want)\s+to\s+know\s+your\s+prices?\W*$/i;
const PRICE_WRITING = /\bi\s+(am\s+)?(writ(e|ing)|wrote)\s+(about|regarding)\s+(your\s+)?(the\s+)?prices?\b/i;

// B2B pitches and scams. Multi-word phrases with no natural reading in a lead
// for a broker, party rental or remodeler; a verified post that matches is
// quiet, so Style Marking's real "we need SEO services" lead still reaches
// the inbox.
const PITCH = /\b(seo services?|search engine optimi[sz]ation services?|first page of google|rank (your|ur) (site|website|business)|backlinks?|guest post(s|ing)?(?!-)|web(site)? traffic|merchant cash advance|employee retention (tax )?credit|ertc|same[- ]day funding|revenue[- ]based financing|crypto(currency)? recovery|recover (your )?(lost|stolen|scammed) (crypto|bitcoin|funds)|online casino|casino bonus|free spins|betting tips|forex (signals|trading signals)|copyright infringement|dmca|contact form (advertising|marketing|blast\w*)|contact forms of websites|i (visited|came across|was checking out) your website|(commercial|cooperation) offer|partnership proposal)\b/i;

// One URL counts once (https://www.zillow.com/... is one link, not two).
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()[\]]+/gi;
const DISGUISED = /\bhxxps?:\/\/|\[\.\]|\(\.\)|\[dot\]|\bwa\s+me\//i;
const SHORT_HOSTS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 't.me',
  'telegra.ph', 'wa.me', 'ow.ly', 'shorturl.at']);
const SPAM_TLD = /\.(ru|su|cn|xyz|top|click|icu|buzz|tk|ml|ga|cf|gq|rest|cyou|sbs)$/;

function urlHost(u) {
  const m = /^(?:https?:\/\/)?([^/?#:]+)/i.exec(u);
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

// A shortener (except Google Maps / Photos share links, the default way people
// send a location or photos: maps.app.goo.gl, photos.app.goo.gl, goo.gl/maps)
// or a spam-only top-level domain, judged on real URL hosts only.
function badLink(urls, text) {
  if (DISGUISED.test(text)) return 'disguised link';
  for (const u of urls) {
    const host = urlHost(u);
    if (host === 'goo.gl' && /goo\.gl\/maps\//i.test(u)) continue;
    if (SHORT_HOSTS.has(host)) return 'link shortener';
    if (SPAM_TLD.test(host)) return 'spam-domain link';
  }
  return null;
}

// A word mixing Latin with Cyrillic/Greek letters: "cаsino" with a Cyrillic а.
const MIXED_SCRIPT = /(?=\p{L}*\p{Script=Latin})(?=\p{L}*[\p{Script=Cyrillic}\p{Script=Greek}])\p{L}{3,}/u;

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org',
  'sharklasers.com', 'trashmail.com', 'throwaway.email', 'maildrop.cc', 'getnada.com', 'fakeinbox.com',
  'dispostable.com', 'mailnesia.com', 'tempmailo.com', 'emailondeck.com', 'mohmal.com', 'moakt.com',
]);

// Only numbers no real person has. Extensions, 7-digit local numbers, two
// numbers in one field and international numbers (with or without "+") pass.
// null = fine or no phone given.
function phoneProblem(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const d = raw.replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, '').replace(/\D/g, '');
  if (d.length < 7) return 'phone has fewer than 7 digits';
  if (/^(\d)\1+$/.test(d) || d === '1234567890' || d === '0123456789') return 'phone is a placeholder number';
  const nanp = d.length === 10 ? d : (d.length === 11 && d[0] === '1' ? d.slice(1) : null);
  const plusOther = raw.startsWith('+') && !raw.startsWith('+1');
  if (nanp && !plusOther) {
    if (!/^[2-9]\d\d[2-9]\d{6}$/.test(nanp)) return 'phone has an impossible area code or exchange';
    if (/^\d{3}55501\d\d$/.test(nanp)) return 'phone is a fictional 555-01xx number';
  }
  return null;
}

// A name word that looks keyboard-random: 5+ letters with no vowel (y counts),
// or 6+ consonants in a row with "h" breaking the run (so Lindstrom,
// Kirchschlager, Hirschberg, Mkrtchyan are fine and "Yrcvvbb" is not). Latin
// letters only: Олександр or Αλέξανδρος has no Latin vowel and is not random.
function randomName(name) {
  const words = normalize(name).normalize('NFD').replace(/[^\p{L}\s]/gu, '').split(/\s+/)
    .filter((w) => w && /^\p{Script=Latin}+$/u.test(w));
  return words.some((w) => w.length >= 5 && (!/[aeiouy]/i.test(w) || /[bcdfgjklmnpqrstvwxz]{6,}/i.test(w)));
}

// ---------------------------------------------------------------------------
// triage
// ---------------------------------------------------------------------------

// fields: { name, email, phone, message, text } where text is any other
// free-text the form collects (joined), judged with the message.
// opts:   { human: token, honeypot, nonEnglish: 'drop' | 'quiet', now }
// -> { action: 'drop' | 'quiet' | 'deliver', reason: string | null }
function triage(fields = {}, opts = {}) {
  const name = normalize(fields.name);
  const email = String(fields.email || '');
  const phone = String(fields.phone || '');
  const message = normalize(fields.message);
  const body = [message, normalize(fields.text)].join('\n').trim();
  const drop = (reason) => ({ action: 'drop', reason });
  const quiet = (reason) => ({ action: 'quiet', reason });

  if (opts.honeypot) return drop('honeypot field filled');
  if (ADULT_DRUGS.test(body)) return drop('adult or drug spam');

  const tokenProblem = humanProblem(opts.human, email, phone, opts.now);
  const lang = language(body);
  const notEnglish = lang === 'non-latin' ? 'not English (non-Latin script)' : (lang ? 'not English' : null);

  // Content signals: certain from a bot, only doubtful from a verified human.
  const urls = body.match(URL_RE) || [];
  const signal = (() => {
    if (PRICE_TEMPLATE.test(message.trim()) || PRICE_WRITING.test(body)) return '"I wanted to know your price" bot template';
    const pitch = PITCH.exec(body);
    if (pitch) return `sales pitch or scam wording ("${pitch[0].toLowerCase()}")`;
    const bad = badLink(urls, body);
    if (bad) return bad;
    if (urls.length >= 3) return `${urls.length} links`;
    if (MIXED_SCRIPT.test(body) || MIXED_SCRIPT.test(name)) return 'look-alike letters from another alphabet';
    if (/https?:\/\/|www\.|\.(com|net|ru|xyz)\b/i.test(name)) return 'link in the name field';
    return null;
  })();

  // Weak signs: never a drop on their own.
  const weak = (() => {
    const domain = email.toLowerCase().split('@')[1] || '';
    if (DISPOSABLE.has(domain)) return 'disposable email';
    const segs = (email.split('@')[0] || '').split('.');
    if (segs.filter((s) => /^[a-z]$/i.test(s)).length >= 4) return 'bot email pattern';   // y.i.h.o.d.u452@ (m.j.k.lindstrom.2@ is fine)
    const ph = phoneProblem(phone);
    if (ph) return ph;
    const words = message.split(/\s+/).filter(Boolean);
    if (words.some((w) => /^[a-z]+$/i.test(w) && w.length >= 8 && !/[aeiouy]/i.test(w))) return 'random-letter words';
    if (words.length === 1 && /^[a-z]{12,}$/i.test(words[0]) && (words[0].match(/[a-z][A-Z]/g) || []).length >= 3) {
      return 'random-letter message';
    }
    if (randomName(name) && (message.match(/\p{L}{2,}/gu) || []).length < 4) return 'random-letter name, near-empty message';
    return null;
  })();

  if (tokenProblem) {
    // No valid token: nearly always a bot. Any spam sign drops it; a bare
    // post (a real visitor with JavaScript off) stays reviewable.
    if (signal) return drop(`${signal}; ${tokenProblem}`);
    if (notEnglish) {
      if (opts.nonEnglish !== 'quiet' || weak) return drop(`${notEnglish}; ${tokenProblem}`);
      return quiet(`${notEnglish}; ${tokenProblem}`);
    }
    return quiet(weak ? `${weak}; ${tokenProblem}` : tokenProblem);
  }
  if (notEnglish) return opts.nonEnglish === 'quiet' ? quiet(notEnglish) : drop(notEnglish);
  if (signal) return quiet(signal);
  if (weak) return quiet(weak);
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
  triage, humanProblem, contactKey, language, phoneProblem, randomName, leadingZeroBits, mintHumanToken, normalize,
  HUMAN_BITS, HUMAN_MIN_ON_PAGE_MS,
};
