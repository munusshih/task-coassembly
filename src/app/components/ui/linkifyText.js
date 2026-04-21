const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>")\]}]+)/gi;
const TRAILING_PUNCT_REGEX = /[.,!?;:]+$/;

function normalizeHref(rawUrl) {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `https://${rawUrl}`;
}

function splitTrailingPunctuation(url) {
  const match = url.match(TRAILING_PUNCT_REGEX);
  if (!match) return { cleanUrl: url, trailing: "" };
  const trailing = match[0] || "";
  const cleanUrl = url.slice(0, Math.max(0, url.length - trailing.length));
  return { cleanUrl, trailing };
}

function renderLineWithLinks(line, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = URL_REGEX.exec(line)) !== null) {
    const full = match[0] || "";
    const start = match.index;
    const end = start + full.length;
    const { cleanUrl, trailing } = splitTrailingPunctuation(full);

    if (start > lastIndex) {
      nodes.push(line.slice(lastIndex, start));
    }

    if (cleanUrl) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${start}`}
          href={normalizeHref(cleanUrl)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cleanUrl}
        </a>,
      );
    }

    if (trailing) {
      nodes.push(trailing);
    }

    lastIndex = end;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

export function renderTextWithLinks(value, keyPrefix = "text") {
  const text = String(value || "");
  const lines = text.split(/\r?\n/);
  const nodes = [];

  lines.forEach((line, index) => {
    nodes.push(...renderLineWithLinks(line, `${keyPrefix}-line-${index}`));
    if (index < lines.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
  });

  return nodes;
}
