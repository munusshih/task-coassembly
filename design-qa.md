# Light panel layout QA

final result: passed

## Target and scope

Source visual truth: `/var/folders/5z/2xfcttrn0kxd7jq5b4cwhq480000gn/T/codex-clipboard-a464c3bc-3c52-46e2-b25c-7a6b238de6e5.png`.

The user requested the reference's sidebar and overall design, with a light background, then explicitly requested much less surrounding padding. This is a layout adaptation for the existing Task application, not a reproduction of the book reader's content or artwork. Helvetica, task records, existing icons, and app interactions are retained. The book thumbnail, decorative corner marks, serif article text, and black stage are intentionally outside scope.

## Evidence

- Final implementation: `/Users/munusshih/.codex/visualizations/2026/10/17/01a147fb-8ee0-7e21-a318-542c45547b5a/task-light-panels.png`.
- Combined full-view comparison: `/Users/munusshih/.codex/visualizations/2026/10/17/01a147fb-8ee0-7e21-a318-542c45547b5a/task-panel-comparison.png`.
- Combined focused header/sidebar comparison: `/Users/munusshih/.codex/visualizations/2026/10/17/01a147fb-8ee0-7e21-a318-542c45547b5a/task-panel-focus.png`.
- Source: 2679 × 1507 pixels. Final implementation screenshot: 1195 × 1136 pixels; measured CSS viewport: 1196 × 1136, reported devicePixelRatio 1.5. The browser screenshot API returns a normalized capture; screenshot pixels are not assumed to equal physical device pixels.
- Source is a wide staged book-reader mockup; implementation is the existing Task board in its default desktop browser. Comparisons preserve image aspect ratio and use equal-width normalized images, with the focused source crop excluding most staging. Differences in app content and stage proportions are intentional; no claim of a pixel-exact clone is made.
- Route/state: `/tasks?week=2026-10-12`, sample data, no dialog open.

## Findings and comparison history

### Initial adaptation

[P2, resolved] Excessive outside background. The first implementation retained 32px side margins and 48px top/bottom spacing. The user explicitly requested less staging. Replaced centered max-width framing with full available width minus 24px, 12px top/bottom padding, and a white panel minimum height of viewport minus 24px. Reduced the internal panel padding from 48px to 32px and horizontal padding to 24–44px.

### Final comparison

No remaining actionable P0/P1/P2 findings in the requested scope. The final browser measurements confirm shell left margin 12px, main panel top 12px and bottom 12px from the viewport edge, and no document horizontal overflow.

## Required fidelity surfaces

- Typography: computed font is `Helvetica, Arial, sans-serif`. The larger sans-serif title and small sidebar labels establish the reference's hierarchy. Application text remains readable; existing task title truncation is retained.
- Spacing/layout rhythm: narrow sidebar with separately rounded home, navigation, collaboration, and account panels; 6px panel gaps; large rounded white content panel; thin header divider. Latest instruction takes precedence over the reference's large outside staging.
- Colors/tokens: light canvas `rgb(241, 241, 235)`, white main panel, stone sidebar, dark text, thin neutral rules. No black canvas. Active navigation uses a white pill rather than a black fill.
- Image quality/assets: no raster imagery is required by this Task layout. Existing app icons are reused. No book artwork or decorative asset is approximated.
- Copy/content: existing app labels, actual view names, sample task records, and existing authorization-based tab visibility are retained. No book-reader copy or unrelated feature is introduced.

## Interaction and responsive verification

- Clicked Projects and returned through CoAssembly home; routes and selected navigation updated correctly.
- Browser console error check: no errors returned.
- At the smaller measured CSS layout (approximately 500px content width), navigation scrolled horizontally, sharing/help stayed visible, and the document had no horizontal overflow. The requested viewport override differed from measured CSS dimensions due to browser density; the measured dimensions were used instead of claiming a 390px verification.
- Temporary viewport override was reset before final capture.
- Sidebar is independently scrollable on short desktop windows, keeping account actions reachable.
- Preview uses isolated sample data; no production records or permissions were changed.

## Implementation checklist

- [x] Reference-inspired grouped sidebar and rounded main panel.
- [x] Light background with reduced 12px staging.
- [x] Helvetica and clean typography preserved.
- [x] Existing navigation, permissions, sharing, and Help retained.
- [x] Browser-rendered desktop and small-layout checks.
- [x] Full-view and focused visual comparisons opened and reviewed.

