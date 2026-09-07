/**
 * Design-system audit — static analysis of the CSS + markup, no browser needed.
 *
 *   npm run audit
 *
 * Catches the class of bug that is invisible to unit tests but obvious on
 * screen: unbalanced braces, a token used but never defined, a theme that
 * forgets half the palette, a class name in a template that no stylesheet
 * ever styles, or dead CSS.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cssFiles = fs.readdirSync(path.join(root, 'styles')).filter((f) => f.endsWith('.css'));
const jsFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) jsFiles.push(full);
  }
})(path.join(root, 'js'));
jsFiles.push(path.join(root, 'index.html'));

const cssRaw = new Map(cssFiles.map((f) => [f, fs.readFileSync(path.join(root, 'styles', f), 'utf8')]));
const css = new Map([...cssRaw].map(([f, t]) => [f, t.replace(/\/\*[\s\S]*?\*\//g, '')]));
const markup = jsFiles.map((f) => [path.relative(root, f), fs.readFileSync(f, 'utf8')]);
const allCss = [...css.values()].join('\n');

let checks = 0;
let failures = 0;
const problems = [];

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  else {
    failures += 1;
    process.stdout.write(`  \x1b[31m✗ ${name}\x1b[0m ${detail}\n`);
    problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

process.stdout.write('\n\x1b[1mTimetable Studio — design-system audit\x1b[0m\n\n');

/* ── 1. every stylesheet parses ─────────────────────────────────────────── */
for (const [file, text] of css) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (stripped.match(/{/g) || []).length;
  const close = (stripped.match(/}/g) || []).length;
  const parens = (stripped.match(/\(/g) || []).length - (stripped.match(/\)/g) || []).length;
  check(`${file}: balanced braces`, open === close, `(${open} { vs ${close} })`);
  check(`${file}: balanced parentheses`, parens === 0, `(off by ${parens})`);
  check(`${file}: no empty rule bodies`, !/[a-z)\s]\s*{\s*}/.test(stripped.replace(/@media[^{]*{/, '')));
  check(`${file}: no double semicolons`, !/;;/.test(stripped));
}

/* ── 2. every custom property used is defined somewhere ─────────────────── */
const defined = new Set();
for (const match of allCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(match[1].toLowerCase());
// properties set from JavaScript
for (const [, text] of markup) {
  for (const match of text.matchAll(/setProperty\(\s*'(--[a-z0-9-]+)'/gi)) defined.add(match[1].toLowerCase());
  for (const match of text.matchAll(/style="[^"]*?(--[a-z0-9-]+)\s*:/gi)) defined.add(match[1].toLowerCase());
}

const used = new Set();
for (const match of allCss.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) used.add(match[1].toLowerCase());
for (const [, text] of markup) {
  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) used.add(match[1].toLowerCase());
}

const undefinedVars = [...used].filter((v) => !defined.has(v));
check('every var(--token) used in CSS/JS is defined', undefinedVars.length === 0, undefinedVars.join(', '));

/* ── 3. every theme defines the full palette ────────────────────────────── */
const themesCss = css.get('themes.css');
const themeIds = [...themesCss.matchAll(/\[data-theme="([a-z0-9-]+)"\]/g)].map((m) => m[1]);
const uniqueThemes = [...new Set(themeIds)];
check('twelve themes are declared', uniqueThemes.length === 12, `got ${uniqueThemes.length}: ${uniqueThemes.join(', ')}`);

const REQUIRED_TOKENS = [
  '--bg', '--panel', '--panel-solid', '--text', '--muted', '--faint', '--line',
  '--accent-h', '--accent-s', '--accent-l', '--accent-2-h', '--accent-ink',
  '--subj-s', '--subj-l', '--subj-text-l', '--subj-border-l', '--subj-chip-l',
];

for (const theme of uniqueThemes) {
  const block = themesCss.match(new RegExp(`\\[data-theme="${theme}"\\][^{]*{([\\s\\S]*?)\\n}`));
  const body = block ? block[1] : '';
  const missing = REQUIRED_TOKENS.filter((token) => !body.includes(`${token}:`));
  check(`theme "${theme}" defines the full palette`, missing.length === 0, `missing ${missing.join(', ')}`);
  check(`theme "${theme}" declares a colour-scheme`, body.includes('color-scheme:'));
}

/* every theme id in CSS exists in the JS registry (and vice versa) */
const registry = fs.readFileSync(path.join(root, 'js/themes.js'), 'utf8');
const registryIds = [...registry.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
const missingInCss = registryIds.filter((id) => !uniqueThemes.includes(id) && !['compact', 'cosy', 'roomy', 'auto', 'grotesk', 'humanist', 'serif', 'mono'].includes(id));
check('every registered theme has CSS', missingInCss.length === 0, missingInCss.join(', '));
const missingInJs = uniqueThemes.filter((id) => !registryIds.includes(id));
check('every CSS theme is registered in JS', missingInJs.length === 0, missingInJs.join(', '));

/* ── 4. class-name coverage between markup and CSS ─────────────────────── */
// Ignore the payload of url(...) — data URIs contain dots (www.w3.org) that
// are not class selectors.
const cssForClasses = allCss.replace(/url\([^)]*\)/g, 'url()');
const cssClasses = new Set();
for (const match of cssForClasses.matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g)) cssClasses.add(match[1]);

