# Latest browser comments

Preserved the user's edits and included the accumulated changes in the release PR.

| Comments | Result |
| --- | --- |
| 1 | Shared hero selectors have less vertical space between the text and underline. |
| 2 | Week, single-date, and member-range calendars start on Sunday. Task allocation weeks remain Monday–Sunday; the task calendar shows six rows so the entire selected boundary week stays visible. |
| 3–4 | One blue focus outline uses :focus-visible. Keyboard navigation enables it; pointer interaction suppresses it, including programmatic calendar focus after clicks. Removed focus fills. Verified pointer outline 0px and keyboard outline blue in the browser. |
| 5 | Removed “This week”; the clock illustration and quarter countdown share one header. |
| 6 | Asterisk editing opens in a wider dialog with 16px fields, a larger discussion area, and a bylaw URL field. References round-trip through the existing body storage as a Markdown citation, so no Firestore schema deployment is needed. Validation restricts the reference to HTTPS on bylaws.coassembly.work. Moving an authored note preserves its citation. |
| 7 | Challenge button removed from the shared reading footer. |
| 8 | Add and glossary-stack tools use black paper and white foreground details. |
| 9 | Note action illustrations use consistent 24px boxes and 36px buttons. Attribution is 12px. |
| 10 | Attribution removed from glossary headers; archived state remains without an actor name. |
| 11 | Navigation and page/reader headings use Member, Project, Wish, Note, Request, and Asterisk. Related grouping labels use Person and Project. Routes and record keys are unchanged. |
| 12 | One date-range calendar replaces the separate week controls. Choose a start and end, then Apply. Arbitrary dates are retained in the URL. Weekly source allocations include all intersecting weeks, explicitly described beside the control; per-weekday summaries use those complete weeks. Verified Oct 22–29 selection in the browser. |
| 13 | Project filtering and closed-project visibility share a single divider row and 16px text. |
| 14 | Note metadata uses a light beige panel. Facilitator, timekeeper, and notetaker displays are removed. Existing records retain their data. |
| 15–17 | Discussion messages and composer align left. Faint existing illustrations decorate the conversation background. Keyboard hints are separate spans with additional spacing and no dot. |
| 18 | Both Markdown and legacy note rendering use subtle repeating ruled lines. |
| 19 | Removed the people/meeting-role block from note creation and editing. New notes do not silently receive role/attendance assignments. Editing preserves recorded assignments without adding defaults. |

## Verification

- 120 tests pass, including new reference round-trip/validation and arbitrary date-range boundary cases: `/tmp/protocol-latest-feedback-tests.log`.
- Production build passes: `/tmp/protocol-latest-feedback-build.log`.
- `git diff --check` passes.
- Browser-verified calendar range application, pointer/keyboard focus, asterisk editor, project toolbar, note metadata/prose/discussion, and note creation.
- No notes or other team records were saved during QA. Bylaw-link persistence was tested through the storage conversion helpers; no real record was modified. Timers were not operated.
- This is not a complete accessibility audit or cross-browser certification.

## Evidence

- `/tmp/protocol-latest-focus.png`
- `/tmp/protocol-latest-range.png`
- `/tmp/protocol-latest-asterisk-editor.png`
- `/tmp/protocol-latest-project.png`
- `/tmp/protocol-latest-note.png`
- `/tmp/protocol-latest-discussion.png`
- `/tmp/protocol-latest-note-create.png`

## Final release additions

- Typography settings expose three levels (headings, text, small labels), with Instrument Sans and local Assembly, Script, Typewriter, and Mono fonts supplied from the user's Drive folder. Choices persist per browser; Original and Assembly mix presets are available.
- Note writing uses CodeMirror 6, with full-page Write, Split, and Preview modes, Markdown formatting controls, search, syntax highlighting, undo/redo, and wrapping. A compact black details disclosure and fixed footer keep writing visible.
- Note reading is capped at 780px. Thoughts remains full bleed and inverted; the library's remaining 16px composer margin is removed.
- Task status groups are To do, Awaiting review, and Reviewed; review history opens from a compact summary.
- Removed the local role preview and resource sublink UI; removed project-toolbar borders and replaced the note's external-link text with an accessible icon.
- Verification: 122 automated tests and production build pass. Typography persistence, formatting, split preview, note width, and composer alignment were checked in the browser using an isolated editor fixture without saving team records. Temporary QA routes and browser logs are excluded from the release.

This log records earlier intermediate designs as well as the final refinements. The final additions above supersede earlier descriptions of editor width and composition.