## Follow-up polish

None required for this iteration. Native 390px device verification was not claimed; the smaller browser layout was checked using measured CSS dimensions.

## TASK ownership and clock iteration

User-directed changes after the panel comparison: tab and page title renamed to `TASK`; icon removed from the CoAssembly home link; large live local-time clock added; member and project task boards split into `Your tasks` and `Team tasks`.

Browser evidence: `task-personal-clock.png` in the same visualization directory. Signed-in preview member Alex appears only in the personal section; Sam and Jules appear only in the team section. Project grouping preserves that distinction, including a shared project containing tasks assigned to both Alex and Sam. Current clock displays the date and timezone independently from the selected task week. No console errors or document horizontal overflow were observed. Ownership tests cover three different viewer identities, restricted member input, orphan task records, and missing identity.

The current user's explicit clock and ownership requests supersede the earlier book-reader content composition. Existing typography, light panels, small outer margins, navigation and record actions are retained. No new actionable P0/P1/P2 layout issue was found in this iteration.

final result: passed

## Large clocks and quieter interface — October 18

Source visual truth: latest user references `codex-clipboard-f85ae569-6050-4022-8a2c-b9c4802a610f.png` (1200 × 1500) and `codex-clipboard-43965ba9-a966-45ce-ac38-a22f7c291ea4.png` (1200 × 900), in `/var/folders/5z/2xfcttrn0kxd7jq5b4cwhq480000gn/T/`. The other four supplied references reinforce oversized clocks, light neutral surfaces, and restrained labels. This is an adaptation to the existing desktop TASK app, not a request to reproduce mobile device chrome, product photos, or a separate mobile application.

Evidence in the visualization directory above:
- `task-large-clocks.png`: final default desktop state, no overlay, 1195 × 1136 screenshot; measured CSS viewport 1196 × 1136, reported DPR 1.5.
- `task-large-clocks-comparison.png`: both source references and final implementation together, aspect-preserving views normalized to a maximum 850px height. Device mockups versus desktop content are explicitly different; there is no pixel-exact fidelity claim.
- `task-large-clocks-focus.png`: focused source timer surface and implementation focus panel, aspect-preserving crops for legible detail comparison.
- `task-clocks-narrow.png`: stacked layout; measured CSS viewport 500 × 1093, 260px dial containers. Browser viewport overrides have different measured CSS sizing, so a native 375px/device verification is not claimed.

Comparison history:
- [P2, resolved] Earlier timer panels had 130px dial containers and six small supporting labels. New desktop dial containers measure 275px; titles are 20px, clock readouts are larger, and actions are 14px with 42px minimum height. Tracking explanations and timer configuration are in disclosures.
- [P2, resolved] Repeated TASK subtitle, quarter badge, personal/team descriptions, zero-review badges, and a disabled empty bulk action created unnecessary noise. Removed them, enlarged task titles and navigation, and removed the extra background layer around personal tasks.
- Post-fix combined full-view and focused comparisons opened and inspected. No remaining actionable P0/P1/P2 findings in the requested adaptation.

Required fidelity surfaces:
- Typography: Helvetica retained per explicit user request; larger numbers and primary text, fewer metadata rows. Dot-matrix font from one reference is intentionally not introduced.
- Spacing/layout: paired large dials on desktop, stacked below 600px; soft, flat panels and consistent control alignment. Existing 12px exterior margins retained. No horizontal document overflow at measured 1196px, 667px, or 500px widths.
- Colors: white clock faces, pale stone panels, dark hands/text, restrained terracotta accent. Light canvas retained; no black background or gradients.
- Assets: clocks are functional SVG time/progress visualizations driven by timestamps, not raster illustrations or replacements for source image assets. Earbuds, device bezels, frog imagery, mobile status bars, and third-party logos are not part of this TASK product adaptation.
- Copy/content: main panels show only their title, state/duration control, clock, task selection, and primary action. Explanations remain accessible in disclosures and the fragment review dialog.

Functional verification in an isolated sample-data preview:
- Stopwatch start, pause/resume, app navigation, finish, automatic logging, and reload persistence.
- Countdown expiry, persistent completion banner, tab-title reminder, automatic logging, and Keep going into an additional stopwatch.
- Automatic fragment review, selection, and logging to an owned task; idle is unchecked by default.
- A second TASK tab is read-only for tracking; ownership transfers when the first leaves TASK. Background tabs keep counting.
- Actual logged time is separate from estimates and displayed on task rows and the member's weekly total. Task replacement transactions preserve time counters against stale editor snapshots.
- Console error query returned no errors. Production build passes with an existing Next tracing warning in the Sheets API path; model/ownership/URL tests pass. Real Firebase writes were not exercised against production data.

