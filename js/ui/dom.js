/**
 * DOM helpers + a single delegated event bus.
 * Views return HTML strings; interactions are declared with data-attributes
 * and handled here, so nothing has to be wired up per-render.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `<svg><use href="#i-<name>"/></svg>` — wraps a sprite symbol for templates. */
export function icon(name, cls = '') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function pct(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function clockTime(value) {
  return value || '';
}

export function relativeTime(iso) {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function longDate(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/* ─────────────────────────── delegated event bus ─────────────────────────── */

const REGISTRY = {
  click: new Map(),
  change: new Map(),
  input: new Map(),
  submit: new Map(),
  keydown: new Map(),
  dragstart: new Map(),
  dragover: new Map(),
  dragleave: new Map(),
  drop: new Map(),
  dragend: new Map(),
};

/**
 * @param {keyof REGISTRY} event
 * @param {string} name  value of the matching data-attribute
 * @param {(e: Event, el: HTMLElement) => void} fn
 */
export function on(event, name, fn) {
  if (!REGISTRY[event]) REGISTRY[event] = new Map();
  REGISTRY[event].set(name, fn);
}

function attributeFor(event) {
  if (event === 'click') return 'data-action';
  if (event === 'submit') return 'data-form';
  return `data-on-${event}`;
}

let mounted = false;
export function mountDelegation(root = document) {
  if (mounted) return;
  mounted = true;
  for (const event of Object.keys(REGISTRY)) {
    root.addEventListener(
      event,
      (e) => {
        const attr = attributeFor(event);
        const el = e.target instanceof Element ? e.target.closest(`[${attr}]`) : null;
        if (!el) return;
        const fn = REGISTRY[event].get(el.getAttribute(attr));
        if (!fn) return;
        if (event === 'submit') e.preventDefault();
        fn(e, el);
      },
      event === 'dragover' || event === 'input' ? { passive: false } : undefined,
    );
  }
}

/** Simple fuzzy match used by the command palette + data filters. */
export function fuzzy(query, text) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = String(text).toLowerCase();
  if (haystack.includes(q)) return true;
  let i = 0;
  for (const char of haystack) {
    if (char === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

/** Run a callback on the next animation frame, coalescing rapid calls. */
export function raf(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}
