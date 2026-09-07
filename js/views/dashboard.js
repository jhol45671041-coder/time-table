/** Dashboard: health of the generated timetable, candidates, diagnostics. */
import { esc, icon, pct, relativeTime } from '../ui/dom.js';
import { todayId, currentPeriodKey } from './timetable.js';

export function render(state) {
  const result = state.result;
  const metrics = result?.metrics;

  if (!result) {
    return `
      ${hero(state, null)}
      <section class="card card-pad anim-rise" style="--i:1">
        <div class="empty">
          <div class="empty-art">${icon('sparkles')}</div>
          <h2 class="h2">Ready when you are</h2>
          <p class="lead">The solver needs nothing but your data. It will place every lesson,
            respect every teacher's availability and room limit, then score its own work.</p>
          <div class="row-wrap" style="justify-content:center;margin-top:6px">
            <button class="btn btn-primary btn-lg" type="button" data-action="generate">${icon('sparkles')} Generate now</button>
            <button class="btn btn-outline" type="button" data-action="go" data-page="data">${icon('sliders')} Review the data first</button>
          </div>
        </div>
      </section>`;
  }

  return `
    ${hero(state, result)}
    ${statRow(state, metrics)}
    <div class="split">
      <div class="col" style="gap:var(--gap)">
        ${todayCard(state)}
        ${diagnosticsCard(state)}
        ${subjectSpreadCard(state)}
      </div>
      <div class="col" style="gap:var(--gap)">
        ${candidatesCard(state)}
        ${teacherLoadCard(state)}
        ${quickActions(state)}
      </div>
    </div>`;
}

/* ───────────────────────────────── hero ───────────────────────────────── */

function hero(state, result) {
  const quality = result?.metrics?.quality ?? 0;
  return `
    <section class="hero anim-rise">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">Fully automated scheduling</p>
          <h1 class="display gradient-text">${esc(state.settings.schoolName)}</h1>
          <p class="lead" style="margin-top:12px">
            ${esc(state.settings.termName)} — ${state.classes.length} classes,
            ${state.subjects.length} subjects, ${state.teachers.length} teachers and
            ${state.rooms.length} rooms arranged into
            ${state.settings.days.filter((d) => d.active !== false).length} days of
            ${state.settings.periods.filter((p) => p.kind === 'lesson').length} periods.
          </p>
          ${result ? `
            <p class="small muted" style="margin-top:10px">
              ${icon('clock')} Solved in ${result.stats?.durationMs ?? '—'} ms across
              ${result.stats?.restarts ?? 1} search pass${(result.stats?.restarts ?? 1) === 1 ? '' : 'es'} ·
              seed ${esc(String(result.seed ?? '—'))} · ${relativeTime(result.generatedAt)}
            </p>` : ''}
          <div class="row-wrap" style="margin-top:20px">
            <button class="btn btn-primary btn-lg" type="button" data-action="generate">
              ${icon('sparkles')} ${result ? 'Generate again' : 'Generate timetable'}
            </button>
            <button class="btn btn-outline btn-lg" type="button" data-action="go" data-page="timetable">
              ${icon('calendar')} Open timetable
            </button>
            <button class="btn btn-ghost" type="button" data-action="random-school">
              ${icon('dice')} Try a random school
            </button>
          </div>
        </div>
        <div class="col" style="align-items:center;gap:16px">
          ${qualityRing(quality)}
          <div class="row-wrap" style="justify-content:center">
            ${result?.conflicts?.length
              ? `<span class="chip chip-danger">${icon('alert')} ${result.conflicts.length} conflicts</span>`
              : `<span class="chip chip-ok">${icon('check-circle')} zero conflicts</span>`}
            <span class="chip">${icon('layers')} ${result?.placements?.length ?? 0} lessons</span>
            ${state.locks.length ? `<span class="chip chip-accent">${icon('pin')} ${state.locks.length} pinned</span>` : ''}
          </div>
        </div>
      </div>
    </section>`;
}

function qualityRing(quality) {
  const value = Math.max(0, Math.min(100, Math.round(quality || 0)));
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const tone = value >= 90 ? 'var(--ok)' : value >= 70 ? 'var(--accent)' : value >= 45 ? 'var(--warn)' : 'var(--danger)';
  return `
    <div class="ring" style="--tone:${tone}" role="img" aria-label="Timetable quality ${value} out of 100">
      <svg viewBox="0 0 140 140" width="152" height="152">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)"/>
            <stop offset="100%" stop-color="var(--accent-2)"/>
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--inset)" stroke-width="11"/>
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="url(#ring-grad)" stroke-width="11"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)"/>
      </svg>
      <div class="ring-label">
        <strong>${value}</strong>
        <span>quality</span>
      </div>
    </div>`;
}