Limits: unlogged fragments remain on this browser/device; logged entries use Firestore transactions. Recovery stops at the last saved heartbeat after an abrupt crash. Timers cannot alert while the browser is closed, and browser suspension can delay an alert until execution resumes. Finance/payroll calculations retain their existing behavior.

Implementation checklist: large dials, reduced visible copy, readable controls, responsive layout, working tracking/review/focus flows, duplicate-tab coordination, persisted fragments, build and tests checked.

final result: passed

## Final iteration: semantic typography and compact data layers

This section supersedes the earlier clock/section descriptions. The user requested fewer nested sections, useful clock-face data, and then a stricter, less redundant presentation.

Source visual truth remains the latest supplied flat-color references (`codex-clipboard-36535aa5-b576-422d-88c4-c29d0663846d.png`, 1200 × 1200) and restrained type reference (`codex-clipboard-f85ae569-6050-4022-8a2c-b9c4802a610f.png`, 1200 × 1500), under the temporary attachment directory recorded above. The user's explicit written corrections override literal reproduction of serif typography, phone chrome, decorative images, and data unrelated to TASK.

Final evidence in the visualization directory:
- `task-semantic-clocks.png`: 1195 × 1136, measured desktop CSS viewport 1196 × 1136, DPR 1.5; paused sample focus session, no dialog.
- `task-semantic-clocks-narrow.png`: 667 × 1457 screenshot, measured CSS viewport 500 × 1093. Density differs; no native 375px device fidelity is claimed. Stacked clock layout, no horizontal document overflow; temporary override reset.
- `task-semantic-comparison.png`: both design references and final TASK view combined, aspect-preserving normalization to a maximum 800px image height. Desktop versus framed phone/graphic compositions are intentionally different; this is a design adaptation.
- `task-semantic-focus-comparison.png`: earlier and final clock surfaces combined for a focused, legible comparison of information density and layering. The earlier capture was scrolled; each crop uses its actual content region.

Findings and resolved iterations:
- [P2, resolved] Nested colored task groups and member cards duplicated hierarchy. Removed task-group fills, member-card framing, the personal member header, and redundant per-member count badges. Personal/team distinctions remain as plain headings; team names organize a single list.
- [P2, resolved] Too many ad hoc type sizes and weights. Every `font-size` declaration in the shared stylesheet now uses one of five semantic roles: page 36px, heading 20px, body 14px, caption 12px, and clock display 40 SVG units. Weights are regular 400 / medium 500. Supporting rhythms are shared. Browser measurement confirms Automatic, Focus, Your tasks and Team tasks all use 20px / 500; body 14px and page title 36px.
- [P2, resolved] Additional clock data duplicated information across concentric rings, wedges, statistics, digital wall time and a legend. Automatic now uses one history ring, following the minute hand's one-hour scale. Solid pending segments and faded logged segments share that ring; idle is dashed, focus is purple. Focus now has one progress ring and one time readout. Removed the second history ring, center totals, digital wall-time duplicate, legend, elapsed wedge, and repeated session totals/captions.
- [P2, resolved] The larger shared body text crowded the project currency field. Increased its fixed slot from 64px to 80px. Projects and Notes navigation/DOM checks preserve visible controls and show no document overflow.

Post-fix combined source/implementation and earlier/final comparisons opened and inspected. No actionable P0/P1/P2 finding remains in this scope.

Required fidelity surfaces:
- Typography: Helvetica throughout; semantic roles and two weights replace local sizes, heavy headings, tiny dial captions, and variable letter spacing. SVG display text scales with the dial viewport.
- Spacing: approximately 409px desktop dial containers, paired flat color surfaces, simpler unboxed task lists, consistent heading/control hierarchy. Smaller layouts stack the same full-width faces.
- Colors: lemon yellow and lavender carry the clock grouping, white carries task content, dark text/hands and high-contrast progress remain readable. Light staging retained; no black background.
- Assets: these are timestamp-driven interactive SVG visualizations, not substitutes for reference illustration assets. Reference device frames, decorative logos, portraits and artwork are excluded from the requested app adaptation.
- Content: additional history/progress data remains functional and inspectable, while explanations live in the tracking disclosure and fragment review. No redundant visible legend or face statistics.

