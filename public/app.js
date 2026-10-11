// Coffee Notes — application controller.
//
// Owns the loaded data, the current pane view and every API round-trip. The
// modules under ./js/ only build DOM; they never fetch and never touch state
// outside the options they are given.

import { api } from './js/api.js';
import { renderDetail, renderIdlePane, renderPaneSkeleton } from './js/detail.js';
import { confirmDiscard, openDialog } from './js/dialog.js';
import { el } from './js/dom.js';
import { createEditor } from './js/editor.js';
import { formatBrewedAt, noteCountLabel } from './js/format.js';
import { renderHistory } from './js/sidebar.js';
import { toast } from './js/toast.js';

const SEARCH_DEBOUNCE = 200;

const dom = {
  banner: document.getElementById('banner'),
  history: document.getElementById('history'),
  historyCount: document.getElementById('history-count'),
  pane: document.getElementById('pane-content'),
  search: document.getElementById('search-input'),
  newNote: document.getElementById('new-note-button'),
  settings: document.getElementById('settings-button')
};

const state = {
  notes: [],
  notesLoaded: false,
  notesLoading: true,
  grinders: [],
  grindersLoaded: false,
  grindersUnavailable: false,
  defaultGrinderId: null,
  query: '',
  selectedId: null,
  note: null,
  previousSelection: null,
  editor: null,
  editorIsNew: false,
  pane: 'loading', // 'loading' | 'idle' | 'detail' | 'editor'
  notesSeq: 0,
  detailSeq: 0
};

// Load failures the user can retry, keyed so a newer success clears only its own.
const errors = new Map();

// --- rendering ---------------------------------------------------------------

function renderBanner() {
  const entry = errors.entries().next().value;
  if (!entry) {
    dom.banner.hidden = true;
    dom.banner.replaceChildren();
    return;
  }
  dom.banner.hidden = false;
  dom.banner.replaceChildren(
    el('span', { class: 'banner__message', text: entry[1] }),
    el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--small',
      text: 'Retry',
      onclick: () => retry()
    })
  );
}

function renderSidebar() {
  dom.historyCount.textContent = state.notesLoading ? '' : noteCountLabel(state.notes.length);
  renderHistory(dom.history, {
    notes: state.notes,
    loading: state.notesLoading,
    error: errors.has('notes'),
    query: state.query.trim(),
    selectedId: state.selectedId,
    onSelect: selectNote,
    onNewNote: startNewNote,
    onClearSearch: clearSearch
  });
}

function renderPane() {
  if (state.pane === 'editor' && state.editor) {
    dom.pane.replaceChildren(state.editor.node);
  } else if (state.pane === 'detail' && state.note) {
    dom.pane.replaceChildren(
      renderDetail({ note: state.note, onEdit: startEdit, onDelete: deleteNote })
    );
  } else if (state.pane === 'loading') {
    dom.pane.replaceChildren(renderPaneSkeleton());
  } else {
    dom.pane.replaceChildren(renderIdlePane({ hasNotes: state.notes.length > 0 }));
  }
}

// --- loading -----------------------------------------------------------------

function notesQuery() {
  const trimmed = state.query.trim();
  return trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
}

async function loadNotes() {
  const seq = ++state.notesSeq;
  if (!state.notesLoaded) {
    state.notesLoading = true;
    renderSidebar();
  }
  try {
    const payload = await api.listNotes(notesQuery());
    if (seq !== state.notesSeq) return; // a newer search already answered
    state.notes = payload?.notes ?? [];
    state.notesLoaded = true;
    state.notesLoading = false;
    clearError('notes');
    renderSidebar();
  } catch (error) {
    if (seq !== state.notesSeq) return;
    state.notesLoading = false;
    renderSidebar();
    setError('notes', `Your notes could not be loaded. ${error.message}`);
  }
}