/* ──────────────────────────────── stats ───────────────────────────────── */

function statRow(state, m) {
  const activeDays = state.settings.days.filter((d) => d.active !== false).length;
  const teachingSlots = state.settings.periods.filter((p) => p.kind === 'lesson').length;
  const capacity = activeDays * teachingSlots * state.classes.length;
  const demand = state.subjects.reduce((sum, s) => sum + s.weeklyPeriods * (s.classIds?.length || state.classes.length), 0);

  const stats = [
    {
      label: 'Lessons placed', value: `${m.placed}<small>/${m.totalLessons}</small>`,
      icon: 'layers', sub: `${m.periods} teaching periods scheduled`, meter: m.totalLessons ? m.placed / m.totalLessons : 1,
    },
    {
      label: 'Hard conflicts', value: `${m.conflicts}`, icon: 'check-circle', tone: m.conflicts ? 'warn' : 'ok',
      sub: m.conflicts ? 'Regenerate to clear them' : 'Teachers, rooms and classes all clash-free',
      meter: m.conflicts ? 0.1 : 1,
    },
    {
      label: 'Room utilisation', value: pct(m.utilisation), icon: 'door',
      sub: `${m.periods} of ${capacity} class-slots used`, meter: m.utilisation,
    },
    {
      label: 'Idle gaps', value: `${m.classHoles}`, icon: 'target', tone: m.classHoles > 4 ? 'warn' : 'ok',
      sub: m.classHoles === 0 ? 'Every class day runs edge-to-edge' : `${m.classHoles} free periods inside class days`,
      meter: 1 - Math.min(1, m.classHoles / Math.max(1, m.placed)),
    },
    {
      label: 'Even spread', value: pct(m.spread), icon: 'shuffle',
      sub: 'Subjects distributed across the week', meter: m.spread,
    },
    {
      label: 'Staff balance', value: pct(m.balance), icon: 'users',
      sub: `Avg ${m.avgTeacherLoad.toFixed(1)} periods/teacher/week`, meter: m.balance,
    },
  ];

  return `
    <div class="stat-grid stagger">
      ${stats.map((s, i) => `
        <article class="stat" style="--i:${i}">
          <p class="stat-top">${icon(s.icon)} ${esc(s.label)}</p>
          <p class="stat-value">${s.value}</p>
          <p class="stat-sub">${esc(s.sub)}</p>
          <div class="meter ${s.tone === 'warn' ? 'meter-warn' : s.tone === 'ok' ? 'meter-ok' : ''}"><i style="width:${Math.round(Math.max(0.02, Math.min(1, s.meter)) * 100)}%"></i></div>
        </article>`).join('')}
    </div>
    <p class="tiny faint" style="margin-top:-8px">
      Demand ${demand} periods · capacity ${capacity} class-slots · ${activeDays} teaching days
    </p>`;
}

/* ─────────────────────────── today at a glance ────────────────────────── */

