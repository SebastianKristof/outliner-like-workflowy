# Outline MVP

A local-first outlining app inspired by Workflowy. This MVP is built with React, TypeScript, Zustand, and Vite and stores data in `localStorage` so it works entirely offline.

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

> **Note:** Package installation requires access to the public npm registry. If your environment blocks registry access, configure npm to use an accessible mirror.

When dependencies are installed, start the dev server with `npm run dev` and open the provided URL in your browser.

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
