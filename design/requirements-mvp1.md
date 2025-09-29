Perfect — here’s a **complete, detailed, technical requirements document** consolidating everything we discussed. You can hand this directly to a developer and they’ll have a precise spec to start implementing the MVP right away.

---

# **Outliner MVP Requirements Document**

## 1. **Vision**

The MVP is a **minimal, fast, local-first outliner** designed for writing and structuring ideas or tasks with checkmarks instead of bullets.
The goals:

* Be frictionless to type and structure.
* Support task-like workflows out of the box.
* Provide basic formatting and movement so any outline shape can be created.
* Persist data locally; no server required for MVP.
* Offer mouse and keyboard controls for all essential actions.

---

## 2. **Core Features (MVP Scope)**

### 2.1. Item Structure

Each item is:

* `text: string` – primary content.
* `checked: boolean` – toggle via checkbox.
* `note?: string` – optional multiline note.
* `children: Item[]` – nested items.
* `parentId?: string` – null/undefined for root items.

### 2.2. Editor Basics

* Infinite nested items.
* Create new item with **Enter**.
* Indent/outdent with **Tab / Shift+Tab**.
* Toggle checkbox with **Space** or click.
* Expand/collapse children.
* Notes: toggle on/off, editable in a textarea below item.
* Auto-save to local storage on every change.

### 2.3. Movement & Reordering

* **Move Up / Down** (swap with sibling above/below).
* **Indent** (become child of previous sibling).
* **Outdent** (become sibling of parent, after it).
* Moving always carries the entire subtree.
* Undoable in one step.

### 2.4. Undo / Redo

* Keyboard: `Cmd/Ctrl+Z` undo, `Shift+Cmd+Z` or `Ctrl+Y` redo.
* Implementation: maintain `past[]`, `present`, `future[]` history stacks.
* Coalesce text typing into single undo steps (500 ms debounce).
* Structural edits always snapshot.
* Caret position restored.

### 2.5. Copy / Paste (Markdown)

* **Copy (Cmd/Ctrl+C)**

  * Exports subtree as Markdown.
  * Format:

    * Checked: `- [x] Text`
    * Unchecked: `- [ ] Text`
    * Note: indented plain lines directly below the item.
    * Children: indented 2 spaces per level.
* **Paste (Cmd/Ctrl+V)**

  * Parses Markdown list items: `- [ ]`, `- [x]`, `-`, `*`, `+`.
  * Indentation: 2/4 spaces or tabs → normalized.
  * Notes: lines under list item without a bullet → attach as note.
  * Insertion:

    * If caret in item text → paste as siblings after item.
    * If caret after expanding “New child” → paste as children.
  * Fallback: if text not Markdown, paste as flat items or as note.

### 2.6. Mouse & Touch Controls

* **Chevron** left of checkbox: toggles expand/collapse.

  * Hidden if no children.
  * Alt/Option+Click → expand/collapse entire subtree.
* **Checkbox**: toggles checked.
* **Row click**: places caret in text.
* **Row hover toolbar** (desktop) / long-press (mobile):

  * Up, Down, Indent, Outdent, Add child, Toggle note, Bold, Italic, Code, Delete.
* **Context menu (right-click)**: duplicate, delete, toggle note, toggle checked.

### 2.7. Formatting

* Support inline Markdown formatting:

  * Bold → `**text**`
  * Italic → `*text*`
  * Code → `` `text` ``
* Render inline formatting visually.
* Copy/export preserves raw Markdown marks.
* Shortcuts: `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `Cmd/Ctrl+``.

---

## 3. **UI & Aesthetic Requirements**

### 3.1. Layout

* Row structure:

  * Chevron → Checkbox → Editable text → Inline toolbar (hover).
  * Note expands under row with light background.

### 3.2. Typography

* Font: `system-ui`.
* Size: 16–18px.
* Line-height: 1.5–1.6.
* Indent step: 20px per level.