Validation:
- Clicking a pending history arc opens review with exactly that fragment selected; other pending fragments remain available and unchecked. Keyboard activation and modal close/focus restoration work.
- Focus progress, pause/resume and previously verified countdown/stopwatch/logging/recovery paths retained.
- 29 automated tests pass, covering tracker boundaries, overlap prevention, recovery, logging deduplication, ownership, history clipping across hour boundaries, and countdown graph deadlines, alongside URL/share tests.
- Production build passes; the previously recorded Sheets API tracing warning remains. No console errors in final preview. Real production Firebase mutations were not used for verification.
- Browser preview remains open with isolated sample data and a paused demonstration focus session. Unlogged time remains device-local until logged, as documented above and in README.

Implementation checklist: shared type roles; two font weights; flatter task list; one data ring per clock; selectable history; responsive layout; console/model/build checks; combined visual comparisons inspected.

final result: passed

## Latest iteration — unframed workspace and animated uppercase titles (2026-10-19)

This section supersedes earlier panel/header layout findings.

- Removed main-content padding, border, corner radius, and background at desktop and mobile breakpoints. Sidebar panel backgrounds remain intact.
- Shared page heading aligns to the sidebar home panel: browser measurements show both main/header and sidebar at y=12px; main padding and border are 0px. Heading row is 56px on desktop and 44px on mobile.
- All eight page headings use the same uppercase text, Helvetica type tokens, and three-frame SVG displacement treatment. Checked TASK, MEMBERS, PROJECTS, WISHES, FINANCE, REQUESTS, NOTES / DOC, and RESOURCES through live navigation.
- The title animation changes only the ink edges, never element geometry. SVG definitions are hidden from accessibility, IDs are instance-specific, and prefers-reduced-motion disables animation while preserving the static treatment.
- Inspected desktop TASK and PROJECTS screenshots and mobile TASK at the measured 500 CSS-pixel width: no horizontal document overflow, no reintroduced main padding, readable title and clock faces. Viewport override reset afterward.
- Captured task-unframed-title.png and inspected task-unframed-comparison.png alongside the prior accepted clock design. Comparison documents structural changes; the captures have different viewport sizes and time/session data, so it is not a pixel-diff claim.
- Tests: 33 passed. Production build passed with the preexisting Sheets/next.config.mjs Turbopack tracing warning.
- Preview uses isolated sample data; production Firebase writes were not exercised.

final result: passed

## Latest iteration — readable typography and decision data (2026-10-19)

Supersedes the earlier 14px body / 12px caption specification.

- Removed the caption token and migrated its uses to the 16px base. All eight navigation pages were inspected in the browser. Rendered text used Helvetica only; essential HTML text measured 16px, headings 20px, and page titles 36px, with no sub-base labels found in the sampled page states.
- Reserved 32px for summary metrics; made project budgets, hours, and request amounts more prominent. SVG clock labels retain their viewport-relative scale rather than inheriting HTML sizes.
- Shared view controls now include visible labels and use a consistent selected color. Forms accommodate the larger text with minimum 40px controls.
- Finance charts use circular rings, readable wrapping legends with numeric values, distinct income/expense colors, and stable payee colors. Purple is reserved for the common pool. Removed the silent eight-category truncation so breakdown totals include every category.
- Finance includes an expandable explanation of actual, expected, receivables, payables, and common pool concepts. Member-page copy emphasizes shared responsibilities.
- Visually inspected TASK, Projects, Finance, and expanded project finance charts. Checked navigation pages at a measured 500 CSS-pixel viewport without horizontal document overflow; reset viewport afterward.
- Evidence: projects-consistent-type.png and finance-readable-data.png in the conversation artifact directory. Preview uses sample data, with actual sheet transactions empty; no live accounting writes were performed.
- 33 existing tests pass. Production build passes with the existing Sheets tracing warning. Final view-label markup was additionally compiled in the preview and checked in-browser.

final result: passed

## Plain titles and sidebar separation — 2026-10-22

Removed the shared title SVG filter definitions, displacement animation, and SVG brightness hover filters. Titles retain uppercase Helvetica. Increased the desktop sidebar/content gap from 6px to 24px. Browser verification on Projects measured a 24px gap and zero SVG filter elements. Production build passed with the existing Sheets tracing warning. Captured projects-plain-title-spacing.png.

