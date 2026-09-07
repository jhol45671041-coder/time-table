/** Exports: CSV · JSON · ICS · Markdown · print. */
import { getState } from './state.js';
import { download, copyText } from './ui/dom.js';
import { toastOk, toastError } from './ui/toast.js';

/* ─────────────────────────── shared helpers ─────────────────────────── */

function rows(state) {
  const placements = state.result?.placements ?? [];
  const subjectById = new Map(state.subjects.map((s) => [s.id, s]));
  const classById = new Map(state.classes.map((c) => [c.id, c]));
  const teacherById = new Map(state.teachers.map((t) => [t.id, t]));
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));
  const periodByKey = new Map(state.settings.periods.map((p) => [p.key, p]));
  const dayById = new Map(state.settings.days.map((d) => [d.id, d]));

  return placements
    .map((p) => {
      const subject = subjectById.get(p.subjectId) || {};
      const klass = classById.get(p.classId) || {};
      const teacher = teacherById.get(p.teacherId) || {};
      const room = roomById.get(p.roomId) || {};
      const day = dayById.get(p.dayId) || {};
      const period = periodByKey.get(p.slotKeys[0]?.split('@')[1]) || {};
      const lastPeriod = periodByKey.get(p.slotKeys[p.slotKeys.length - 1]?.split('@')[1]) || {};
      return {
        day: day.full || day.label || p.dayId,
        dayId: p.dayId,
        dayIndex: (state.settings.days.findIndex((d) => d.id === p.dayId) + 1) || 0,
        period: period.label || '',
        start: period.start || '',
        end: lastPeriod.end || period.end || '',
        class: klass.name || p.classId,
        subject: subject.name || p.subjectId,
        code: subject.code || '',
        teacher: teacher.name || '—',
        room: room.name || '—',
        length: p.length,
        locked: p.locked ? 'yes' : '',
      };
    })
    .sort((a, b) => a.dayIndex - b.dayIndex || a.start.localeCompare(b.start) || a.class.localeCompare(b.class));
}

function scopeFilter(state, scope) {
  const { scopeKind, scopeId } = scope;
  if (scopeKind === 'class') return (r) => r.class === (state.classes.find((c) => c.id === scopeId)?.name ?? r.class);
  if (scopeKind === 'teacher') return (r) => r.teacher === (state.teachers.find((t) => t.id === scopeId)?.name ?? r.teacher);
  if (scopeKind === 'room') return (r) => r.room === (state.rooms.find((x) => x.id === scopeId)?.name ?? r.room);
  return () => true;
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/* ──────────────────────────────── CSV ───────────────────────────────── */

const CSV_COLUMNS = ['Day', 'Period', 'Start', 'End', 'Class', 'Subject', 'Code', 'Teacher', 'Room', 'Length', 'Pinned'];

export function toCSV(state = getState(), scope = { scopeKind: 'all' }) {
  const keep = scopeFilter(state, scope);
  const data = rows(state).filter(keep);
  const escapeCell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    CSV_COLUMNS.join(','),
    ...data.map((r) =>
      [r.day, r.period, r.start, r.end, r.class, r.subject, r.code, r.teacher, r.room, r.length, r.locked]
        .map(escapeCell)
        .join(','),
    ),
  ].join('\n');
}

/* ──────────────────────────────── JSON ──────────────────────────────── */

export function toJSON(state = getState()) {
  return JSON.stringify(state, null, 2);
}

/* ─────────────────────────── Markdown table ────────────────────────── */