async function loadGrinders() {
  try {
    const payload = await api.listGrinders();
    state.grinders = payload?.grinders ?? [];
    state.defaultGrinderId = payload?.default_id ?? null;
    state.grindersLoaded = true;
    state.grindersUnavailable = false;
    clearError('grinders');
  } catch (error) {
    state.grindersUnavailable = true;
    setError('grinders', `Grinder presets could not be loaded. ${error.message}`);
  }
}

async function loadDetail(id) {
  const seq = ++state.detailSeq;
  state.pane = 'loading';
  renderPane();
  try {
    const payload = await api.getNote(id);
    if (seq !== state.detailSeq) return;
    state.note = payload?.note ?? null;
    state.pane = 'detail';
    clearError('note');
    renderPane();
  } catch (error) {
    if (seq !== state.detailSeq) return;
    state.note = null;
    state.pane = 'idle';
    setError('note', `That note could not be opened. ${error.message}`);
    renderPane();
  }
}

function setError(key, message) {
  errors.set(key, message);
  renderBanner();
}

function clearError(key) {
  if (errors.delete(key)) renderBanner();
}

async function retry() {
  const keys = [...errors.keys()];
  errors.clear();
  renderBanner();
  if (keys.includes('notes')) await loadNotes();
  if (keys.includes('grinders')) await loadGrinders();
  if (keys.includes('note') && state.selectedId !== null) await loadDetail(state.selectedId);
}

// --- unsaved-changes guard ---------------------------------------------------

function isDirty() {
  return state.pane === 'editor' && state.editor !== null && state.editor.isDirty();
}

function closeEditor() {
  state.editor = null;
  if (state.pane === 'editor') state.pane = 'idle';
}

/** Run an in-app navigation, asking before unsaved edits are discarded. */
async function withGuard(action, message) {
  if (isDirty() && !(await confirmDiscard(message))) return false;
  closeEditor();
  await action();
  return true;
}

// --- navigation --------------------------------------------------------------

function selectNote(id) {
  if (id === state.selectedId && state.pane === 'detail') return;
  withGuard(async () => {
    state.selectedId = id;
    state.previousSelection = null;
    renderSidebar();
    await loadDetail(id);
  }, 'Selecting another note discards the changes you have not saved yet.');
}

function startNewNote() {
  withGuard(async () => {
    state.previousSelection = state.selectedId;
    state.selectedId = null;
    state.note = null;
    renderSidebar();
    if (!state.grindersLoaded) await loadGrinders();
    showEditor({ isNew: true });
  }, 'Starting a new note discards the changes you have not saved yet.');
}

function startEdit() {
  if (!state.note) return;
  withGuard(async () => showEditor({ isNew: false }), 'Editing discards the changes you have not saved yet.');
}

function showEditor({ isNew }) {
  state.pane = 'editor';
  state.editorIsNew = isNew;
  state.editor = createEditor({
    note: isNew ? null : state.note,
    isNew,
    grinders: state.grinders,
    defaultGrinderId: state.defaultGrinderId,
    grindersUnavailable: state.grindersUnavailable,
    onSave: saveNote,
    onCancel: cancelEdit,
    onOpenSettings: openSettings
  });
  renderPane();
  state.editor.focusFirst();
}

async function cancelEdit() {
  const wasNew = state.editorIsNew;
  if (isDirty() && !(await confirmDiscard('This note has changes you have not saved yet.'))) return;

  const previous = state.previousSelection;
  state.editor = null;
  state.editorIsNew = false;

  if (!wasNew && state.note) {
    // An edited note reverts to the stored version — nothing was written.
    state.pane = 'detail';
    renderPane();
    return;
  }

  state.previousSelection = null;
  if (previous !== null && state.notes.some((item) => item.id === previous)) {
    state.selectedId = previous;
    renderSidebar();
    await loadDetail(previous);
    return;
  }
  state.selectedId = null;
  state.note = null;
  state.pane = 'idle';
  renderSidebar();
  renderPane();
}

