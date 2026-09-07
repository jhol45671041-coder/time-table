/**
 * Timetable Studio — application bootstrap.
 * Wiring: store → views → delegated events → router → shortcuts → palette.
 */
import {
  getState, subscribe, setPrefs, generate, resetDemo, loadRandomSchool,
  importData, exportData, clearLocks, chooseAlternative, currentModel,
} from './state.js';
import { mountDelegation, on, $, $$, esc, icon, download } from './ui/dom.js';
import { applyPrefs, renderNav, setPage, NAV } from './ui/shell.js';
import { toast, toastOk, toastWarn, toastError } from './ui/toast.js';
import { openModal, confirmDialog, isModalOpen } from './ui/modal.js';
import { openPalette, registerCommands, isPaletteOpen } from './ui/palette.js';
import { THEMES, DENSITIES, FONTS, randomStyle } from './themes.js';
import { exportAs, copyAs, toICS } from './exporters.js';

import * as dashboard from './views/dashboard.js';
import * as timetable from './views/timetable.js';
import * as dataView from './views/data.js';
import * as styles from './views/styles.js';
import * as exportView from './views/export.js';

const VIEWS = {
  dashboard: dashboard.render,
  timetable: timetable.render,
  data: dataView.render,
  styles: styles.render,
  export: exportView.render,
};

let generating = false;
let renderQueued = false;

/* ───────────────────────────────── render ─────────────────────────────── */

function render(detail = {}) {
  const state = getState();
  applyPrefs(state.ui);
  renderNav(state);

  const page = VIEWS[state.ui.page] ? state.ui.page : 'dashboard';
  const target = $(`#page-${page}`);
  if (!target) return;

  // Keep the grid's scroll position across re-renders (drag & drop, pins…).
  const scroller = $('.tt-wrap', target);
  const scroll = scroller ? { top: scroller.scrollTop, left: scroller.scrollLeft } : null;

  const html = VIEWS[page](state);
  if (target.innerHTML !== html) target.innerHTML = html;

  if (scroll) {
    const next = $('.tt-wrap', target);
    if (next) {
      next.scrollTop = scroll.top;
      next.scrollLeft = scroll.left;
    }
  }

  setPage(page, state);
  void detail;
}

function queueRender(detail) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render(detail);
  });
}

/* ───────────────────────────────── router ─────────────────────────────── */

function pageFromHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.id === hash) ? hash : null;
}

function navigate(page) {
  if (!VIEWS[page]) return;
  if (location.hash !== `#/${page}`) location.hash = `#/${page}`;
  setPrefs({ page });
}

/* ─────────────────────────────── generation ───────────────────────────── */

/**
 * Print is for the timetable sheet: hop to the timetable page first so the
 * print stylesheet always has the grid to work with, whatever the user was
 * looking at.
 */
async function printTimetable() {
  if (getState().ui.page !== 'timetable') {
    navigate('timetable');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 120));
  }
  window.print();
}

async function runGenerate({ silent = false, candidates = 3 } = {}) {
  if (generating) return;
  generating = true;
  const btn = $('#btn-generate');
  btn?.classList.add('is-busy');
  btn?.setAttribute('disabled', '');
  const label = btn?.querySelector('.btn-label');
  const previous = label?.textContent;
  if (label) label.textContent = 'Solving…';

  try {
    const result = await generate({ candidates });
    const m = result.metrics;
    if (result.unplaced?.length) {
      toastWarn(
        `${result.unplaced.length} lesson${result.unplaced.length === 1 ? '' : 's'} could not be placed`,
        `${m.placed}/${m.totalLessons} scheduled · quality ${m.quality}/100 — see the solver report.`,
      );
    } else if (m.conflicts) {
      toastError('Solved with conflicts', `${m.conflicts} clash${m.conflicts === 1 ? '' : 'es'} detected — please report this.`);
    } else if (!silent) {
      toastOk(
        `Timetable solved · quality ${m.quality}/100`,
        `${m.placed} lessons, zero conflicts, ${result.alternatives?.length || 1} candidate${(result.alternatives?.length || 1) === 1 ? '' : 's'} compared in ${result.stats?.durationMs ?? '—'} ms.`,
      );
    }
    queueRender({ scope: 'result' });
  } catch (err) {
    console.error(err);
    toastError('Generation failed', String(err?.message || err));
  } finally {
    generating = false;
    btn?.classList.remove('is-busy');
    btn?.removeAttribute('disabled');
    if (label && previous) label.textContent = previous;
  }
}