export function toMarkdown(state = getState(), scope = { scopeKind: 'all' }) {
  const keep = scopeFilter(state, scope);
  const data = rows(state).filter(keep);
  const days = state.settings.days.filter((d) => d.active !== false);
  const periods = state.settings.periods.filter((p) => p.kind === 'lesson');
  const label = scope.scopeKind === 'all'
    ? state.settings.schoolName
    : scope.scopeKind === 'class'
      ? state.classes.find((c) => c.id === scope.scopeId)?.name
      : scope.scopeKind === 'teacher'
        ? state.teachers.find((t) => t.id === scope.scopeId)?.name
        : state.rooms.find((r) => r.id === scope.scopeId)?.name;

  const lines = [
    `# ${label} — ${state.settings.termName}`,
    '',
    `| Time | ${days.map((d) => d.label).join(' | ')} |`,
    `| --- |${days.map(() => ' --- |').join('')}`,
  ];

  for (const period of periods) {
    const cells = days.map((day) => {
      const hit = data.find((r) => r.dayId === day.id && r.period === period.label);
      return hit ? `**${hit.subject}**<br>${hit.teacher}${hit.room !== '—' ? ` · ${hit.room}` : ''}` : '';
    });
    lines.push(`| ${period.start}–${period.end} | ${cells.join(' | ')} |`);
  }

  lines.push('', `_Generated ${new Date().toLocaleString()} · quality ${state.result?.metrics?.quality ?? '—'}/100 · ${state.result?.conflicts?.length ?? 0} conflicts_`);
  return lines.join('\n');
}

/* ───────────────────────────────── ICS ─────────────────────────────── */

/**
 * Real calendar events for the *next* occurrence of each weekday, so the
 * timetable can be dropped straight into Google/Apple/Outlook Calendar.
 * @param {string} [weekStartISO] Monday of the week to project onto.
 */
