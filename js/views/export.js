/** Export view — CSV / JSON / ICS / Markdown / plain text + print. */
import { esc, icon, on } from '../ui/dom.js';
import { getState, setPrefs } from '../state.js';
import { exportAs, copyAs, preview } from '../exporters.js';
import { toastWarn } from '../ui/toast.js';

const FORMATS = [
  { id: 'csv', name: 'CSV', icon: 'list', ext: '.csv', blurb: 'Opens in Excel, Sheets or any SIS import tool.' },
  { id: 'json', name: 'JSON', icon: 'save', ext: '.json', blurb: 'The whole dataset — classes, staff, rooms, pins and the solved week.' },
  { id: 'ics', name: 'Calendar (ICS)', icon: 'calendar', ext: '.ics', blurb: 'Real recurring events for Google, Apple and Outlook calendars.' },
  { id: 'markdown', name: 'Markdown', icon: 'edit', ext: '.md', blurb: 'A week table you can paste into Notion, GitHub or a wiki.' },
  { id: 'text', name: 'Plain text', icon: 'list', ext: '.txt', blurb: 'Fixed-width grid for the staffroom noticeboard.' },
];

export function render(state) {
  const scope = state.ui.exportScope || { scopeKind: 'all' };
  const hasResult = Boolean(state.result?.placements?.length);

  return `
    <section class="card anim-rise">
      <div class="card-head">
        ${icon('download')}
        <div class="grow">
          <h2>Export & print</h2>
          <p class="tiny muted">Everything is generated in your browser — no data leaves this device</p>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-action="print">${icon('printer')} Print view</button>
      </div>

      <div class="card-body col" style="gap:18px">
        <div class="field">
          <span class="label">Scope</span>
          <div class="row-wrap">
            <div class="segmented" role="group" aria-label="Export scope kind">
              ${['all', 'class', 'teacher', 'room'].map((kind) => `
                <button type="button" data-action="scope-kind" data-kind="${kind}" aria-pressed="${scope.scopeKind === kind}">
                  ${kind === 'all' ? 'Whole school' : kind[0].toUpperCase() + kind.slice(1)}
                </button>`).join('')}
            </div>
            ${scope.scopeKind === 'all' ? '' : scopeSelect(state, scope)}
          </div>
          <p class="help">${scopeSentence(state, scope)}</p>
        </div>

        ${hasResult ? '' : `
          <div class="alert alert-warn">
            ${icon('alert')}
            <div class="grow"><strong>No timetable to export yet</strong>
            <p>Generate one first — it takes well under a second.</p></div>
            <button class="btn btn-primary btn-sm" type="button" data-action="generate">${icon('sparkles')} Generate</button>
          </div>`}

        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
          ${FORMATS.map((format, i) => `
            <article class="card card-pad lift" style="animation: rise var(--t-slow) var(--ease-out) both; animation-delay:${i * 45}ms">
              <div class="row" style="align-items:flex-start">
                <span class="empty-art" style="width:38px;height:38px;border-radius:12px">${icon(format.icon)}</span>
                <div class="grow">
                  <strong>${esc(format.name)}</strong>
                  <p class="tiny muted" style="margin-top:3px;line-height:1.4">${esc(format.blurb)}</p>
                </div>
              </div>
              <div class="row" style="margin-top:14px">
                <button class="btn btn-primary btn-sm grow" type="button" data-action="export" data-format="${format.id}" ${hasResult ? '' : 'disabled'}>
                  ${icon('download')} Download ${format.ext}
                </button>
                <button class="btn btn-outline btn-icon btn-sm" type="button" data-action="copy" data-format="${format.id}"
                  data-tip="Copy to clipboard" ${hasResult ? '' : 'disabled'}>${icon('copy')}</button>
                <button class="btn btn-ghost btn-icon btn-sm" type="button" data-action="preview" data-format="${format.id}"
                  data-tip="Preview" ${hasResult ? '' : 'disabled'}>${icon('eye')}</button>
              </div>
            </article>`).join('')}
        </div>
      </div>
    </section>

    <section class="card anim-rise" style="--i:2">
      <div class="card-head">${icon('printer')}<div class="grow"><h2>Print-ready sheet</h2>
        <p class="tiny muted">Landscape A4 with a letterhead, ink-friendly colours and no UI chrome</p></div>
        <button class="btn btn-outline btn-sm" type="button" data-action="go" data-page="timetable">${icon('calendar')} Choose view</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="print">${icon('printer')} Print</button>
      </div>
      <div class="card-body">
        <div class="print-mock">
          <div class="print-mock-head">
            <strong>${esc(state.settings.schoolName)}</strong>
            <span>${esc(state.settings.termName)}</span>
          </div>
          <div class="print-mock-grid" style="--cols:${Math.max(1, state.settings.days.filter((d) => d.active !== false).length)}">
            ${['', ...state.settings.days.filter((d) => d.active !== false).map((d) => d.label)].map((label, i) =>
              i === 0 ? '<span></span>' : `<span class="pm-day">${esc(label)}</span>`).join('')}
            ${Array.from({ length: 4 }, (_, r) => `
              <span class="pm-time">${esc(state.settings.periods.filter((p) => p.kind === 'lesson')[r]?.start ?? '')}</span>
              ${state.settings.days.filter((d) => d.active !== false).map((day, c) => {
                const subject = state.subjects[(r * 5 + c * 3) % Math.max(1, state.subjects.length)];
                return `<span class="pm-cell" style="--h:${subject?.hue ?? 222}">${esc(subject?.code ?? '')}</span>`;
              }).join('')}
            `).join('')}
          </div>
          <p class="tiny faint" style="margin-top:10px">Preview only — the real printout uses the live timetable.</p>
        </div>
      </div>
    </section>

    <section class="card anim-rise" style="--i:3">
      <div class="card-head">${icon('upload')}<div class="grow"><h2>Import a dataset</h2>
        <p class="tiny muted">Restore a previously exported JSON file</p></div>
        <button class="btn btn-outline btn-sm" type="button" data-action="import-file">${icon('upload')} Choose file…</button>
      </div>
      <div class="card-body">
        <pre class="code">{
  "version": 3,
  "settings": { "schoolName": "…", "days": […], "periods": […] },
  "classes":  [{ "id": "c-10a", "name": "10A", "size": 28, "homeRoomId": "r-101" }],
  "subjects": [{ "id": "maths", "name": "Mathematics", "weeklyPeriods": 4,
                 "maxPerDay": 1, "sessionLength": 1, "difficulty": 3,
                 "roomType": "any", "teacherId": "t-amara", "hue": 222 }],
  "teachers": [{ "id": "t-amara", "name": "Amara Osei", "maxPeriodsPerDay": 6,
                 "unavailable": ["wed@p7", "wed@p8"] }],
  "rooms":    [{ "id": "r-lab-a", "name": "Lab A", "capacity": 32, "type": "lab" }],
  "locks":    [{ "lessonId": "maths::c-10a::0", "slotKey": "mon@p1" }]
}</pre>
      </div>
    </section>`;
}

