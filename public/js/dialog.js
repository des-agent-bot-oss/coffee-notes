// Modal dialogs built on the native <dialog> element. showModal() supplies the
// modal backdrop, the inert background and Esc; the small Tab wrap below keeps
// focus inside the dialog, which the top layer alone does not guarantee once
// the last control has been passed.

import { el } from './dom.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Resolved on every key press, so the list stays correct after the dialog body
 * is re-rendered or a control becomes disabled while a request is in flight.
 */
function focusable(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
}

function wrapTab(dialog, event) {
  if (event.key !== 'Tab') return;
  const nodes = focusable(dialog);
  if (nodes.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  const outside = !dialog.contains(active);
  if (event.shiftKey && (outside || active === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (outside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Open a modal dialog.
 * Resolves with the chosen action's `value`, or null when dismissed with Esc,
 * the backdrop or a click outside the dialog box.
 */
export function openDialog({ title, description = '', body = null, actions = [] }) {
  const host = document.getElementById('dialog-root');
  const opener = document.activeElement;
  const dialog = el('dialog', { class: 'dialog', 'aria-label': title });

  let settle = () => {};
  const answer = new Promise((resolve) => {
    settle = (value) => {
      resolve(value);
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  });

  dialog.append(el('h2', { class: 'dialog__title', text: title }));
  if (description) dialog.append(el('p', { class: 'dialog__description', text: description }));
  if (body) dialog.append(body);

  const footer = el('div', { class: 'dialog__actions' });
  for (const action of actions) {
    const button = el('button', {
      type: 'button',
      class: `btn btn--${action.variant ?? 'ghost'}`,
      text: action.label
    });
    button.addEventListener('click', () => settle(action.value));
    footer.append(button);
  }
  dialog.append(footer);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault(); // keep closing in one place
    settle(null);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) settle(null); // backdrop click
  });
  dialog.addEventListener('keydown', (event) => wrapTab(dialog, event));

  host.append(dialog);
  dialog.showModal(); // Esc fires 'cancel'
  // showModal() can land on a control that is not in the tab order; the first
  // tabbable is the non-destructive action in every confirmation this app
  // opens, so choose it explicitly.
  const first = focusable(dialog)[0];
  if (first) first.focus();
  return answer;
}

/** Confirmation used before discarding unsaved edits. Resolves true to discard. */
export function confirmDiscard(message) {
  return openDialog({
    title: 'Discard unsaved changes?',
    description: message,
    actions: [
      { label: 'Keep editing', value: 'stay', variant: 'ghost' },
      { label: 'Discard changes', value: 'discard', variant: 'danger' }
    ]
  }).then((choice) => choice === 'discard');
}
