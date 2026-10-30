# Protocol — Resource list and annotated UI refinements

Date: 2026-10-29

## Visual evidence

- Source: `/var/folders/5z/2xfcttrn0kxd7jq5b4cwhq480000gn/T/codex-clipboard-0a1b595b-b5b2-4bcd-914a-e01c7599beaf.png` (446 × 564 pixels, including a phone frame).
- Resource implementation: `/tmp/protocol-resource-list.png` (747 × 774 browser capture).
- Combined comparison opened for inspection: `/tmp/protocol-resource-comparison.png`.
- Additional evidence: `/tmp/protocol-resource-list-final.png`, `/tmp/protocol-project-dashboard.png`, `/tmp/protocol-note-fullscreen.png`, `/tmp/protocol-member-period.png`.
- State: signed-in Resource category list, General section; saved previews loaded, no creation/edit form open.
- Normalization: the reference includes a phone bezel; Protocol is an existing responsive desktop workspace at 80% content scale. The combined image preserves each capture's proportions and normalizes their display height. This is a requested adaptation of the reference's list structure, not a pixel clone or replacement of Protocol's header. No density-sensitive or exact typography match is claimed.

## Comparison and findings

The prior folder grid differed materially from the selected reference's image-left/text-right reading list. It was replaced with full-width rows, actual cached preview imagery, colored title fallbacks, compact contributor/date metadata and thin black row dividers. The final combined comparison shows this structure consistently across image and fallback states. No actionable P0/P1/P2 issue remains within the requested adaptation.

- Typography: Instrument Sans and Protocol's existing title/body/caption tokens are retained intentionally. Titles wrap naturally; source-like compact metadata remains secondary.
- Layout: thumbnails sit left of titles and descriptions; rows share a baseline, image ratio and consistent spacing. The fixed creation dock aligns to the workspace gutter. Category headings have no divider; separators belong to the rows.
- Colors: existing palette tokens supply fallback tiles. Foreground and row dividers use black. The reference's varied image/color rhythm is preserved without introducing a second palette.
- Image quality: the existing revision-keyed preview cache is reused. Real screenshots/OG previews remain unchanged, including a mostly white document preview; missing images use the requested title tile. No reference images or device chrome were fabricated.
- Content: real resource names, descriptions, links and dates are retained. Unknown contributors remain hidden. Category and Chronology grouping still work.

The thumbnails, title/metadata hierarchy and dividers are readable in the combined full-view comparison; no extra magnified region was needed. Differences in phone chrome, content, font family and the persistent Protocol header are intentional product constraints.

## Interaction and regression checks

- Resource edit opens and Cancel closes without saving; resource and related-link destinations remain intact.
- Project Overview, Team and Budget tabs switch correctly. Folder patterns compare total capacity, allocation and logged time using one denominator.
- Members switches between a single week and an explicitly inclusive date range; year optgroups do not appear in the selected label.
- Overall member summary displays accumulated allocated time and an eight-hour-workday/team-hours-per-weekday equivalent.
- Fullscreen note reading and close action were checked; metadata, pencil editing action and shared pills remain available.
- Calendar uses black grid lines, supplied-art SVG arrows and a labeled Today indicator.
- Timer headings are compact, counts use the shared circular badge, checkbox shapes are circular, and descriptive help is in the driver tour. Automatic time publishes eligible blocks without a manual refresh.
- Browser error log checked: no errors returned during the final navigation pass.
- Automated tests: 93 passing, including automatic publication, total-capacity ratios and inclusive weekday calculations.
- Production build: passed.

## Follow-up polish

- Existing source previews vary in visual density, especially document screenshots. They deliberately retain the saved source content rather than replacing it with invented artwork.
- Browser verification used the available 747 × 774 viewport; the existing responsive wide-screen grid rules are retained.

final result: passed

## October 29 interface follow-up