function scopeSelect(state, scope) {
  const list = scope.scopeKind === 'class' ? state.classes
    : scope.scopeKind === 'teacher' ? state.teachers
      : state.rooms;
  return `
    <select class="select" style="width:auto;min-width:180px" data-on-change="scope-id" aria-label="Choose scope">
      ${list.map((item) => `<option value="${esc(item.id)}" ${scope.scopeId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
    </select>`;
}

function scopeSentence(state, scope) {
  const count = state.result?.placements?.length ?? 0;
  if (scope.scopeKind === 'all') return `${count} lessons across ${state.classes.length} classes.`;
  const list = scope.scopeKind === 'class' ? state.classes : scope.scopeKind === 'teacher' ? state.teachers : state.rooms;
  const item = list.find((x) => x.id === scope.scopeId) || list[0];
  if (!item) return 'Nothing matches this scope yet.';
  const key = scope.scopeKind === 'class' ? 'classId' : scope.scopeKind === 'teacher' ? 'teacherId' : 'roomId';
  const n = (state.result?.placements ?? []).filter((p) => p[key] === item.id).length;
  return `${n} lesson${n === 1 ? '' : 's'} for ${item.name}.`;
}

export function registerExportHandlers() {
  on('click', 'scope-kind', (e, el) => {
    const state = getState();
    const kind = el.dataset.kind;
    const firstId = kind === 'class' ? state.classes[0]?.id
      : kind === 'teacher' ? state.teachers[0]?.id
        : kind === 'room' ? state.rooms[0]?.id : null;
    setPrefs({ exportScope: kind === 'all' ? { scopeKind: 'all' } : { scopeKind: kind, scopeId: firstId } });
  });

  on('change', 'scope-id', (e, el) => {
    const state = getState();
    const scope = state.ui.exportScope || { scopeKind: 'class' };
    setPrefs({ exportScope: { ...scope, scopeId: el.value } });
  });

  on('click', 'export', (e, el) => {
    const state = getState();
    if (!state.result?.placements?.length) {
      toastWarn('Nothing to export', 'Generate a timetable first.');
      return;
    }
    exportAs(el.dataset.format, state.ui.exportScope || { scopeKind: 'all' });
  });

  on('click', 'copy', (e, el) => {
    const state = getState();
    copyAs(el.dataset.format, state.ui.exportScope || { scopeKind: 'all' });
  });

  on('click', 'preview', (e, el) => {
    const state = getState();
    const text = preview(el.dataset.format, state.ui.exportScope || { scopeKind: 'all' });
    import('../ui/modal.js').then(({ openModal }) => {
      openModal({
        title: `${el.dataset.format.toUpperCase()} preview`,
        subtitle: `${text.split('\n').length} lines · ${text.length.toLocaleString()} characters`,
        size: 'wide',
        body: `<pre class="code" style="max-height:56vh">${esc(text)}</pre>`,
        footer: `
          <button class="btn btn-ghost" type="button" data-close>Close</button>
          <button class="btn btn-outline" type="button" data-copy-preview>${icon('copy')} Copy</button>
          <button class="btn btn-primary" type="button" data-download-preview>${icon('download')} Download</button>`,
        onMount: (root) => {
          root.querySelector('[data-copy-preview]').addEventListener('click', () => {
            copyAs(el.dataset.format, state.ui.exportScope || { scopeKind: 'all' });
          });
          root.querySelector('[data-download-preview]').addEventListener('click', () => {
            exportAs(el.dataset.format, state.ui.exportScope || { scopeKind: 'all' });
          });
        },
      });
    });
  });
}
