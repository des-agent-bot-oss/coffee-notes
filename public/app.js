// Coffee Notes — application controller.
//
// Owns the loaded data, the current pane view and every API round-trip. The
// modules under ./js/ only build DOM; they never fetch and never touch state
// outside the options they are given.

import { api } from './js/api.js';
import { renderDetail, renderIdlePane, renderPaneSkeleton } from './js/detail.js';
import { confirmDiscard, openDialog } from './js/dialog.js';
import { el } from './js/dom.js';
import { createDrawer } from './js/drawer.js';
import { createEditor } from './js/editor.js';
import { formatBrewedAt, noteCountLabel } from './js/format.js';
import { createSettings } from './js/settings.js';
import { renderHistory } from './js/sidebar.js';
import { toast } from './js/toast.js';

const SEARCH_DEBOUNCE = 200;

const dom = {
  banner: document.getElementById('banner'),
  header: document.getElementById('app-header'),
  history: document.getElementById('history'),
  historyCount: document.getElementById('history-count'),
  notesButton: document.getElementById('notes-button'),
  pane: document.getElementById('pane'),
  paneContent: document.getElementById('pane-content'),
  search: document.getElementById('search-input'),
  searchClear: document.getElementById('search-clear'),
  backdrop: document.getElementById('drawer-backdrop'),
  sidebar: document.getElementById('sidebar'),
  skipLink: document.getElementById('skip-link'),
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
  samplesLoaded: false,
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

// The settings component lives only while its dialog is open.
let settings = null;

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
    onClearSearch: clearSearch,
    onLoadSamples: loadSamples
  });
}

function renderPane() {
  if (state.pane === 'editor' && state.editor) {
    dom.paneContent.replaceChildren(state.editor.node);
  } else if (state.pane === 'detail' && state.note) {
    dom.paneContent.replaceChildren(
      renderDetail({ note: state.note, onEdit: startEdit, onDelete: deleteNote })
    );
  } else if (state.pane === 'loading') {
    dom.paneContent.replaceChildren(renderPaneSkeleton());
  } else {
    dom.paneContent.replaceChildren(renderIdlePane({ hasNotes: state.notes.length > 0 }));
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
    if (!state.query.trim()) {
      // An unfiltered list is the only place that shows whether sample data is
      // present, which gates the seed action so it can never run twice.
      state.samplesLoaded = state.notes.some((note) => note.is_demo);
    }
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
  if (settings) settings.refresh();
}

// --- mobile drawer -----------------------------------------------------------

const drawer = createDrawer({
  panel: dom.sidebar,
  backdrop: dom.backdrop,
  opener: dom.notesButton,
  background: [dom.skipLink, dom.header, dom.banner, dom.pane]
});

function closeDrawer() {
  drawer.close();
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
  // Choosing a note is the drawer's purpose: close it before anything else so a
  // discard prompt can never open behind its focus trap.
  closeDrawer();
  // Always re-read the note, even when it is the one on screen: a load that
  // fails must raise the banner and Retry rather than quietly leaving the
  // previous note in the pane as if it were current.
  withGuard(async () => {
    state.selectedId = id;
    state.previousSelection = null;
    renderSidebar();
    await loadDetail(id);
  }, 'Selecting another note discards the changes you have not saved yet.');
}

function startNewNote() {
  closeDrawer();
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
    syncSearchClear();
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

// --- search ------------------------------------------------------------------

let searchTimer = null;

function syncSearchClear() {
  dom.searchClear.hidden = dom.search.value.trim() === '';
}

function onSearchInput() {
  state.query = dom.search.value;
  syncSearchClear();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadNotes(), SEARCH_DEBOUNCE);
}

function clearSearch() {
  clearTimeout(searchTimer);
  dom.search.value = '';
  state.query = '';
  syncSearchClear();
  loadNotes();
}

// --- settings ----------------------------------------------------------------

function openSettings() {
  closeDrawer();
  return withGuard(() => showSettings(), 'Opening settings discards the changes you have not saved yet.');
}

function settingsSnapshot() {
  return {
    grinders: state.grinders,
    defaultId: state.defaultGrinderId,
    samplesLoaded: state.samplesLoaded,
    unavailable: state.grindersUnavailable
  };
}

/**
 * Run one grinder mutation, then re-read the list so `snapshot()` — and the
 * dialog that renders from it — never shows the state from before the change.
 */
async function mutateGrinder(request) {
  const payload = await request();
  await loadGrinders();
  return payload.grinder;
}

async function showSettings() {
  settings = createSettings({
    snapshot: settingsSnapshot,
    actions: {
      add: (name) => mutateGrinder(() => api.createGrinder(name)),
      rename: (id, name) => mutateGrinder(() => api.renameGrinder(id, name)),
      makeDefault: (id) => mutateGrinder(() => api.setDefaultGrinder(id)),
      remove: async (id) => {
        const payload = await api.deleteGrinder(id);
        await loadGrinders();
        // A note that used the removed preset now has no grinder_id; re-read it
        // so the editor offers the stored grinder name instead of a dead id.
        if (state.pane === 'detail' && state.selectedId !== null) await loadDetail(state.selectedId);
        return payload;
      },
      seed: async () => {
        const payload = await api.seedDemo();
        await loadNotes();
        await loadGrinders();
        return payload.created;
      },
      clearDemo: async () => {
        const payload = await api.clearDemo();
        await loadNotes();
        await loadGrinders();
        if (state.selectedId !== null && !state.notes.some((item) => item.id === state.selectedId)) {
          state.selectedId = null;
          state.note = null;
          state.pane = 'idle';
          renderSidebar();
          renderPane();
        }
        return payload.removed;
      }
    }
  });

  try {
    await openDialog({
      title: 'Grinder settings',
      description: 'Grinder presets fill in the grinder field when you record a new note. Removing one never changes a saved note.',
      body: settings.node,
      actions: [{ label: 'Close', value: 'close', variant: 'ghost' }]
    });
  } finally {
    settings = null;
  }
}

/** Load the sample notes from the empty history state. */
async function loadSamples() {
  if (state.samplesLoaded) {
    toast('Sample notes are already loaded.', 'error');
    return;
  }
  try {
    const payload = await api.seedDemo();
    toast(`${payload?.created ?? 'Sample'} sample notes loaded.`);
  } catch (error) {
    toast(`Sample notes could not be loaded. ${error.message}`, 'error');
    return;
  }
  await loadNotes();
  await loadGrinders();
  if (settings) settings.refresh();
}

// --- keyboard ----------------------------------------------------------------

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)
  );
}

function dialogOpen() {
  return document.querySelector('dialog[open]') !== null;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'n' || event.key === 'N') {
    // Ctrl/Cmd+N: only take the shortcut when it is unambiguous. While a dialog
    // is open, or while the user is typing, the browser keeps its own binding.
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (dialogOpen() || isTypingTarget(event.target)) return;
    event.preventDefault();
    startNewNote();
    return;
  }

  if (event.key !== 'Escape') return;
  if (dialogOpen()) return; // the dialog owns its own Esc
  if (drawer.isOpen()) {
    drawer.close();
    return;
  }
  if (state.pane !== 'editor') return;
  event.preventDefault();
  cancelEdit();
});

window.addEventListener('beforeunload', (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

// --- start-up ----------------------------------------------------------------

async function boot() {
  renderSidebar();
  renderPane();
  syncSearchClear();
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
dom.searchClear.addEventListener('click', clearSearch);

boot();
