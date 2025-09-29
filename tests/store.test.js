import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/store.js';
import { parseMarkdown, serializeMarkdown } from '../src/utils/markdown.js';

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
};

function resetEnvironment() {
  storage.clear();
}

test('createStore boots with a single default item', () => {
  resetEnvironment();
  const store = createStore();
  const { doc } = store.getState();
  assert.equal(doc.rootIds.length, 1);
  const rootId = doc.rootIds[0];
  assert.ok(doc.items[rootId]);
  assert.equal(doc.items[rootId].text, 'New item');
});

test('addSiblingAfter inserts a root-level sibling after the target item', () => {
  resetEnvironment();
  const store = createStore();
  const [firstId] = store.getState().doc.rootIds;
  const secondId = store.addSiblingAfter(firstId);
  const { doc } = store.getState();
  assert.deepEqual(doc.rootIds, [firstId, secondId]);
  assert.equal(doc.items[secondId].parentId, undefined);
});

test('indent and outdent restructure the hierarchy relative to siblings', () => {
  resetEnvironment();
  const store = createStore();
  const [firstId] = store.getState().doc.rootIds;
  const secondId = store.addSiblingAfter(firstId);
  const thirdId = store.addSiblingAfter(secondId);

  store.indent(secondId);
  store.indent(thirdId);

  let { doc } = store.getState();
  assert.deepEqual(doc.rootIds, [firstId]);
  assert.deepEqual(doc.items[firstId].children, [secondId, thirdId]);
  assert.equal(doc.items[secondId].parentId, firstId);
  assert.equal(doc.items[thirdId].parentId, firstId);

  store.outdent(secondId);
  doc = store.getState().doc;
  assert.deepEqual(doc.rootIds, [firstId, secondId]);
  assert.deepEqual(doc.items[firstId].children, [thirdId]);
  assert.equal(doc.items[secondId].parentId, undefined);
});

test('deleteItem removes an entire subtree and updates parent relationships', () => {
  resetEnvironment();
  const store = createStore();
  const [rootId] = store.getState().doc.rootIds;
  const childId = store.addChild(rootId);
  const grandChildId = store.addChild(childId);

  store.deleteItem(childId);

  const { doc } = store.getState();
  assert.deepEqual(doc.items[rootId].children, []);
  assert.ok(!doc.items[childId]);
  assert.ok(!doc.items[grandChildId]);
});

test('undo and redo revert structural changes', () => {
  resetEnvironment();
  const store = createStore();
  const [rootId] = store.getState().doc.rootIds;
  const childId = store.addChild(rootId);
  assert.ok(store.getState().doc.items[childId]);

  store.undo();
  assert.ok(!store.getState().doc.items[childId]);

  store.redo();
  assert.ok(store.getState().doc.items[childId]);
});

test('insertNodes from parsed markdown preserves checkbox state and notes', () => {
  resetEnvironment();
  const store = createStore();
  const [rootId] = store.getState().doc.rootIds;
  const markdown = `- [x] Parent\n  - [ ] Child\n    Child note`;
  const nodes = parseMarkdown(markdown);
  const created = store.insertNodes(undefined, rootId, nodes);

  const { doc } = store.getState();
  assert.equal(created.length, 1);
  const insertedId = created[0];
  assert.deepEqual(doc.rootIds, [rootId, insertedId]);
  assert.equal(doc.items[insertedId].text, 'Parent');
  assert.equal(doc.items[insertedId].checked, true);
  assert.equal(doc.items[insertedId].note, undefined);

  const childId = doc.items[insertedId].children[0];
  assert.ok(childId);
  assert.equal(doc.items[childId].text, 'Child');
  assert.equal(doc.items[childId].checked, false);
  assert.equal(doc.items[childId].note, 'Child note');

  const serialized = serializeMarkdown(doc, insertedId);
  assert.equal(serialized, `- [x] Parent\n  - [ ] Child\n    Child note`);
});

test('focusItem does not emit notifications when selection is unchanged', () => {
  resetEnvironment();
  const store = createStore();
  const [rootId] = store.getState().doc.rootIds;
  let updates = 0;
  const unsubscribe = store.subscribe(() => {
    updates += 1;
  });

  store.focusItem(rootId, 0);
  assert.equal(updates, 1);

  store.focusItem(rootId, 0);
  assert.equal(updates, 1);

  unsubscribe();
});
