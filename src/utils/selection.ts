export const getCaretOffset = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
};

export const getSelectionOffsets = (element: HTMLElement): { start: number; end: number } | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  const endRange = range.cloneRange();
  const preEnd = endRange.cloneRange();
  preEnd.selectNodeContents(element);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const end = preEnd.toString().length;
  return { start, end };
};

export const setCaretOffset = (element: HTMLElement, offset: number) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = offset;

  const traverse = (node: Node): Range | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = (node.textContent ?? '').length;
      if (remaining <= textLength) {
        range.setStart(node, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= textLength;
      return null;
    }
    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      const result = traverse(child);
      if (result) return result;
    }
    return null;
  };

  const finalRange = traverse(element);
  if (finalRange) {
    selection.removeAllRanges();
    selection.addRange(finalRange);
  } else {
    element.focus();
  }
};
