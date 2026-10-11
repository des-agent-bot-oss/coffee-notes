// Read-only note view: the pane header with its actions, the labelled field
// list, and the tasting notes block that preserves line breaks.

import { el } from './dom.js';
import { EMPTY, formatBrewedAt, grams, grindSize, ratioText, roastLabel, text } from './format.js';

function field(label, value) {
  return el('div', { class: 'field' }, [
    el('dt', { class: 'field__label', text: label }),
    el('dd', { class: 'field__value', text: value })
  ]);
}

export function renderDetail({ note, onEdit, onDelete }) {
  const card = el('article', { class: 'card detail' });

  card.append(
    el('header', { class: 'pane-header' }, [
      el('div', { class: 'pane-header__titles' }, [
        el('p', { class: 'pane-header__eyebrow', text: formatBrewedAt(note.brewed_at) }),
        el('h2', { class: 'pane-header__title', text: note.bean_name || 'Brew note' }),
        note.is_demo
          ? el('p', { class: 'pane-header__sample' }, [
              el('span', { class: 'chip chip--sample', text: 'Sample' }),
              ' Sample data — remove it from Settings when you are done with it.'
            ])
          : null
      ]),
      el('div', { class: 'pane-header__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Edit', onclick: () => onEdit() }),
        el('button', { type: 'button', class: 'btn btn--danger btn--small', text: 'Delete', onclick: () => onDelete() })
      ])
    ])
  );

  card.append(
    el('dl', { class: 'field-list' }, [
      field('Brew date and time', formatBrewedAt(note.brewed_at)),
      field('Grinder', text(note.grinder_name)),
      field('Grind size', grindSize(note.grind_size)),
      field('Dose', grams(note.dose_g)),
      field('Water', grams(note.water_g)),
      field('Ratio', ratioText(note) ?? EMPTY),
      field('Bean', text(note.bean_name)),
      field('Origin', text(note.bean_origin)),
      field('Roast level', roastLabel(note.roast_level))
    ])
  );

  card.append(
    el('section', { class: 'detail__notes' }, [
      el('h3', { class: 'section-title', text: 'Tasting notes' }),
      el('p', {
        class: 'tasting',
        text: note.tasting_notes || 'No tasting notes recorded for this brew.'
      })
    ])
  );

  return card;
}

/** Placeholder shown in the pane while nothing is selected. */
export function renderIdlePane({ hasNotes }) {
  return el('div', { class: 'card placeholder' }, [
    el('h2', { class: 'placeholder__title', text: hasNotes ? 'Nothing selected' : 'Welcome to Coffee Notes' }),
    el('p', {
      class: 'placeholder__text',
      text: hasNotes
        ? 'Choose a note from the history, or start a new one.'
        : 'Start a new note to record your first brew — grinder, dose, water and how it tasted.'
    })
  ]);
}

/** Loading skeleton that mirrors the shape of the detail card. */
export function renderPaneSkeleton() {
  return el('div', { class: 'card', 'aria-busy': 'true' }, [
    el('div', { class: 'skeleton-pane' }, [
      el('span', { class: 'skeleton skeleton--title' }),
      el('span', { class: 'skeleton skeleton--block' }),
      el('span', { class: 'skeleton skeleton--block' }),
      el('span', { class: 'skeleton skeleton--block skeleton--half' }),
      el('span', { class: 'skeleton skeleton--area' })
    ])
  ]);
}
