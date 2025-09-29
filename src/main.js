import { createStore } from './store.js';
import { renderInlineMarkdown } from './utils/format.js';
import { getCaretOffset, getSelectionOffsets, setCaretOffset } from './utils/selection.js';
import { parseMarkdown, serializeMarkdown } from './utils/markdown.js';

const store = createStore();
const root = document.getElementById('root');

const refs = {
  text: new Map(),
  note: new Map(),
  add: new Map(),
};

function formatSelection(value, selection, marker) {
  const { start, end } = selection;
  if (start === end) return null;
  const before = value.slice(0, start);
  const middle = value.slice(start, end);
  const after = value.slice(end);
  const markerPair = marker === '`' ? '`' : marker;
  return {
    text: `${before}${marker}${middle}${markerPair}${after}`,
    selectionOffset: end + marker.length + markerPair.length,
  };
}

function applySelectionFocus() {
  const { ui, doc } = store.getState();
  const selection = ui.selection;
  if (!selection) return;
  if (selection.mode === 'caret') {
    const target = refs.text.get(selection.anchorId);
    if (target) {
      const offset = typeof selection.caretOffset === 'number'
        ? selection.caretOffset
        : (doc.items[selection.anchorId]?.text.length ?? 0);
      target.focus({ preventScroll: true });
      setCaretOffset(target, offset);
    }
  } else if (selection.mode === 'item') {
    const note = refs.note.get(selection.anchorId);
    if (note) {
      note.focus({ preventScroll: true });
      note.selectionStart = note.selectionEnd = note.value.length;
    }
  } else if (selection.mode === 'subtree') {
    const button = refs.add.get(selection.anchorId);
    if (button) {
      button.focus({ preventScroll: true });
    }
  }
}

function handleFormatting(id, marker) {
  const element = refs.text.get(id);
  if (!element) return;
  const offsets = getSelectionOffsets(element);
  const text = element.innerText;
  const selection = offsets && offsets.start !== offsets.end
    ? offsets
    : { start: 0, end: text.length };
  const formatted = formatSelection(text, selection, marker);
  if (formatted) {
    store.setText(id, formatted.text, { caretOffset: formatted.selectionOffset });
    requestAnimationFrame(() => {
      const target = refs.text.get(id);
      if (target) {
        setCaretOffset(target, formatted.selectionOffset);
      }
    });
  }
}

function focusAfterRender(callback) {
  requestAnimationFrame(callback);
}

function createToolbar(id) {
  const toolbar = document.createElement('div');
  toolbar.className = 'item-toolbar';

  const makeButton = (label, title, handler) => {
    const button = document.createElement('button');
    button.innerHTML = label;
    button.title = title;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  };

  toolbar.appendChild(makeButton('↑', 'Move up (Alt+↑)', () => store.moveUp(id)));
  toolbar.appendChild(makeButton('↓', 'Move down (Alt+↓)', () => store.moveDown(id)));
  toolbar.appendChild(makeButton('→', 'Indent (Tab)', () => store.indent(id)));
  toolbar.appendChild(makeButton('←', 'Outdent (Shift+Tab)', () => store.outdent(id)));
  toolbar.appendChild(makeButton('<strong>B</strong>', 'Bold (Cmd/Ctrl+B)', () => handleFormatting(id, '**')));
  toolbar.appendChild(makeButton('<em>I</em>', 'Italic (Cmd/Ctrl+I)', () => handleFormatting(id, '*')));
  toolbar.appendChild(makeButton('<code>&lt;</code>', 'Code (Cmd/Ctrl+`)', () => handleFormatting(id, '`')));
  toolbar.appendChild(makeButton('+', 'Add child', () => {
    const childId = store.addChild(id);
    focusAfterRender(() => {
      const child = refs.text.get(childId);
      if (child) {
        child.focus({ preventScroll: true });
        setCaretOffset(child, 0);
      }
    });
  }));
  toolbar.appendChild(makeButton('📝', 'Toggle note (Cmd/Ctrl+;)', () => {
    const isOpen = store.getState().ui.notesOpen[id];
    store.toggleNote(id);
    if (!isOpen) {
      focusAfterRender(() => {
        const note = refs.note.get(id);
        if (note) {
          note.focus({ preventScroll: true });
          note.selectionStart = note.selectionEnd = note.value.length;
        }
      });
    }
  }));
  toolbar.appendChild(makeButton('✕', 'Delete', () => {
    store.deleteItem(id);
  }));

  return toolbar;
}

function handleCopy(event, id) {
  event.preventDefault();
  const markdown = serializeMarkdown(store.getState().doc, id);
  event.clipboardData.setData('text/plain', markdown);
  event.clipboardData.setData('text/markdown', markdown);
}

