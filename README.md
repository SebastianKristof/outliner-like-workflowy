# Outline MVP

A local-first outlining app inspired by Workflowy. The MVP is implemented with vanilla JavaScript and browser APIs, persisting data in `localStorage` so it works entirely offline without external build tooling.

## Features

- Infinite nested outline with checkbox-based tasks.
- Keyboard-first controls for adding siblings/children, indenting, moving, and toggling completion or notes.
- Inline Markdown formatting with bold, italic, and code styling that round-trips via clipboard.
- Notes per item rendered in lightweight editor surfaces with quick toggles.
- Undo/redo history with typing coalescing and structural snapshotting.
- Markdown copy/paste for full subtree export/import.
- Local persistence with instant restore on reload.

## Getting Started

```bash
npm install
npm run dev
```

`npm install` succeeds without network access because all dependencies are bundled locally. Running `npm run dev` starts a small Node-based static server on port 5173; alternatively, open `index.html` directly in your browser.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Enter | New sibling |
| Shift+Enter | Toggle note and focus note |
| Tab / Shift+Tab | Indent / Outdent |
| Alt+↑ / Alt+↓ | Move item up/down |
| Cmd/Ctrl+. | Toggle checkbox |
| Cmd/Ctrl+; | Toggle note |
| Cmd/Ctrl+B | Bold selection |
| Cmd/Ctrl+I | Italic selection |
| Cmd/Ctrl+` | Inline code |
| Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z / Cmd/Ctrl+Y | Undo / Redo |
| Cmd/Ctrl+C / Cmd/Ctrl+V | Copy / Paste subtree as Markdown |

## Clipboard Format

Copying an item places Markdown of the entire subtree onto the clipboard, e.g.:

```
- [x] Complete outline
  - [ ] Polish styling
    Note for this item
```

Pasting Markdown with checkboxes reproduces the nested structure in the outline. Non-Markdown text is inserted into the current item.

## License

MIT
