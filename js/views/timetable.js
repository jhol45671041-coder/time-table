/**
 * Timetable view — week grid, teacher/room views, agenda, drag-to-adjust,
 * lesson popovers.
 */
import { esc, icon, on } from '../ui/dom.js';
import { getState, setPrefs, toggleLock, moveLesson, currentModel } from '../state.js';
import { canMove } from '../scheduler.js';
import { toastOk, toastWarn, toastError } from '../ui/toast.js';
import { DENSITIES } from '../themes.js';

/* ─────────────────────────── drag session state ─────────────────────── */
let drag = null; // { lessonId, model, result, cache, lastCell }
let popover = null;

const WEEKDAY_TO_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function todayId(state) {
  const now = new Date();
  return WEEKDAY_TO_DAY[now.getDay()];
}

export function currentPeriodKey(state) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const hit = state.settings.periods.find((p) => p.start <= hhmm && hhmm < p.end);
  return hit?.key ?? null;
}

/* ─────────────────────────────── selectors ──────────────────────────── */

function entityOptions(state) {
  const view = state.ui.view;
  if (view === 'teacher') {
    return state.teachers.map((t) => ({ id: t.id, label: t.name }));
  }
  if (view === 'room') {
    return state.rooms.map((r) => ({ id: r.id, label: `${r.name} · ${r.capacity}` }));
  }
  return state.classes.map((c) => ({ id: c.id, label: `${c.name} · ${c.grade}` }));
}

/**
 * The entity the grid is filtered to. Falls back to the first available row if
 * the stored id is stale — which happens after importing a different dataset.
 */
function activeEntityId(state) {
  const view = state.ui.view === 'agenda' ? (state.ui.agendaView || 'class') : state.ui.view;
  const list = view === 'teacher' ? state.teachers : view === 'room' ? state.rooms : state.classes;
  const key = view === 'teacher' ? 'activeTeacherId' : view === 'room' ? 'activeRoomId' : 'activeClassId';
  const wanted = state.ui[key];
  return list.some((row) => row.id === wanted) ? wanted : list[0]?.id ?? null;
}

function matches(placement, state) {
  const view = state.ui.view === 'agenda' ? (state.ui.agendaView || 'class') : state.ui.view;
  const id = activeEntityId(state);
  if (view === 'teacher') return placement.teacherId === id;
  if (view === 'room') return placement.roomId === id;
  return placement.classId === id;
}

/* ─────────────────────────────── rendering ──────────────────────────── */

export function render(state) {
  if (!state.result?.placements?.length) return emptyState(state);

  const view = state.ui.view;
  const body = view === 'agenda' ? renderAgenda(state) : renderGrid(state);

  return `
    ${printHead(state)}
    <section class="card anim-rise">
      ${renderToolbar(state)}
      ${body}
      ${renderLegend(state)}
    </section>
    ${printFoot(state)}
  `;
}

function emptyState(state) {
  return `
    <section class="card anim-rise">
      <div class="empty">
        <div class="empty-art">${icon('sparkles')}</div>
        <h2 class="h2">No timetable yet</h2>
        <p class="lead">Press <strong>Generate</strong> and the solver will build a conflict-free week
        for ${state.classes.length} classes, ${state.subjects.length} subjects and ${state.teachers.length} teachers.</p>
        <button class="btn btn-primary btn-lg" type="button" data-action="generate">
          ${icon('sparkles')} Generate timetable
        </button>
      </div>
    </section>`;
}

