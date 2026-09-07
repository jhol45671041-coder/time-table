/**
 * Styles studio — twelve themes, an accent recolour, density, typeface and
 * effect toggles, all applied live with a component preview.
 */
import { esc, icon, on } from '../ui/dom.js';
import { getState, setPrefs } from '../state.js';
import { THEMES, THEME_MAP, DENSITIES, FONTS, ACCENT_PRESETS, randomStyle } from '../themes.js';
import { toastOk } from '../ui/toast.js';

export function render(state) {
  const prefs = state.ui;
  const active = THEME_MAP[prefs.theme] || THEMES[0];

  return `
    <section class="card card-pad anim-rise">
      <div class="page-head">
        <div class="grow">
          <p class="eyebrow">Style studio</p>
          <h1 class="h1">Twelve looks, one timetable</h1>
          <p class="lead">Every theme rewrites the whole design-token set — surfaces, type, subject
            colours, shadows and corner radii — so the switch is instant and consistent everywhere,
            including the printable sheet.</p>
        </div>
        <div class="row">
          <button class="btn btn-outline" type="button" data-action="surprise-style">${icon('dice')} Surprise me</button>
          <button class="btn btn-ghost" type="button" data-action="reset-style">${icon('refresh')} Reset</button>
        </div>
      </div>

      <div class="row-wrap" style="margin-top:18px">
        <span class="chip chip-accent">${icon('palette')} ${esc(active.name)}</span>
        <span class="chip">${esc(active.family)}</span>
        <span class="chip">${icon(active.mode === 'dark' ? 'moon' : 'sun')} ${active.mode} mode</span>
        <span class="chip">${icon('eye')} ${DENSITIES.find((d) => d.id === prefs.density)?.name ?? 'Cosy'} density</span>
        <span class="chip">${icon('edit')} ${FONTS.find((f) => f.id === prefs.font)?.name ?? 'Grotesk'} type</span>
        ${prefs.accent == null ? '' : `<span class="chip">accent ${prefs.accent}°</span>`}
      </div>
    </section>

    <section class="anim-rise" style="--i:1">
      <p class="section-title">Themes</p>
      <div class="theme-grid">
        ${THEMES.map((theme, i) => themeCard(theme, prefs, i)).join('')}
      </div>
    </section>

    <div class="split">
      <section class="card anim-rise" style="--i:2">
        <div class="card-head">${icon('eye')}<div class="grow"><h2>Live component preview</h2>
          <p class="tiny muted">This is exactly how the app looks in the selected style</p></div></div>
        <div class="card-body col" style="gap:18px">
          ${componentPreview(state)}
        </div>
      </section>

      <div class="col" style="gap:var(--gap)">
        <section class="card anim-rise" style="--i:3">
          <div class="card-head">${icon('sparkles')}<div class="grow"><h2>Accent</h2></div></div>
          <div class="card-body col" style="gap:14px">
            <div class="legend">
              ${ACCENT_PRESETS.map((preset) => `
                <button class="legend-item" type="button" data-action="set-accent" data-hue="${preset.hue}"
                  style="cursor:pointer;${prefs.accent === preset.hue ? 'border-color:var(--accent);color:var(--text)' : ''}">
                  <span class="legend-swatch" style="background:hsl(${preset.hue} 85% 58%);border-color:hsl(${preset.hue} 85% 45%)"></span>
                  ${esc(preset.name)}
                </button>`).join('')}
            </div>
            <div class="field">
              <label for="accent-range">Custom hue · <span class="mono" id="accent-value">${prefs.accent ?? '—'}${prefs.accent == null ? '' : '°'}</span></label>
              <input class="range" type="range" id="accent-range" min="0" max="359" value="${prefs.accent ?? 249}"
                data-on-input="accent-live" data-on-change="accent-commit" aria-label="Accent hue">
              <div class="hue-strip"></div>
              <button class="btn btn-ghost btn-sm" type="button" data-action="clear-accent">
                ${icon('refresh')} Use the theme's own accent
              </button>
            </div>
          </div>
        </section>

        <section class="card anim-rise" style="--i:4">
          <div class="card-head">${icon('sliders')}<div class="grow"><h2>Layout & type</h2></div></div>
          <div class="card-body col" style="gap:16px">
            <div class="field">
              <span class="label">Density</span>
              <div class="segmented" role="group" aria-label="Density">
                ${DENSITIES.map((d) => `<button type="button" data-action="set-density" data-density="${d.id}"
                  aria-pressed="${prefs.density === d.id}" data-tip="${esc(d.note)}">${d.name}</button>`).join('')}
              </div>
            </div>
            <div class="field">
              <span class="label">Typeface</span>
              <div class="segmented" role="group" aria-label="Typeface" style="flex-wrap:wrap">
                ${FONTS.map((f) => `<button type="button" data-action="set-font" data-font="${f.id}"
                  aria-pressed="${prefs.font === f.id}" data-tip="${esc(f.note)}">${f.name}</button>`).join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="card anim-rise" style="--i:5">
          <div class="card-head">${icon('zap')}<div class="grow"><h2>Effects</h2></div></div>
          <div class="card-body col" style="gap:4px">
            ${toggleRow('motion', 'Animation', 'Transitions, staggered reveals, hover motion', prefs.motion)}
            ${toggleRow('glass', 'Glass blur', 'Frosted sidebar, header and popovers', prefs.glass)}
            ${toggleRow('grain', 'Film grain', 'Subtle noise overlay for texture', prefs.grain)}
            ${toggleRow('ambient', 'Ambient light', 'Floating colour blooms behind the app', prefs.ambient)}
          </div>
        </section>
      </div>
    </div>`;
}

