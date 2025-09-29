import { create } from 'zustand';
import { produce } from 'immer';
import { DocSnapshot, Item, ItemId, OutlinerState } from './types';
import { createId } from './utils/id';
import { ParsedNode } from './utils/markdown';

const STORAGE_KEY = 'outliner:doc:v1';
const TYPING_COALESCE_MS = 500;

type DocUpdater = (draft: DocSnapshot) => void;

interface OutlinerActions {
  focusItem: (id: ItemId, caretOffset?: number, mode?: 'caret' | 'item' | 'subtree') => void;
  toggleCollapse: (id: ItemId) => void;
  toggleCollapseDeep: (id: ItemId, collapsed: boolean) => void;
  toggleChecked: (id: ItemId) => void;
  toggleNote: (id: ItemId) => void;
  setText: (id: ItemId, text: string, opts?: { typing?: boolean; caretOffset?: number }) => void;
  setNote: (id: ItemId, note: string) => void;
  addSiblingAfter: (id: ItemId) => ItemId;
  addChild: (id: ItemId) => ItemId;
  deleteItem: (id: ItemId) => void;
  moveUp: (id: ItemId) => void;
  moveDown: (id: ItemId) => void;
  indent: (id: ItemId) => void;
  outdent: (id: ItemId) => void;
  undo: () => void;
  redo: () => void;
  replaceDoc: (doc: DocSnapshot) => void;
  insertNodes: (
    parentId: ItemId | undefined,
    afterId: ItemId | undefined,
    nodes: ParsedNode[]
  ) => ItemId[];
}

export type OutlinerStore = OutlinerState & OutlinerActions;

const emptyDoc = (): DocSnapshot => {
  const id = createId();
  const item: Item = {
    id,
    text: 'New item',
    checked: false,
    children: [],
  };
  return { rootIds: [id], items: { [id]: item } };
};

const initialDoc = (): DocSnapshot => {
  if (typeof localStorage === 'undefined') {
    return emptyDoc();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDoc();
    const parsed = JSON.parse(raw) as DocSnapshot;
    if (!parsed.rootIds || !parsed.items) return emptyDoc();
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored doc', error);
    return emptyDoc();
  }
};

const createHistory = (doc: DocSnapshot) => ({
  past: [] as DocSnapshot[],
  present: doc,
  future: [] as DocSnapshot[],
  lastTextChange: undefined as number | undefined,
});

const persistDoc = (doc: DocSnapshot) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
};

const ensureSelection = (
  state: OutlinerStore,
  id: ItemId,
  caretOffset?: number,
  mode: 'caret' | 'item' | 'subtree' = 'caret'
) => {
  state.ui.selection = { anchorId: id, mode, caretOffset };
};

const applyDocChange = (set: (fn: (state: OutlinerStore) => void) => void, get: () => OutlinerStore) =>
  (updater: DocUpdater, opts?: { typing?: boolean; caretOffset?: number }) => {
    const now = Date.now();
    set((state) => {
      const current = state.history.present;
      const updated = produce(current, updater);
      const shouldCoalesce = Boolean(opts?.typing) &&
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
        state.history.lastTextChange = opts?.typing ? now : undefined;
      }
      if (state.ui.selection && opts?.caretOffset !== undefined) {
        state.ui.selection.caretOffset = opts.caretOffset;
      }
    });
    persistDoc(get().doc);
  };

const insertAfterSibling = (doc: DocSnapshot, parentId: ItemId | undefined, siblingId: ItemId | undefined, id: ItemId) => {
  if (parentId) {
    const parent = doc.items[parentId];
    const idx = siblingId ? parent.children.indexOf(siblingId) : -1;
    parent.children.splice(idx + 1, 0, id);
  } else {
    const idx = siblingId ? doc.rootIds.indexOf(siblingId) : -1;
    doc.rootIds.splice(idx + 1, 0, id);
  }
};

const appendParsedNodes = (
  draft: DocSnapshot,
  parentId: ItemId | undefined,
  afterId: ItemId | undefined,
  nodes: ParsedNode[]
): ItemId[] => {
  const createdIds: ItemId[] = [];
  const insertChild = (parent: ItemId, node: ParsedNode): ItemId => {
    const id = createId();
    const item: Item = {
      id,
      text: node.text,
      checked: node.checked,
      note: node.note,
      children: [],
      parentId: parent,
    };
    draft.items[id] = item;
    node.children.forEach((child) => {
      const childId = insertChild(id, child);
      draft.items[id].children.push(childId);
    });
    return id;
  };

  let lastInserted = afterId;

  const insertNode = (node: ParsedNode): ItemId => {
    const id = createId();
    const item: Item = {
      id,
      text: node.text,
      checked: node.checked,
      note: node.note,
      children: [],
      parentId,
    };
    draft.items[id] = item;
    if (parentId) {
      const parent = draft.items[parentId];
      const siblings = parent.children;
      const idx = lastInserted ? siblings.indexOf(lastInserted) : -1;
      siblings.splice(idx + 1, 0, id);
    } else {
      const siblings = draft.rootIds;
      const idx = lastInserted ? siblings.indexOf(lastInserted) : -1;
      siblings.splice(idx + 1, 0, id);
    }
    lastInserted = id;
    node.children.forEach((child) => {
      const childId = insertChild(item.id, child);
      draft.items[item.id].children.push(childId);
    });
    return id;
  };

  nodes.forEach((node) => {
    const id = insertNode(node);
    createdIds.push(id);
  });

  return createdIds;
};

