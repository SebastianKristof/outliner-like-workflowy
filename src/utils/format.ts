const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const renderInlineMarkdown = (text: string): string => {
  const escaped = escapeHtml(text);
  const code = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  const bold = code.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const italic = bold.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return italic.replace(/\n/g, '<br/>');
};
