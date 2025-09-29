import { DocSnapshot, ItemId } from '../types';

export interface ParsedNode {
  text: string;
  checked: boolean;
  note?: string;
  children: ParsedNode[];
}

const indent = (depth: number) => '  '.repeat(depth);

const formatNote = (depth: number, note?: string) => {
  if (!note) return [] as string[];
  const lines = note.split('\n');
  return lines.map((line) => `${indent(depth + 1)}${line}`);
};

export const serializeMarkdown = (doc: DocSnapshot, rootId: ItemId): string => {
  const lines: string[] = [];
  const visit = (id: ItemId, depth: number) => {
    const item = doc.items[id];
    const checkbox = item.checked ? '[x]' : '[ ]';
    const text = item.text || '';
    lines.push(`${indent(depth)}- ${checkbox} ${text}`.trimEnd());
    lines.push(...formatNote(depth, item.note));
    item.children.forEach((childId) => visit(childId, depth + 1));
  };
  visit(rootId, 0);
  return lines.join('\n');
};

interface LineInfo {
  indent: number;
  text: string;
  bullet?: boolean;
  checked?: boolean;
}

const parseLine = (line: string): LineInfo => {
  const expanded = line.replace(/\t/g, '  ');
  const match = expanded.match(/^(\s*)([-*+]\s+)(\[(.|\s)\]\s+)?(.*)$/);
  if (match) {
    const spaces = match[1].length;
    const checkbox = match[3]?.trim();
    let checked: boolean | undefined;
    if (checkbox === '[x]' || checkbox === '[X]') checked = true;
    if (checkbox === '[ ]' || checkbox === '[]') checked = false;
    const remaining = match[4] ?? '';
    return {
      indent: Math.floor(spaces / 2),
      text: remaining.trim(),
      bullet: true,
      checked,
    };
  }
  return {
    indent: Math.floor((expanded.match(/^\s*/)![0].length) / 2),
    text: expanded.trimEnd(),
    bullet: false,
  };
};

export const parseMarkdown = (markdown: string): ParsedNode[] => {
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const stack: { depth: number; node: ParsedNode }[] = [];
  const roots: ParsedNode[] = [];

  lines.forEach((line) => {
    const info = parseLine(line);
    if (info.bullet) {
      const node: ParsedNode = {
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
};