- Notes: author/editor faces, a two-column meeting summary, full-width document content, persisted discussion, and exact phrase search with matching excerpts. Editorial cards now run A/B/C across rows.
- Wishes: proposal templates, revision snapshots, revision-specific votes and reasoned review by another member. Approved proposals convert to a project in one Firestore transaction with a stable project ID. Existing wishes remain available as ideas; archived entries have a separate filter.
- Projects: Urgent/High/Normal/Low Kanban; planning selects group projects by R&D, Work, and Service and order each group by urgency. Unknown legacy priorities remain in Normal. Rounded folders use a plain silhouette. Task cards link their title to the task, show member faces and rejection counts, and expose owner-editable deadlines. The board contains its own scrolling.
- Timers: simple clock faces retained, inner focus ring removed, adjoining equal-height desktop panels, underlined transparent fields, black recording action, rolling 24-hour history, relative dates, and an explicit cross-tab control handoff. Verified time selection and task selection enable Log without submitting a real time entry.
- Members/reviews: contact details and historical projects, compact profile links, a Reviewed heading, reviewer faces and retained rejection history.
- Asterisks: shared full-screen modal and search/select components, original note styling, compact icon actions. Four starter notes and the specific hehe/jeh test note were soft-removed and their records verified in Removed.
- Navigation/settings: animated vector Protocol mark with reduced-motion support; borderless menu controls; construction icons in the footer; profile editing and browser-local motion, density, and focus-duration preferences.
- Resource cards: verified bordered, padded multi-column cards with solid-color image fallbacks.

Browser checks used the signed-in local preview. Proposal voting, approval, project conversion, time logging, profile updates, and deadline writes were not submitted against real team records during QA. Pure model tests cover required proposal fields, revisions, review ownership/reasons/stale revisions, planning order, and rolling history boundaries.

## Follow-up annotation pass: shared controls and presentation

- Rechecked the latest comments against the current preview. The actual favicon now supplies both the menu trigger and the compact navigation wordmark, aligned with Close. Creation docks use existing compose illustrations and a hover surface across the entire bar.
- The shared composer slides upward and downward, uses a single field radius, and keeps focus inside a field instead of adding double outlines. Its member picker shows small portraits, supports arrow/Home/End keys, and closes its options on Escape without closing the composer. Verified selection and Cancel without creating a task.
- Inline avatars are fixed square 20px images; member-directory portraits keep their larger profile treatment. Timer headings align status illustrations with titles, and all white data strokes are removed.
- Native selects now share one inset chevron and fill the arrow wrapper. Hero selectors measure the selected text separately, preventing cropped glyphs. Period controls reuse WeekSelect.
- Resource cards retain padded square covers and solid-color fallbacks. Favicons are not promoted to full-size previews. Edit/delete tools occupy one corner and appear on hover or keyboard focus; the resource title link covers the card.
- Member rows now show project counts and an allocation ring with percentages. Inactive profiles use a compact layout with four columns on desktop, two on narrower screens, and no empty project sections. Approximate workday totals use the approximation sign.
- Projects show logged percentages on folders and one-line progress in Kanban. Priority runs from Low to Urgent with existing illustrations. Active/closed controls are in the hero. The latest request supersedes the earlier scrollbox request: task lanes now show full card height with no internal vertical scrollbar.
- Wishes uses the shared hero picker, search, collection, entity card, section, field, and button components. The writing template separates the decision brief, delivery plan, and work/spending table. New proposals start with a work-package row; totals update from its costs/hours. Drafts can remain incomplete; submission still validates the complete proposal. Verified a synthetic 1000 TWD / 4 hour calculation and discarded the QA draft without saving.
- Validation: 106 tests pass, production build passes, and git diff whitespace checks pass. No real task, deadline, profile, time-log, proposal, approval, or project conversion was submitted during this pass.

Final browser verification also caught and fixed missing global screen-reader-only styling and the task board's intrinsic-width overflow. The rejection filter now remains inside the viewport, keyboard instructions stay hidden, and task lanes have visible overflow with no vertical scrollbox. The final test suite has 106 passing tests and the final production build completes successfully.
