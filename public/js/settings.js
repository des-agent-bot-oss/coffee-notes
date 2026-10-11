// Grinder settings and the sample-data actions.
//
// The dialog chrome (focus trap, Esc, backdrop, focus return) comes from
// ./dialog.js. This module only builds the body and never touches global state:
// it reads the current grinders through `snapshot()` and performs every
// mutation through `actions`. A rejected action is reported next to the control
// that caused it, and the list is re-read from `snapshot()` after every success,
// so the visible list cannot drift from the server.

import { openDialog } from './dialog.js';
import { el } from './dom.js';
import { noteCountLabel } from './format.js';

const NAME_MAX = 40;

export function createSettings({ snapshot, actions }) {
  const root = el('div', { class: 'settings' });
  const status = el('p', { class: 'settings__status', hidden: true });
  status.setAttribute('role', 'status');
  const body = el('div', { class: 'settings__body' });
  root.append(status, body);

  let busy = false;
  let buttons = [];
  let addValue = '';
  let editingId = null;
  let renameValue = '';
  let focusAfterRender = null;

  function view() {
    const value = snapshot() ?? {};
    return {
      grinders: value.grinders ?? [],
      defaultId: value.defaultId ?? null,
      samplesLoaded: Boolean(value.samplesLoaded),
      unavailable: Boolean(value.unavailable)
    };
  }

  function setStatus(message, variant = 'ok') {
    if (!message) {
      status.textContent = '';
      status.hidden = true;
      return;
    }
    status.textContent = message;
    status.className = `settings__status settings__status--${variant}`;
    status.hidden = false;
  }

  function setBusy(value) {
    busy = value;
    root.classList.toggle('settings--busy', value);
    root.setAttribute('aria-busy', value ? 'true' : 'false');
    for (const node of buttons) node.disabled = value;
  }

  function markInvalid(control, error) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', error.id);
    error.hidden = false;
  }

  function clearInvalid(control, error) {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    error.textContent = '';
    error.hidden = true;
  }

  /** Run one server mutation, report its outcome, then re-read the list. */
  async function run(work, message, focus = null) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    let result;
    try {
      result = await work();
    } catch (error) {
      setBusy(false);
      setStatus(error?.message ?? 'That did not work. Nothing was changed.', 'error');
      return;
    }
    setBusy(false);
    setStatus(typeof message === 'function' ? message(result) : message);
    // `render()` applies focusAfterRender at its end, so set it first.
    focusAfterRender = typeof focus === 'function' ? focus() : focus;
    render();
  }

  // --- add -------------------------------------------------------------------

  function renderAdd() {
    const input = el('input', {
      type: 'text',
      id: 'settings-new-grinder',
      class: 'input',
      maxlength: String(NAME_MAX),
      autocomplete: 'off',
      placeholder: 'e.g. Comandante C40'
    });
    input.value = addValue;
    const error = el('p', { class: 'field-error', id: 'settings-add-error', hidden: true });
    const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Add grinder' });
    const form = el('form', { class: 'settings__add', novalidate: true }, [
      el('label', { class: 'field-group__label', for: 'settings-new-grinder', text: 'Add a grinder' }),
      el('div', { class: 'settings__add-row' }, [input, submit]),
      error
    ]);
    buttons.push(submit);

    input.addEventListener('input', () => {
      addValue = input.value;
      clearInvalid(input, error);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      const name = input.value.trim();
      if (name === '') {
        error.textContent = 'Enter a grinder name.';
        markInvalid(input, error);
        input.focus();
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        await actions.add(name);
      } catch (failure) {
        setBusy(false);
        error.textContent = failure?.fields?.name ?? failure?.message ?? 'That grinder could not be added.';
        markInvalid(input, error);
        input.focus();
        return;
      }
      setBusy(false);
      addValue = '';
      setStatus(`${name} added.`);
      focusAfterRender = '#settings-new-grinder';
      render();
    });

    return form;
  }

  // --- rows ------------------------------------------------------------------

  function renderEditRow(grinder) {
    const input = el('input', {
      type: 'text',
      id: `grinder-rename-${grinder.id}`,
      class: 'input',
      maxlength: String(NAME_MAX),
      autocomplete: 'off'
    });
    input.value = renameValue;
    const error = el('p', { class: 'field-error', id: `grinder-rename-error-${grinder.id}`, hidden: true });
    const save = el('button', { type: 'button', class: 'btn btn--primary btn--small' }, [
      'Save',
      el('span', { class: 'sr-only', text: ` new name for ${grinder.name}` })
    ]);
    const cancel = el('button', { type: 'button', class: 'btn btn--ghost btn--small' }, [
      'Cancel',
      el('span', { class: 'sr-only', text: ` renaming ${grinder.name}` })
    ]);
    buttons.push(save, cancel);

    input.addEventListener('input', () => {
      renameValue = input.value;
      clearInvalid(input, error);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save.click();
      }
    });
    cancel.addEventListener('click', () => {
      editingId = null;
      renameValue = '';
      focusAfterRender = `[data-rename="${grinder.id}"]`;
      render();
    });
    save.addEventListener('click', async () => {
      if (busy) return;
      const name = input.value.trim();
      if (name === '') {
        error.textContent = 'Enter a grinder name.';
        markInvalid(input, error);
        input.focus();
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        await actions.rename(grinder.id, name);
      } catch (failure) {
        setBusy(false);
        error.textContent = failure?.fields?.name ?? failure?.message ?? 'That name could not be saved.';
        markInvalid(input, error);
        input.focus();
        return;
      }
      setBusy(false);
      editingId = null;
      renameValue = '';
      setStatus(`Renamed to ${name}.`);
      focusAfterRender = `[data-rename="${grinder.id}"]`;
      render();
    });

    return el(
      'li',
      { class: 'grinder grinder--editing', dataset: { row: String(grinder.id) }, tabindex: '-1' },
      [
        el('label', {
          class: 'grinder__rename-label',
          for: `grinder-rename-${grinder.id}`,
          text: `Rename “${grinder.name}”`
        }),
        input,
        error,
        el('div', { class: 'grinder__actions' }, [cancel, save])
      ]
    );
  }

  function renderRow(grinder, defaultId) {
    const isDefault = grinder.id === defaultId || grinder.is_default;
    const nameId = `grinder-name-${grinder.id}`;
    const actionCell = el('div', { class: 'grinder__actions' });
    const row = el(
      'li',
      { class: 'grinder', dataset: { row: String(grinder.id) }, tabindex: '-1' },
      [
        el('div', { class: 'grinder__id' }, [
          el('span', { class: 'grinder__name', id: nameId, text: grinder.name }),
          isDefault ? el('span', { class: 'badge', text: 'Default' }) : null,
          el('span', { class: 'grinder__count', text: noteCountLabel(grinder.note_count) })
        ]),
        actionCell
      ]
    );

    if (!isDefault) {
      const makeDefault = el('button', { type: 'button', class: 'btn btn--ghost btn--small' }, [
        'Make default',
        el('span', { class: 'sr-only', text: ` for ${grinder.name}` })
      ]);
      makeDefault.addEventListener('click', () =>
        run(
          () => actions.makeDefault(grinder.id),
          () => {
            const promoted = view().grinders.find((item) => item.id === grinder.id);
            return promoted ? `${promoted.name} is now the default.` : 'Default grinder updated.';
          },
          () => `[data-row="${grinder.id}"]`
        )
      );
      buttons.push(makeDefault);
      actionCell.append(makeDefault);
    }

    const rename = el('button', { type: 'button', class: 'btn btn--ghost btn--small' }, [
      'Rename',
      el('span', { class: 'sr-only', text: ` ${grinder.name}` })
    ]);
    rename.dataset.rename = String(grinder.id);
    rename.addEventListener('click', () => {
      editingId = grinder.id;
      renameValue = grinder.name;
      focusAfterRender = `#grinder-rename-${grinder.id}`;
      render();
    });

    const remove = el('button', { type: 'button', class: 'btn btn--danger btn--small' }, [
      'Remove',
      el('span', { class: 'sr-only', text: ` ${grinder.name}` })
    ]);
    remove.dataset.remove = String(grinder.id);
    remove.addEventListener('click', () => confirmRemove(grinder, defaultId));
    buttons.push(rename, remove);
    actionCell.append(rename, remove);

    return row;
  }

  async function confirmRemove(grinder, defaultId) {
    if (busy) return;
    const keepsHistory =
      `Notes you already saved keep the grinder name “${grinder.name}” — ` +
      'removing the preset never changes your history.';
    const promotes =
      grinder.id === defaultId
        ? ' The oldest remaining grinder becomes the default; if none are left, a new note starts with an empty grinder.'
        : '';
    const choice = await openDialog({
      title: 'Remove this grinder preset?',
      description: `${grinder.name} will no longer be offered for new notes. ${keepsHistory}${promotes}`,
      actions: [
        { label: 'Keep grinder', value: 'keep', variant: 'ghost' },
        { label: 'Remove grinder', value: 'remove', variant: 'danger' }
      ]
    });
    if (choice !== 'remove') return;
    await run(
      () => actions.remove(grinder.id),
      () => {
        const after = view();
        if (after.grinders.length === 0) return `${grinder.name} removed. There are no grinder presets yet.`;
        if (grinder.id === defaultId) {
          const promoted = after.grinders.find((item) => item.id === after.defaultId);
          if (promoted) return `${grinder.name} removed. ${promoted.name} is now the default.`;
        }
        return `${grinder.name} removed.`;
      },
      () => (view().grinders.length === 0 ? '#settings-new-grinder' : '.grinder-list .grinder')
    );
  }

  // --- sample notes ----------------------------------------------------------

  function renderSamples() {
    const { samplesLoaded } = view();
    const section = el('section', { class: 'settings__samples' }, [
      el('h3', { class: 'section-title', text: 'Sample notes' }),
      el('p', {
        class: 'settings__sample-text',
        text: samplesLoaded
          ? 'Sample notes are loaded. They carry a Sample chip and are never mixed in silently with your own notes.'
          : 'Load a set of realistic sample notes to try the journal out. They are marked with a Sample chip and can be removed again in one step.'
      })
    ]);

    const button = samplesLoaded
      ? el('button', { type: 'button', class: 'btn btn--danger btn--small' }, [
          'Remove sample notes',
          el('span', { class: 'sr-only', text: ' — this only removes notes that came from the sample data' })
        ])
      : el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Load sample notes' });
    buttons.push(button);
    button.addEventListener('click', () => {
      const focus = '.settings__samples button';
      if (samplesLoaded) {
        run(
          () => actions.clearDemo(),
          (removed) => (removed ? `${removed} sample notes removed.` : 'There were no sample notes left to remove.'),
          focus
        );
      } else {
        run(
          () => actions.seed(),
          (created) => (created ? `${created} sample notes loaded.` : 'Sample notes loaded.'),
          focus
        );
      }
    });
    section.append(button);
    return section;
  }

  // --- render ----------------------------------------------------------------

  function render() {
    const { grinders, defaultId, unavailable } = view();
    buttons = [];
    if (editingId !== null && !grinders.some((grinder) => grinder.id === editingId)) {
      editingId = null;
      renameValue = '';
    }
    body.replaceChildren();

    if (unavailable && grinders.length === 0) {
      body.append(
        el('p', {
          class: 'settings__empty',
          text: 'Grinder presets could not be loaded. Close this dialog and use Retry on the message behind it.'
        })
      );
    } else if (grinders.length === 0) {
      body.append(
        el('p', {
          class: 'settings__empty',
          text: 'No grinder presets yet. The first one you add becomes the default, and a note keeps whatever grinder name you give it.'
        })
      );
    } else {
      const list = el('ul', { class: 'grinder-list' });
      for (const grinder of grinders) {
        list.append(grinder.id === editingId ? renderEditRow(grinder) : renderRow(grinder, defaultId));
      }
      body.append(list);
    }

    body.append(renderAdd(), renderSamples());
    setBusy(busy);

    if (focusAfterRender) {
      const target = root.querySelector(focusAfterRender);
      focusAfterRender = null;
      if (target) target.focus();
    }
  }

  render();

  return {
    node: root,
    refresh: render
  };
}
