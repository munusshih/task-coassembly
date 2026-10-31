import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyHtmlNote, noteContentToMarkdown } from '../src/app/lib/noteMarkdown.mjs';

test('new Markdown note content remains unchanged for editing', () => {
  const markdown = '## Decisions\n\n- Keep the notes readable';
  assert.equal(isLegacyHtmlNote(markdown), false);
  assert.equal(noteContentToMarkdown(markdown), markdown);
});

test('legacy HTML notes convert to Markdown while retaining structure and links', () => {
  const markdown = noteContentToMarkdown(
    '<h2>Agenda</h2><ul><li>Updates</li><li><a href="https://example.com">Review</a></li></ul>',
  );
  assert.match(markdown, /^## Agenda/);
  assert.match(markdown, /-\s+Updates/);
  assert.match(markdown, /\[Review\]\(https:\/\/example\.com\)/);
});

test('legacy HTML detection covers common meeting-note markup', () => {
  assert.equal(isLegacyHtmlNote('<blockquote>Decision</blockquote>'), true);
  assert.equal(isLegacyHtmlNote('A plain-text note'), false);
});