function handlePaste(event, id) {
  const data = event.clipboardData.getData('text/markdown') || event.clipboardData.getData('text/plain');
  if (!data) return;
  const parsed = parseMarkdown(data);
  if (!parsed.length) return;
  event.preventDefault();
  const { doc, ui } = store.getState();
  const item = doc.items[id];
  if (!item) return;
  if (ui.selection?.mode === 'subtree') {
    const lastChild = item.children[item.children.length - 1];
    store.insertNodes(id, lastChild, parsed);
  } else {
    store.insertNodes(item.parentId, id, parsed);
  }
}

function handleBackspace(event, id, textElement) {
  if (!textElement) return;
  const text = textElement.innerText.trim();
  const { doc } = store.getState();
  const item = doc.items[id];
  if (!item) return;
  if (text.length === 0 && item.children.length === 0) {
    event.preventDefault();
    let targetId;
    const seekLastDescendant = (startId) => {
      let currentId = startId;
      while (doc.items[currentId]?.children.length) {
        const children = doc.items[currentId].children;
        currentId = children[children.length - 1];
      }
      return currentId;
    };
    if (item.parentId) {
      const siblings = doc.items[item.parentId].children;
      const idx = siblings.indexOf(id);
      if (idx > 0) {
        targetId = seekLastDescendant(siblings[idx - 1]);
      } else {
        targetId = item.parentId;
      }
    } else {
      const roots = doc.rootIds;
      const idx = roots.indexOf(id);
      if (idx > 0) {
        targetId = seekLastDescendant(roots[idx - 1]);
      }
    }
    const caretLength = targetId ? (doc.items[targetId]?.text.length ?? 0) : 0;
    store.deleteItem(id);
    if (targetId) {
      store.focusItem(targetId, caretLength, 'caret');
      focusAfterRender(() => {
        const target = refs.text.get(targetId);
        if (target) {
          target.focus({ preventScroll: true });
          setCaretOffset(target, caretLength);
        }
      });
    }
  }
}