function toggleRow(key, label, note, value) {
  return `
    <div class="list-item">
      <div class="grow">
        <strong style="font-size:.87rem">${esc(label)}</strong>
        <p class="tiny muted">${esc(note)}</p>
      </div>
      <button class="switch" type="button" role="switch" aria-checked="${value !== false}"
        data-action="toggle-pref" data-pref="${key}" aria-label="${esc(label)}"></button>
    </div>`;
}

function themeCard(theme, prefs, index) {
  const p = theme.preview;
  const active = prefs.theme === theme.id;
  const radius = p.radius;
  const shadow = p.neu
    ? '6px 6px 14px rgba(163,177,198,.55), -6px -6px 14px rgba(255,255,255,.9)'
    : p.brutal
      ? '4px 4px 0 #0a0a0a'
      : theme.mode === 'dark'
        ? '0 10px 24px -12px rgba(0,0,0,.8)'
        : '0 10px 22px -14px rgba(16,24,40,.35)';
  const border = p.brutal ? '2px solid #0a0a0a' : `1px solid ${p.line}`;
  const font = theme.id === 'paper' ? 'Georgia, serif' : theme.id === 'brutalist' ? 'ui-monospace, Menlo, monospace' : 'inherit';

  return `
    <button class="theme-card" type="button" data-action="set-theme" data-theme-id="${theme.id}"
      aria-pressed="${active}" style="animation: rise var(--t-slow) var(--ease-out) both; animation-delay:${index * 32}ms">
      <span class="theme-preview" style="background:${p.bg};font-family:${font}">
        <span class="tp-row" style="align-items:center;gap:6px">
          <span style="width:16px;height:16px;border-radius:${Math.min(radius, 6)}px;background:linear-gradient(135deg,${p.accent},${p.accent2});flex:none"></span>
          <span class="tp-title" style="background:${p.text};opacity:.85"></span>
        </span>
        <span class="tp-row">
          <span class="tp-bar" style="background:${p.accent};opacity:.9;border-radius:${radius / 2}px;height:26px"></span>
          <span class="tp-bar" style="background:${p.accent2};opacity:.55;border-radius:${radius / 2}px;height:26px"></span>
        </span>
        <span class="tp-row">
          <span class="tp-bar" style="background:${p.panel};border:${border};border-radius:${radius / 2}px;height:20px;box-shadow:${shadow}"></span>
          <span class="tp-bar" style="background:${p.panel};border:${border};border-radius:${radius / 2}px;height:20px;box-shadow:${shadow}"></span>
          <span class="tp-bar" style="background:${p.accent};opacity:.25;border-radius:${radius / 2}px;height:20px"></span>
        </span>
        <span class="tp-row" style="margin-top:auto;align-items:center;gap:5px">
          <span style="font-size:8px;color:${p.muted};letter-spacing:.08em">Aa</span>
          <span style="flex:1;height:4px;border-radius:99px;background:${p.line}"></span>
          <span style="width:12px;height:12px;border-radius:50%;background:${p.accent2}"></span>
        </span>
      </span>
      <span class="theme-meta">
        <strong>${esc(theme.name)}</strong>
        <span>${esc(theme.family)}</span>
      </span>
      <span class="tiny muted" style="display:block;margin-top:4px;line-height:1.35">${esc(theme.blurb)}</span>
    </button>`;
}