function todayCard(state) {
  const today = todayId(state);
  const day = state.settings.days.find((d) => d.id === today && d.active !== false);
  const klass = state.classes.find((c) => c.id === state.ui.activeClassId) || state.classes[0];
  const nowPeriod = currentPeriodKey(state);

  const head = `
    <div class="card-head">
      <span class="dot ${day ? 'dot-live' : ''}" style="${day ? 'background:var(--accent)' : ''}"></span>
      <div class="grow">
        <h2>${day ? 'Today at a glance' : 'Not a teaching day'}</h2>
        <p class="tiny muted">${day ? `${esc(day.full)} · ${esc(klass?.name || '')}` : 'The week starts again on the next active day'}</p>
      </div>
      <select class="select" style="width:auto" data-on-change="dash-class" aria-label="Choose class">
        ${state.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === klass?.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>`;

  if (!day || !klass) {
    return `<section class="card anim-rise" style="--i:2">${head}<div class="card-body"><p class="muted small">Nothing scheduled today.</p></div></section>`;
  }

  const placements = state.result.placements.filter((p) => p.classId === klass.id && p.dayId === day.id);
  const byStart = new Map(placements.map((p) => [p.startSlotKey, p]));
  const subjectById = new Map(state.subjects.map((s) => [s.id, s]));
  const teacherById = new Map(state.teachers.map((t) => [t.id, t]));
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));

  const rows = state.settings.periods.map((period) => {
    if (period.kind !== 'lesson') {
      return `<div class="today-row break"><span class="t">${esc(period.start)}</span><span class="b">${esc(period.label)}</span></div>`;
    }
    const placement = byStart.get(`${day.id}@${period.key}`);
    const isNow = period.key === nowPeriod;
    if (!placement) {
      return `<div class="today-row free ${isNow ? 'now' : ''}"><span class="t">${esc(period.start)}</span><span class="b">Free period</span></div>`;
    }
    const subject = subjectById.get(placement.subjectId) || {};
    return `
      <div class="today-row ${isNow ? 'now' : ''}" data-action="go-timetable" style="--h:${subject.hue ?? 222};cursor:pointer">
        <span class="t">${esc(period.start)}</span>
        <span class="swatch"></span>
        <span class="grow">
          <strong>${esc(subject.name)}</strong>
          <em>${esc(teacherById.get(placement.teacherId)?.name || '—')} · ${esc(roomById.get(placement.roomId)?.name || '—')}</em>
        </span>
        ${isNow ? '<span class="chip chip-accent">now</span>' : `<span class="tiny faint">${placement.length > 1 ? `${placement.length}×` : ''}</span>`}
      </div>`;
  }).join('');

  return `
    <section class="card anim-rise" style="--i:2">
      ${head}
      <div class="card-body today">${rows}</div>
    </section>`;
}

/* ────────────────────────────── diagnostics ───────────────────────────── */