export const useOutlinerStore = create<OutlinerStore>()((set, get) => {
  const doc = initialDoc();
  const history = createHistory(doc);
  const apply = applyDocChange(set, get);

  return {
    doc,
    ui: { collapsed: {}, notesOpen: {}, selection: undefined },
    history,
    focusItem: (id, caretOffset, mode = 'caret') => {
      set((state) => {
        state.ui.selection = { anchorId: id, mode, caretOffset };
      });
    },
    toggleCollapse: (id) => {
      set((state) => {
        state.ui.collapsed[id] = !state.ui.collapsed[id];
      });
      persistDoc(get().doc);
    },
    toggleCollapseDeep: (id, collapsed) => {
      set((state) => {
        const traverse = (itemId: ItemId) => {
          state.ui.collapsed[itemId] = collapsed;
          state.doc.items[itemId].children.forEach(traverse);
        };
        traverse(id);
      });
      persistDoc(get().doc);
    },
    toggleChecked: (id) => {
      apply((draft) => {
        draft.items[id].checked = !draft.items[id].checked;
      });
    },
    toggleNote: (id) => {
      set((state) => {
        state.ui.notesOpen[id] = !state.ui.notesOpen[id];
      });
      if (get().ui.notesOpen[id] && !get().doc.items[id].note) {
        apply((draft) => {
          draft.items[id].note = '';
        });
      }
      persistDoc(get().doc);
    },
    setText: (id, text, opts) => {
      apply((draft) => {
        draft.items[id].text = text;
      }, { typing: opts?.typing, caretOffset: opts?.caretOffset });
    },
    setNote: (id, note) => {
      apply((draft) => {
        draft.items[id].note = note;
      });
    },
    addSiblingAfter: (id) => {
      const newId = createId();
      apply((draft) => {
        const current = draft.items[id];
        const siblingParent = current.parentId;
        const item: Item = {
          id: newId,
          text: '',
          checked: false,
          children: [],
          parentId: siblingParent,
        };
        draft.items[newId] = item;
        insertAfterSibling(draft, siblingParent, id, newId);
      });
      ensureSelection(get(), newId, 0);
      persistDoc(get().doc);
      return newId;
    },
    addChild: (id) => {
      const newId = createId();
      apply((draft) => {
        const item: Item = {
          id: newId,
          text: '',
          checked: false,
          children: [],
          parentId: id,
        };
        draft.items[newId] = item;
        draft.items[id].children.push(newId);
      });
      set((state) => {
        state.ui.collapsed[id] = false;
      });
      ensureSelection(get(), newId, 0);
      persistDoc(get().doc);
      return newId;
    },
    deleteItem: (id) => {
      apply((draft) => {
        const queue = [id];
        const toRemove = new Set<ItemId>();
        while (queue.length) {
          const currentId = queue.pop()!;
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
    moveUp: (id) => {
      apply((draft) => {
        const item = draft.items[id];
        const siblings = item.parentId ? draft.items[item.parentId].children : draft.rootIds;
        const idx = siblings.indexOf(id);
        if (idx > 0) {
          [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
        }
      });
    },
    moveDown: (id) => {
      apply((draft) => {
        const item = draft.items[id];
        const siblings = item.parentId ? draft.items[item.parentId].children : draft.rootIds;
        const idx = siblings.indexOf(id);
        if (idx >= 0 && idx < siblings.length - 1) {
          [siblings[idx + 1], siblings[idx]] = [siblings[idx], siblings[idx + 1]];
        }
      });
    },
    indent: (id) => {
      apply((draft) => {
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
    outdent: (id) => {
      apply((draft) => {
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
    undo: () => {
      set((state) => {
        if (!state.history.past.length) return;
        const previous = state.history.past.pop()!;
        state.history.future.unshift(state.history.present);
        state.history.present = previous;
        state.doc = previous;
        state.history.lastTextChange = undefined;
      });
      persistDoc(get().doc);
    },
    redo: () => {
      set((state) => {
        if (!state.history.future.length) return;
        const next = state.history.future.shift()!;
        state.history.past.push(state.history.present);
        state.history.present = next;
        state.doc = next;
        state.history.lastTextChange = undefined;
      });
      persistDoc(get().doc);
    },
    replaceDoc: (doc) => {
      set((state) => {
        state.history.past.push(state.history.present);
        state.history.present = doc;
        state.history.future = [];
        state.history.lastTextChange = undefined;
        state.doc = doc;
      });
      persistDoc(get().doc);
    },
    insertNodes: (parentId, afterId, nodes) => {
      let created: ItemId[] = [];
      apply((draft) => {
        created = appendParsedNodes(draft, parentId, afterId, nodes);
      });
      if (created.length) {
        ensureSelection(get(), created[created.length - 1], 0);
      }
      return created;
    },
  };
});