/* ──────────────────────────── global handlers ─────────────────────────── */

function registerGlobalHandlers() {
  on('click', 'generate', () => runGenerate());

  on('click', 'go', (e, el) => navigate(el.dataset.page));
  on('click', 'go-timetable', () => navigate('timetable'));
  on('click', 'print', () => printTimetable());

  on('click', 'clear-locks', async () => {
    const count = getState().locks.length;
    const ok = await confirmDialog({
      title: `Unpin ${count} lesson${count === 1 ? '' : 's'}?`,
      message: 'The solver will be free to move them on the next generate.',
      confirmLabel: 'Unpin all',
    });
    if (!ok) return;
    clearLocks();
    toastOk('All lessons unpinned', 'Regenerate to let the solver rearrange the week.');
  });

  on('click', 'use-candidate', (e, el) => {
    const seed = Number(el.dataset.seed);
    const result = chooseAlternative(seed);
    if (!result) {
      toastWarn('Candidate unavailable', 'Regenerate to produce fresh candidates.');
      return;
    }
    toastOk(`Switched to seed ${seed}`, `Quality ${result.metrics.quality}/100 · ${result.conflicts.length} conflicts`);
  });

  on('click', 'export-json', () => {
    download(`timetable-dataset-${new Date().toISOString().slice(0, 10)}.json`, exportData(), 'application/json');
    toastOk('Dataset downloaded', 'Keep it safe — importing restores everything.');
  });

  on('click', 'import-file', () => pickFile());

  on('click', 'reset-demo', async () => {
    const ok = await confirmDialog({
      title: 'Reset to the demo school?',
      message: 'Your current classes, subjects, staff, rooms and pins will be replaced by Northgate Academy.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) return;
    resetDemo();
    toast({ title: 'Demo data restored', message: 'Generating a fresh week…', kind: 'info' });
    runGenerate({ silent: true });
  });

  on('click', 'random-school', () => openRandomSchoolModal());

  on('click', 'open-palette', () => launchPalette());
}

function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importData(text);
      toastOk('Dataset imported', `${getState().classes.length} classes · ${getState().subjects.length} subjects loaded.`);
      runGenerate({ silent: true });
    } catch (err) {
      toastError('Import failed', String(err?.message || err));
    }
  });
  input.click();
}

function openRandomSchoolModal() {
  const defaults = { classes: 6, teachers: 14, subjects: 10, days: 5, periods: 8 };
  openModal({
    title: 'Generate a random school',
    subtitle: 'Stress-test the solver with a brand-new dataset',
    size: 'narrow',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        ${['classes', 'teachers', 'subjects', 'days', 'periods'].map((key) => `
          <div class="field">
            <label for="rs-${key}">${key[0].toUpperCase() + key.slice(1)}</label>
            <input class="input" type="number" id="rs-${key}" name="${key}" min="1"
              max="${key === 'days' ? 6 : key === 'periods' ? 12 : 24}" value="${defaults[key]}">
          </div>`).join('')}
      </div>
      <p class="help">${icon('info')} Demand is capped at ~70% of capacity so every dataset stays solvable.</p>`,
    footer: `
      <button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" data-build>${icon('dice')} Build & solve</button>`,
    onMount: (root) => {
      root.querySelector('[data-build]').addEventListener('click', () => {
        const values = {};
        for (const input of root.querySelectorAll('[name]')) {
          values[input.name] = Math.max(1, Number(input.value) || defaults[input.name]);
        }
        root.querySelector('[data-close]').click();
        loadRandomSchool(values);
        toast({ title: `${values.classes} classes created`, message: 'Solving the week…', kind: 'info' });
        runGenerate({ silent: true }).then(() => navigate('timetable'));
      });
    },
  });
}

/* ─────────────────────────── command palette ─────────────────────────── */

