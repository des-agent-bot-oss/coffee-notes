// Transient status messages for saves and deletes. They live in one polite live
// region so they are announced without moving focus.

import { el } from './dom.js';

const DISMISS_AFTER = 4000;
const FADE_OUT = 250;

export function toast(message, variant = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const node = el('p', { class: `toast toast--${variant}`, text: message });
  region.append(node);
  setTimeout(() => {
    node.classList.add('toast--leaving');
    setTimeout(() => node.remove(), FADE_OUT);
  }, DISMISS_AFTER);
}
