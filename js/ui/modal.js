/** Modal dialogs + a promise-based confirm. */
import { icon, esc, $ } from './dom.js';

let current = null;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} opts.body           HTML
 * @param {string} [opts.footer]       HTML
 * @param {'narrow'|'wide'} [opts.size]
 * @param {(root:HTMLElement, api:object) => void} [opts.onMount]
 * @returns {{close:() => void, root:HTMLElement}}
 */
export function openModal({ title, subtitle = '', body, footer = '', size = '', onMount }) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-shell ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div class="grow">
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p class="small muted">${esc(subtitle)}</p>` : ''}
        </div>
        <button class="btn btn-ghost btn-icon" type="button" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;

  document.getElementById('modal-root').appendChild(backdrop);
  document.body.classList.add('modal-open');

  const api = {
    root: backdrop,
    close: () => closeModal(),
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) closeModal();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeModal();
    }
    if (e.key === 'Tab') trapFocus(e, backdrop);
  };
  document.addEventListener('keydown', onKey);
  api._onKey = onKey;

  current = api;
  const focusTarget = $('input, select, textarea, button.btn-primary', backdrop);
  if (focusTarget) setTimeout(() => focusTarget.focus(), 40);
  if (onMount) onMount(backdrop, api);
  return api;
}

export function closeModal() {
  if (!current) return;
  document.removeEventListener('keydown', current._onKey);
  current.root.remove();
  document.body.classList.remove('modal-open');
  current = null;
}

export function isModalOpen() {
  return Boolean(current);
}

function trapFocus(e, container) {
  const focusables = Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Promise-based confirmation dialog. */
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}) {
  return new Promise((resolve) => {
    const api = openModal({
      title,
      size: 'narrow',
      body: `<p class="muted">${esc(message)}</p>`,
      footer: `
        <button class="btn btn-ghost" type="button" data-choice="0">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-choice="1">${esc(confirmLabel)}</button>`,
      onMount: (root) => {
        root.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-choice]');
          if (!btn) return;
          resolve(btn.dataset.choice === '1');
          api.close();
        });
      },
    });
    // closing without choosing = cancel
    const observer = new MutationObserver(() => {
      if (!api.root.isConnected) {
        observer.disconnect();
        resolve(false);
      }
    });
    observer.observe(api.root.parentNode, { childList: true });
  });
}
