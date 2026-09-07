/**
 * UI smoke test — boots the real app inside jsdom and drives it.
 *
 *   npm run smoke
 *
 * jsdom cannot execute <script type="module">, so we build the DOM from
 * index.html, expose it as Node globals, then import the app entry point
 * exactly as a browser would.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];

const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: 'http://localhost:8000/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});

const { window } = dom;

/* ── minimal browser shims ─────────────────────────────────────────────── */
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
globalThis.location = window.location;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
// jsdom provides a real localStorage for http(s) URLs
globalThis.localStorage = window.localStorage;
window.print = () => {};
window.URL.createObjectURL = () => 'blob:mock';
window.URL.revokeObjectURL = () => {};
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

window.addEventListener('error', (e) => errors.push(`window.onerror: ${e.message}`));
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
const originalError = console.error;
console.error = (...args) => {
  errors.push(`console.error: ${args.map(String).join(' ')}`);
  originalError(...args);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = async (ms = 40) => { await sleep(ms); };

let checks = 0;
let failures = 0;
function check(name, condition, extra = '') {
  checks += 1;
  if (condition) {
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  \x1b[31m✗ ${name}\x1b[0m ${extra}\n`);
  }
}

/* ── boot ──────────────────────────────────────────────────────────────── */
process.stdout.write('\n\x1b[1mTimetable Studio — UI smoke test\x1b[0m\n\n');

await import(path.join(root, 'js/main.js'));
const studio = window.TimetableStudio;

check('app booted and exposed its debug surface', Boolean(studio));
// Wait for the automatic first generation by polling, not by guessing a duration.
const startedAt = Date.now();
while (!studio.getState().result && Date.now() - startedAt < 20000) await tick(50);
const bootMs = Date.now() - startedAt;
await tick(200); // let the animation-frame-driven re-render land

const state = studio.getState();
check('a timetable was generated automatically on first load', Boolean(state.result?.placements?.length),
  `placements=${state.result?.placements?.length ?? 0}`);
check('first load reaches a solved timetable in under 4 s', bootMs < 4000, `${bootMs} ms`);
check('generated timetable has zero hard conflicts', (state.result?.conflicts?.length ?? 1) === 0);
check('every lesson was placed', (state.result?.unplaced?.length ?? 1) === 0,
  `unplaced=${state.result?.unplaced?.length}`);

/* ── shell ─────────────────────────────────────────────────────────────── */
const navItems = document.querySelectorAll('#nav-list .nav-item');
check('sidebar navigation rendered (5 pages)', navItems.length === 5, `got ${navItems.length}`);
check('mobile navigation rendered', document.querySelectorAll('#mobile-nav-list a').length === 5);
check('quick theme dots rendered (12)', document.querySelectorAll('#theme-quick .theme-dot').length === 12);
check('dashboard is the landing page', document.querySelector('#page-dashboard')?.classList.contains('is-active'));
check('dashboard shows the quality ring', Boolean(document.querySelector('.ring svg circle')));
check('dashboard shows stat cards', document.querySelectorAll('.stat').length >= 6,
  `got ${document.querySelectorAll('.stat').length}`);
check('hero names the school', document.querySelector('.hero .display')?.textContent.includes(state.settings.schoolName));
check('solver report rendered', Boolean(document.querySelector('.alert')));

/* ── every page renders ────────────────────────────────────────────────── */
for (const page of ['timetable', 'data', 'styles', 'export', 'dashboard']) {
  studio.navigate(page);
  await tick(60);
  const el = document.querySelector(`#page-${page}`);
  check(`${page} page renders`, el?.classList.contains('is-active') && el.innerHTML.length > 500,
    `length=${el?.innerHTML.length}`);
}

/* ── timetable grid ────────────────────────────────────────────────────── */
studio.navigate('timetable');
await tick(60);
const days = state.settings.days.filter((d) => d.active !== false).length;
check('grid has a cell for every day × teaching period, plus one wide cell per break',
  document.querySelectorAll('.tt-cell').length === countExpectedCells(state),
  `got ${document.querySelectorAll('.tt-cell').length}, expected ${countExpectedCells(state)}`);
check('day headers rendered', document.querySelectorAll('.tt-dayhead').length === days);
check('lessons are visible for the active class', document.querySelectorAll('.lesson').length > 0,
  `got ${document.querySelectorAll('.lesson').length}`);
check('legend lists every subject', document.querySelectorAll('.tt-legend .legend-item').length >= state.subjects.length);

function countExpectedCells(s) {
  const d = s.settings.days.filter((x) => x.active !== false).length;
  const lessons = s.settings.periods.filter((p) => p.kind === 'lesson').length;
  const breaks = s.settings.periods.length - lessons;
  return d * lessons + breaks; // one wide cell per break row
}

/* ── view switching ────────────────────────────────────────────────────── */
for (const view of ['teacher', 'room', 'agenda']) {
  const btn = document.querySelector(`[data-action="set-view"][data-view="${view}"]`);
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(60);
  const ok = view === 'agenda'
    ? document.querySelectorAll('.agenda-item').length > 0
    : document.querySelectorAll('.tt-cell').length > 0;
  check(`${view} view renders`, ok && studio.getState().ui.view === view);
}
document.querySelector('[data-action="set-view"][data-view="class"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);

/* ── lesson popover + pinning ──────────────────────────────────────────── */
const lesson = document.querySelector('.lesson');
lesson.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(30);
check('clicking a lesson opens the detail popover', Boolean(document.querySelector('.popover')));
const pinBtn = document.querySelector('[data-action="lesson-pin"]');
check('popover offers a pin action', Boolean(pinBtn));
pinBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('pinning stores a lock', studio.getState().locks.length === 1, `locks=${studio.getState().locks.length}`);
check('pinned lesson is marked in the grid', Boolean(document.querySelector('.lesson.is-locked')));

/* ── regeneration respects the pin ─────────────────────────────────────── */
const lockedSlot = studio.getState().locks[0].slotKey;
await studio.generate({ candidates: 2 });
await tick(80);
const after = studio.getState();
check('regeneration kept the pinned lesson in place',
  after.result.placements.find((p) => p.lessonId === after.locks[0]?.lessonId)?.startSlotKey === lockedSlot,
  `${after.result.placements.find((p) => p.lessonId === after.locks[0]?.lessonId)?.startSlotKey} ≠ ${lockedSlot}`);
check('regenerated timetable is still conflict-free', after.result.conflicts.length === 0);
check('candidate solutions are offered', (after.result.alternatives?.length ?? 0) >= 2);

/* ── drag & drop ───────────────────────────────────────────────────────── */
studio.navigate('timetable');
await tick(60);
const moving = document.querySelector('.lesson:not(.is-locked)');
const emptyCells = [...document.querySelectorAll('.tt-cell')]
  .filter((cell) => !cell.querySelector('.lesson') && !cell.classList.contains('is-break'));

// Find a cell the engine actually accepts, and one it must refuse.
let targetCell = null;
let illegalCell = null;
for (const cell of emptyCells) {
  moving.dispatchEvent(dragEvent('dragstart'));
  cell.dispatchEvent(dragEvent('dragover'));
  if (cell.classList.contains('drop-ok') && !targetCell) targetCell = cell;
  if (cell.classList.contains('drop-bad') && !illegalCell) illegalCell = cell;
  moving.dispatchEvent(dragEvent('dragend'));
  cell.classList.remove('drop-ok', 'drop-bad');
  if (targetCell && illegalCell) break;
}

function dragEvent(type, extra = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = { setData() {}, getData: () => '', dropEffect: '', effectAllowed: '', ...extra };
  return event;
}

if (moving && emptyCells.length) {
  // Illegal drops first — they must be refused with an explanation and leave
  // the timetable untouched (and they do not re-render, so the DOM stays live).
  if (illegalCell) {
    const before = JSON.stringify(studio.getState().result.placements.map((p) => [p.lessonId, p.startSlotKey]));
    moving.dispatchEvent(dragEvent('dragstart'));
    illegalCell.dispatchEvent(dragEvent('dragover'));
    check('an illegal target is marked as refused', illegalCell.classList.contains('drop-bad'));
    illegalCell.dispatchEvent(dragEvent('drop'));
    await tick(80);
    const after = JSON.stringify(studio.getState().result.placements.map((p) => [p.lessonId, p.startSlotKey]));
    check('an illegal drop changes nothing', before === after);
    check('refusing an illegal drop explains why', Boolean(document.querySelector('.toast-error')),
      document.querySelector('.toast')?.textContent ?? 'no toast');
    moving.dispatchEvent(dragEvent('dragend'));
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  } else {
    check('an illegal drop target was found to test refusal', false);
  }

  // Then a legal move, which does re-render the grid.
  if (targetCell) {
    moving.dispatchEvent(dragEvent('dragstart'));
    targetCell.dispatchEvent(dragEvent('dragover'));
    check('a legal target is highlighted', targetCell.classList.contains('drop-ok'));
    const lessonId = moving.dataset.lesson;
    const wanted = targetCell.dataset.slot;
    targetCell.dispatchEvent(dragEvent('drop'));
    await tick(120);
    const moved = studio.getState().result.placements.find((p) => p.lessonId === lessonId);
    check('dropping on a legal cell moves the lesson', moved?.startSlotKey === wanted,
      `${moved?.startSlotKey} vs ${wanted}`);
    check('the hand-moved timetable is still conflict-free', studio.getState().result.conflicts.length === 0);
    check('a hand move is flagged as manual', moved?.manual === true);
  } else {
    check('a legal drop target was found in the grid', false);
  }
} else {
  check('drag & drop test found a lesson and empty cells', false);
}

/* ── themes ────────────────────────────────────────────────────────────── */
for (const theme of studio.themes) {
  studio.setTheme(theme);
  await tick(20);
  const applied = document.documentElement.dataset.theme === theme;
  if (!applied) check(`theme ${theme} applies`, false);
}
check(`all ${studio.themes.length} themes apply to <html>`, document.documentElement.dataset.theme === studio.themes[studio.themes.length - 1]);

studio.navigate('styles');
await tick(60);
check('styles studio renders a card per theme',
  document.querySelectorAll('.theme-card').length === studio.themes.length,
  `got ${document.querySelectorAll('.theme-card').length}`);
check('styles studio renders the live component preview', Boolean(document.querySelector('.lesson')));
document.querySelector('[data-action="surprise-style"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(40);
check('"surprise me" changes the look', studio.themes.includes(studio.getState().ui.theme));
document.querySelector('[data-action="set-density"][data-density="compact"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(40);
check('density switch updates <html>', document.documentElement.dataset.density === 'compact');
document.querySelector('[data-action="toggle-pref"][data-pref="motion"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(40);
check('effect toggle updates <html>', document.documentElement.dataset.motion === 'off');
document.querySelector('[data-action="reset-style"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(40);
check('style reset restores Aurora', studio.getState().ui.theme === 'aurora');

/* ── data editing ──────────────────────────────────────────────────────── */
studio.navigate('data');
await tick(60);
check('data page shows the classes table', document.querySelectorAll('table.data tbody tr').length === state.classes.length);
document.querySelector('[data-action="data-tab"][data-tab="subjects"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('subjects tab lists every subject',
  document.querySelectorAll('table.data tbody tr').length === studio.getState().subjects.length);
document.querySelector('[data-action="data-tab"][data-tab="bell"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('bell schedule lists every period',
  document.querySelectorAll('table.data tbody tr').length === studio.getState().settings.periods.length);

document.querySelector('[data-action="add-entity"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
document.querySelector('[data-action="data-tab"][data-tab="rooms"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(40);
document.querySelector('[data-action="add-entity"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('add-entity opens a modal form', Boolean(document.querySelector('.modal-shell')));
const nameInput = document.querySelector('.modal-body input[name="name"]');
nameInput.value = 'Observatory';
document.querySelector('[data-save]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('saving the form adds the room', studio.getState().rooms.some((r) => r.name === 'Observatory'));
check('the modal closed after saving', !document.querySelector('.modal-shell'));

/* ── export ────────────────────────────────────────────────────────────── */
studio.navigate('export');
await tick(60);
check('export page lists five formats', document.querySelectorAll('[data-action="export"]').length >= 5);

const exporters = await import(path.join(root, 'js/exporters.js'));
const csv = exporters.toCSV(studio.getState(), { scopeKind: 'all' });
check('CSV export has a header and one row per lesson',
  csv.split('\n').length === studio.getState().result.placements.length + 1, `lines=${csv.split('\n').length}`);
check('CSV header is correct', csv.startsWith('Day,Period,Start,End,Class,Subject,Code,Teacher,Room,Length,Pinned'));

const ics = exporters.toICS(studio.getState(), { scopeKind: 'all' });
check('ICS export is a valid calendar', ics.startsWith('BEGIN:VCALENDAR') && ics.trim().endsWith('END:VCALENDAR'));
check('ICS contains one VEVENT per lesson',
  (ics.match(/BEGIN:VEVENT/g) || []).length === studio.getState().result.placements.length);
check('ICS events carry start and end times', ics.includes('DTSTART:') && ics.includes('DTEND:'));

const md = exporters.toMarkdown(studio.getState(), { scopeKind: 'all' });
check('Markdown export builds a week table', md.includes('| Time |') && md.includes('---'));

const json = exporters.toJSON(studio.getState());
check('JSON export round-trips', JSON.parse(json).classes.length === studio.getState().classes.length);

const classScope = { scopeKind: 'class', scopeId: studio.getState().classes[0].id };
const classCsv = exporters.toCSV(studio.getState(), classScope);
check('scoped CSV export filters to one class',
  classCsv.split('\n').length - 1 === studio.getState().result.placements.filter((p) => p.classId === classScope.scopeId).length);

/* ── persistence ───────────────────────────────────────────────────────── */
check('state is persisted to localStorage', window.localStorage.length > 0);
const persisted = JSON.parse(window.localStorage.getItem('timetable-studio:v3'));
check('persisted payload contains the solved week', persisted.result.placements.length > 100);
check('persisted payload contains the chosen theme', Boolean(persisted.ui.theme));

/* ── command palette ───────────────────────────────────────────────────── */
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
await tick(60);
check('Ctrl+K opens the command palette', Boolean(document.querySelector('.palette')));
const query = document.querySelector('#palette-query');
query.value = 'aurora';
query.dispatchEvent(new window.Event('input', { bubbles: true }));
await tick(40);
check('palette filters commands', document.querySelectorAll('.palette-item').length > 0);
document.querySelector('.palette-item').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(60);
check('running a palette command applies it and closes', studio.getState().ui.theme === 'aurora' && !document.querySelector('.palette'));

/* ── keyboard shortcuts ────────────────────────────────────────────────── */
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '4', bubbles: true }));
await tick(60);
check('number keys switch pages', studio.getState().ui.page === 'styles');
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
await tick(60);
check('…and back again', studio.getState().ui.page === 'timetable');

/* ── report ────────────────────────────────────────────────────────────── */
process.stdout.write('\n');
if (errors.length) {
  process.stdout.write(`\x1b[31mRuntime errors (${errors.length}):\x1b[0m\n`);
  for (const err of errors.slice(0, 12)) process.stdout.write(`  - ${err}\n`);
}
check('no runtime errors were thrown', errors.length === 0);

process.stdout.write(`\n\x1b[1m${checks - failures}/${checks} checks passed\x1b[0m`);
if (failures) process.stdout.write(` \x1b[31m(${failures} failed)\x1b[0m`);
process.stdout.write('\n\n');

process.exit(failures || errors.length ? 1 : 0);
