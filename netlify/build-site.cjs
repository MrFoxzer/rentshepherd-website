// Builds _site/, the folder Netlify publishes (see netlify.toml), from the repo
// checkout: every website file, hard-linked, and none of the internal ones.
//
// Why: the site used to publish the repo root, so tools/ (the page generators),
// netlify.toml and the function source (netlify/functions/*.js, including the
// lead guard) were public URLs. The /netlify/* 404! rule did not close that:
// Netlify serves file paths case-insensitively but matches redirect rules
// case-sensitively, so /Netlify/functions/... and /Tools/... still returned the
// files (found 2026-10-25). A file that is not deployed can't leak. Functions
// are bundled separately from netlify/functions and never need to be in _site.
//
//   node netlify/build-site.cjs                 (what Netlify runs)
//   node netlify/build-site.cjs <src> <out>     (local check against an export)
'use strict';
const fs = require('fs');
const path = require('path');

// Top-level folders that are never part of the website (matched case-insensitively).
const PRIVATE_DIRS = new Set(['netlify', 'tools', 'docs', 'scripts', 'node_modules', 'outreach', 'leads', '_site']);
// Folders that are never part of the website at any depth.
const PRIVATE_ANY_DIRS = new Set(['__pycache__']);
// File types that are never pages or assets here: notes, scripts, data, config.
const PRIVATE_EXT = /\.(md|markdown|mjs|cjs|py|pyc|sh|csv|tsv|xlsx?|json|toml|ya?ml|env|log|bak|sql|sqlite|db|zip)$/i;

// rel: path relative to the repo root, with / separators.
function isPublic(rel) {
  const parts = rel.split('/');
  if (parts.some((p) => p.startsWith('.'))) return false; // .claude/, .git/, .netlify/, .gitignore ...
  if (parts.length > 1 && PRIVATE_DIRS.has(parts[0].toLowerCase())) return false;
  if (parts.slice(0, -1).some((p) => PRIVATE_ANY_DIRS.has(p.toLowerCase()))) return false;
  if (PRIVATE_EXT.test(rel)) return false;
  // Site scripts live in js/. A .js at the root would be a tool, never a page asset.
  if (parts.length === 1 && /\.js$/i.test(rel)) return false;
  return true;
}

function build(src, out) {
  src = path.resolve(src);
  out = path.resolve(out);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const published = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (abs === out) continue;
      const rel = path.relative(src, abs).split(path.sep).join('/');
      if (ent.isDirectory()) {
        const low = ent.name.toLowerCase();
        if (ent.name.startsWith('.') || PRIVATE_ANY_DIRS.has(low) || (dir === src && PRIVATE_DIRS.has(low))) continue;
        walk(abs);
        continue;
      }
      if (!ent.isFile() || !isPublic(rel)) continue; // symlinks, sockets: skipped
      const dest = path.join(out, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try { fs.linkSync(abs, dest); } catch (e) { fs.copyFileSync(abs, dest); }
      published.push(rel);
    }
  })(src);
  return published;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const src = process.argv[2] || root;
  const out = process.argv[3] || path.join(src, '_site');
  const published = build(src, out);
  // Fail the build (Netlify then keeps the live deploy) rather than publish a broken site.
  for (const must of ['index.html', '404.html', 'thank-you.html', 'privacy.html', 'terms.html', 'css/style.css',
    'js/main.js', 'js/human-check.js', 'robots.txt', 'sitemap.xml', 'llms.txt', 'images/og-default.png', 'locations/index.html', 'blog/index.html']) {
    if (!fs.existsSync(path.join(out, must))) { console.error('build-site: missing ' + must); process.exit(1); }
  }
  // The IndexNow key file (<32 hex>.txt at the root) must stay public.
  if (!published.some((f) => /^[0-9a-f]{32}\.txt$/.test(f))) { console.error('build-site: missing the IndexNow key file'); process.exit(1); }
  const pages = published.filter((f) => /\.html$/i.test(f)).length;
  if (pages < 80) { console.error('build-site: only ' + pages + ' pages, refusing to publish'); process.exit(1); }
  const bad = published.filter((f) => !isPublic(f));
  if (bad.length) { console.error('build-site: internal files in output: ' + bad.join(', ')); process.exit(1); }
  console.log('build-site: published ' + published.length + ' files (' + pages + ' pages) to ' + path.relative(process.cwd(), out));
}

module.exports = { isPublic, build, PRIVATE_DIRS, PRIVATE_EXT };