async function saveNote(payload, { isNew, id }) {
  const result = isNew ? await api.createNote(payload) : await api.updateNote(id, payload);
  const note = result.note;

  state.note = note;
  state.selectedId = note.id;
  state.previousSelection = null;
  state.editor = null;
  state.editorIsNew = false;
  state.pane = 'detail';

  if (isNew && state.query) {
    // A brand-new note is not necessarily a search hit; show the full history.
    state.query = '';
    dom.search.value = '';
  }

  renderPane();
  toast(isNew ? 'Note saved.' : 'Changes saved.');
  await loadNotes();
}

async function deleteNote() {
  const note = state.note;
  if (!note) return;

  const choice = await openDialog({
    title: 'Delete this note?',
    description: `The note from ${formatBrewedAt(note.brewed_at)} brewed with ${note.grinder_name} will be removed for good. This cannot be undone.`,
    actions: [
      { label: 'Keep note', value: 'keep', variant: 'ghost' },
      { label: 'Delete note', value: 'delete', variant: 'danger' }
    ]
  });
  if (choice !== 'delete') return;

  try {
    await api.deleteNote(note.id);
  } catch (error) {
    toast(`The note could not be deleted. ${error.message}`, 'error');
    return;
  }
  toast('Note deleted.');

  const index = state.notes.findIndex((item) => item.id === note.id);
  await loadNotes();
  const next = state.notes[index] ?? state.notes[index - 1] ?? null;
  if (next) {
    state.selectedId = next.id;
    renderSidebar();
    await loadDetail(next.id);
  } else {
    state.selectedId = null;
    state.note = null;
    state.pane = 'idle';
    renderSidebar();
    renderPane();
  }
}

// --- search and settings -----------------------------------------------------

let searchTimer = null;

function onSearchInput() {
  state.query = dom.search.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadNotes(), SEARCH_DEBOUNCE);
}

function clearSearch() {
  clearTimeout(searchTimer);
  dom.search.value = '';
  state.query = '';
  loadNotes();
}

function openSettings() {
  return withGuard(
    () => showSettings(),
    'Opening settings discards the changes you have not saved yet.'
  );
}

function showSettings() {
  const body = el('div', { class: 'settings' });
  if (state.grinders.length === 0) {
    body.append(
      el('p', {
        class: 'settings__empty',
        text: state.grindersUnavailable
          ? 'Grinder presets could not be loaded.'
          : 'No grinder presets yet. Until you add one, a note keeps whatever grinder name you type.'
      })
    );
  } else {
    const list = el('ul', { class: 'grinder-list' });
    for (const grinder of state.grinders) {
      list.append(
        el('li', { class: 'grinder-list__item' }, [
          el('span', { class: 'grinder-list__name', text: grinder.name }),
          grinder.is_default ? el('span', { class: 'badge', text: 'Default' }) : null,
          el('span', { class: 'grinder-list__count', text: noteCountLabel(grinder.note_count) })
        ])
      );
    }
    body.append(list);
  }

  return openDialog({
    title: 'Settings',
    description: 'Grinder presets fill in the grinder field when you record a new note.',
    body,
    actions: [{ label: 'Close', value: 'close', variant: 'ghost' }]
  });
}

// --- start-up ----------------------------------------------------------------

async function boot() {
  renderSidebar();
  renderPane();
  await Promise.all([loadNotes(), loadGrinders()]);

  if (state.selectedId === null && state.notes.length > 0) {
    state.selectedId = state.notes[0].id;
    renderSidebar();
    await loadDetail(state.selectedId);
  } else if (state.pane === 'loading') {
    state.pane = 'idle';
    renderPane();
  }
}

dom.newNote.addEventListener('click', () => startNewNote());
dom.settings.addEventListener('click', () => openSettings());
dom.search.addEventListener('input', onSearchInput);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (document.querySelector('dialog[open]')) return; // the dialog owns its own Esc
  if (state.pane !== 'editor') return;
  event.preventDefault();
  cancelEdit();
});

window.addEventListener('beforeunload', (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

boot();
