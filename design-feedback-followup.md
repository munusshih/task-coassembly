# Browser comment follow-up

Implemented against the current mixed working tree, preserving the user's edits. This intermediate pass preceded the user-authorized release commit and PR. No team data was submitted during verification.

| Comments | Change | Verification |
| --- | --- | --- |
| 1 | Member start/end controls align from the top, so labels and triggers share a row. | Browser screenshot. |
| 2, 8 | One RationaleNoteFooter for floating notes and glossary cards; one source link, no duplicate source caption, 16px source and action text. | Both views inspected. |
| 3 | Add-note paper is blue; glossary stack's front paper is purple. | Browser screenshot. |
| 4, 5 | Meeting crew is the main heading; quarter countdown is supporting text. Live week header includes a clock illustration. | Browser screenshot. |
| 6 | The portaled glossary now receives the shared note surface module; paper colors match the note type in both views. Cards grow to fit their contents. | Browser screenshot. |
| 7 | NoteNumber accepts a type: original asterisk for Why, review circle for Rule, book carrier for How-to, help hat for Question, approval illustration for Decision. Number badges remain. | Type variants visible in glossary. |
| 9 | Active text removed from individual glossary cards. Archived remains where relevant. | Browser screenshot. |
| 10 | Status and Sort use black inverse selects, including keyboard focus. | Browser screenshot. |
| 11 | Glossary total is a circular black count badge. Modal title uses aria-labelledby. | Browser screenshot. |
| 12 | Task composer has standalone Subtasks and Links headings. Disclosure summaries show their item state. | Browser screenshot. |
| 13, 14 | Shared FormActions supplies spacing and button sizing. Primary action comes before Cancel in task, member, project, resource, note, and rationale editing; reason/archive/task/project confirmation dialogs follow the same order. | Code review and task/project/member forms inspected. |
| 15 | Pronoun labels use commas; input normalization still accepts legacy middle dots. | Existing regression test updated and passed; rendered profile text inspected. |
| 16 | Removed the hero view-picker focus fill; its existing underline receives keyboard emphasis. | CSS reviewed. |
| 17 | Removed focus-driven underlines on field labels; accessible labels remain. Field focus indication remains on the control. | Project and member forms inspected. |
| 18 | Member roles reuse the existing keyboard-accessible illustrated selector with four distinct role illustrations. | All options inspected. |
| 19 | Member labels, text fields, selects, and Notes text use 16px; control heights are aligned. | Browser screenshot. |
| 20, 21 | Project creation fields use one 16px scale, and start/end dates share a dedicated two-column row. | Browser screenshot. |
| 22 | Removed the portfolio overview counts and bars from the Projects header. Closed-project toggle remains available by the collection. | Browser screenshot. |
| 23 | Shared DateField uses the installed DayPicker library for date inputs, including project-task deadlines and task creation/editing. The whole field opens the calendar; month/year navigation, clearing, bounds, and native required validation remain. Background scroll containers lock while open; Escape restores scrolling and focus. | Opened deadline calendar without changing real deadlines. Selected and cleared a date in an unsaved project draft. Observed body overflow hidden while open and restored after Escape. |

## Checks

- 118 tests pass: `/tmp/protocol-feedback-tests.log`.
- Production build passes: `/tmp/protocol-feedback-build.log`.
- `git diff --check` passes.
- No actual record creation, note edits, approvals, status changes, or time changes were submitted.
- Browser inspection used the authenticated 1159 × 984 preview. This is not a full accessibility audit or cross-browser certification.

## Screenshot evidence

- `/tmp/protocol-feedback-glossary.png`
- `/tmp/protocol-feedback-notes.png`
- `/tmp/protocol-feedback-week-range.png`
- `/tmp/protocol-feedback-member-form.png`
- `/tmp/protocol-feedback-project-form.png`
- `/tmp/protocol-feedback-projects.png`
- `/tmp/protocol-feedback-task-form.png`
- `/tmp/protocol-feedback-calendar.png`

Release note: This document records intermediate work. Subsequent refinements and verification are recorded in design-latest-comments.md and included in the release PR.