final result: passed

## Collapsible sidebar — 2026-10-22

Added a keyboard-accessible sidebar toggle with expanded state and a labeled 44px reopen control. Collapsing hides navigation, sharing, account, and brand controls from layout and accessibility while reclaiming content width. The local browser preference survives reload. Verified collapse, persistence, Enter-key reopening, and navigation to Projects in the live isolated preview. Captured sidebar-collapsed.png. Production build passed with the existing Sheets tracing warning.

final result: passed

## Restore page organization and use real local data — 2026-10-22

Supersedes previous added header-dashboard and visual-instrument findings. Removed the header visualizations and their shared components from all seven non-TASK pages. TASK components and clock behavior were not changed. Retained existing forms, lists, project/member grouping, finance ledgers and original request receipt field grouping, using minimal surfaces and readable typography. Removed the extra Finance explainer panel and the blanket panel-padding overrides.

Replaced the temporary sample-data server on port 3010 with `next dev`, using the repository's configured Firebase connection. Opened http://localhost:3010/projects to keep real browser storage separate from the old fixture preview. Verified the Google sign-in page is shown without fixture branding. Added a server-validated Firebase-token-to-workspace-session exchange so the legacy cookie gate no longer prevents Google login. Membership is checked through Firestore under the user's own token; no Admin credentials or auth bypass is introduced. Sign-out clears both sessions.

38 tests pass, including invalid token rejection, inactive/missing membership, verified-email fallback, upstream failure and signed-cookie tampering. Live local endpoint rejects missing tokens with 401 and foreign origins with 403. Production build passed with the existing Sheets tracing warning. Source references confirm no PageDashboard or VisualInstrument remains.

Protected-page visual QA with real data is awaiting the user's Google sign-in. No successful live member session or real-data page rendering is claimed yet.

final result: blocked (protected-page visual verification requires user sign-in)

## Real signed-in verification — 2026-10-22

User completed Google sign-in. Verified live protected views on localhost:3010: 19 projects, 26 notes, 14 resources, actual members, and TASK personal/team lists plus focus task choices. Finance successfully loaded the accountant sheet (1005 rows). The seven non-TASK pages have no added header visualizations or SVG filters; TASK clocks remain. Sidebar collapse/reopen and expanded navigation were verified.

Requests and Wishes receive permission-denied responses for reimbursements and backlogItems under the deployed Firestore rules. Added explicit load-failure alerts and suppressed misleading empty lists and creation controls on these failures. Existing local rules changes were not deployed. Those collections require a separately reviewed rules deployment before live records can be verified.

Observed a Firestore internal assertion during a development session with hot updates and navigation. A full reload restored live subscriptions; the subsequent navigation check showed the collection permission failures above, without reproducing that assertion. No SDK-level fix is claimed.

38 tests pass. Final production build passes with the existing Sheets tracing warning. Evidence: real-restored-projects.png, real-restored-task.png, real-restored-notes.png, real-restored-resources.png, real-restored-finance.png and error-state captures in the conversation artifact directory. No business records were created, approved, deleted, or manually logged during verification.

final result: UI restoration and available live-data views passed; Requests/Wishes live-data verification blocked by deployed collection permissions.


## Bottom workspace navigation — 2026-10-22

Moved primary navigation from the left sidebar into a fixed bottom bar. Pages reclaim the sidebar width. All allowed page links remain labeled in uppercase, with the current page highlighted. Online presence, sharing, help, home and sign-out are available in More. The menu supports Escape, closes on outside pointer interaction and page changes. Removed the former sidebar collapse behavior.

Verified the real Projects page, menu opening and Escape dismissal, and navigation to Resources at a narrow viewport (measured 582 CSS pixels) with no horizontal document overflow. The navigation scrolls independently and keeps the current page visible; More stays available. Reserved bottom padding and safe-area spacing keep the final page content reachable. Reset viewport and returned preview to Projects. Production build passed with the existing Sheets tracing warning; final menu-ref behavior also compiled and was exercised in the dev preview. Evidence: bottom-navigation-projects.png.

final result: passed

## Restore useful color and simplify navigation — 2026-10-22

