// The note editor, shown in the same pane as the detail view.
//
// The controller owns the request: onSave(payload, meta) either resolves after
// navigating away, or throws an ApiError. A thrown error carrying `fields` is
// attached to the offending controls; anything else becomes a form message.
// The form itself shows the in-flight `Saving…` state.

import { el } from './dom.js';
import { localDateTimeValue } from './format.js';

const ROAST_OPTIONS = [
  ['', 'Not set'],
  ['light', 'Light'],
  ['medium', 'Medium'],
  ['dark', 'Dark']
];

// Mirrors the server's ranges (docs/SPEC.md §7) so obvious mistakes are caught
// before a round-trip. The server stays the authority.
const NUMBER_FIELDS = {
  grind_size: { min: 0, max: 100, step: '0.1' },
  dose_g: { min: 0, max: 200, step: '0.1' },
  water_g: { min: 0, max: 2000, step: '0.1' }
};

const BREWED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function createEditor({
  note = null,
  isNew,
  grinders = [],
  defaultGrinderId = null,
  grindersUnavailable = false,
  onSave,
  onCancel,
  onOpenSettings
}) {
  const controls = new Map();
  const form = el('form', { class: 'editor card', novalidate: true });
  const grid = el('div', { class: 'form-grid' });
  const formError = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const saveButton = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Save' });
  const grinderMode = grinders.length > 0 ? 'select' : 'text';
  const initial = initialValues();
  function addField({ name, label, control, hint = null, wide = false }) {
    const error = el('p', { class: 'field-error', id: `err-${name}`, hidden: true });
    grid.append(
      el('div', { class: `field-group${wide ? ' field-group--wide' : ''}` }, [
        el('label', { class: 'field-group__label', for: control.id, text: label }),
        control,
        hint,
        error
      ])
    );
    controls.set(name, { control, error });
  }

  function initialValues() {
    if (isNew) {
      const preset =
        grinders.find((grinder) => grinder.id === defaultGrinderId) ?? grinders[0] ?? null;
      return {
        brewed_at: localDateTimeValue(),
        grinder: preset ? `id:${preset.id}` : '',
        grinder_name: '',
        grind_size: '',
        dose_g: '',
        water_g: '',
        bean_name: '',
        bean_origin: '',
        roast_level: '',
        tasting_notes: ''
      };
    }
    return {
      brewed_at: note.brewed_at,
      grinder: note.grinder_id ? `id:${note.grinder_id}` : `name:${note.grinder_name}`,
      grinder_name: note.grinder_name,
      grind_size: note.grind_size ?? '',
      dose_g: note.dose_g ?? '',
      water_g: note.water_g ?? '',
      bean_name: note.bean_name ?? '',
      bean_origin: note.bean_origin ?? '',
      roast_level: note.roast_level ?? '',
      tasting_notes: note.tasting_notes ?? ''
    };
  }

  // Pane header: same shape as the detail view, with the save actions instead.
  form.append(
    el('header', { class: 'pane-header' }, [
      el('div', { class: 'pane-header__titles' }, [
        el('p', { class: 'pane-header__eyebrow', text: isNew ? 'New note' : 'Editing note' }),
        el('h2', {
          class: 'pane-header__title',
          text: isNew ? 'Record a brew' : note.bean_name || 'Edit note'
        })
      ]),
      el('div', { class: 'pane-header__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Cancel', onclick: () => onCancel() }),
        saveButton
      ])
    ])
  );

  const brewedAt = el('input', {
    type: 'datetime-local',
    id: 'field-brewed_at',
    name: 'brewed_at',
    class: 'input',
    value: initial.brewed_at
  });
  addField({ name: 'brewed_at', label: 'Brew date and time', control: brewedAt, wide: true });

  if (grinderMode === 'select') {
    const select = el('select', { id: 'field-grinder_id', name: 'grinder_id', class: 'input' });
    for (const grinder of grinders) {
      select.append(
        el('option', {
          value: `id:${grinder.id}`,
          text: grinder.is_default ? `${grinder.name} — default` : grinder.name
        })
      );
    }
    if (initial.grinder.startsWith('name:')) {
      // The note's preset is gone; keep showing the name it was saved with.
      const snapshot = initial.grinder.slice(5);
      select.append(el('option', { value: `name:${snapshot}`, text: `${snapshot} — preset removed` }));
    }
    select.value = initial.grinder;
    addField({ name: 'grinder_id', label: 'Grinder', control: select, wide: true });
  } else {
    const hint = el('p', { class: 'field-group__hint' }, [
      grindersUnavailable
        ? 'Grinder presets could not be loaded. Type the grinder name — the note still saves.'
        : 'No grinder presets yet. Type the grinder name and the note keeps it.'
    ]);
    hint.append(' ', el('button', {
      type: 'button',
      class: 'link-button',
      text: 'Open Settings',
      onclick: () => onOpenSettings()
    }));
    addField({
      name: 'grinder_name',
      label: 'Grinder',
      wide: true,
      hint,
      control: el('input', {
        type: 'text',
        id: 'field-grinder_name',
        name: 'grinder_name',
        class: 'input',
        maxlength: '80',
        value: initial.grinder_name
      })
    });
  }

  const numeric = (name) => {
    const spec = NUMBER_FIELDS[name];
    return el('input', {
      type: 'number',
      id: `field-${name}`,
      name,
      class: 'input',
      inputmode: 'decimal',
      step: spec.step,
      min: String(spec.min),
      max: String(spec.max),
      value: initial[name]
    });
  };

  addField({ name: 'grind_size', label: 'Grind size', control: numeric('grind_size') });

  const roast = el('select', { id: 'field-roast_level', name: 'roast_level', class: 'input' });
  for (const [value, label] of ROAST_OPTIONS) roast.append(el('option', { value, text: label }));
  roast.value = initial.roast_level;
  addField({ name: 'roast_level', label: 'Roast level', control: roast });

  addField({ name: 'dose_g', label: 'Dose (g)', control: numeric('dose_g') });
  addField({ name: 'water_g', label: 'Water (g)', control: numeric('water_g') });

  for (const [name, label] of [['bean_name', 'Bean'], ['bean_origin', 'Origin']]) {
    addField({
      name,
      label,
      control: el('input', {
        type: 'text',
        id: `field-${name}`,
        name,
        class: 'input',
        maxlength: '120',
        value: initial[name]
      })
    });
  }

  addField({
    name: 'tasting_notes',
    label: 'Tasting notes',
    wide: true,
    hint: el('p', { class: 'field-group__hint', text: 'How it tasted, how it brewed, what to change next time.' }),
    control: el('textarea', {
      id: 'field-tasting_notes',
      name: 'tasting_notes',
      class: 'input input--area',
      rows: '6',
      maxlength: '4000',
      value: initial.tasting_notes
    })
  });

  form.append(formError, grid);

  // --- reading, validating and submitting ------------------------------------

  // The snapshot uses readValues() so it shares the key set and order of the
  // live form: an untouched editor is not dirty.
  const initialSnapshot = JSON.stringify(readValues());

  function readValues() {
    const values = {};
    for (const [name, record] of controls) values[name] = record.control.value;
    return values;
  }

  function numberValue(raw) {
    const trimmed = String(raw).trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  function validate(values) {
    const errors = {};

    const brewedAtValue = values.brewed_at.trim();
    if (!brewedAtValue) errors.brewed_at = 'Brew date and time is required.';
    else if (!BREWED_AT.test(brewedAtValue)) errors.brewed_at = 'Use the format YYYY-MM-DDTHH:MM.';

    if (grinderMode === 'select') {
      if (!values.grinder_id) errors.grinder_id = 'Choose a grinder.';
    } else {
      const name = values.grinder_name.trim();
      if (!name) errors.grinder_name = 'Choose a grinder or type its name.';
      else if (name.length > 80) errors.grinder_name = 'Keep it to 80 characters or fewer.';
    }

    for (const [name, spec] of Object.entries(NUMBER_FIELDS)) {
      if (controls.get(name).control.validity.badInput) {
        errors[name] = 'Enter a number.';
        continue;
      }
      const raw = values[name].trim();
      if (raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) errors[name] = 'Enter a number.';
      else if (value <= spec.min || value > spec.max) {
        errors[name] = `Enter a number greater than ${spec.min} and at most ${spec.max}.`;
      }
    }

    return errors;
  }

  function payloadFrom(values) {
    const payload = {
      brewed_at: values.brewed_at.trim(),
      grind_size: numberValue(values.grind_size),
      dose_g: numberValue(values.dose_g),
      water_g: numberValue(values.water_g),
      bean_name: values.bean_name.trim(),
      bean_origin: values.bean_origin.trim(),
      roast_level: values.roast_level || null,
      tasting_notes: values.tasting_notes.trim()
    };
    if (grinderMode === 'select') {
      const [kind, ...rest] = values.grinder_id.split(':');
      const value = rest.join(':');
      if (kind === 'id') payload.grinder_id = Number(value);
      else payload.grinder_name = value;
    } else {
      payload.grinder_name = values.grinder_name.trim();
    }
    return payload;
  }

  function setFormError(message) {
    formError.textContent = message ?? '';
    formError.hidden = !message;
  }

  function setFieldErrors(fields, { focusFirst = false } = {}) {
    let first = null;
    for (const [name, record] of controls) {
      const message = fields[name];
      record.error.textContent = message ?? '';
      record.error.hidden = !message;
      if (message) {
        record.control.setAttribute('aria-invalid', 'true');
        record.control.setAttribute('aria-describedby', record.error.id);
        first ??= record.control;
      } else {
        record.control.removeAttribute('aria-invalid');
        record.control.removeAttribute('aria-describedby');
      }
    }
    const unplaced = Object.entries(fields).filter(([name]) => !controls.has(name));
    if (unplaced.length > 0) setFormError(unplaced.map(([, message]) => message).join(' '));
    if (focusFirst && first) first.focus();
  }

  function setSaving(saving) {
    saveButton.disabled = saving;
    saveButton.textContent = saving ? 'Saving…' : 'Save';
    form.setAttribute('aria-busy', saving ? 'true' : 'false');
  }

  let saving = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;

    const values = readValues();
    setFormError(null);
    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors, { focusFirst: true });
      return;
    }
    setFieldErrors({});

    saving = true;
    setSaving(true);
    try {
      await onSave(payloadFrom(values), { isNew, id: note?.id ?? null });
    } catch (error) {
      saving = false;
      setSaving(false);
      const fields = error?.fields ?? {};
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields, { focusFirst: true });
        setFormError('Check the highlighted fields and save again.');
      } else {
        setFormError(error?.message ?? 'The note could not be saved.');
      }
    }
  });

  return {
    node: form,
    isDirty: () => JSON.stringify(readValues()) !== initialSnapshot,
    focusFirst: () => controls.get('brewed_at').control.focus()
  };
}