function renderToolbar(state) {
  const view = state.ui.view;
  const options = entityOptions(state);
  const activeId = activeEntityId(state);
  const locks = state.locks.length;
  const pending = hasPendingPins(state);
  const metrics = state.result.metrics || {};

  const viewButtons = [
    { id: 'class', label: 'Class', icon: 'users' },
    { id: 'teacher', label: 'Teacher', icon: 'user' },
    { id: 'room', label: 'Room', icon: 'door' },
    { id: 'agenda', label: 'Agenda', icon: 'list' },
  ];

  return `
    <div class="tt-toolbar no-print">
      <div class="segmented" role="group" aria-label="Timetable view">
        ${viewButtons.map((v) => `
          <button type="button" data-action="set-view" data-view="${v.id}" aria-pressed="${view === v.id}">
            ${icon(v.icon)}${v.label}
          </button>`).join('')}
      </div>

      <div class="field" style="min-width:190px">
        <select class="select" data-on-change="set-entity" aria-label="Choose ${view === 'teacher' ? 'teacher' : view === 'room' ? 'room' : 'class'}">
          ${options.map((o) => `<option value="${esc(o.id)}" ${o.id === activeId ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
      </div>

      <div class="segmented" role="group" aria-label="Density">
        ${DENSITIES.map((d) => `
          <button type="button" data-action="set-density" data-density="${d.id}"
            aria-pressed="${state.ui.density === d.id}" data-tip="${esc(d.note)}">${d.name}</button>`).join('')}
      </div>

      <span class="spacer"></span>

      ${locks ? `<span class="chip chip-accent">${icon('pin')} ${locks} pinned</span>` : ''}
      ${pending ? `<span class="chip chip-warn" data-tip="Pins are applied on the next generate">pins pending</span>` : ''}
      ${metrics.conflicts ? `<span class="chip chip-danger">${icon('alert')} ${metrics.conflicts} conflicts</span>`
        : `<span class="chip chip-ok">${icon('check-circle')} conflict-free</span>`}
      <span class="chip">${icon('target')} quality ${metrics.quality ?? '—'}/100</span>

      <button class="btn btn-ghost btn-icon" type="button" data-action="print" data-tip="Print this view">${icon('printer')}</button>
    </div>`;
}

function hasPendingPins(state) {
  const generated = state.result?.generatedAt ? new Date(state.result.generatedAt).getTime() : 0;
  return state.locks.some((lock) => (lock.at || 0) > generated);
}

function renderGrid(state) {
  const days = state.settings.days.filter((d) => d.active !== false);
  const periods = state.settings.periods;
  const placements = state.result.placements;
  const subjectById = new Map(state.subjects.map((s) => [s.id, s]));
  const teacherById = new Map(state.teachers.map((t) => [t.id, t]));
  const classById = new Map(state.classes.map((c) => [c.id, c]));
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));

  const startByKey = new Map(placements.map((p) => [p.startSlotKey, p]));
  const today = todayId(state);
  const nowPeriod = currentPeriodKey(state);

  // per-day counts for the visible entity
  const counts = new Map(days.map((d) => [d.id, 0]));
  for (const p of placements) {
    if (!matches(p, state)) continue;
    counts.set(p.dayId, (counts.get(p.dayId) || 0) + p.length);
  }

  let index = 0;
  const cells = [];

  // header row
  cells.push(`<div class="tt-corner">Week</div>`);
  for (const day of days) {
    const isToday = day.id === today;
    cells.push(`
      <div class="tt-dayhead ${isToday ? 'is-today' : ''}">
        ${isToday ? '<span class="today-dot" aria-hidden="true"></span>' : ''}
        <strong>${esc(day.label)}</strong>
        <span>${counts.get(day.id) || 0} p</span>
      </div>`);
  }

  for (const period of periods) {
    const isLesson = period.kind === 'lesson';
    const isNow = period.key === nowPeriod && days.some((d) => d.id === today);
    cells.push(`
      <div class="tt-time ${isLesson ? '' : 'is-break'} ${isNow ? 'is-now' : ''}" style="--rh:var(--row-h${isLesson ? '' : '-break'})">
        <b>${isLesson ? esc(period.short || period.label) : esc(period.label)}</b>
        ${isLesson ? `<span>${esc(period.start)}</span>` : ''}
      </div>`);

    if (!isLesson) {
      cells.push(`
        <div class="tt-cell is-break" style="grid-column: 2 / -1; --rh:var(--row-h-break)">
          <span>${esc(period.label)} · ${esc(period.start)}–${esc(period.end)}</span>
        </div>`);
      continue;
    }

    for (const day of days) {
      const slotKey = `${day.id}@${period.key}`;
      const placement = startByKey.get(slotKey);
      const visible = placement && matches(placement, state);
      cells.push(`
        <div class="tt-cell ${isNow && day.id === today ? 'is-now-cell' : ''}"
             data-slot="${slotKey}" data-day="${day.id}" data-period="${period.key}"
             style="--rh:var(--row-h)"
             data-on-dragover="cell-over" data-on-dragleave="cell-leave" data-on-drop="cell-drop">
          ${visible ? lessonHTML(placement, state, { subjectById, teacherById, classById, roomById }, index++) : ''}
        </div>`);
    }
  }

  return `
    <div class="tt-wrap">
      <div class="tt" style="--days:${days.length}">
        ${cells.join('')}
      </div>
    </div>`;
}

function lessonHTML(placement, state, lookups, index) {
  const subject = lookups.subjectById.get(placement.subjectId) || {};
  const teacher = lookups.teacherById.get(placement.teacherId);
  const klass = lookups.classById.get(placement.classId) || {};
  const room = lookups.roomById.get(placement.roomId);
  const periodByKey = new Map(state.settings.periods.map((p) => [p.key, p]));
  const first = periodByKey.get(placement.slotKeys[0]?.split('@')[1]) || {};
  const last = periodByKey.get(placement.slotKeys[placement.slotKeys.length - 1]?.split('@')[1]) || {};

  const meta = state.ui.view === 'teacher'
    ? `${icon('users')}${esc(klass.name || '')}${room ? ` · ${esc(room.name)}` : ''}`
    : state.ui.view === 'room'
      ? `${icon('users')}${esc(klass.name || '')} · ${esc(teacher?.name || '—')}`
      : `${icon('user')}${esc(teacher?.name || '—')}${room ? ` · ${esc(room.name)}` : ''}`;

  return `
    <article class="lesson ${placement.locked ? 'is-locked' : ''} ${placement.manual ? 'is-manual' : ''}"
      style="--h:${subject.hue ?? 222};--span:${placement.length};--i:${Math.min(index, 10)}"
      draggable="true" tabindex="0" role="button"
      data-lesson="${esc(placement.lessonId)}" data-slot="${esc(placement.startSlotKey)}"
      data-action="lesson-open"
      data-on-dragstart="lesson-drag-start" data-on-dragend="lesson-drag-end"
      aria-label="${esc(subject.name)} with ${esc(teacher?.name || 'no teacher')} in ${esc(room?.name || 'no room')}, ${esc(first.start || '')} to ${esc(last.end || '')}">
      <span class="lesson-name">${esc(subject.name || placement.subjectId)}</span>
      <span class="lesson-meta">${meta}</span>
      <span class="lesson-time">${esc(first.start || '')}–${esc(last.end || '')}${placement.length > 1 ? ` · ${placement.length} periods` : ''}</span>
    </article>`;
}

function renderLegend(state) {
  return `
    <div class="tt-legend no-print">
      ${state.subjects.map((subject) => `
        <span class="legend-item" style="--h:${subject.hue}" data-tip="${esc(subject.name)} · ${subject.weeklyPeriods}/week">
          <span class="legend-swatch"></span>${esc(subject.code || subject.name)}
        </span>`).join('')}
      <span class="legend-item" style="margin-left:auto">${icon('info')} Drag a lesson to move it — illegal drops are blocked</span>
    </div>`;
}

/* ─────────────────────────────── agenda ─────────────────────────────── */

function renderAgenda(state) {
  const days = state.settings.days.filter((d) => d.active !== false);
  const periods = state.settings.periods;
  const placements = state.result.placements.filter((p) => matches(p, state));
  const subjectById = new Map(state.subjects.map((s) => [s.id, s]));
  const teacherById = new Map(state.teachers.map((t) => [t.id, t]));
  const classById = new Map(state.classes.map((c) => [c.id, c]));
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));
  const today = todayId(state);

  return `
    <div class="agenda">
      ${days.map((day) => {
        const items = [];
        for (const period of periods) {
          const slotKey = `${day.id}@${period.key}`;
          if (period.kind !== 'lesson') {
            items.push(`<div class="agenda-break"><span>${esc(period.start)}</span><span>${esc(period.label)}</span></div>`);
            continue;
          }
          const placement = placements.find((p) => p.startSlotKey === slotKey);
          if (!placement) continue;
          const subject = subjectById.get(placement.subjectId) || {};
          const lastPeriod = periods.find((p) => p.key === placement.slotKeys[placement.slotKeys.length - 1]?.split('@')[1]) || period;
          items.push(`
            <div class="agenda-item" style="--h:${subject.hue ?? 222}" data-action="lesson-open"
                 data-lesson="${esc(placement.lessonId)}" data-slot="${esc(placement.startSlotKey)}" tabindex="0" role="button">
              <time>${esc(period.start)}–${esc(lastPeriod.end || period.end)}</time>
              <span class="bar"></span>
              <span>
                <span class="who">${esc(subject.name)} ${placement.locked ? icon('pin') : ''}</span>
                <span class="where">${esc(classById.get(placement.classId)?.name || '')} · ${esc(teacherById.get(placement.teacherId)?.name || '—')} · ${esc(roomById.get(placement.roomId)?.name || '—')}</span>
              </span>
            </div>`);
        }
        const periodsToday = placements.filter((p) => p.dayId === day.id).reduce((s, p) => s + p.length, 0);
        return `
          <div class="agenda-day">
            <div class="agenda-dayhead">
              <strong>${esc(day.full || day.label)}${day.id === today ? ' <span class="chip chip-accent">today</span>' : ''}</strong>
              <span>${periodsToday} period${periodsToday === 1 ? '' : 's'}</span>
            </div>
            <div class="agenda-list">
              ${items.length ? items.join('') : '<p class="small faint" style="padding:8px 12px">Nothing scheduled.</p>'}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ─────────────────────────── print-only blocks ──────────────────────── */

function printHead(state) {
  const entity = state.ui.view === 'teacher'
    ? state.teachers.find((t) => t.id === activeEntityId(state))?.name
    : state.ui.view === 'room'
      ? state.rooms.find((r) => r.id === activeEntityId(state))?.name
      : state.classes.find((c) => c.id === activeEntityId(state))?.name;
  const kind = state.ui.view === 'teacher' ? 'Teacher' : state.ui.view === 'room' ? 'Room' : 'Class';
  return `
    <div class="print-head">
      <div>
        <h1>${esc(state.settings.schoolName)}</h1>
        <p>${esc(state.settings.termName)} · ${kind}: ${esc(entity || '—')}</p>
      </div>
      <div class="stamp">
        Generated ${esc(new Date(state.result.generatedAt || Date.now()).toLocaleString())}<br/>
        Quality ${state.result.metrics?.quality ?? '—'}/100 · ${state.result.conflicts?.length ?? 0} conflicts
      </div>
    </div>`;
}

function printFoot(state) {
  return `
    <div class="print-foot">
      <span>${esc(state.settings.schoolName)} — ${esc(state.settings.termName)}</span>
      <span>Timetable Studio · seed ${esc(String(state.result.seed ?? '—'))}</span>
    </div>`;
}

/* ───────────────────────────── interactions ─────────────────────────── */

export function registerTimetableHandlers() {
  on('click', 'set-view', (e, el) => {
    setPrefs({ view: el.dataset.view });
  });

  on('change', 'set-entity', (e, el) => {
    const state = getState();
    const id = el.value;
    if (state.ui.view === 'teacher') setPrefs({ activeTeacherId: id });
    else if (state.ui.view === 'room') setPrefs({ activeRoomId: id });
    else setPrefs({ activeClassId: id, agendaView: 'class' });
  });

  on('click', 'set-density', (e, el) => setPrefs({ density: el.dataset.density }));

  /* ── drag & drop ───────────────────────────────────────────────────── */
  on('dragstart', 'lesson-drag-start', (e, el) => {
    const state = getState();
    const lessonId = el.dataset.lesson;
    const locked = state.locks.some((l) => l.lessonId === lessonId);
    if (locked) {
      e.preventDefault();
      toastWarn('That lesson is pinned', 'Unpin it first if you want to move it.');
      return;
    }
    drag = {
      lessonId,
      model: currentModel(),
      result: { placements: state.result.placements, unplaced: [], conflicts: [], lockViolations: [] },
      cache: new Map(),
      lastCell: null,
    };
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', lessonId);
    } catch { /* older browsers */ }
  });

  on('dragend', 'lesson-drag-end', (e, el) => {
    el.classList.remove('dragging');
    clearDropMarks();
    drag = null;
  });

  on('dragover', 'cell-over', (e, el) => {
    if (!drag) return;
    const slotKey = el.dataset.slot;
    e.preventDefault();
    if (drag.lastCell === el) return;
    clearDropMarks();
    drag.lastCell = el;
    const verdict = cachedCanMove(slotKey);
    el.classList.add(verdict.ok ? 'drop-ok' : 'drop-bad');
    e.dataTransfer.dropEffect = verdict.ok ? 'move' : 'none';
  });

  on('dragleave', 'cell-leave', (e, el) => {
    el.classList.remove('drop-ok', 'drop-bad');
    if (drag && drag.lastCell === el) drag.lastCell = null;
  });

  on('drop', 'cell-drop', (e, el) => {
    e.preventDefault();
    clearDropMarks();
    if (!drag) return;
    const slotKey = el.dataset.slot;
    const lessonId = drag.lessonId;
    drag = null;

    const verdict = moveLesson(lessonId, slotKey);
    if (!verdict.ok) {
      toastError('Cannot move it there', verdict.reason);
      return;
    }
    toastOk('Lesson moved', `${describeLesson(lessonId)} → ${describeSlot(slotKey)}`);
  });

  /* ── lesson popover ────────────────────────────────────────────────── */
  on('click', 'lesson-open', (e, el) => {
    e.stopPropagation();
    openLessonPopover(el);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const el = document.activeElement;
      if (el?.classList?.contains('lesson') || el?.classList?.contains('agenda-item')) {
        e.preventDefault();
        openLessonPopover(el);
      }
    }
    if (e.key === 'Escape') closeLessonPopover();
  });

  document.addEventListener('click', (e) => {
    if (popover && !popover.contains(e.target) && !e.target.closest('.lesson') && !e.target.closest('.agenda-item')) {
      closeLessonPopover();
    }
  });

  on('click', 'lesson-pin', (e, el) => {
    const lessonId = el.dataset.lesson;
    const slotKey = el.dataset.slot;
    const dayId = slotKey.split('@')[0];
    const added = toggleLock(lessonId, slotKey, dayId);
    closeLessonPopover();
    toastOk(added ? 'Lesson pinned' : 'Lesson unpinned',
      added ? 'It stays exactly here on the next generate.' : 'The solver is free to move it again.');
  });

  on('click', 'lesson-improve', (e, el) => {
    const lessonId = el.dataset.lesson;
    closeLessonPopover();
    improveLesson(lessonId);
  });

  on('click', 'lesson-focus-day', (e, el) => {
    const slotKey = el.dataset.slot;
    closeLessonPopover();
    const [dayId] = slotKey.split('@');
    setPrefs({ view: 'agenda', activeClassId: getState().ui.activeClassId });
    toastOk('Agenda opened', `Showing the day-by-day list for ${dayId.toUpperCase()}.`);
  });

  function cachedCanMove(slotKey) {
    if (!drag) return { ok: false };
    if (drag.cache.has(slotKey)) return drag.cache.get(slotKey);
    const verdict = canMove(drag.model, drag.result, drag.lessonId, slotKey);
    drag.cache.set(slotKey, verdict);
    return verdict;
  }
}

function clearDropMarks() {
  document.querySelectorAll('.drop-ok, .drop-bad').forEach((el) => el.classList.remove('drop-ok', 'drop-bad'));
}

function describeLesson(lessonId) {
  const state = getState();
  const [subjectId, classId] = lessonId.split('::');
  const subject = state.subjects.find((s) => s.id === subjectId);
  const klass = state.classes.find((c) => c.id === classId);
  return `${subject?.name ?? subjectId} · ${klass?.name ?? classId}`;
}

function describeSlot(slotKey) {
  const state = getState();
  const [dayId, periodKey] = slotKey.split('@');
  const day = state.settings.days.find((d) => d.id === dayId);
  const period = state.settings.periods.find((p) => p.key === periodKey);
  return `${day?.label ?? dayId} ${period?.start ?? ''}`;
}

/** Move a lesson to its cheapest legal slot — a one-lesson optimisation. */
function improveLesson(lessonId) {
  const state = getState();
  const model = currentModel();
  const result = { placements: state.result.placements, unplaced: [], conflicts: [], lockViolations: [] };
  const current = result.placements.find((p) => p.lessonId === lessonId);
  if (!current) {
    toastWarn('Nothing to optimise', 'That lesson is not in the current timetable.');
    return;
  }

  // The lesson's own slot is a candidate too: canMove() lifts the lesson out of
  // the board before testing, so "stay where you are" is always legal and we
  // only move when another slot genuinely scores better.
  let best = null;
  for (const slot of model.slots) {
    if (!slot.teaching) continue;
    const verdict = canMove(model, result, lessonId, slot.key);
    if (!verdict.ok) continue;
    if (!best || verdict.decision.cost < best.cost - 0.5) {
      best = { slotKey: slot.key, cost: verdict.decision.cost };
    }
  }

  if (!best || best.slotKey === current.startSlotKey) {
    toastWarn('Already optimal', 'No legal slot scores better than the one this lesson is in.');
    return;
  }

  const moved = moveLesson(lessonId, best.slotKey);
  if (!moved.ok) {
    toastError('Move failed', moved.reason);
    return;
  }
  toastOk('Lesson optimised', `${describeLesson(lessonId)} → ${describeSlot(best.slotKey)}`);
}

/* ─────────────────────────── lesson popover ─────────────────────────── */

function openLessonPopover(anchor) {
  closeLessonPopover();
  document.querySelectorAll('.lesson.is-selected').forEach((el) => el.classList.remove('is-selected'));
  anchor.classList.add('is-selected');
  const state = getState();
  const lessonId = anchor.dataset.lesson;
  const slotKey = anchor.dataset.slot;
  const placement = state.result.placements.find((p) => p.lessonId === lessonId);
  if (!placement) return;

  const subject = state.subjects.find((s) => s.id === placement.subjectId) || {};
  const teacher = state.teachers.find((t) => t.id === placement.teacherId);
  const klass = state.classes.find((c) => c.id === placement.classId) || {};
  const room = state.rooms.find((r) => r.id === placement.roomId);
  const day = state.settings.days.find((d) => d.id === placement.dayId);
  const periodByKey = new Map(state.settings.periods.map((p) => [p.key, p]));
  const first = periodByKey.get(placement.slotKeys[0]?.split('@')[1]) || {};
  const last = periodByKey.get(placement.slotKeys[placement.slotKeys.length - 1]?.split('@')[1]) || {};
  const locked = state.locks.some((l) => l.lessonId === lessonId);

  const el = document.createElement('div');
  el.className = 'popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `${subject.name} details`);
  el.innerHTML = `
    <div class="row" style="align-items:flex-start;gap:12px">
      <span class="avatar" style="--h:${subject.hue ?? 222}">${esc(subject.code?.slice(0, 2) || '?')}</span>
      <div class="grow">
        <strong style="font-size:.95rem">${esc(subject.name)}</strong>
        <p class="small muted">${esc(day?.full || '')} · ${esc(first.start || '')}–${esc(last.end || '')}${placement.length > 1 ? ` · ${placement.length} periods` : ''}</p>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" type="button" data-close-pop aria-label="Close">${icon('x')}</button>
    </div>
    <hr class="divider" style="margin:12px 0" />
    <dl class="col" style="gap:7px;font-size:.82rem">
      <div class="spread"><dt class="muted">Class</dt><dd>${esc(klass.name)} <span class="faint">(${klass.size} pupils)</span></dd></div>
      <div class="spread"><dt class="muted">Teacher</dt><dd>${esc(teacher?.name || '—')}</dd></div>
      <div class="spread"><dt class="muted">Room</dt><dd>${esc(room?.name || '—')} ${room ? `<span class="faint">cap ${room.capacity}</span>` : ''}</dd></div>
      <div class="spread"><dt class="muted">Weekly</dt><dd>${subject.weeklyPeriods} period${subject.weeklyPeriods === 1 ? '' : 's'} · max ${subject.maxPerDay}/day</dd></div>
      ${placement.manual ? '<div class="spread"><dt class="muted">Status</dt><dd><span class="chip chip-warn">moved by hand</span></dd></div>' : ''}
    </dl>
    <hr class="divider" style="margin:12px 0" />
    <div class="row-wrap">
      <button class="btn btn-sm ${locked ? 'btn-outline' : 'btn-primary'}" type="button" data-action="lesson-pin"
        data-lesson="${esc(lessonId)}" data-slot="${esc(slotKey)}">
        ${icon(locked ? 'unlock' : 'pin')} ${locked ? 'Unpin' : 'Pin here'}
      </button>
      <button class="btn btn-sm btn-outline" type="button" data-action="lesson-improve" data-lesson="${esc(lessonId)}">
        ${icon('sparkles')} Find best slot
      </button>
      <button class="btn btn-sm btn-ghost" type="button" data-action="lesson-focus-day" data-slot="${esc(slotKey)}">
        ${icon('list')} Agenda
      </button>
    </div>
    ${locked ? '<p class="tiny faint" style="margin-top:10px">Pinned lessons are never moved by the solver.</p>' : ''}
  `;

  document.body.appendChild(el);
  const rect = anchor.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = rect.right + 10;
  if (left + width > window.innerWidth - 12) left = Math.max(12, rect.left - width - 10);
  let top = rect.top;
  if (top + height > window.innerHeight - 12) top = Math.max(12, window.innerHeight - height - 12);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-pop]')) closeLessonPopover();
  });

  popover = el;
  window.addEventListener('resize', closeLessonPopover, { once: true });
}

function closeLessonPopover() {
  document.querySelectorAll('.lesson.is-selected').forEach((el) => el.classList.remove('is-selected'));
  if (!popover) return;
  popover.remove();
  popover = null;
}
