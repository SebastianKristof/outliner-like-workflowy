import { createId } from './utils/id.js';
import { appendParsedNodes } from './utils/markdown.js';

const STORAGE_KEY = 'outliner:doc:v1';
const TYPING_COALESCE_MS = 500;

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function emptyDoc() {
  const id = createId();
  const item = {
    id,
    text: 'New item',
    checked: false,
    children: [],
  };
  return { rootIds: [id], items: { [id]: item } };
}

function loadDoc() {
  if (typeof localStorage === 'undefined') {
    return emptyDoc();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDoc();
    const parsed = JSON.parse(raw);
    if (!parsed.rootIds || !parsed.items) return emptyDoc();
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored doc', error);
    return emptyDoc();
  }
}

function persistDoc(doc) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

function createHistory(doc) {
  return {
    past: [],
    present: doc,
    future: [],
    lastTextChange: undefined,
  };
}

export function createStore() {
  const listeners = new Set();
  const doc = loadDoc();
  const state = {
    doc,
    ui: { collapsed: {}, notesOpen: {}, selection: undefined },
    history: createHistory(doc),
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const getState = () => state;

  const ensureSelection = (id, caretOffset, mode = 'caret') => {
    state.ui.selection = { anchorId: id, caretOffset, mode };
  };

  const applyDocChange = (updater, opts = {}) => {
    const now = Date.now();
    const current = state.history.present;
    const updated = cloneDoc(current);
    updater(updated);
    const shouldCoalesce = Boolean(opts.typing) &&
      state.history.lastTextChange !== undefined &&
      now - state.history.lastTextChange < TYPING_COALESCE_MS;

    if (shouldCoalesce) {
      state.history.present = updated;
      state.doc = updated;
      state.history.lastTextChange = now;
    } else {
      state.history.past.push(current);
      state.history.present = updated;
      state.doc = updated;
      state.history.future = [];
      state.history.lastTextChange = opts.typing ? now : undefined;
    }

    if (state.ui.selection && typeof opts.caretOffset === 'number') {
      state.ui.selection.caretOffset = opts.caretOffset;
    }

    persistDoc(state.doc);
    notify();
  };

  const store = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState,
    focusItem(id, caretOffset, mode = 'caret') {
      ensureSelection(id, caretOffset, mode);
      notify();
    },
    toggleCollapse(id) {
      state.ui.collapsed[id] = !state.ui.collapsed[id];
      persistDoc(state.doc);
      notify();
    },
    toggleCollapseDeep(id, collapsed) {
      const traverse = (itemId) => {
        state.ui.collapsed[itemId] = collapsed;
        const item = state.doc.items[itemId];
        if (item) {
          item.children.forEach(traverse);
        }
      };
      traverse(id);
      persistDoc(state.doc);
      notify();
    },
    toggleChecked(id) {
      applyDocChange((draft) => {
        draft.items[id].checked = !draft.items[id].checked;
      });
    },
    toggleNote(id) {
      state.ui.notesOpen[id] = !state.ui.notesOpen[id];
      if (state.ui.notesOpen[id] && !state.doc.items[id].note) {
        applyDocChange((draft) => {
          draft.items[id].note = '';
        });
        return;
      }
      persistDoc(state.doc);
      notify();
    },
    setText(id, text, opts = {}) {
      applyDocChange((draft) => {
        draft.items[id].text = text;
      }, opts);
    },
    setNote(id, note) {
      applyDocChange((draft) => {
        draft.items[id].note = note;
      });
    },
    addSiblingAfter(id) {
      const newId = createId();
      applyDocChange((draft) => {
        const current = draft.items[id];
        const siblingParent = current.parentId;
        const item = {
          id: newId,
          text: '',
          checked: false,
          children: [],
          parentId: siblingParent,
        };
        draft.items[newId] = item;
        if (siblingParent) {
          const parent = draft.items[siblingParent];
          const idx = parent.children.indexOf(id);
          parent.children.splice(idx + 1, 0, newId);
        } else {
          const idx = draft.rootIds.indexOf(id);
          draft.rootIds.splice(idx + 1, 0, newId);
        }
      });
      ensureSelection(newId, 0);
      persistDoc(state.doc);
      notify();
      return newId;
    },
    addChild(id) {
      const newId = createId();
      applyDocChange((draft) => {
        const item = {
          id: newId,
          text: '',
          checked: false,
          children: [],
          parentId: id,
        };
        draft.items[newId] = item;
        draft.items[id].children.push(newId);
      });
      state.ui.collapsed[id] = false;
      ensureSelection(newId, 0);
      persistDoc(state.doc);
      notify();
      return newId;
    },
    deleteItem(id) {
      applyDocChange((draft) => {
        const queue = [id];
        const toRemove = new Set();
        while (queue.length) {
          const currentId = queue.pop();
          const item = draft.items[currentId];
          if (!item) continue;
          toRemove.add(currentId);
          queue.push(...item.children);
        }
        toRemove.forEach((removeId) => {
          const item = draft.items[removeId];
          if (!item) return;
          if (item.parentId) {
            const parent = draft.items[item.parentId];
            parent.children = parent.children.filter((childId) => childId !== removeId);
          } else {
            draft.rootIds = draft.rootIds.filter((rootId) => rootId !== removeId);
          }
          delete draft.items[removeId];
        });
      });
    },
    moveUp(id) {
      applyDocChange((draft) => {
        const item = draft.items[id];
        const siblings = item.parentId ? draft.items[item.parentId].children : draft.rootIds;
        const idx = siblings.indexOf(id);
        if (idx > 0) {
          [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
        }
      });
    },
    moveDown(id) {
      applyDocChange((draft) => {
        const item = draft.items[id];
        const siblings = item.parentId ? draft.items[item.parentId].children : draft.rootIds;
        const idx = siblings.indexOf(id);
        if (idx >= 0 && idx < siblings.length - 1) {
          [siblings[idx + 1], siblings[idx]] = [siblings[idx], siblings[idx + 1]];
        }
      });
    },
    indent(id) {
      applyDocChange((draft) => {
        const item = draft.items[id];
        const siblings = item.parentId ? draft.items[item.parentId].children : draft.rootIds;
        const idx = siblings.indexOf(id);
        if (idx > 0) {
          const newParentId = siblings[idx - 1];
          siblings.splice(idx, 1);
          item.parentId = newParentId;
          draft.items[newParentId].children.push(id);
        }
      });
    },
    outdent(id) {
      applyDocChange((draft) => {
        const item = draft.items[id];
        if (!item.parentId) return;
        const parent = draft.items[item.parentId];
        const siblings = parent.children;
        const idx = siblings.indexOf(id);
        if (idx === -1) return;
        siblings.splice(idx, 1);
        const grandParentId = parent.parentId;
        item.parentId = grandParentId;
        if (grandParentId) {
          const grandParent = draft.items[grandParentId];
          const parentIdx = grandParent.children.indexOf(parent.id);
          grandParent.children.splice(parentIdx + 1, 0, id);
        } else {
          const parentIdx = draft.rootIds.indexOf(parent.id);
          draft.rootIds.splice(parentIdx + 1, 0, id);
        }
      });
    },
    undo() {
      if (!state.history.past.length) return;
      const previous = state.history.past.pop();
      state.history.future.unshift(state.history.present);
      state.history.present = previous;
      state.doc = previous;
      state.history.lastTextChange = undefined;
      persistDoc(state.doc);
      notify();
    },
    redo() {
      if (!state.history.future.length) return;
      const next = state.history.future.shift();
      state.history.past.push(state.history.present);
      state.history.present = next;
      state.doc = next;
      state.history.lastTextChange = undefined;
      persistDoc(state.doc);
      notify();
    },
    replaceDoc(docSnapshot) {
      state.history.past.push(state.history.present);
      state.history.present = docSnapshot;
      state.history.future = [];
      state.history.lastTextChange = undefined;
      state.doc = docSnapshot;
      persistDoc(state.doc);
      notify();
    },
    insertNodes(parentId, afterId, nodes) {
      let created = [];
      applyDocChange((draft) => {
        created = appendParsedNodes(draft, parentId, afterId, nodes);
      });
      if (created.length) {
        ensureSelection(created[created.length - 1], 0);
        notify();
      }
      return created;
    },
  };

  return store;
}
