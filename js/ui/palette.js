/** Command palette (Ctrl/Cmd + K). */
import { icon, esc, fuzzy, $ } from './dom.js';
import { THEMES, DENSITIES, FONTS } from '../themes.js';

let open = false;
let cursor = 0;
let commands = [];
let filtered = [];
let onClose = null;

/**
 * @param {Array<{id:string,label:string,group:string,icon?:string,hint?:string,keywords?:string,run:() => void}>} list
 */
export function registerCommands(list) {
  commands = list;
}

export function openPalette() {
  if (open) return;
  open = true;
  cursor = 0;

  const root = document.createElement('div');
  root.className = 'palette-backdrop';
  root.id = 'palette';
  root.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="palette-input">
        ${icon('search')}
        <input type="text" id="palette-query" placeholder="Search commands, themes, classes…" autocomplete="off" spellcheck="false" />
        <kbd>Esc</kbd>
      </div>
      <div class="palette-list" id="palette-list"></div>
      <div class="palette-foot">
        <span>${icon('arrow-right')} <kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span id="palette-count"></span>
      </div>
    </div>`;

  document.getElementById('palette-root').appendChild(root);
  document.body.classList.add('modal-open');

  root.addEventListener('mousedown', (e) => {
    if (e.target === root) closePalette();
  });
  root.addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) runAt(Number(item.dataset.index));
  });

  const input = $('#palette-query', root);
  input.addEventListener('input', () => {
    cursor = 0;
    renderList(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(cursor); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });

  renderList('');
  setTimeout(() => input.focus(), 30);
}

export function closePalette() {
  if (!open) return;
  open = false;
  $('#palette')?.remove();
  document.body.classList.remove('modal-open');
  if (onClose) onClose();
}

export function isPaletteOpen() {
  return open;
}

function renderList(query) {
  filtered = commands.filter((cmd) => fuzzy(query, `${cmd.label} ${cmd.group} ${cmd.keywords || ''}`));
  const list = $('#palette-list');
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `<div class="empty" style="padding:26px"><p class="muted small">No command matches “${esc(query)}”.</p></div>`;
    $('#palette-count').textContent = '';
    return;
  }

  let lastGroup = null;
  list.innerHTML = filtered
    .map((cmd, index) => {
      const head = cmd.group !== lastGroup
        ? `<p class="nav-label" style="padding:10px 12px 4px">${esc(cmd.group)}</p>`
        : '';
      lastGroup = cmd.group;
      return `${head}
        <div class="palette-item ${index === cursor ? 'is-cursor' : ''}" data-index="${index}" role="option"
             aria-selected="${index === cursor}">
          ${icon(cmd.icon || 'arrow-right')}
          <span>${esc(cmd.label)}</span>
          ${cmd.hint ? `<span class="hint-key">${esc(cmd.hint)}</span>` : ''}
        </div>`;
    })
    .join('');

  $('#palette-count').textContent = `${filtered.length} command${filtered.length === 1 ? '' : 's'}`;
  list.querySelector('.is-cursor')?.scrollIntoView?.({ block: 'nearest' });
}

function move(delta) {
  if (!filtered.length) return;
  cursor = (cursor + delta + filtered.length) % filtered.length;
  const list = $('#palette-list');
  $$('.palette-item', list).forEach((el, i) => {
    el.classList.toggle('is-cursor', i === cursor);
    el.setAttribute('aria-selected', String(i === cursor));
  });
  list.querySelector('.is-cursor')?.scrollIntoView?.({ block: 'nearest' });
}

function runAt(index) {
  const cmd = filtered[index];
  if (!cmd) return;
  closePalette();
  setTimeout(() => cmd.run(), 10);
}
