// History sidebar: the note list, its selected state, and the sidebar's
// loading / empty / filtered-empty states.

import { append, clear, el } from './dom.js';
import { EMPTY, formatBrewedAt } from './format.js';

const SKELETON_ROWS = 6;

function skeleton() {
  const list = el('ul', { class: 'skeleton-rows' });
  for (let index = 0; index < SKELETON_ROWS; index += 1) {
    list.append(
      el('li', { class: 'skeleton-row' }, [
        el('span', { class: 'skeleton skeleton--line' }),
        el('span', { class: 'skeleton skeleton--line skeleton--line-sub' })
      ])
    );
  }
  return list;
}

function row(note, { selected, onSelect }) {
  const button = el(
    'button',
    {
      type: 'button',
      class: 'note-row',
      'aria-current': selected ? 'true' : null,
      onclick: () => onSelect(note.id)
    },
    [
      el('span', { class: 'note-row__when', text: formatBrewedAt(note.brewed_at) }),
      el('span', { class: 'note-row__meta' }, [
        el('span', { class: 'note-row__grinder', text: note.grinder_name }),
        el('span', { class: 'note-row__bean', text: ` · ${note.bean_name || EMPTY}` })
      ]),
      note.is_demo ? el('span', { class: 'chip chip--sample', text: 'Sample' }) : null,
      note.grind_size === null || note.grind_size === undefined
        ? null
        : el('span', { class: 'chip chip--grind', text: `Grind ${note.grind_size}` })
    ]
  );
  return el('li', {}, [button]);
}

export function renderHistory(
  host,
  { notes, loading, error, query, selectedId, onSelect, onNewNote, onClearSearch, onLoadSamples }
) {
  clear(host);
  host.setAttribute('aria-busy', loading ? 'true' : 'false');

  if (loading) {
    append(host, skeleton());
    return;
  }

  if (error) {
    append(host, el('p', { class: 'history__message', text: 'Your notes could not be loaded.' }));
    return;
  }

  if (notes.length === 0) {
    if (query) {
      append(
        host,
        el('div', { class: 'empty' }, [
          el('h2', { class: 'empty__title', text: 'No matching notes' }),
          el('p', { class: 'empty__text', text: `Nothing matches “${query}”. Try another word, or clear the search.` }),
          el('button', {
            type: 'button',
            class: 'btn btn--ghost btn--small',
            text: 'Clear search',
            onclick: () => onClearSearch()
          })
        ])
      );
      return;
    }
    append(
      host,
      el('div', { class: 'empty' }, [
        el('h2', { class: 'empty__title', text: 'No notes yet' }),
        el('p', {
          class: 'empty__text',
          text: 'Record a brew and it will appear here, newest first — with the grinder, beans and grind size you used.'
        }),
        el('div', { class: 'empty__actions' }, [
          el('button', { type: 'button', class: 'btn btn--primary', text: 'New note', onclick: () => onNewNote() }),
          onLoadSamples
            ? el('button', {
                type: 'button',
                class: 'btn btn--ghost',
                text: 'Load sample notes',
                onclick: () => onLoadSamples()
              })
            : null
        ])
      ])
    );
    return;
  }

  const list = el('ul', { class: 'history__list' });
  for (const note of notes) list.append(row(note, { selected: note.id === selectedId, onSelect }));
  host.append(list);
}