function launchPalette() {
  registerCommands(buildCommands());
  openPalette();
}

function buildCommands() {
  const state = getState();
  const list = [];

  for (const item of NAV) {
    list.push({ id: `go-${item.id}`, label: `Go to ${item.label}`, group: 'Navigate', icon: item.icon, run: () => navigate(item.id) });
  }

  list.push(
    { id: 'generate', label: 'Generate a new timetable', group: 'Scheduling', icon: 'sparkles', hint: 'G', run: () => runGenerate() },
    { id: 'generate-more', label: 'Generate 6 candidates and pick the best', group: 'Scheduling', icon: 'layers', run: () => runGenerate({ candidates: 6 }) },
    {
      id: 'clear-locks', label: `Unpin all ${state.locks.length} pinned lessons`, group: 'Scheduling', icon: 'unlock',
      run: () => { clearLocks(); toastOk('All pins cleared', 'Regenerate to let the solver rearrange them.'); },
    },
    { id: 'random-school', label: 'Generate a random school', group: 'Scheduling', icon: 'dice', run: () => openRandomSchoolModal() },
    { id: 'reset-demo', label: 'Reset to the demo dataset', group: 'Scheduling', icon: 'refresh', run: () => { resetDemo(); runGenerate({ silent: true }); } },
  );

  for (const view of ['class', 'teacher', 'room', 'agenda']) {
    list.push({
      id: `view-${view}`, label: `${view[0].toUpperCase() + view.slice(1)} view`, group: 'Views', icon: view === 'agenda' ? 'list' : view === 'teacher' ? 'user' : view === 'room' ? 'door' : 'users',
      run: () => { setPrefs({ view }); navigate('timetable'); },
    });
  }
  for (const klass of state.classes) {
    list.push({ id: `class-${klass.id}`, label: `Open ${klass.name}`, group: 'Classes', icon: 'users', keywords: klass.grade, run: () => { setPrefs({ view: 'class', activeClassId: klass.id }); navigate('timetable'); } });
  }
  for (const teacher of state.teachers.slice(0, 24)) {
    list.push({ id: `teacher-${teacher.id}`, label: teacher.name, group: 'Teachers', icon: 'user', run: () => { setPrefs({ view: 'teacher', activeTeacherId: teacher.id }); navigate('timetable'); } });
  }

  for (const theme of THEMES) {
    list.push({ id: `theme-${theme.id}`, label: `${theme.name} theme`, group: 'Styles', icon: 'palette', keywords: `${theme.family} ${theme.mode} ${theme.blurb}`, run: () => setPrefs({ theme: theme.id }) });
  }
  for (const density of DENSITIES) {
    list.push({ id: `density-${density.id}`, label: `${density.name} density`, group: 'Styles', icon: 'sliders', run: () => setPrefs({ density: density.id }) });
  }
  for (const font of FONTS) {
    list.push({ id: `font-${font.id}`, label: `${font.name} typeface`, group: 'Styles', icon: 'edit', run: () => setPrefs({ font: font.id }) });
  }
  list.push(
    { id: 'surprise', label: 'Surprise me with a random style', group: 'Styles', icon: 'dice', run: () => { setPrefs(randomStyle()); navigate('styles'); } },
    { id: 'toggle-motion', label: `Turn animation ${state.ui.motion === false ? 'on' : 'off'}`, group: 'Styles', icon: 'zap', run: () => setPrefs({ motion: state.ui.motion === false }) },
    { id: 'toggle-glass', label: `Turn glass blur ${state.ui.glass === false ? 'on' : 'off'}`, group: 'Styles', icon: 'layers', run: () => setPrefs({ glass: state.ui.glass === false }) },
  );

  for (const format of ['csv', 'json', 'ics', 'markdown', 'text']) {
    list.push({ id: `export-${format}`, label: `Export ${format.toUpperCase()}`, group: 'Export', icon: 'download', run: () => exportAs(format, state.ui.exportScope || { scopeKind: 'all' }) });
  }
  list.push(
    { id: 'print', label: 'Print timetable', group: 'Export', icon: 'printer', hint: 'P', run: () => printTimetable() },
    { id: 'ics-next-week', label: 'Copy next week as .ics text', group: 'Export', icon: 'calendar', run: async () => { const { copyText } = await import('./ui/dom.js'); await copyText(toICS(state, { scopeKind: 'all' })); toastOk('ICS copied', 'Paste it into a .ics file or your calendar import.'); } },
  );

  return list;
}

