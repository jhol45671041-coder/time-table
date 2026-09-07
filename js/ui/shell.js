/** App shell: navigation, header, quick theme dots, and applying preferences. */
import { icon, esc, $, $$ } from './dom.js';
import { THEMES, THEME_MAP } from '../themes.js';

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', title: 'Dashboard', sub: (s) => `${s.settings.schoolName} · ${s.settings.termName}` },
  { id: 'timetable', label: 'Timetable', icon: 'calendar', title: 'Timetable', sub: (s) => viewLabel(s) },
  { id: 'data', label: 'Data', icon: 'sliders', title: 'Data', sub: (s) => `${s.classes.length} classes · ${s.subjects.length} subjects · ${s.teachers.length} staff · ${s.rooms.length} rooms` },
  { id: 'styles', label: 'Styles', icon: 'palette', title: 'Styles', sub: () => `${THEMES.length} themes · live preview` },
  { id: 'export', label: 'Export', icon: 'download', title: 'Export', sub: () => 'CSV · JSON · ICS · print-ready' },
];

function viewLabel(state) {
  const view = state.ui.view;
  if (view === 'teacher') {
    const t = state.teachers.find((x) => x.id === state.ui.activeTeacherId);
    return `Teacher view · ${t?.name ?? '—'}`;
  }
  if (view === 'room') {
    const r = state.rooms.find((x) => x.id === state.ui.activeRoomId);
    return `Room view · ${r?.name ?? '—'}`;
  }
  if (view === 'agenda') return 'Agenda view · day-by-day list';
  const c = state.classes.find((x) => x.id === state.ui.activeClassId);
  return `Class view · ${c?.name ?? '—'}`;
}

/* ─────────────────────────── preferences → <html> ─────────────────────── */

export function applyPrefs(prefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme in THEME_MAP ? prefs.theme : 'aurora';
  root.dataset.density = prefs.density || 'cosy';
  root.dataset.font = prefs.font || 'grotesk';
  root.dataset.motion = prefs.motion === false ? 'off' : 'on';
  root.dataset.glass = prefs.glass === false ? 'off' : 'on';
  root.dataset.grain = prefs.grain === false ? 'off' : 'on';
  root.dataset.ambient = prefs.ambient === false || prefs.motion === false ? 'off' : 'on';

  if (prefs.accent == null) {
    root.dataset.accent = 'off';
    root.style.removeProperty('--accent-h');
    root.style.removeProperty('--accent-2-h');
  } else {
    root.dataset.accent = 'on';
    root.style.setProperty('--accent-h', String(prefs.accent));
    root.style.setProperty('--accent-2-h', String((prefs.accent + 152) % 360));
  }

  const theme = THEME_MAP[root.dataset.theme];
  const meta = $('meta[name="color-scheme"]') || createMeta();
  meta.content = theme?.mode === 'light' ? 'light' : 'dark';
  let themeColor = $('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = theme?.preview.bg ?? '#0b0d1a';
}

function createMeta() {
  const meta = document.createElement('meta');
  meta.name = 'color-scheme';
  document.head.appendChild(meta);
  return meta;
}

/* ───────────────────────────────── nav ────────────────────────────────── */

export function renderNav(state) {
  const problems = (state.result?.diagnostics || []).filter((d) => d.severity !== 'ok').length;
  const conflicts = state.result?.conflicts?.length || 0;

  const badge = (item) => {
    if (item.id === 'timetable' && conflicts) return `<span class="badge" style="background:var(--danger);color:#fff">${conflicts}</span>`;
    if (item.id === 'dashboard' && problems) return `<span class="badge" style="background:var(--warn);color:var(--accent-ink)">${problems}</span>`;
    if (item.id === 'data') return `<span class="badge">${state.classes.length}</span>`;
    return '';
  };

  const html = NAV.map((item) => `
    <li>
      <a class="nav-item" href="#/${item.id}" data-nav="${item.id}" ${state.ui.page === item.id ? 'aria-current="page"' : ''}>
        ${icon(item.icon)}<span>${item.label}</span>${badge(item)}
      </a>
    </li>`).join('');

  const list = $('#nav-list');
  if (list) list.innerHTML = html;

  const mobile = $('#mobile-nav-list');
  if (mobile) {
    mobile.innerHTML = NAV.map((item) => `
      <li>
        <a href="#/${item.id}" data-nav="${item.id}" ${state.ui.page === item.id ? 'aria-current="page"' : ''}>
          ${icon(item.icon)}${item.label}
        </a>
      </li>`).join('');
  }

  const quick = $('#theme-quick');
  if (quick) {
    quick.innerHTML = THEMES.map((theme) => `
      <button class="theme-dot" type="button" data-action="set-theme" data-theme-id="${theme.id}"
        aria-pressed="${state.ui.theme === theme.id}"
        data-tip="${esc(theme.name)}"
        style="background: linear-gradient(135deg, ${theme.preview.accent} 0 52%, ${theme.preview.bg} 52% 100%)"></button>`).join('');
  }

  const note = $('#storage-note');
  if (note) {
    note.textContent = conflicts
      ? `${conflicts} conflict${conflicts === 1 ? '' : 's'} — regenerate`
      : state.result
        ? 'Saved in this browser'
        : 'No timetable yet';
  }
}

export function setPage(page, state) {
  const item = NAV.find((n) => n.id === page) || NAV[0];
  $$('.page').forEach((el) => el.classList.toggle('is-active', el.dataset.page === item.id));
  const title = $('#header-title');
  const sub = $('#header-sub');
  if (title) title.textContent = item.title;
  if (sub) sub.textContent = typeof item.sub === 'function' ? item.sub(state) : '';
  document.title = `${item.title} · Timetable Studio`;
  $$('[data-nav]').forEach((el) => {
    if (el.dataset.nav === item.id) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}
