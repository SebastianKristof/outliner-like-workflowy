import { createId } from './id.js';

const STORAGE_INDENT = 2;

function indent(depth) {
  return '  '.repeat(depth);
}

function formatNote(depth, note) {
  if (!note) return [];
  const lines = note.split('\n');
  return lines.map((line) => `${indent(depth + 1)}${line}`);
}

export function serializeMarkdown(doc, rootId) {
  const lines = [];
  const visit = (id, depth) => {
    const item = doc.items[id];
    if (!item) return;
    const checkbox = item.checked ? '[x]' : '[ ]';
    const text = item.text || '';
    lines.push(`${indent(depth)}- ${checkbox} ${text}`.trimEnd());
    lines.push(...formatNote(depth, item.note));
    item.children.forEach((childId) => visit(childId, depth + 1));
  };
  visit(rootId, 0);
  return lines.join('\n');
}

function parseLine(line) {
  const expanded = line.replace(/\t/g, '  ');
  const match = expanded.match(/^(\s*)([-*+]\s+)(\[(.|\s)\]\s+)?(.*)$/);
  if (match) {
    const spaces = match[1].length;
    const checkbox = match[3]?.trim();
    let checked;
    if (checkbox === '[x]' || checkbox === '[X]') checked = true;
    if (checkbox === '[ ]' || checkbox === '[]') checked = false;
    const remaining = match[4] ?? '';
    return {
      indent: Math.floor(spaces / STORAGE_INDENT),
      text: remaining.trim(),
      bullet: true,
      checked,
    };
  }
  const leadingSpaces = expanded.match(/^\s*/) ?? [''];
  return {
    indent: Math.floor((leadingSpaces[0].length) / STORAGE_INDENT),
    text: expanded.trimEnd(),
    bullet: false,
  };
}

export function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const stack = [];
  const roots = [];

  lines.forEach((line) => {
    const info = parseLine(line);
    if (info.bullet) {
      const node = {
        text: info.text,
        checked: info.checked ?? false,
        children: [],
      };
      while (stack.length && stack[stack.length - 1].depth >= info.indent) {
        stack.pop();
      }
      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].node.children.push(node);
      }
      stack.push({ depth: info.indent, node });
    } else if (stack.length) {
      const target = stack[stack.length - 1].node;
      target.note = target.note ? `${target.note}\n${info.text.trim()}` : info.text.trim();
    }
  });

  return roots;
}

export function appendParsedNodes(doc, parentId, afterId, nodes) {
  const createdIds = [];

  const insertChild = (parent, node) => {
    const id = createId();
    const item = {
      id,
      text: node.text,
      checked: node.checked,
      note: node.note,
      children: [],
      parentId: parent,
    };
    doc.items[id] = item;
    node.children.forEach((child) => {
      const childId = insertChild(id, child);
      doc.items[id].children.push(childId);
    });
    return id;
  };

  let lastInserted = afterId;

  const insertNode = (node) => {
    const id = createId();
    const item = {
      id,
      text: node.text,
      checked: node.checked,
      note: node.note,
      children: [],
      parentId,
    };
    doc.items[id] = item;
    if (parentId) {
      const parent = doc.items[parentId];
      const siblings = parent.children;
      const idx = lastInserted ? siblings.indexOf(lastInserted) : -1;
      siblings.splice(idx + 1, 0, id);
    } else {
      const siblings = doc.rootIds;
      const idx = lastInserted ? siblings.indexOf(lastInserted) : -1;
      siblings.splice(idx + 1, 0, id);
    }
    lastInserted = id;
    node.children.forEach((child) => {
      const childId = insertChild(id, child);
      doc.items[id].children.push(childId);
    });
    return id;
  };

  nodes.forEach((node) => {
    const id = insertNode(node);
    createdIds.push(id);
  });

  return createdIds;
}
