const htmlEscapes = [
  { regex: /&/g, replacement: '&amp;' },
  { regex: /</g, replacement: '&lt;' },
  { regex: />/g, replacement: '&gt;' },
  { regex: /"/g, replacement: '&quot;' },
  { regex: /'/g, replacement: '&#39;' },
];

function escapeHtml(str) {
  let result = str;
  for (const { regex, replacement } of htmlEscapes) {
    result = result.replace(regex, replacement);
  }
  return result;
}

export function renderInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  const code = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  const bold = code.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const italic = bold.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return italic.replace(/\n/g, '<br/>');
}