### 3.3. Styling

* Minimal, clean, calm.
* Faint indent guides (optional toggle).
* Active row: subtle background highlight.
* Buttons: monochrome, 28×28 px, 8 px spacing, tooltips with shortcuts.
* Mobile: tap targets ≥40×40 px.

---

## 4. **Technical Requirements**

### 4.1. Stack

* **Frontend**: React + TypeScript + Vite.
* **State management**: Zustand or Redux Toolkit with Immer.
* **Persistence**: LocalStorage (JSON).
* **Clipboard**: `navigator.clipboard.read/write` with `text/plain` + `text/markdown`.
* **Deployment**: Vercel/Netlify.

### 4.2. Data Model (TypeScript)

```ts
type ItemId = string;

interface Item {
  id: ItemId;
  text: string;
  checked: boolean;
  note?: string;
  children: ItemId[];
  parentId?: ItemId;
}

interface DocState {
  rootIds: ItemId[];
  items: Record<ItemId, Item>;
  ui: {
    collapsed: Record<ItemId, boolean>;
    selection: {
      anchorId: ItemId;
      mode: 'caret' | 'item' | 'subtree';
      caretOffset?: number;
    };
  };
}
```

---

## 5. **Algorithms**

### 5.1. Move Up

* Swap with previous sibling in parent’s `children[]`.
* No-op if first sibling.

### 5.2. Move Down

* Swap with next sibling.
* No-op if last sibling.

### 5.3. Indent

* Make item child of previous sibling.
* Append to that sibling’s `children[]`.
* Update parentId.
* No-op if no previous sibling.

### 5.4. Outdent

* Remove from parent’s `children[]`.
* Insert into grandparent’s `children[]` immediately after parent.
* Update parentId.
* No-op if at root level.

### 5.5. Copy → Markdown

* DFS traversal of subtree.
* For each item:

  * Indent = level × 2 spaces.
  * Checkbox: `- [ ]` or `- [x]`.
  * Note: plain lines under item.

### 5.6. Paste ← Markdown

* Tokenize lines by indent + bullet.
* Build tree with stack of last-seen item at each level.
* Notes: attach to last item at same level.

---

## 6. **Keyboard Map**

* **Enter**: new sibling.
* **Shift+Enter**: new line in note.
* **Tab / Shift+Tab**: indent / outdent.
* **Alt+↑ / Alt+↓**: move up/down (with subtree).
* **Cmd/Ctrl+.**: toggle checkbox.
* **Cmd/Ctrl+;**: toggle note.
* **Cmd/Ctrl+B / I / `**: bold, italic, code.
* **Cmd/Ctrl+Z / Y**: undo/redo.
* **Cmd/Ctrl+C / V**: copy/paste Markdown.
* **Cmd/Ctrl+/**: show shortcut cheat-sheet modal.

---

## 7. **Persistence**

* LocalStorage key: `outliner:doc:v1`.
* JSON encoding of `DocState`.
* Migration field for schema evolution.
* Fallback to empty doc on load error.

---

## 8. **Non-MVP (Future Versions)**

* Authentication and cloud sync.
* Real-time collaboration.
* Drag-and-drop reordering.
* Sharing links.
* Mind map view.
* AI summarization/expansion.

---

## 9. **Acceptance Criteria**

1. User can add, indent, outdent, move, and check items.
2. Undo/redo works for typing, moving, and structural edits.
3. Copying subtree produces valid Markdown.
4. Pasting Markdown list creates equivalent outline.
5. All actions possible via both keyboard and mouse.
6. State persists across reloads.
7. App loads instantly, works offline, and feels fluid.

---

⚡ **One-line summary for developer**:
*"Build a local-first React outliner with checkboxes, notes, indent/outdent, move up/down, undo/redo, and Markdown copy/paste. Minimal UI, mouse + keyboard parity. Persist to LocalStorage."*
