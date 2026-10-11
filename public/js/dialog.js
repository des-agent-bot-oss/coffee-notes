// Modal dialogs built on the native <dialog> element. showModal() supplies the
// focus trap, the inert background, the backdrop and Esc, so there is no
// hand-rolled trap to get wrong.

import { el } from './dom.js';

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

  host.append(dialog);
  dialog.showModal(); // focuses the first control; Esc fires 'cancel'
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