function componentPreview(state) {
  const subject = state.subjects[0] || { name: 'Mathematics', code: 'MAT', hue: 222 };
  const subject2 = state.subjects[3] || { name: 'Chemistry', code: 'CHE', hue: 158 };
  const teacher = state.teachers[0] || { name: 'Amara Osei', initials: 'AO' };
  const klass = state.classes[0] || { name: '10A', hue: 222 };

  return `
    <div class="row-wrap">
      <button class="btn btn-primary" type="button">${icon('sparkles')} Primary</button>
      <button class="btn btn-outline" type="button">${icon('download')} Outline</button>
      <button class="btn btn-ghost" type="button">${icon('copy')} Ghost</button>
      <button class="btn btn-danger btn-sm" type="button">${icon('trash')} Danger</button>
    </div>

    <div class="row-wrap">
      <span class="chip chip-accent">${icon('pin')} accent chip</span>
      <span class="chip chip-ok">${icon('check-circle')} conflict-free</span>
      <span class="chip chip-warn">${icon('alert')} warning</span>
      <span class="badge">12</span>
      <span class="avatar" style="--h:${klass.hue ?? 222}">${esc(klass.name.slice(0, 3))}</span>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat">
        <p class="stat-top">${icon('target')} Quality</p>
        <p class="stat-value">98<small>/100</small></p>
        <div class="meter meter-ok"><i style="width:98%"></i></div>
      </div>
      <div class="card card-pad" style="border-radius:var(--radius-lg)">
        <p class="tiny muted upper">Nested card</p>
        <p class="small" style="margin-top:6px">Surfaces, borders and shadows follow the theme.</p>
        <input class="input" style="margin-top:10px" placeholder="Input field" aria-label="Sample input">
      </div>
    </div>

    <div>
      <p class="label" style="margin-bottom:8px">Lesson blocks</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <article class="lesson" style="--h:${subject.hue ?? 222};--span:1;height:auto">
          <span class="lesson-name">${esc(subject.name)}</span>
          <span class="lesson-meta">${icon('user')}${esc(teacher.name)}</span>
          <span class="lesson-time">08:30–09:15</span>
        </article>
        <article class="lesson is-locked" style="--h:${subject2.hue ?? 158};--span:1;height:auto">
          <span class="lesson-name">${esc(subject2.name)}</span>
          <span class="lesson-meta">${icon('door')}Lab A</span>
          <span class="lesson-time">pinned</span>
        </article>
      </div>
    </div>`;
}

/* ────────────────────────────── interactions ──────────────────────────── */

export function registerStyleHandlers() {
  on('click', 'set-theme', (e, el) => {
    const id = el.dataset.themeId;
    setPrefs({ theme: id });
    const theme = THEME_MAP[id];
    if (theme) toastOk(`${theme.name} applied`, theme.blurb);
  });

  on('click', 'set-font', (e, el) => setPrefs({ font: el.dataset.font }));

  on('click', 'toggle-pref', (e, el) => {
    const key = el.dataset.pref;
    const state = getState();
    setPrefs({ [key]: state.ui[key] === false });
  });

  on('click', 'set-accent', (e, el) => setPrefs({ accent: Number(el.dataset.hue) }));
  on('click', 'clear-accent', () => setPrefs({ accent: null }));

  // While dragging we only touch CSS custom properties — writing to the store
  // would re-render (and destroy) the slider mid-gesture. The value is
  // committed on `change`, when the pointer is released.
  on('input', 'accent-live', (e, el) => {
    const hue = Number(el.value);
    const root = document.documentElement;
    root.dataset.accent = 'on';
    root.style.setProperty('--accent-h', String(hue));
    root.style.setProperty('--accent-2-h', String((hue + 152) % 360));
    const label = document.getElementById('accent-value');
    if (label) label.textContent = `${hue}°`;
  });

  on('change', 'accent-commit', (e, el) => setPrefs({ accent: Number(el.value) }));

  on('click', 'surprise-style', () => {
    const style = randomStyle();
    setPrefs(style);
    const theme = THEME_MAP[style.theme];
    toastOk(`${theme.name} · ${style.density} · ${style.font}`, 'A random look — press again to roll another.');
  });

  on('click', 'reset-style', () => {
    setPrefs({ theme: 'aurora', accent: null, density: 'cosy', font: 'grotesk', motion: true, glass: true, grain: true, ambient: true });
    toastOk('Style reset', 'Back to Aurora with the default settings.');
  });
}
