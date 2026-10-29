# Notes editorial archive — design QA

final result: passed

## Scope and visual truth

- Source: `/var/folders/5z/2xfcttrn0kxd7jq5b4cwhq480000gn/T/codex-clipboard-95286816-0f9e-4254-805d-2c6ecbb43efd.png`.
- Implementation: `http://localhost:3000/notes`, Date / Grid, real workspace notes.
- Screenshot: `/tmp/protocol-notes-editorial.png`.
- Full comparison: `/tmp/protocol-notes-comparison.png`.
- Focused card comparison: `/tmp/protocol-notes-focused-comparison.png`.
- Source pixels: 1200 × 1200. Implementation capture: 1227 × 1272, CSS viewport 1227px wide, existing app scale 80%. Comparison panels normalized to a common 720px width without stretching.

This is the requested adaptation (“a little more like this”), not a clone of the publication website. Protocol's existing shared header, Instrument Sans, date/project grouping, full-width search, and bottom composer remain. Actual note content replaces the reference's publications. Four responsive columns accommodate the workspace's longer bilingual titles. Existing notes have no chosen cover images; no unrelated stock photos or fabricated note content were added. Optional cover images can be supplied by URL in creation and editing.

## Comparison history

1. Initial capture found a P1 horizontal overflow: intrinsic CSS column widths expanded the section beyond the viewport. It also showed unnecessary gray body excerpts that competed with the editorial titles (P2).
2. Fixed the section/grid minimum width and constrained its column body. Removed default excerpts; search matches may still show contextual snippets.
3. Recaptured and compared the full view and focused content region with the source. The grid now ends at x=1202.9 within the 1227px viewport. No content clipping remains.

## Required visual surfaces

- Typography: shared Instrument Sans, large regular-weight titles, small author/date metadata. No emoji or separate decorative typeface.
- Spacing: open masonry columns, compact outlined taxonomy pills, aligned black number circles; no boxed-card surface.
- Colors: black/white archive presentation using existing palette variables. No new ad hoc color values.
- Images: optional covers preserve their source imagery. A real local SVG image URL rendered successfully in an unsaved composer preview; the preview draft was cleared afterward. Invalid URL schemes are rejected by tested helpers.
- Copy/content: real note titles, project names, authors, dates, and linked hosts. The shared header intentionally differs from the publication reference.

## Interactions checked

- Create drawer exposes optional image URL, preview, and title fields without emoji controls.
- Calendar remains available as an explicit layout.
- Switching Calendar → Projects resets to Grid and keeps controls valid.
- Search still indexes note contents and metadata; links and existing note actions retain their behaviors.
- Timer mode/duration and select-all/clear were checked without starting sessions or logging work.
- Weekly members show active people under role headings, with no inactive section.
- Project Kanban renders all 19 available projects. Columns have max-height none and visible list overflow; Cancelled is separate, missing statuses stay in Scheduled, and Move-to selectors are absent.

## Findings

No remaining actionable P0/P1/P2 findings within this adaptation. Residual limitation: users supply their own cover image URLs; file upload is not part of this change. The responsive layout has explicit 4/3/2/1-column breakpoints; only the current desktop viewport was visually captured.

## Validation

82 automated tests passed. Production build passed. Browser console checked: earlier transient HMR parse errors were corrected; there are no errors after the corrected build. Desktop browser interactions and screenshots inspected. No live notes were created, edited, deleted, or archived for these checks.