// Class names the markup builds at runtime, e.g. class="alert alert-${sev}".
// Anything whose prefix appears here counts as used.
const dynamicPrefixes = new Set();
for (const [, text] of markup) {
  for (const match of text.matchAll(/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\$\{/g)) dynamicPrefixes.add(`${match[1]}-`);
}

const usedClasses = new Set();
for (const [, text] of markup) {
  // class="…" and classList.add/remove/toggle('…')
  for (const match of text.matchAll(/class="([^"$]*)"/g)) {
    for (const name of match[1].split(/\s+/)) if (name) usedClasses.add(name);
  }
  for (const match of text.matchAll(/class="([^"]*)\$\{/g)) void match;
  for (const match of text.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
    for (const name of match[1].matchAll(/'([a-zA-Z0-9_-]+)'/g)) usedClasses.add(name[1]);
  }
  for (const match of text.matchAll(/className\s*=\s*[`']([^`'$]*)[`']/g)) {
    for (const name of match[1].split(/\s+/)) if (name) usedClasses.add(name);
  }
}

const markupText = markup.map(([, t]) => t).join('\n');
const BOUNDARY = new Set([" ", "\n", "\t", "\r", '"', "'", "`", "<", ">", "=", "/", "(", ")"]);

/** True when `name` occurs in the markup as a whole word, delimited properly. */
function appearsInMarkup(name) {
  let from = 0;
  for (;;) {
    const at = markupText.indexOf(name, from);
    if (at < 0) return false;
    const before = at === 0 ? " " : markupText[at - 1];
    const after = markupText[at + name.length] ?? " ";
    if (BOUNDARY.has(before) && BOUNDARY.has(after)) return true;
    from = at + 1;
  }
}

const unstyled = [...usedClasses].filter((c) => !cssClasses.has(c) && !appearsInMarkup(c)).sort();
check('every class used in markup is styled somewhere', unstyled.length === 0, `unstyled: ${unstyled.join(', ')}`);

const dead = [...cssClasses]
  .filter((c) => !usedClasses.has(c) && !appearsInMarkup(c))
  .filter((c) => ![...dynamicPrefixes].some((prefix) => c.startsWith(prefix)))
  .sort();
check('no dead CSS classes', dead.length === 0, `${dead.length} unused: ${dead.join(', ')}`);

/* ── 5. every icon referenced by <use href="#i-…"> exists in the sprite ── */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const symbols = new Set([...html.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map((m) => m[1]));
const referenced = new Set();
const quotedStrings = new Set();
for (const [, text] of markup) {
  for (const match of text.matchAll(/#i-([a-z0-9-]+)/g)) referenced.add(match[1]);
  for (const match of text.matchAll(/icon\('([a-z0-9-]+)'/g)) referenced.add(match[1]);
  for (const match of text.matchAll(/icon:\s*'([a-z0-9-]+)'/g)) referenced.add(match[1]);
  for (const match of text.matchAll(/['"`]([a-z][a-z0-9-]*)['"`]/g)) quotedStrings.add(match[1]);
}
const missingIcons = [...referenced].filter((i) => !symbols.has(i)).sort();
check('every referenced icon exists in the sprite', missingIcons.length === 0, missingIcons.join(', '));
const unusedIcons = [...symbols].filter((i) => !referenced.has(i) && !quotedStrings.has(i)).sort();
check('sprite has no unused icons', unusedIcons.length === 0, unusedIcons.join(', '));

/* ── 6. accessibility + responsive basics ──────────────────────────────── */
check('every stylesheet is linked from index.html',
  cssFiles.every((f) => html.includes(`styles/${f}`)),
  cssFiles.filter((f) => !html.includes(`styles/${f}`)).join(', '));
check('page has a lang attribute', /<html[^>]*\slang="/.test(html));
check('page has a viewport meta', /name="viewport"/.test(html));
check('page has a description meta', /name="description"/.test(html));
check('page has an icon', /rel="icon"/.test(html));
check('decorative layers are hidden from screen readers', /class="ambient" aria-hidden="true"/.test(html) && /class="grain" aria-hidden="true"/.test(html));
check('live region for toasts', /id="toasts"[^>]*aria-live="polite"/.test(html));
check('primary landmark navigation is labelled', /aria-label="Primary"/.test(html) && /aria-label="Mobile"/.test(html));
check('reduced-motion is respected', allCss.includes('prefers-reduced-motion'));
check('print stylesheet has an @page rule', css.get('print.css').includes('@page'));
check('at least three responsive breakpoints', (allCss.match(/@media \(max-width/g) || []).length >= 3);
check('focus-visible styling is defined', allCss.includes(':focus-visible'));

/* ── 7. no external network dependencies ───────────────────────────────── */
const cssNoDataUri = allCss.replace(/url\(\s*["']?data:[^)]*\)/g, 'url(data:)');
const external = [...cssNoDataUri.matchAll(/url\((?!["']?data:)([^)]+)\)/g)].map((m) => m[1]);
const remoteScripts = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
check('CSS has no external url() dependencies', external.length === 0, external.join(', '));
check('HTML has no external scripts or stylesheets', remoteScripts.length === 0, remoteScripts.join(', '));

process.stdout.write('\n');
if (failures) {
  process.stdout.write(`\x1b[31m${failures} problem(s):\x1b[0m\n`);
  for (const p of problems) process.stdout.write(`  - ${p}\n`);
}
process.stdout.write(`\n\x1b[1m${checks - failures}/${checks} audit checks passed\x1b[0m\n\n`);
process.exit(failures ? 1 : 0);
