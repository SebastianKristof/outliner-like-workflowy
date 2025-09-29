import React, { useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useOutlinerStore } from '../store';
import { ItemId } from '../types';
import { renderInlineMarkdown } from '../utils/format';
import { getCaretOffset, getSelectionOffsets, setCaretOffset } from '../utils/selection';
import { parseMarkdown, serializeMarkdown, type ParsedNode } from '../utils/markdown';

interface ItemRowProps {
  id: ItemId;
  depth: number;
}

const formatSelection = (
  value: string,
  selection: { start: number; end: number },
  marker: string
): { text: string; selectionOffset: number } | null => {
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
};

const ItemRow: React.FC<ItemRowProps> = ({ id, depth }) => {
  const item = useOutlinerStore((state) => state.doc.items[id]);
  const collapsed = useOutlinerStore((state) => Boolean(state.ui.collapsed[id]));
  const noteOpen = useOutlinerStore((state) => state.ui.notesOpen[id] ?? Boolean(state.doc.items[id].note));
  const selection = useOutlinerStore((state) => state.ui.selection);
  const focusItem = useOutlinerStore((state) => state.focusItem);
  const toggleCollapse = useOutlinerStore((state) => state.toggleCollapse);
  const toggleCollapseDeep = useOutlinerStore((state) => state.toggleCollapseDeep);
  const toggleChecked = useOutlinerStore((state) => state.toggleChecked);
  const toggleNote = useOutlinerStore((state) => state.toggleNote);
  const setText = useOutlinerStore((state) => state.setText);
  const setNote = useOutlinerStore((state) => state.setNote);
  const addSiblingAfter = useOutlinerStore((state) => state.addSiblingAfter);
  const addChild = useOutlinerStore((state) => state.addChild);
  const deleteItem = useOutlinerStore((state) => state.deleteItem);
  const moveUp = useOutlinerStore((state) => state.moveUp);
  const moveDown = useOutlinerStore((state) => state.moveDown);
  const indent = useOutlinerStore((state) => state.indent);
  const outdent = useOutlinerStore((state) => state.outdent);
  const insertNodes = useOutlinerStore((state) => state.insertNodes);

  const textRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.innerHTML = renderInlineMarkdown(item.text);
  }, [item.text]);

  useEffect(() => {
    if (!textRef.current) return;
    if (selection?.anchorId === id && selection.mode === 'caret') {
      textRef.current.focus();
      if (selection.caretOffset !== undefined) {
        setCaretOffset(textRef.current, selection.caretOffset);
      }
    }
  }, [selection, id]);

  const updateCaret = useCallback(() => {
    if (!textRef.current) return;
    const caret = getCaretOffset(textRef.current);
    focusItem(id, caret, 'caret');
  }, [focusItem, id]);

  const handleInput = useCallback(() => {
    if (!textRef.current) return;
    const text = textRef.current.innerText;
    const caret = getCaretOffset(textRef.current);
    setText(id, text, { typing: true, caretOffset: caret });
  }, [id, setText]);

  const applyFormatting = useCallback(
    (marker: string) => {
      if (!textRef.current) return;
      let offsets = getSelectionOffsets(textRef.current);
      if (!offsets || offsets.start === offsets.end) {
        if (!item.text.length) return;
        offsets = { start: 0, end: item.text.length };
      }
      const formatted = formatSelection(item.text, offsets, marker);
      if (formatted) {
        setText(id, formatted.text, { caretOffset: formatted.selectionOffset });
        requestAnimationFrame(() => {
          if (textRef.current) {
            setCaretOffset(textRef.current, formatted.selectionOffset);
          }
        });
      }
    },
    [id, item.text, setText]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          if (!noteOpen) {
            toggleNote(id);
          }
          const store = useOutlinerStore.getState();
          const existing = store.doc.items[id].note ?? '';
          const nextValue = existing ? `${existing}\n` : '';
          if (nextValue !== existing) {
            setNote(id, nextValue);
          }
          requestAnimationFrame(() => {
            if (noteRef.current) {
              noteRef.current.focus();
              const length = noteRef.current.value.length;
              noteRef.current.setSelectionRange(length, length);
            }
          });
          return;
        }
        const newId = addSiblingAfter(id);
        requestAnimationFrame(() => focusItem(newId, 0, 'caret'));
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          outdent(id);
        } else {
          indent(id);
        }
        return;
      }
      if (event.key === 'Backspace') {
        if (textRef.current && textRef.current.innerText.trim().length === 0 && item.children.length === 0) {
          event.preventDefault();
          const store = useOutlinerStore.getState();
          const doc = store.doc;
          const current = doc.items[id];
          let targetId: ItemId | undefined;
          const seekLastDescendant = (startId: ItemId): ItemId => {
            let currentId = startId;
            while (doc.items[currentId].children.length) {
              const children = doc.items[currentId].children;
              currentId = children[children.length - 1];
            }
            return currentId;
          };
          if (current.parentId) {
            const siblings = doc.items[current.parentId].children;
            const idx = siblings.indexOf(id);
            if (idx > 0) {
              targetId = seekLastDescendant(siblings[idx - 1]);
            } else {
              targetId = current.parentId;
            }
          } else {
            const roots = doc.rootIds;
            const idx = roots.indexOf(id);
            if (idx > 0) {
              targetId = seekLastDescendant(roots[idx - 1]);
            }
          }
          const caretLength = targetId ? doc.items[targetId]?.text.length ?? 0 : 0;
          deleteItem(id);
          if (targetId) {
            requestAnimationFrame(() => focusItem(targetId, caretLength, 'caret'));
          }
        }
        return;
      }
      if (event.key === 'ArrowUp' && event.altKey) {
        event.preventDefault();
        moveUp(id);
        return;
      }
      if (event.key === 'ArrowDown' && event.altKey) {
        event.preventDefault();
        moveDown(id);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        applyFormatting('**');
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        applyFormatting('*');
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '`') {
        event.preventDefault();
        applyFormatting('`');
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault();
        toggleChecked(id);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ';') {
        event.preventDefault();
        toggleNote(id);
        requestAnimationFrame(() => noteRef.current?.focus());
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x')) {
        // rely on onCopy handler
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        // rely on onPaste handler
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        addSiblingAfter(id);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
      }
    },
    [
      addSiblingAfter,
      focusItem,
      id,
      indent,
      item.text,
      moveDown,
      moveUp,
      noteOpen,
      outdent,
      applyFormatting,
      deleteItem,
      setNote,
      setText,
      toggleChecked,
      toggleNote,
    ]
  );

  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const markdown = serializeMarkdown(useOutlinerStore.getState().doc, id);
      event.clipboardData.setData('text/plain', markdown);
      event.clipboardData.setData('text/markdown', markdown);
    },
    [id]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = event.clipboardData.getData('text/markdown') || event.clipboardData.getData('text/plain');
      if (!clipboardData) return;
      const parsed = parseMarkdown(clipboardData);
      if (!parsed.length) return;
      event.preventDefault();
      const mode = selection?.mode;
      if (mode === 'subtree') {
        const lastChild = item.children[item.children.length - 1];
        insertNodes(id, lastChild, parsed);
      } else {
        insertNodes(item.parentId, id, parsed);
      }
    },
    [id, insertNodes, item.children, item.parentId, selection?.mode]
  );

  const handleNoteChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNote(id, event.target.value);
    },
    [id, setNote]
  );

  const focusNote = useCallback(() => {
    focusItem(id, undefined, 'item');
  }, [focusItem, id]);

  const handleRowFocus = useCallback(() => {
    focusItem(id, undefined, 'caret');
  }, [focusItem, id]);

  const handleAddChild = useCallback(() => {
    const childId = addChild(id);
    requestAnimationFrame(() => focusItem(childId, 0, 'caret'));
  }, [addChild, focusItem, id]);

  const handleChevronClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (event.altKey) {
        const newState = !collapsed;
        toggleCollapseDeep(id, newState);
      } else {
        toggleCollapse(id);
      }
    },
    [collapsed, id, toggleCollapse, toggleCollapseDeep]
  );

  const toolbar = (
    <div className="item-toolbar">
      <button onClick={() => moveUp(id)} title="Move up (Alt+↑)">↑</button>
      <button onClick={() => moveDown(id)} title="Move down (Alt+↓)">↓</button>
      <button onClick={() => indent(id)} title="Indent (Tab)">→</button>
      <button onClick={() => outdent(id)} title="Outdent (Shift+Tab)">←</button>
      <button onClick={() => applyFormatting('**')} title="Bold (Cmd/Ctrl+B)"><strong>B</strong></button>
      <button onClick={() => applyFormatting('*')} title="Italic (Cmd/Ctrl+I)"><em>I</em></button>
      <button onClick={() => applyFormatting('`')} title="Code (Cmd/Ctrl+`)"><code>{'<'}</code></button>
      <button onClick={handleAddChild} title="Add child">+</button>
      <button onClick={() => toggleNote(id)} title="Toggle note (Cmd/Ctrl+;)">📝</button>
      <button onClick={() => deleteItem(id)} title="Delete">✕</button>
    </div>
  );

  return (
    <div className="item-container" style={{ marginLeft: depth * 20 }}>
      <div className={clsx('item-row', { active: selection?.anchorId === id })} onClick={handleRowFocus}>
        <button
          className={clsx('chevron', { hidden: item.children.length === 0 })}
          onClick={handleChevronClick}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={item.checked}
            onChange={() => toggleChecked(id)}
          />
        </label>
        <div
          ref={textRef}
          className="item-text"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={updateCaret}
          onBlur={updateCaret}
          onCopy={handleCopy}
          onPaste={handlePaste}
          role="textbox"
          aria-label="Item text"
        />
        {toolbar}
      </div>
      {noteOpen && (
        <textarea
          ref={noteRef}
          className="item-note"
          value={item.note ?? ''}
          onChange={handleNoteChange}
          onFocus={focusNote}
          placeholder="Add note"
        />
      )}
      {!collapsed && item.children.map((childId) => (
        <ItemRow key={childId} id={childId} depth={depth + 1} />
      ))}
      <button
        className="add-child"
        onClick={handleAddChild}
        onFocus={() => focusItem(id, undefined, 'subtree')}
      >
        Add child
      </button>
    </div>
  );
};

const Outliner: React.FC = () => {
  const rootIds = useOutlinerStore((state) => state.doc.rootIds);

  const handleAddRoot = useCallback(() => {
    const store = useOutlinerStore.getState();
    const lastRoot = store.doc.rootIds[store.doc.rootIds.length - 1];
    let newId: ItemId;
    if (lastRoot) {
      newId = store.addSiblingAfter(lastRoot);
    } else {
      const blankNode: ParsedNode = { text: '', checked: false, children: [] };
      const created = store.insertNodes(undefined, undefined, [blankNode]);
      newId = created[0];
    }
    requestAnimationFrame(() => store.focusItem(newId, 0, 'caret'));
  }, []);

  return (
    <div className="outliner">
      {rootIds.map((rootId) => (
        <ItemRow key={rootId} id={rootId} depth={0} />
      ))}
      <button className="add-root" onClick={handleAddRoot}>Add top-level item</button>
    </div>
  );
};

export default Outliner;