export function toICS(state = getState(), scope = { scopeKind: 'all' }, weekStartISO = null) {
  const keep = scopeFilter(state, scope);
  const data = rows(state).filter(keep);

  const start = weekStartISO ? new Date(weekStartISO) : nextMonday();
  const dayIds = state.settings.days.filter((d) => d.active !== false).map((d) => d.id);

  const dateFor = (dayId) => {
    const offset = Math.max(0, dayIds.indexOf(dayId));
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return date;
  };

  const pad = (n) => String(n).padStart(2, '0');
  const asUTC = (date, time) => {
    const [h, m] = (time || '08:00').split(':').map(Number);
    const local = new Date(date);
    local.setHours(h || 0, m || 0, 0, 0);
    return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}00Z`;
  };

  const events = data.map((r, index) => {
    const date = dateFor(r.dayId);
    const summary = `${r.subject} — ${r.class}`;
    const location = r.room !== '—' ? r.room : '';
    const description = `Teacher: ${r.teacher}\\nClass: ${r.class}\\nPeriod: ${r.period}${r.locked ? '\\nPinned by user' : ''}`;
    return [
      'BEGIN:VEVENT',
      `UID:${slug(r.class)}-${slug(r.subject)}-${index}-${stamp()}@timetable.studio`,
      `DTSTAMP:${asUTC(new Date(), new Date().toTimeString().slice(0, 5))}`,
      `DTSTART:${asUTC(date, r.start)}`,
      `DTEND:${asUTC(date, r.end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      location ? `LOCATION:${icsEscape(location)}` : '',
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lesson starts in 10 minutes',
      'END:VALARM',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  });

  const label = scope.scopeKind === 'all' ? state.settings.schoolName : (
    state.classes.find((c) => c.id === scope.scopeId)?.name ||
    state.teachers.find((t) => t.id === scope.scopeId)?.name ||
    state.rooms.find((r) => r.id === scope.scopeId)?.name || 'Timetable'
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timetable Studio//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`${label} — ${state.settings.termName}`)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function icsEscape(text) {
  return String(text).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function nextMonday() {
  const date = new Date();
  const day = date.getDay();
  const delta = day === 0 ? 1 : (day <= 1 ? 1 : 8 - day);
  date.setDate(date.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date;
}

/* ─────────────────────────── text timetable ────────────────────────── */

export function toText(state = getState(), scope = { scopeKind: 'all' }) {
  const keep = scopeFilter(state, scope);
  const data = rows(state).filter(keep);
  const days = state.settings.days.filter((d) => d.active !== false);
  const width = 18;
  const cell = (text) => String(text).slice(0, width - 1).padEnd(width);

  const lines = [
    `${state.settings.schoolName} — ${state.settings.termName}`,
    `${'='.repeat(width * (days.length + 1))}`,
    cell('Time') + days.map((d) => cell(d.label)).join(''),
    `${'-'.repeat(width * (days.length + 1))}`,
  ];

  for (const period of state.settings.periods) {
    const isLesson = period.kind === 'lesson';
    const time = isLesson ? `${period.start}` : period.label;
    const cells = days.map((day) => {
      if (!isLesson) return cell('· break ·');
      const hit = data.find((r) => r.dayId === day.id && r.period === period.label);
      return cell(hit ? `${hit.subject}` : '');
    });
    lines.push(cell(time) + cells.join(''));
    if (isLesson) {
      const sub = days.map((day) => {
        const hit = data.find((r) => r.dayId === day.id && r.period === period.label);
        return cell(hit ? `${hit.room}` : '');
      });
      lines.push(cell('') + sub.join(''));
    }
  }
  return lines.join('\n');
}

/* ─────────────────────────────── actions ───────────────────────────── */

export function exportAs(format, scope = { scopeKind: 'all' }) {
  const state = getState();
  if (!state.result?.placements?.length) {
    toastError('Nothing to export yet', 'Generate a timetable first.');
    return;
  }
  const name = scopeLabel(state, scope);
  try {
    if (format === 'csv') {
      download(`timetable-${slug(name)}-${stamp()}.csv`, toCSV(state, scope), 'text/csv;charset=utf-8');
    } else if (format === 'json') {
      download(`timetable-data-${stamp()}.json`, toJSON(state), 'application/json');
    } else if (format === 'ics') {
      download(`timetable-${slug(name)}-${stamp()}.ics`, toICS(state, scope), 'text/calendar;charset=utf-8');
    } else if (format === 'markdown') {
      download(`timetable-${slug(name)}-${stamp()}.md`, toMarkdown(state, scope), 'text/markdown;charset=utf-8');
    } else if (format === 'text') {
      download(`timetable-${slug(name)}-${stamp()}.txt`, toText(state, scope), 'text/plain;charset=utf-8');
    }
    toastOk(`${format.toUpperCase()} exported`, `${rows(state).filter(scopeFilter(state, scope)).length} lessons · ${name}`);
  } catch (err) {
    toastError('Export failed', String(err?.message || err));
  }
}

export async function copyAs(format, scope = { scopeKind: 'all' }) {
  const state = getState();
  const text = format === 'csv' ? toCSV(state, scope)
    : format === 'json' ? toJSON(state)
      : format === 'ics' ? toICS(state, scope)
        : format === 'text' ? toText(state, scope)
          : toMarkdown(state, scope);
  const ok = await copyText(text);
  if (ok) toastOk('Copied to clipboard', `${format.toUpperCase()} · ${text.length.toLocaleString()} characters`);
  else toastError('Could not copy', 'Your browser blocked clipboard access — use Download instead.');
  return ok;
}

export function preview(format, scope = { scopeKind: 'all' }) {
  const state = getState();
  if (!state.result?.placements?.length) return '— generate a timetable first —';
  try {
    if (format === 'csv') return toCSV(state, scope);
    if (format === 'json') return toJSON(state);
    if (format === 'ics') return toICS(state, scope);
    if (format === 'text') return toText(state, scope);
    return toMarkdown(state, scope);
  } catch (err) {
    return `Export error: ${err.message}`;
  }
}

function scopeLabel(state, scope) {
  if (scope.scopeKind === 'class') return state.classes.find((c) => c.id === scope.scopeId)?.name ?? 'class';
  if (scope.scopeKind === 'teacher') return state.teachers.find((t) => t.id === scope.scopeId)?.name ?? 'teacher';
  if (scope.scopeKind === 'room') return state.rooms.find((r) => r.id === scope.scopeId)?.name ?? 'room';
  return 'all';
}
