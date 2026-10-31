import TurndownService from 'turndown';

const legacyHtmlTags = /<(?:p|h[1-6]|ul|ol|li|blockquote|div|table|hr|pre|section|figure|a|span|img)\b/i;

function normalizedTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s「」“”"'*#]/g, '')
    .toLowerCase();
}

export function isLegacyHtmlNote(content) {
  return legacyHtmlTags.test(String(content || ''));
}

export function noteContentToMarkdown(content, title = '') {
  const source = String(content || '');
  if (!isLegacyHtmlNote(source)) return source;

  let html = source;
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(source, 'text/html');
    const first = document.body.firstElementChild;
    if (
      first &&
      /^(H[1-6]|P)$/.test(first.tagName) &&
      normalizedTitle(first.textContent) === normalizedTitle(title)
    ) {
      first.remove();
    }
    html = document.body.innerHTML;
  }

  const converter = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
  return converter.turndown(html).trim();
}
