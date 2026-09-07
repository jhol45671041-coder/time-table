/**
 * Data view — edit everything the solver consumes:
 * classes, subjects, teachers, rooms, the bell schedule and school details.
 */
import { esc, icon, initials, on } from '../ui/dom.js';
import { getState, setPrefs, upsert, remove, setSettings, uid, isStale } from '../state.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { toastOk, toastWarn, toastError } from '../ui/toast.js';

const TABS = [
  { id: 'classes', label: 'Classes', icon: 'users' },
  { id: 'subjects', label: 'Subjects', icon: 'book' },
  { id: 'teachers', label: 'Teachers', icon: 'user' },
  { id: 'rooms', label: 'Rooms', icon: 'door' },
  { id: 'bell', label: 'Bell schedule', icon: 'clock' },
  { id: 'school', label: 'School', icon: 'globe' },
];

const ROOM_TYPES = ['standard', 'lab', 'computer', 'studio', 'music', 'gym', 'hall'];

export function render(state) {
  const tab = state.ui.dataTab || 'classes';
  return `
    ${staleBanner(state)}
    <section class="card anim-rise">
      <div class="card-head" style="flex-wrap:wrap">
        ${icon('sliders')}
        <div class="grow">
          <h2>Timetable inputs</h2>
          <p class="tiny muted">Everything here feeds the solver — changes mark the timetable stale until you regenerate</p>
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="random-school">${icon('dice')} Random school</button>
        <button class="btn btn-outline btn-sm" type="button" data-action="import-file">${icon('upload')} Import JSON</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="generate">${icon('sparkles')} Regenerate</button>
      </div>
      <div class="tabs" role="tablist" aria-label="Data sections">
        ${TABS.map((t) => `
          <button class="tab" role="tab" type="button" data-action="data-tab" data-tab="${t.id}"
            aria-selected="${tab === t.id}">${icon(t.icon)} ${t.label}</button>`).join('')}
      </div>
      <div class="card-body" role="tabpanel">${panel(tab, state)}</div>
    </section>`;
}

function staleBanner(state) {
  if (!isStale(state)) return '';
  return `
    <div class="alert alert-warn anim-rise no-print">
      ${icon('alert')}
      <div class="grow">
        <strong>Your data changed since this timetable was generated</strong>
        <p>The grid on screen may no longer match your classes, staff or rooms.</p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-action="generate">${icon('refresh')} Regenerate</button>
    </div>`;
}

function panel(tab, state) {
  if (tab === 'subjects') return subjectsPanel(state);
  if (tab === 'teachers') return teachersPanel(state);
  if (tab === 'rooms') return roomsPanel(state);
  if (tab === 'bell') return bellPanel(state);
  if (tab === 'school') return schoolPanel(state);
  return classesPanel(state);
}

const addBtn = (collection, label) => `
  <button class="btn btn-primary btn-sm" type="button" data-action="add-entity" data-collection="${collection}">
    ${icon('plus')} ${label}
  </button>`;

const rowActions = (collection, id) => `
  <div class="row-actions">
    <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="edit-entity" data-collection="${collection}" data-id="${esc(id)}" data-tip="Edit">${icon('edit')}</button>
    <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="del-entity" data-collection="${collection}" data-id="${esc(id)}" data-tip="Delete">${icon('trash')}</button>
  </div>`;

/* ─────────────────────────────── classes ──────────────────────────────── */