/* ─────────────────────────────── shortcuts ───────────────────────────── */

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Command palette' },
  { keys: ['G'], label: 'Generate a new timetable' },
  { keys: ['P'], label: 'Print the current view' },
  { keys: ['1'], label: 'Dashboard' },
  { keys: ['2'], label: 'Timetable' },
  { keys: ['3'], label: 'Data' },
  { keys: ['4'], label: 'Styles' },
  { keys: ['5'], label: 'Export' },
  { keys: ['Esc'], label: 'Close dialog / popover' },
];

function openShortcuts() {
  openModal({
    title: 'Keyboard shortcuts',
    size: 'narrow',
    body: `
      <div class="col" style="gap:2px">
        ${SHORTCUTS.map((s) => `
          <div class="list-item">
            <span class="grow">${esc(s.label)}</span>
            <span class="row" style="gap:4px">${s.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join('')}</span>
          </div>`).join('')}
      </div>
      <p class="help">${icon('info')} Drag any lesson to move it; illegal drops are refused with a reason.</p>`,
    footer: `<button class="btn btn-primary" type="button" data-close>Got it</button>`,
  });
}

function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/* ───────────────────────────────── boot ──────────────────────────────── */

function boot() {
  mountDelegation();
  registerGlobalHandlers();
  timetable.registerTimetableHandlers();
  dataView.registerDataHandlers();
  styles.registerStyleHandlers();
  exportView.registerExportHandlers();

  const state = getState();
  const hashPage = pageFromHash();
  if (hashPage && hashPage !== state.ui.page) state.ui.page = hashPage;

  applyPrefs(state.ui);
  render();

  subscribe((next, detail) => queueRender(detail));

  window.addEventListener('hashchange', () => {
    const page = pageFromHash();
    if (page && page !== getState().ui.page) setPrefs({ page });
    else render();
  });

  $('#btn-generate')?.addEventListener('click', () => runGenerate());
  $('#btn-print')?.addEventListener('click', () => printTimetable());
  $('#btn-palette')?.addEventListener('click', () => launchPalette());
  $('#btn-shortcuts')?.addEventListener('click', openShortcuts);
  $('#btn-menu')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sidebar') && !e.target.closest('#btn-menu')) {
      document.body.classList.remove('nav-open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isPaletteOpen()) return;
      launchPalette();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
      // let the browser's own dialog handle it — the print sheet is styled
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || isModalOpen() || isPaletteOpen()) return;

    const key = e.key.toLowerCase();
    if (key === 'g') { e.preventDefault(); runGenerate(); }
    else if (key === 'p') { e.preventDefault(); printTimetable(); }
    else if (key === '?') { e.preventDefault(); openShortcuts(); }
    else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      navigate(NAV[Number(e.key) - 1].id);
    }
  });

  // keep the "now" indicator honest
  setInterval(() => {
    const page = getState().ui.page;
    if (page === 'timetable' || page === 'dashboard') render();
  }, 60000);

  // first run: solve automatically so the app is never empty
  if (!state.result) {
    setTimeout(() => runGenerate({ silent: true }), 260);
    setTimeout(() => {
      const m = getState().result?.metrics;
      if (m) {
        toast({
          title: `Welcome — your week is ready`,
          message: `${m.placed} lessons scheduled automatically, quality ${m.quality}/100. Press G to solve it again.`,
          kind: 'ok',
          timeout: 7000,
        });
      }
    }, 900);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* expose a tiny debug surface — handy in the console, harmless in production */
window.TimetableStudio = {
  getState,
  currentModel,
  generate: runGenerate,
  navigate,
  exportAs,
  copyAs,
  themes: THEMES.map((t) => t.id),
  setTheme: (id) => setPrefs({ theme: id }),
  version: '1.0.0',
};
