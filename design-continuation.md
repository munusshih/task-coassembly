# Protocol continuation: interaction and design review

This pass builds on the user's in-progress code. The starting tracked diff is preserved at `/tmp/protocol-user-edits-before-continuation.patch`. Existing Firestore rules, local MCP configuration, Markdown conversion, proposal form work, and other unrelated edits were not reset. This intermediate pass preceded the user-authorized release commit and PR.

## Review steps and current health

1. **Sign-in and loading — implemented; visual check pending.** Sign-in uses the centered Protocol brand and a quiet, unframed layout. It retains the existing Google sign-in and session checks. No sign-in or credential handling was attempted.
2. **Week selection — browser verified and model-tested.** The whole trigger is a button with a readable date range. DayPicker selects a Monday–Sunday calendar week. Escape, outside click, blur, and selection close the calendar. The generic WeekSelect also forwards its controlled value and change handler, fixing its broken dropdown behavior. Calendar-day conversion uses the displayed date rather than converting a local Sunday into Taipei's next Monday.
3. **Members — browser verified.** Weekly allocation has a start week and an optional inclusive end week. Overall is removed from navigation and allowed URL values. Old links fall back to a supported view.
4. **Shared controls and header — implemented; task baseline browser verified.** Button, IconButton, CloseButton, EditButton, and ActionLink share ControlSurface. Hover uses opacity with stable fills; keyboard focus remains visible through a fill and text emphasis without a border ring. Inputs use the field radius token, and multiline editing surfaces use the panel token. The visible view-picker label now supplies its actual text baseline while the native select covers the entire label hit area. Date fields open the browser's calendar from the whole field.
5. **Creation drawer — existing user fix preserved.** Task creation already closes through the shared composer context after successful save. The 260ms close timing and slide-down rule are retained. Reduced motion remains supported.
6. **Asterisks — reading surface browser verified.** The original asterisk illustration appears alongside the numbered circle in the reading and glossary surfaces. Paper colors return by note kind. Removed notes are omitted from the visible glossary; the underlying revision history is not purged. Opening the board no longer automatically deletes starter/test records. The card measures its actual height before painting, keeping saved positions from jumping because of a guessed height. Driver.js remains a separate tour.
7. **Bylaw explanations — source checked.** Retrieved the public governance and project chapters directly. Added project-record traceability (PROJ-01), shared project approval (PROJ-02), and access to meeting records (GOV-04). Explanations distinguish interface conveniences from bylaw requirements, include source links, and retain Challenge. The board status and support count are explicitly not substitutes for required agreement. Source retrieval via the web tool failed, so the public pages were read directly by HTTP; no browser state was read through that route.
8. **Projects — portfolio browser verified.** Portfolio and project capacity views share ProjectTimeBars. Both use labeled planned/recorded measures with a clear scale. Actual amounts remain readable above capacity while bar fills cap at the track length. The unlabeled multi-project strip is removed.
9. **Wishes — reader and editor browser verified.** Existing shared board, drag behavior, and proposal model validation remain. The Move to dropdown is removed; Alt+Left/Right provides keyboard movement through statuses. Reader headings now follow the editor's three sections. Early ideas show one invitation to develop the draft instead of many repeated missing-content paragraphs. Draft saving stays available through a sticky action area.
10. **Notes — reader browser verified; edit changes code reviewed.** Preserved the user's Markdown/GFM and legacy HTML support. Both render through the same prose style module. Read and edit use the same width and typography. Optional people/roles are disclosed, and save feedback/actions remain together. Existing source content is not migrated during this pass.
11. **Task links — implemented; visual check pending.** The view explicitly says Across all weeks and hides the week selector and week-specific context that did not filter its contents.
12. **Stylesheet organization — implemented; build-tested.** globals.css is an import entry point. Ordered stylesheets preserve the previous cascade for foundations, task board, projects, notes/resources, people/wishes, dialogs, and workspace composition. New component styles live next to their components. The shared interaction contract is separate. Relative font paths were adjusted for the moved stylesheets.

## Library decisions

- React DayPicker: adopted for calendar interaction rather than implementing calendar navigation, week grids, and keyboard behavior from scratch. Week selection stays distinct from single-date fields.
- React Markdown + remark-gfm + Turndown: preserved the user's additions. They handle Markdown, tables, and legacy conversion. Tiptap remains for legacy rich HTML; both formats share one prose presentation.
- Chatscope: preserved the existing discussion UI and Firestore persistence.
- Full UI kit / chart framework: not added. A second visual system would increase inconsistency. Existing Protocol actions, boards, forms, and two simple time bars cover the current needs.

## Verification and limit

- Starting baseline: 116 tests passed.
- Current suite: 118 tests, including calendar date/range regressions and the existing Markdown, proposal, tracking, and rationale tests.
- Production build and whitespace verification are recorded in `/tmp/protocol-continuation-build.log` and `/tmp/protocol-continuation-tests.log`.
- Browser access was restored after the user reloaded the preview. Inspected the authenticated task header, week calendar, optional member end-week range, note reader, proposal reader/editor, project portfolio, and asterisk reading surface at 1159 × 984.
- Browser findings fixed: DayPicker's nested root was overriding the intended accent; an old important variable forced note paper to white; project figures needed explicit columns; the live week note repeated its label. Timer headings now constrain and wrap their status within the panel.
- Screenshot evidence: `/tmp/protocol-qa-task.png`, `/tmp/protocol-qa-members.png`, `/tmp/protocol-qa-note.png`, `/tmp/protocol-qa-proposal.png`, `/tmp/protocol-qa-proposal-editor.png`, `/tmp/protocol-qa-projects.png`, `/tmp/protocol-qa-asterisks.png`.
- Limits: sign-in was not opened by signing out of the authenticated session. Real note edit/save, proposal status changes, saved note dragging, and new record submission were not exercised. Drawer close timing and keyboard focus rules were code reviewed; this is not a complete accessibility audit.
- No team records, notes, proposals, approvals, profiles, or tracked time were submitted during this continuation.

Release note: This document records intermediate work. The completed release includes the subsequent changes in design-latest-comments.md and is committed through the release PR.