function classesPanel(state) {
  const load = state.result?.placements ?? [];
  return `
    <div class="spread" style="margin-bottom:14px">
      <p class="small muted">${state.classes.length} class${state.classes.length === 1 ? '' : 'es'} ·
        ${state.classes.reduce((s, c) => s + (Number(c.size) || 0), 0)} pupils in total</p>
      ${addBtn('classes', 'Add class')}
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Class</th><th>Year</th><th>Pupils</th><th>Home room</th><th>Periods / week</th><th></th></tr></thead>
        <tbody>
          ${state.classes.map((klass) => {
            const room = state.rooms.find((r) => r.id === klass.homeRoomId);
            const periods = load.filter((p) => p.classId === klass.id).reduce((s, p) => s + p.length, 0);
            return `
              <tr>
                <td><span class="row"><span class="avatar" style="--h:${klass.hue ?? 222}">${esc(klass.name.slice(0, 3))}</span><strong>${esc(klass.name)}</strong></span></td>
                <td class="muted">${esc(klass.grade || '—')}</td>
                <td>${esc(klass.size)}</td>
                <td class="muted">${esc(room?.name || '—')}${room && Number(room.capacity) < Number(klass.size) ? ` <span class="chip chip-danger">too small</span>` : ''}</td>
                <td>${periods || '—'}</td>
                <td>${rowActions('classes', klass.id)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ─────────────────────────────── subjects ─────────────────────────────── */

function subjectsPanel(state) {
  const total = state.subjects.reduce((s, x) => s + x.weeklyPeriods, 0);
  return `
    <div class="spread" style="margin-bottom:14px">
      <p class="small muted">${state.subjects.length} subjects · ${total} periods per class per week ·
        ${state.subjects.filter((s) => s.sessionLength === 2).length} taught as doubles</p>
      ${addBtn('subjects', 'Add subject')}
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Subject</th><th>Teacher</th><th>Weekly</th><th>Max / day</th><th>Session</th><th>Difficulty</th><th>Room</th><th></th></tr></thead>
        <tbody>
          ${state.subjects.map((subject) => {
            const teacher = state.teachers.find((t) => t.id === subject.teacherId);
            return `
              <tr>
                <td>
                  <span class="row">
                    <span class="legend-swatch" style="--h:${subject.hue}"></span>
                    <span><strong>${esc(subject.name)}</strong><br><span class="tiny faint mono">${esc(subject.code || '')}</span></span>
                  </span>
                </td>
                <td class="muted">${esc(teacher?.name || '—')}</td>
                <td>${subject.weeklyPeriods}</td>
                <td>${subject.maxPerDay}</td>
                <td>${subject.sessionLength === 2 ? '<span class="chip">double</span>' : 'single'}</td>
                <td>${'★'.repeat(subject.difficulty || 2)}<span class="faint">${'☆'.repeat(3 - (subject.difficulty || 2))}</span></td>
                <td class="muted">${esc(subject.roomType || 'any')}</td>
                <td>${rowActions('subjects', subject.id)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="help" style="margin-top:12px">
      ${icon('info')} <strong>Difficulty</strong> biases demanding subjects towards the morning.
      <strong>Room type</strong> forces the lesson into a matching room (lab, gym, studio…).
      A <strong>double</strong> session needs two free periods side by side.
    </p>`;
}

/* ─────────────────────────────── teachers ─────────────────────────────── */

function teachersPanel(state) {
  const load = state.result?.metrics?.teacherLoad || {};
  return `
    <div class="spread" style="margin-bottom:14px">
      <p class="small muted">${state.teachers.length} staff ·
        ${state.teachers.reduce((s, t) => s + (t.unavailable?.length || 0), 0)} unavailable slots marked</p>
      ${addBtn('teachers', 'Add teacher')}
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Teacher</th><th>Subjects</th><th>Max / day</th><th>Weekly load</th><th>Unavailable</th><th></th></tr></thead>
        <tbody>
          ${state.teachers.map((teacher) => {
            const subjects = state.subjects.filter((s) => s.teacherId === teacher.id);
            const weekly = subjects.reduce((sum, s) => sum + s.weeklyPeriods * state.classes.length, 0);
            const placed = load[teacher.id] || 0;
            const capacity = (teacher.maxPeriodsPerDay || 6) * state.settings.days.filter((d) => d.active !== false).length;
            return `
              <tr>
                <td><span class="row"><span class="avatar" style="--h:${(teacher.initials.charCodeAt(0) * 7) % 360}">${esc(teacher.initials || initials(teacher.name))}</span><strong>${esc(teacher.name)}</strong></span></td>
                <td class="muted">${subjects.map((s) => esc(s.code || s.name)).join(', ') || '—'}</td>
                <td>${teacher.maxPeriodsPerDay}</td>
                <td>
                  <span class="row" style="gap:8px">
                    <span class="track" style="width:74px;height:7px;border-radius:99px;background:var(--inset);overflow:hidden">
                      <i style="display:block;height:100%;width:${Math.min(100, (weekly / Math.max(1, capacity)) * 100)}%;background:${weekly > capacity ? 'var(--danger)' : 'var(--accent-grad)'}"></i>
                    </span>
                    <span class="tiny mono">${weekly}/${capacity}</span>
                  </span>
                  ${weekly > capacity ? '<span class="chip chip-danger">over capacity</span>' : ''}
                </td>
                <td class="muted">${teacher.unavailable?.length || 0}</td>
                <td>${rowActions('teachers', teacher.id)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ───────────────────────────────── rooms ──────────────────────────────── */

function roomsPanel(state) {
  const usage = state.result?.metrics?.roomUsage || {};
  const teachingSlots = state.settings.days.filter((d) => d.active !== false).length *
    state.settings.periods.filter((p) => p.kind === 'lesson').length;
  return `
    <div class="spread" style="margin-bottom:14px">
      <p class="small muted">${state.rooms.length} rooms ·
        ${state.rooms.reduce((s, r) => s + Number(r.capacity || 0), 0)} places</p>
      ${addBtn('rooms', 'Add room')}
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Room</th><th>Type</th><th>Capacity</th><th>Occupancy</th><th>Home of</th><th></th></tr></thead>
        <tbody>
          ${state.rooms.map((room) => {
            const used = usage[room.id] || 0;
            const home = state.classes.find((c) => c.homeRoomId === room.id);
            return `
              <tr>
                <td><strong>${esc(room.name)}</strong></td>
                <td><span class="chip ${room.type === 'standard' ? '' : 'chip-accent'}">${esc(room.type)}</span></td>
                <td>${room.capacity}</td>
                <td>
                  <span class="row" style="gap:8px">
                    <span class="track" style="width:74px;height:7px;border-radius:99px;background:var(--inset);overflow:hidden">
                      <i style="display:block;height:100%;width:${Math.min(100, (used / Math.max(1, teachingSlots)) * 100)}%;background:var(--accent-grad)"></i>
                    </span>
                    <span class="tiny mono">${used}/${teachingSlots}</span>
                  </span>
                </td>
                <td class="muted">${esc(home?.name || '—')}</td>
                <td>${rowActions('rooms', room.id)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ───────────────────────────── bell schedule ──────────────────────────── */

function bellPanel(state) {
  const days = state.settings.days;
  const periods = state.settings.periods;
  return `
    <div class="spread" style="margin-bottom:14px;flex-wrap:wrap">
      <div>
        <p class="label">Teaching days</p>
        <div class="row-wrap" style="margin-top:6px">
          ${days.map((day) => `
            <button class="chip ${day.active === false ? '' : 'chip-accent'}" type="button"
              data-action="toggle-day" data-id="${esc(day.id)}" aria-pressed="${day.active !== false}">
              ${day.active === false ? '' : icon('check')} ${esc(day.full || day.label)}
            </button>`).join('')}
        </div>
      </div>
      <div class="row">
        <button class="btn btn-outline btn-sm" type="button" data-action="add-period">${icon('plus')} Add period</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="add-break">${icon('plus')} Add break</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead><tr><th style="width:54px">#</th><th>Label</th><th>Start</th><th>End</th><th>Type</th><th style="width:120px"></th></tr></thead>
        <tbody>
          ${periods.map((period, index) => `
            <tr>
              <td class="mono faint">${index + 1}</td>
              <td><input class="input" style="padding:6px 9px" value="${esc(period.label)}" data-on-change="period-field" data-index="${index}" data-field="label" aria-label="Period label"></td>
              <td><input class="input mono" type="time" style="padding:6px 9px" value="${esc(period.start)}" data-on-change="period-field" data-index="${index}" data-field="start" aria-label="Start time"></td>
              <td><input class="input mono" type="time" style="padding:6px 9px" value="${esc(period.end)}" data-on-change="period-field" data-index="${index}" data-field="end" aria-label="End time"></td>
              <td>
                <select class="select" style="padding:6px 30px 6px 9px" data-on-change="period-field" data-index="${index}" data-field="kind" aria-label="Slot type">
                  ${['lesson', 'break', 'lunch'].map((k) => `<option value="${k}" ${period.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
                </select>
              </td>
              <td>
                <div class="row-actions" style="opacity:1">
                  <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="move-period" data-index="${index}" data-dir="-1" data-tip="Move up" ${index === 0 ? 'disabled' : ''}>${icon('chevron-down')}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="move-period" data-index="${index}" data-dir="1" data-tip="Move down" ${index === periods.length - 1 ? 'disabled' : ''} style="transform:rotate(180deg)">${icon('chevron-down')}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="del-period" data-index="${index}" data-tip="Delete">${icon('trash')}</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="help" style="margin-top:12px">${icon('info')} Breaks and lunch are never taught in — they show as hatched rows and split double sessions.</p>`;
}

/* ──────────────────────────────── school ──────────────────────────────── */

function schoolPanel(state) {
  const metrics = state.result?.metrics;
  return `
    <div class="form-grid">
      <div class="field">
        <label for="f-school">School name</label>
        <input class="input" id="f-school" value="${esc(state.settings.schoolName)}" data-on-change="setting" data-field="schoolName">
      </div>
      <div class="field">
        <label for="f-term">Term</label>
        <input class="input" id="f-term" value="${esc(state.settings.termName)}" data-on-change="setting" data-field="termName">
      </div>
    </div>
    <hr class="divider" style="margin:16px 0" />
    <h3 class="h3">Dataset</h3>
    <p class="small muted">Everything is stored in this browser only — no server, no account.</p>
    <div class="row-wrap" style="margin-top:12px">
      <button class="btn btn-outline btn-sm" type="button" data-action="export-json">${icon('download')} Download dataset</button>
      <button class="btn btn-outline btn-sm" type="button" data-action="import-file">${icon('upload')} Import dataset</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="random-school">${icon('dice')} Generate a random school</button>
      <button class="btn btn-danger btn-sm" type="button" data-action="reset-demo">${icon('refresh')} Reset to demo data</button>
    </div>
    ${metrics ? `
      <hr class="divider" style="margin:16px 0" />
      <h3 class="h3">Last run</h3>
      <div class="stat-grid" style="margin-top:10px">
        <div class="stat"><p class="stat-top">${icon('clock')} Solve time</p><p class="stat-value">${state.result.stats?.durationMs ?? '—'}<small> ms</small></p><p class="stat-sub">${state.result.stats?.restarts ?? 1} search passes · ${state.result.stats?.backtracks ?? 0} backtracks</p></div>
        <div class="stat"><p class="stat-top">${icon('dice')} Seed</p><p class="stat-value mono" style="font-size:1.2rem">${esc(String(state.result.seed ?? '—'))}</p><p class="stat-sub">Reproducible: the same seed gives the same week</p></div>
        <div class="stat"><p class="stat-top">${icon('target')} Quality</p><p class="stat-value">${metrics.quality}<small>/100</small></p><p class="stat-sub">spread ${(metrics.spread * 100).toFixed(0)}% · balance ${(metrics.balance * 100).toFixed(0)}%</p></div>
      </div>` : ''}`;
}

/* ────────────────────────────── interactions ──────────────────────────── */

export function registerDataHandlers() {
  on('click', 'data-tab', (e, el) => setPrefs({ dataTab: el.dataset.tab }));

  on('click', 'add-entity', (e, el) => openEntityForm(el.dataset.collection, null));
  on('click', 'edit-entity', (e, el) => openEntityForm(el.dataset.collection, el.dataset.id));

  on('click', 'del-entity', async (e, el) => {
    const state = getState();
    const collection = el.dataset.collection;
    const item = state[collection].find((row) => row.id === el.dataset.id);
    if (!item) return;
    const ok = await confirmDialog({
      title: `Delete ${item.name}?`,
      message: collection === 'teachers'
        ? 'Their subjects will be reassigned to the first remaining teacher.'
        : collection === 'rooms'
          ? 'Classes using it as a home room will be reassigned.'
          : 'The timetable will be regenerated without it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    remove(collection, item.id);
    toastOk('Deleted', `${item.name} removed from the dataset.`);
  });

  on('click', 'toggle-day', (e, el) => {
    const state = getState();
    const days = state.settings.days.map((d) =>
      d.id === el.dataset.id ? { ...d, active: d.active === false } : d);
    if (!days.some((d) => d.active !== false)) {
      toastWarn('At least one day needed', 'A timetable with no teaching days cannot be built.');
      return;
    }
    setSettings({ days });
  });

  on('change', 'period-field', (e, el) => {
    const state = getState();
    const periods = [...state.settings.periods];
    const index = Number(el.dataset.index);
    const field = el.dataset.field;
    periods[index] = { ...periods[index], [field]: el.value };
    if (field === 'label') periods[index].short = el.value.replace(/[^0-9]/g, '') || el.value.slice(0, 2);
    setSettings({ periods });
  });

  on('click', 'add-period', () => {
    const state = getState();
    const periods = [...state.settings.periods];
    const last = periods.filter((p) => p.kind === 'lesson').pop();
    const start = addMinutes(last?.end || '15:00', 5);
    periods.push({
      key: uid('p'),
      label: `Period ${periods.filter((p) => p.kind === 'lesson').length + 1}`,
      short: String(periods.filter((p) => p.kind === 'lesson').length + 1),
      start,
      end: addMinutes(start, 45),
      kind: 'lesson',
    });
    setSettings({ periods });
    toastOk('Period added', `${start}–${addMinutes(start, 45)}`);
  });

  on('click', 'add-break', () => {
    const state = getState();
    const periods = [...state.settings.periods];
    const last = periods.filter((p) => p.kind === 'lesson').pop();
    const start = last?.end || '11:00';
    periods.push({ key: uid('br'), label: 'Break', short: '☕', start, end: addMinutes(start, 20), kind: 'break' });
    setSettings({ periods });
  });

  on('click', 'del-period', async (e, el) => {
    const state = getState();
    const index = Number(el.dataset.index);
    const period = state.settings.periods[index];
    const ok = await confirmDialog({
      title: `Remove "${period.label}"?`,
      message: 'Lessons placed in this slot will be rescheduled.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    const periods = state.settings.periods.filter((_, i) => i !== index);
    if (!periods.some((p) => p.kind === 'lesson')) {
      toastWarn('Keep at least one period', 'A day with no teaching periods cannot hold lessons.');
      return;
    }
    setSettings({ periods });
  });

  on('click', 'move-period', (e, el) => {
    const state = getState();
    const periods = [...state.settings.periods];
    const index = Number(el.dataset.index);
    const target = index + Number(el.dataset.dir);
    if (target < 0 || target >= periods.length) return;
    [periods[index], periods[target]] = [periods[target], periods[index]];
    setSettings({ periods });
  });

  on('change', 'setting', (e, el) => setSettings({ [el.dataset.field]: el.value }));

  on('click', 'dash-class', (e, el) => setPrefs({ activeClassId: el.value }));
  on('change', 'dash-class', (e, el) => setPrefs({ activeClassId: el.value }));
}

function addMinutes(hhmm, delta) {
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  const total = (h * 60 + m + delta + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/* ────────────────────────────── entity forms ──────────────────────────── */

function openEntityForm(collection, id) {
  const state = getState();
  const item = id ? state[collection].find((row) => row.id === id) : null;
  const isNew = !item;
  const draft = item ? { ...item } : defaultsFor(collection, state);

  const forms = { classes: classForm, subjects: subjectForm, teachers: teacherForm, rooms: roomForm };
  const body = forms[collection](draft, state);
  const title = `${isNew ? 'Add' : 'Edit'} ${collection.replace(/s$/, '')}`;

  openModal({
    title,
    subtitle: isNew ? 'It joins the next generation run' : draft.name,
    body,
    footer: `
      <button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" data-save>${icon('save')} ${isNew ? 'Add' : 'Save changes'}</button>`,
    onMount: (root) => {
      if (collection === 'teachers') wireAvailability(root, draft, state);
      if (collection === 'subjects') wireHue(root, draft);
      if (collection === 'classes') wireHue(root, draft);

      root.querySelector('[data-save]').addEventListener('click', () => {
        const next = readForm(root, collection, draft, state);
        const problem = validateEntity(collection, next, state);
        if (problem) {
          toastError('Cannot save', problem);
          return;
        }
        upsert(collection, next);
        root.querySelector('[data-close]').click();
        toastOk(isNew ? 'Added' : 'Saved', `${next.name} — regenerate to fold it into the timetable.`);
      });
    },
  });
}

function defaultsFor(collection, state) {
  if (collection === 'classes') {
    return { id: uid('c'), name: `${state.classes.length + 7}A`, grade: 'Year 7', size: 26, homeRoomId: state.rooms[0]?.id ?? null, hue: (state.classes.length * 57) % 360 };
  }
  if (collection === 'subjects') {
    return { id: uid('s'), name: 'New subject', code: 'NEW', hue: (state.subjects.length * 41) % 360, teacherId: state.teachers[0]?.id ?? null, weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'any' };
  }
  if (collection === 'teachers') {
    return { id: uid('t'), name: 'New teacher', initials: 'NT', maxPeriodsPerDay: 6, unavailable: [] };
  }
  return { id: uid('r'), name: 'New room', capacity: 30, type: 'standard' };
}

const field = (label, inner, help = '') => `
  <div class="field"><label>${esc(label)}</label>${inner}${help ? `<span class="help">${esc(help)}</span>` : ''}</div>`;

function classForm(draft, state) {
  return `
    <div class="form-grid">
      ${field('Class name', `<input class="input" name="name" value="${esc(draft.name)}" required>`)}
      ${field('Year group', `<input class="input" name="grade" value="${esc(draft.grade || '')}">`)}
      ${field('Pupils', `<input class="input" type="number" name="size" min="1" max="200" value="${esc(draft.size)}">`)}
      ${field('Home room', `<select class="select" name="homeRoomId">
        <option value="">— none —</option>
        ${state.rooms.map((r) => `<option value="${esc(r.id)}" ${r.id === draft.homeRoomId ? 'selected' : ''}>${esc(r.name)} (cap ${r.capacity})</option>`).join('')}
      </select>`)}
    </div>
    ${hueField(draft)}`;
}

function subjectForm(draft, state) {
  return `
    <div class="form-grid">
      ${field('Subject', `<input class="input" name="name" value="${esc(draft.name)}" required>`)}
      ${field('Code', `<input class="input mono" name="code" value="${esc(draft.code || '')}" maxlength="5">`)}
      ${field('Teacher', `<select class="select" name="teacherId">
        ${state.teachers.map((t) => `<option value="${esc(t.id)}" ${t.id === draft.teacherId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>`)}
      ${field('Room type', `<select class="select" name="roomType">
        ${['any', ...ROOM_TYPES].map((t) => `<option value="${t}" ${t === (draft.roomType || 'any') ? 'selected' : ''}>${t}</option>`).join('')}
      </select>`)}
      ${field('Periods per week', `<input class="input" type="number" name="weeklyPeriods" min="0" max="20" value="${esc(draft.weeklyPeriods)}">`)}
      ${field('Max per day', `<input class="input" type="number" name="maxPerDay" min="1" max="5" value="${esc(draft.maxPerDay)}">`)}
      ${field('Session length', `<select class="select" name="sessionLength">
        <option value="1" ${draft.sessionLength !== 2 ? 'selected' : ''}>Single period</option>
        <option value="2" ${draft.sessionLength === 2 ? 'selected' : ''}>Double period</option>
      </select>`)}
      ${field('Difficulty', `<select class="select" name="difficulty">
        <option value="1" ${draft.difficulty === 1 ? 'selected' : ''}>1 · light (afternoons fine)</option>
        <option value="2" ${draft.difficulty === 2 ? 'selected' : ''}>2 · neutral</option>
        <option value="3" ${draft.difficulty === 3 ? 'selected' : ''}>3 · demanding (mornings)</option>
      </select>`, 'Demanding subjects are pulled towards the morning.')}
    </div>
    ${hueField(draft)}`;
}

function teacherForm(draft, state) {
  const days = state.settings.days.filter((d) => d.active !== false);
  const lessons = state.settings.periods.filter((p) => p.kind === 'lesson');
  const unavailable = new Set(draft.unavailable || []);
  return `
    <div class="form-grid">
      ${field('Name', `<input class="input" name="name" value="${esc(draft.name)}" required>`)}
      ${field('Initials', `<input class="input mono" name="initials" value="${esc(draft.initials || '')}" maxlength="3">`)}
      ${field('Max periods per day', `<input class="input" type="number" name="maxPeriodsPerDay" min="1" max="12" value="${esc(draft.maxPeriodsPerDay)}">`)}
    </div>
    <div>
      <p class="label" style="margin-bottom:8px">Unavailable slots <span class="faint">(click to toggle — meetings, part-time days, cover)</span></p>
      <div class="avail" id="avail-grid" style="--cols:${days.length}">
        <span></span>
        ${days.map((d) => `<span class="avail-day">${esc(d.label)}</span>`).join('')}
        ${lessons.map((period) => `
          <span class="avail-time mono">${esc(period.short || period.label)}</span>
          ${days.map((day) => {
            const key = `${day.id}@${period.key}`;
            return `<button type="button" class="avail-cell ${unavailable.has(key) ? 'off' : ''}" data-slot="${esc(key)}"
              aria-pressed="${unavailable.has(key)}" aria-label="${esc(day.label)} ${esc(period.label)}"></button>`;
          }).join('')}
        `).join('')}
      </div>
      <p class="help" style="margin-top:8px"><span id="avail-count">${unavailable.size}</span> slot(s) blocked</p>
    </div>`;
}

function roomForm(draft) {
  return `
    <div class="form-grid">
      ${field('Room name', `<input class="input" name="name" value="${esc(draft.name)}" required>`)}
      ${field('Capacity', `<input class="input" type="number" name="capacity" min="1" max="400" value="${esc(draft.capacity)}">`)}
      ${field('Type', `<select class="select" name="type">
        ${ROOM_TYPES.map((t) => `<option value="${t}" ${t === draft.type ? 'selected' : ''}>${t}</option>`).join('')}
      </select>`, 'Subjects can require a specific type.')}
    </div>`;
}

function hueField(draft) {
  return `
    <div>
      <p class="label" style="margin-bottom:8px">Colour</p>
      <div class="row" style="gap:12px">
        <input class="range" type="range" name="hue" min="0" max="359" value="${esc(draft.hue ?? 222)}" style="--h:${draft.hue ?? 222}" data-on-input="hue-live">
        <span class="hue-swatch" data-swatch style="--h:${draft.hue ?? 222}" aria-hidden="true"></span>
      </div>
      <div class="hue-strip" style="margin-top:8px"></div>
    </div>`;
}

function wireHue(root, draft) {
  const range = root.querySelector('input[name="hue"]');
  const swatch = root.querySelector('[data-swatch]');
  if (!range || !swatch) return;
  range.addEventListener('input', () => {
    swatch.style.setProperty('--h', range.value);
    range.style.setProperty('--h', range.value);
    draft.hue = Number(range.value);
  });
}

function wireAvailability(root, draft, state) {
  const grid = root.querySelector('#avail-grid');
  const count = root.querySelector('#avail-count');
  if (!grid) return;
  const set = new Set(draft.unavailable || []);
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.avail-cell');
    if (!cell) return;
    const key = cell.dataset.slot;
    if (set.has(key)) set.delete(key);
    else set.add(key);
    cell.classList.toggle('off', set.has(key));
    cell.setAttribute('aria-pressed', String(set.has(key)));
    count.textContent = set.size;
    draft.unavailable = [...set];
  });
  void state;
}

function readForm(root, collection, draft, state) {
  const next = { ...draft };
  for (const input of root.querySelectorAll('[name]')) {
    const key = input.name;
    let value = input.value;
    if (['size', 'weeklyPeriods', 'maxPerDay', 'sessionLength', 'difficulty', 'capacity', 'maxPeriodsPerDay', 'hue'].includes(key)) {
      value = Number(value);
    }
    if (key === 'homeRoomId' && value === '') value = null;
    if (key === 'teacherId' && value === '') value = null;
    next[key] = value;
  }
  if (collection === 'teachers' && !next.initials) next.initials = initials(next.name);
  if (collection === 'subjects' && !next.code) next.code = next.name.slice(0, 3).toUpperCase();
  void state;
  return next;
}

function validateEntity(collection, item, state) {
  if (!item.name || !String(item.name).trim()) return 'A name is required.';
  if (collection === 'classes') {
    if (!(Number(item.size) > 0)) return 'Class size must be at least 1.';
    const room = state.rooms.find((r) => r.id === item.homeRoomId);
    if (room && Number(room.capacity) < Number(item.size)) {
      return `${room.name} only holds ${room.capacity} — the class has ${item.size} pupils. Pick a bigger room or raise its capacity.`;
    }
  }
  if (collection === 'subjects') {
    if (Number(item.weeklyPeriods) > 0 && !item.teacherId) return 'Choose a teacher for this subject.';
    const teachingSlots = state.settings.days.filter((d) => d.active !== false).length *
      state.settings.periods.filter((p) => p.kind === 'lesson').length;
    if (Number(item.weeklyPeriods) > teachingSlots) {
      return `${item.weeklyPeriods} periods a week cannot fit into ${teachingSlots} available slots.`;
    }
    if (item.sessionLength === 2 && Number(item.weeklyPeriods) % 2 !== 0) {
      return 'Double sessions need an even number of weekly periods.';
    }
    if (Number(item.weeklyPeriods) > Number(item.maxPerDay) * state.settings.days.filter((d) => d.active !== false).length) {
      return `With max ${item.maxPerDay}/day this subject can never fit ${item.weeklyPeriods} periods a week.`;
    }
    if (item.roomType && item.roomType !== 'any' && !state.rooms.some((r) => r.type === item.roomType)) {
      return `No room of type “${item.roomType}” exists — add one or choose another type.`;
    }
  }
  if (collection === 'rooms' && !(Number(item.capacity) > 0)) return 'Capacity must be at least 1.';
  if (collection === 'teachers' && !(Number(item.maxPeriodsPerDay) > 0)) return 'Max periods per day must be at least 1.';
  return null;
}