function createItemRow(id, depth) {
  const { doc, ui } = store.getState();
  const item = doc.items[id];
  if (!item) return document.createDocumentFragment();
  const collapsed = Boolean(ui.collapsed[id]);
  const noteOpen = ui.notesOpen[id] ?? Boolean(item.note);

  const container = document.createElement('div');
  container.className = 'item-container';
  container.style.marginLeft = `${depth * 20}px`;

  const row = document.createElement('div');
  row.className = 'item-row';
  if (ui.selection?.anchorId === id) {
    row.classList.add('active');
  }
  row.addEventListener('click', () => {
    store.focusItem(id, undefined, 'caret');
  });

  const chevron = document.createElement('button');
  chevron.className = 'chevron';
  chevron.textContent = collapsed ? '▶' : '▼';
  if (item.children.length === 0) {
    chevron.classList.add('hidden');
  }
  chevron.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.altKey) {
      store.toggleCollapseDeep(id, !collapsed);
    } else {
      store.toggleCollapse(id);
    }
  });

  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'checkbox';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.checked;
  checkbox.addEventListener('change', (event) => {
    event.stopPropagation();
    store.toggleChecked(id);
  });
  checkboxLabel.appendChild(checkbox);

  const text = document.createElement('div');
  text.className = 'item-text';
  text.contentEditable = 'true';
  text.innerHTML = renderInlineMarkdown(item.text);
  text.setAttribute('role', 'textbox');
  text.setAttribute('aria-label', 'Item text');
  refs.text.set(id, text);

  text.addEventListener('input', () => {
    const caret = getCaretOffset(text);
    store.setText(id, text.innerText, { typing: true, caretOffset: caret });
  });

  text.addEventListener('focus', () => {
    const caret = getCaretOffset(text);
    store.focusItem(id, caret, 'caret');
  });

  text.addEventListener('blur', () => {
    const caret = getCaretOffset(text);
    store.focusItem(id, caret, 'caret');
  });

  text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        store.toggleNote(id);
        focusAfterRender(() => {
          const note = refs.note.get(id);
          if (note) {
            note.focus({ preventScroll: true });
            note.selectionStart = note.selectionEnd = note.value.length;
          }
        });
        return;
      }
      const newId = store.addSiblingAfter(id);
      focusAfterRender(() => {
        const next = refs.text.get(newId);
        if (next) {
          next.focus({ preventScroll: true });
          setCaretOffset(next, 0);
        }
      });
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        store.outdent(id);
      } else {
        store.indent(id);
      }
      return;
    }
    if (event.key === 'Backspace') {
      handleBackspace(event, id, text);
      return;
    }
    if (event.key === 'ArrowUp' && event.altKey) {
      event.preventDefault();
      store.moveUp(id);
      return;
    }
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      store.moveDown(id);
      return;
    }
    const lowerKey = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && lowerKey === 'b') {
      event.preventDefault();
      handleFormatting(id, '**');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && lowerKey === 'i') {
      event.preventDefault();
      handleFormatting(id, '*');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '`') {
      event.preventDefault();
      handleFormatting(id, '`');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '.') {
      event.preventDefault();
      store.toggleChecked(id);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === ';') {
      event.preventDefault();
      store.toggleNote(id);
      focusAfterRender(() => {
        const note = refs.note.get(id);
        if (note) {
          note.focus({ preventScroll: true });
          note.selectionStart = note.selectionEnd = note.value.length;
        }
      });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && lowerKey === 'd') {
      event.preventDefault();
      const newId = store.addSiblingAfter(id);
      focusAfterRender(() => {
        const next = refs.text.get(newId);
        if (next) {
          next.focus({ preventScroll: true });
          setCaretOffset(next, 0);
        }
      });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && (lowerKey === 'z' || lowerKey === 'y')) {
      event.preventDefault();
    }
  });

  text.addEventListener('copy', (event) => handleCopy(event, id));
  text.addEventListener('cut', (event) => handleCopy(event, id));
  text.addEventListener('paste', (event) => handlePaste(event, id));

  const toolbar = createToolbar(id);

  row.appendChild(chevron);
  row.appendChild(checkboxLabel);
  row.appendChild(text);
  row.appendChild(toolbar);

  container.appendChild(row);

  if (noteOpen) {
    const note = document.createElement('textarea');
    note.className = 'item-note';
    note.value = item.note ?? '';
    note.placeholder = 'Add note';
    refs.note.set(id, note);
    note.addEventListener('change', (event) => {
      store.setNote(id, event.target.value);
    });
    note.addEventListener('focus', () => {
      store.focusItem(id, undefined, 'item');
    });
    container.appendChild(note);
  }

  if (!collapsed) {
    item.children.forEach((childId) => {
      container.appendChild(createItemRow(childId, depth + 1));
    });
  }

  const addChildButton = document.createElement('button');
  addChildButton.className = 'add-child';
  addChildButton.textContent = 'Add child';
  addChildButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const childId = store.addChild(id);
    focusAfterRender(() => {
      const child = refs.text.get(childId);
      if (child) {
        child.focus({ preventScroll: true });
        setCaretOffset(child, 0);
      }
    });
  });
  addChildButton.addEventListener('focus', () => {
    store.focusItem(id, undefined, 'subtree');
  });
  refs.add.set(id, addChildButton);
  container.appendChild(addChildButton);

  return container;
}

function render() {
  refs.text.clear();
  refs.note.clear();
  refs.add.clear();

  root.innerHTML = '';

  const app = document.createElement('div');
  app.className = 'app-shell';

  const header = document.createElement('header');
  header.className = 'app-header';
  const title = document.createElement('h1');
  title.textContent = 'Outline';
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Fast, local-first outlining with keyboard superpowers.';
  header.appendChild(title);
  header.appendChild(tagline);

  const main = document.createElement('main');
  const outliner = document.createElement('div');
  outliner.className = 'outliner';

  const { doc } = store.getState();
  doc.rootIds.forEach((rootId) => {
    outliner.appendChild(createItemRow(rootId, 0));
  });

  const addRoot = document.createElement('button');
  addRoot.className = 'add-root';
  addRoot.textContent = 'Add top-level item';
  addRoot.addEventListener('click', () => {
    const state = store.getState();
    const lastRoot = state.doc.rootIds[state.doc.rootIds.length - 1];
    let newId;
    if (lastRoot) {
      newId = store.addSiblingAfter(lastRoot);
    } else {
      const blankNode = { text: '', checked: false, children: [] };
      const created = store.insertNodes(undefined, undefined, [blankNode]);
      newId = created[0];
    }
    focusAfterRender(() => {
      const target = refs.text.get(newId);
      if (target) {
        target.focus({ preventScroll: true });
        setCaretOffset(target, 0);
      }
    });
  });

  main.appendChild(outliner);
  main.appendChild(addRoot);

  app.appendChild(header);
  app.appendChild(main);

  root.appendChild(app);

  applySelectionFocus();
}

store.subscribe(render);
render();

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      store.redo();
    } else {
      store.undo();
    }
  }
  if ((event.metaKey || event.ctrlKey) && (key === 'y')) {
    event.preventDefault();
    store.redo();
  }
});
