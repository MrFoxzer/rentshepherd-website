// Netlify publishes _site/, built by netlify/build-site.cjs from the repo
// checkout. This fails if an internal file (tools, function source,
// config/data files, compiled Python) would be published, or if a real page
// or asset would be left out.
//   node .claude/tests/private-paths.test.cjs
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const { isPublic, build } = require(path.join(ROOT, 'netlify/build-site.cjs'));

// Netlify builds from a clean clone, so what it sees is the tracked files.
const tracked = execFileSync('/usr/bin/git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);

// 1. Nothing internal is published.
const INTERNAL = (f) => f.split('/').some((p) => p.startsWith('.') || p === '__pycache__') ||
  /^(docs|scripts|tools|netlify|node_modules)\//i.test(f) ||
  /\.(md|mjs|cjs|py|pyc|sh|json|toml|csv|xlsx?|zip)$/i.test(f) || (!f.includes('/') && /\.js$/i.test(f));
const leaks = tracked.filter((f) => INTERNAL(f) && isPublic(f));
assert.deepStrictEqual(leaks, [], 'internal files that would be published:\n  ' + leaks.join('\n  '));
for (const f of ['tools/generate_locations.py', 'Tools/make_og.py', 'TOOLS/__pycache__/generate_locations.cpython-314.pyc',
  'js/__pycache__/x.pyc', 'netlify/functions/submission-created.js', 'Netlify/functions/_lib/lead-guard.js', 'netlify.toml',
  'NETLIFY.TOML', 'package.json', 'package-lock.json', 'README.md', 'CLAUDE.md', '.claude/tests/lead-guard.test.cjs',
  '.netlify/functions/submission-created.zip', 'leads/list.csv', 'a.js']) {
  assert.ok(!isPublic(f), f + ' would be published');
}

// 2. Every page and asset is still published.
const WEB = /\.(html?|css|js|jpe?g|png|gif|webp|avif|svg|ico|pdf|txt|xml|webmanifest|woff2?|ttf|otf|mp4|webm)$/i;
const dropped = tracked.filter((f) => !INTERNAL(f) && (WEB.test(f) || f === '_headers' || f === '_redirects') && !isPublic(f));
assert.deepStrictEqual(dropped, [], 'website files that would be left out:\n  ' + dropped.join('\n  '));
const kept = tracked.filter(isPublic);
assert.ok(kept.filter((f) => f.endsWith('.html')).length >= 80, 'too few pages would be published');
assert.ok(kept.some((f) => /^[0-9a-f]{32}\.txt$/.test(f)), 'IndexNow key file would be left out');

// 3. build() on a small tree: private dirs pruned in any letter case, files hard-linked, output not re-copied.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-site-'));
try {
  const put = (rel, body = rel) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), body); };
  ['index.html', 'js/main.js', 'locations/index.html', 'images/a.png', 'llms.txt', '0123456789abcdef0123456789abcdef.txt',
    'tools/x.py', 'Tools/y.html', 'tools/__pycache__/x.pyc', 'NETLIFY/functions/a.js', 'netlify.toml', '.claude/t.cjs',
    'package.json', 'a.js', 'css/__pycache__/z.css'].forEach((f) => put(f));
  put('_site/stale.html');
  const out = path.join(tmp, '_site');
  const got = build(tmp, out).sort();
  assert.deepStrictEqual(got, ['0123456789abcdef0123456789abcdef.txt', 'images/a.png', 'index.html', 'js/main.js', 'llms.txt', 'locations/index.html']);
  assert.ok(!fs.existsSync(path.join(out, 'stale.html')), 'old _site contents were kept');
  assert.strictEqual(fs.statSync(path.join(out, 'index.html')).ino, fs.statSync(path.join(tmp, 'index.html')).ino, 'not hard-linked');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// 4. netlify.toml publishes _site and keeps functions where Netlify bundles them.
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
assert.match(toml, /command\s*=\s*"node netlify\/build-site\.cjs"/, 'build command missing');
assert.match(toml, /publish\s*=\s*"_site"/, 'publish dir is not _site');
assert.match(toml, /directory\s*=\s*"netlify\/functions"/, 'functions dir moved');

console.log('ok: ' + tracked.length + ' tracked files, ' + kept.length + ' published, ' + (tracked.length - kept.length) + ' internal left out');