function diagnosticsCard(state) {
  const issues = state.result.diagnostics || [];
  const icons = { ok: 'check-circle', warn: 'alert', error: 'alert' };
  return `
    <section class="card anim-rise" style="--i:3">
      <div class="card-head">
        ${icon('target')}
        <div class="grow"><h2>Solver report</h2><p class="tiny muted">What the engine checked and what it would change</p></div>
        <span class="chip ${issues.some((i) => i.severity === 'error') ? 'chip-danger' : issues.some((i) => i.severity === 'warn') ? 'chip-warn' : 'chip-ok'}">
          ${issues.filter((i) => i.severity !== 'ok').length} item${issues.filter((i) => i.severity !== 'ok').length === 1 ? '' : 's'}
        </span>
      </div>
      <div class="card-body col" style="gap:10px">
        ${issues.map((issue) => `
          <div class="alert alert-${issue.severity}">
            ${icon(icons[issue.severity] || 'info')}
            <div class="grow">
              <strong>${esc(issue.title)}</strong>
              ${issue.detail ? `<p>${esc(issue.detail)}</p>` : ''}
              ${issue.hint ? `<p style="color:var(--text);opacity:.85">${esc(issue.hint)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </section>`;
}

/* ──────────────────────── subject spread per class ────────────────────── */

function subjectSpreadCard(state) {
  const days = state.settings.days.filter((d) => d.active !== false);
  const klass = state.classes.find((c) => c.id === state.ui.activeClassId) || state.classes[0];
  const subjectById = new Map(state.subjects.map((s) => [s.id, s]));

  const rows = state.subjects.map((subject, i) => {
    const cells = days.map((day) => {
      const count = state.result.placements.filter(
        (p) => p.classId === klass?.id && p.subjectId === subject.id && p.dayId === day.id,
      ).length;
      return `<span class="sp-cell ${count ? 'on' : ''}" style="--h:${subject.hue}" title="${esc(subject.name)} · ${esc(day.label)}">${count || ''}</span>`;
    }).join('');
    return `
      <div class="sp-row" style="--i:${i}">
        <span class="sp-name">${esc(subject.code || subject.name)}</span>
        <span class="sp-cells">${cells}</span>
        <span class="sp-total">${subject.weeklyPeriods}</span>
      </div>`;
  }).join('');

  return `
    <section class="card anim-rise" style="--i:4">
      <div class="card-head">
        ${icon('shuffle')}
        <div class="grow"><h2>Weekly spread · ${esc(klass?.name || '')}</h2>
        <p class="tiny muted">Sessions per subject per day — the solver keeps this as even as the rules allow</p></div>
      </div>
      <div class="card-body">
        <div class="sp-head">
          <span class="sp-name"></span>
          <span class="sp-cells">${days.map((d) => `<span class="sp-day">${esc(d.label)}</span>`).join('')}</span>
          <span class="sp-total tiny faint">wk</span>
        </div>
        <div class="sp-body">${rows}</div>
      </div>
    </section>`;
}

/* ───────────────────────────── candidates ─────────────────────────────── */

function candidatesCard(state) {
  const alts = state.result.alternatives || [];
  if (alts.length < 2) return '';
  return `
    <section class="card anim-rise" style="--i:5">
      <div class="card-head">
        ${icon('layers')}
        <div class="grow"><h2>Candidate solutions</h2><p class="tiny muted">Three independent solves, ranked by quality</p></div>
      </div>
      <div class="card-body col" style="gap:9px">
        ${alts.map((alt, i) => {
          const active = alt.seed === state.result.seed;
          return `
            <div class="cand ${active ? 'active' : ''}" style="--i:${i}">
              <span class="cand-rank">${i === 0 ? icon('star') : i + 1}</span>
              <span class="grow">
                <strong>Quality ${alt.quality}</strong>
                <em>${alt.conflicts} conflicts · ${alt.unplaced} unplaced · ${(alt.utilisation * 100).toFixed(0)}% used · seed ${alt.seed}</em>
                <span class="meter"><i style="width:${alt.quality}%"></i></span>
              </span>
              <button class="btn btn-sm ${active ? 'btn-ghost' : 'btn-outline'}" type="button"
                data-action="use-candidate" data-seed="${alt.seed}" ${active ? 'disabled' : ''}>
                ${active ? icon('check') : 'Use'}
              </button>
            </div>`;
        }).join('')}
      </div>
    </section>`;
}

/* ───────────────────────────── teacher load ───────────────────────────── */

function teacherLoadCard(state) {
  const load = state.result.metrics.teacherLoad || {};
  const max = Math.max(1, ...Object.values(load));
  const rows = state.teachers.map((teacher, i) => {
    const value = load[teacher.id] || 0;
    const capacity = teacher.maxPeriodsPerDay * state.settings.days.filter((d) => d.active !== false).length;
    return `
      <div class="load-row" style="--i:${i};--h:${(i * 47) % 360}">
        <span class="name" data-tip="${esc(teacher.name)} · max ${teacher.maxPeriodsPerDay}/day">${esc(teacher.name)}</span>
        <span class="track"><i style="width:${Math.round((value / Math.max(max, capacity)) * 100)}%"></i></span>
        <span class="val">${value}</span>
      </div>`;
  }).join('');

  return `
    <section class="card anim-rise" style="--i:6">
      <div class="card-head">
        ${icon('users')}
        <div class="grow"><h2>Teacher load</h2><p class="tiny muted">Periods per week against each contract maximum</p></div>
      </div>
      <div class="card-body load-bars">${rows}</div>
    </section>`;
}

/* ──────────────────────────── quick actions ───────────────────────────── */

function quickActions(state) {
  return `
    <section class="card anim-rise" style="--i:7">
      <div class="card-head">${icon('zap')}<div class="grow"><h2>Quick actions</h2></div></div>
      <div class="card-body col" style="gap:8px">
        <button class="btn btn-outline btn-block" type="button" data-action="go" data-page="styles">
          ${icon('palette')} Restyle the whole app <span class="grow"></span> ${icon('chevron-right')}
        </button>
        <button class="btn btn-outline btn-block" type="button" data-action="export" data-format="csv">
          ${icon('download')} Export CSV
        </button>
        <button class="btn btn-outline btn-block" type="button" data-action="copy" data-format="markdown">
          ${icon('copy')} Copy as Markdown
        </button>
        <button class="btn btn-outline btn-block" type="button" data-action="print">${icon('printer')} Print / save PDF</button>
        ${state.locks.length ? `
          <button class="btn btn-ghost btn-block" type="button" data-action="clear-locks">
            ${icon('unlock')} Unpin all ${state.locks.length} lesson${state.locks.length === 1 ? '' : 's'}
          </button>` : ''}
        <button class="btn btn-ghost btn-block" type="button" data-action="reset-demo">${icon('refresh')} Reset demo data</button>
      </div>
    </section>`;
}