Restored the original project status/kind color mappings. Expanded projects use a lilac selection header, cream hourly-rate section, sage budget ledger, and soft stage blocks; existing values, stage proportions and labels remain. Restored distinct task/stage/team progress colors with matching legend dots. Removed row side borders and softened grouping to reduce nested boxes. Typography and TASK clocks remain as before.

Reduced the bottom navigation to 52px icon targets, retaining accessible page names and current-page semantics. Labels appear on hover and keyboard focus; More uses a matching ellipsis icon. Verified the real expanded project, hidden default labels, keyboard focus revealing the Wishes label, More opening and outside dismissal. Desktop document width equals viewport width, dock measures 512px, and no SVG filters exist. Production build passed with the existing Sheets tracing warning. Evidence: projects-color-icon-dock.png.

final result: passed


## Deploy missing Firestore collection permissions — 2026-10-22

Authenticated the existing Firebase CLI account again, retrieved the live rules, and confirmed that the deployed version omitted backlogItems, reimbursements, financeConfig and sharedViews. Saved the former rules to /tmp/coassembly-live-firestore-rules.json. Deployed only firestore:rules to the configured coassembl project. Firebase compiled and released the rules successfully; other services were not deployed.

Reloaded the real signed-in preview: Wishes now shows 18 entries and Requests shows 6 records. Opened Finance and checked new console output: no permission errors were recorded after the deployment/reload. Existing error handling remains for future access failures. No business records were edited during verification. This supersedes earlier Requests/Wishes permissions blockers. Evidence: wishes-live-permissions-fixed.png.

final result: passed

## TASK readability and compact columns — 2026-10-23

Day-clock labels now use full 24-hour times (00:00, 06:00, 12:00, 18:00) at the 16px SVG label token. Side labels are anchored outward; DOM rectangle checks and the desktop screenshot confirm separation from the center time. Task titles use the 20px heading token. Metadata retains the 16px body token with distinct padded project, planned-time, logged-time, deadline and overtime chips, improved contrast and wrapping.

Restored responsive multi-column task grouping: personal work remains separate; team member cards use auto-fit columns with a 340px minimum. At wide desktop sizes personal and team groups sit side by side. At narrower widths the groups stack and member cards use the available columns. Existing task operations and tracking logic are unchanged.

Reviewed source typography declarations and visible rendered text on all eight navigation pages. No visible text below 16px was found in those page states. Browser-default sub/sup text now explicitly uses the 16px base. Narrow TASK check (measured viewport 582 CSS pixels) found no document overflow and no visible text under 16px. Reset viewport and left TASK open. Production build passed with the existing Sheets tracing warning. Evidence: task-readable-columns.png. No business records were changed in verification.

final result: passed

## Page margins and task base size — 2026-10-23

Task titles now use the 16px body token again, superseding the previous 20px task-title choice. Semantic section headings remain 20px. Expanded workspace padding to 32px at the top and responsive 24–48px side margins; narrow screens use 24px top and 20px sides. Browser verification measured 16px on every task title, 48px desktop sides, 32px top, and no horizontal document overflow. Dev preview compiled the CSS update. Evidence: task-comfortable-margins.png.

## Floating local role preview — 2026-10-23

Replaced the in-flow role toolbar with a collapsed floating control above the bottom navigation. Expanding reveals the existing local role selector and its UI-only notice. Active previews have a colored indicator. Escape and outside pointer interaction close the panel. The local-only eligibility gate, selected role and permissions behavior are unchanged.

Verified opening and Escape dismissal without changing roles: page content stays at the same 32px top position in both states, control uses fixed positioning and no horizontal overflow occurs. Production build passed with the existing Sheets tracing warning. Evidence: role-preview-expanded.png.

## Clock column and task board — 2026-10-23

Added a responsive TASK workspace with a one-third clock column on the left and two-thirds task board on the right. Automatic and Focus stack vertically in the left column. Week/view controls align with the top of the clocks. Personal tasks use compact card columns, with team member columns below. Completed-task review controls wrap below the content to avoid squeezing titles and tags. Existing timer and task behavior is unchanged.

Verified desktop columns at approximately 535px and 1071px with identical top positions. At the narrow test viewport (measured 582 CSS pixels), workspace and clocks stack to a single column with no document overflow. Reset viewport and saved task-clocks-left-board-right.png. Production build passed with the existing Sheets tracing warning; the final completed-card CSS adjustment was compiled and inspected in the dev preview.

final result: passed
