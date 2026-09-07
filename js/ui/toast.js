/** Toast notifications. */
import { icon, esc } from './dom.js';

const ICONS = { ok: 'check-circle', warn: 'alert', error: 'alert', info: 'info' };
let host = null;

function ensureHost() {
  if (!host) host = document.getElementById('toasts');
  return host;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {'ok'|'warn'|'error'|'info'} [opts.kind]
 * @param {number} [opts.timeout]
 */
export function toast({ title, message = '', kind = 'info', timeout = 4200 }) {
  const root = ensureHost();
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `
    <span class="toast-icon">${icon(ICONS[kind] || 'info')}</span>
    <div class="grow">
      <strong>${esc(title)}</strong>
      ${message ? `<p>${esc(message)}</p>` : ''}
    </div>
    <button class="btn btn-ghost btn-icon btn-sm" type="button" aria-label="Dismiss">${icon('x')}</button>
  `;

  const dismiss = () => {
    if (!el.isConnected) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 240);
  };

  el.querySelector('button').addEventListener('click', dismiss);
  root.appendChild(el);
  if (timeout > 0) setTimeout(dismiss, timeout);

  // never stack more than four
  while (root.children.length > 4) root.firstElementChild.remove();
  return dismiss;
}

export const toastOk = (title, message) => toast({ title, message, kind: 'ok' });
export const toastWarn = (title, message) => toast({ title, message, kind: 'warn' });
export const toastError = (title, message) => toast({ title, message, kind: 'error', timeout: 6500 });
