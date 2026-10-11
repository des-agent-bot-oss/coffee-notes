# Owner brief (verbatim, 2026-10-12)

Build a polished, locally hosted coffee journal called “Coffee Notes” from this brief. Treat this brief as the requirements source; do not search for or reuse an older implementation.

I will be asleep and probably unavailable. Choose sensible technical and design details yourself, record material assumptions, and proceed without waiting for ordinary preference questions. Use the existing coordinator/coder/tester/reviewer profiles, native Kanban and team skills. Choose handoff order based on the task rather than forcing every role through every step.

FIRST: Check for existing project files, Kanban tasks, Git repositories and previous progress from this request. Continue that work rather than creating duplicate projects, repositories or tasks. Inspect actual state before retrying an external action. If blocked or a task budget is exhausted, preserve progress and send me a partial report through Telegram with the exact blocker and instructions for resuming.

## Product

A personal coffee brewing and tasting notebook. Make it useful and pleasant for a single local user.

Core features:
- Create, browse, view, edit and delete coffee notes. Show history newest first, with clear selected state and summaries of date, grinder and beans.
- Each note records brew date/time, grinder, optional numeric grind size, brew ratio displayed as 1:X, bean information and free-text tasting notes.
- Default a new note to the current local date/time and the preferred grinder. Do not shift the displayed time unexpectedly through UTC conversion.
- Settings let me add/remove grinder presets and choose one default. Handle duplicate/blank names clearly. Removing a preset must preserve historical notes and their grinder information.
- A new-note action, save/cancel, clear validation and safe deletion confirmation. Cancelling a new note must not create an empty saved record. Protect unsaved edits from accidental navigation.
- Desktop: history sidebar and spacious detail/editor area. Mobile: usable drawer with backdrop, sensible form layout and accessible controls.
- Ctrl/Cmd+N for a new note where it does not interfere with typing or browser behavior.
- Add simple search/filtering if useful after the core works; avoid expanding into an unrelated coffee platform.

## Visual direction

Warm, refined specialty-coffee journal:
- Cream/off-white foundation around #F7F0E6.
- Espresso brown #3C2415, medium brown #6B4A30 and muted tan #C9A87C.
- Rounded cards, subtle shadows, restrained borders, generous but purposeful spacing.
- Readable typography; DM Sans or a similar suitable font, with a reliable fallback.
- Refine the layout, hierarchy, forms, note cards and interactions. Avoid clutter, excessive decoration, generic marketing sections and placeholder copy.
- Include loading, empty, validation, API-error and success states. Support keyboard navigation, visible focus, labelled inputs and accessible mobile dialogs/drawers.
- Use realistic sample notes only through an explicit demo/seed action; keep them separate from user-created content.

## Backend and local operation

Implement a real frontend + backend API + durable database. Notes and grinder settings must be stored server-side and survive browser refresh and application-process restart. Browser storage must not be the sole data store.

Choose a small, maintainable stack that fits this VM (4 vCPU, dynamic 4–8 GiB RAM, HDD). SQLite is a sensible default unless another DB has a demonstrated benefit. Provide reproducible initialization/migrations, appropriate validation/error handling and documented API routes.

Host ONLY inside the local VM. Bind application/API services to loopback; do not deploy, enable public/LAN exposure, configure cloud hosting or add external product services. Give me the actual local URL, start/stop instructions and any SSH port forwarding needed to access it from Windows. Keep app processes separate from Hermes and do not alter the VM’s security policy or credentials.
Prefer one straightforward repository and a few documented commands. Dependencies are allowed when justified. Avoid speculative abstractions, microservices, duplicate state, unnecessary scaffolding and unrelated features. Do not require local model inference for the application.

## Git and autonomy

Create a fresh local Git repository in the VM workspace and choose a clear project name, unless the initial state check finds an existing repository for this task; in that case, continue it.

Creating a new private GitHub repository under the configured bot account and pushing project code is authorized. You may choose direct push or a draft PR according to what suits the new bot-owned repository; no deployment, automatic PR merging, administration changes or expanded credential permissions.

For explicitly assigned contributions to another repository, use a bot-owned fork and PR, or a registered temporary PR feature branch if forking is unavailable and permissions allow it. Never push its default branch. This task does not authorize modifying unrelated repositories.

If repository creation or push is denied, record the exact blocker once and continue the local build, commits and testing. Do not repeatedly retry permission failures or wait for me. Preserve useful work.

Set up a distinct stable project memory bank before saving project knowledge; reuse it if already created for this task. Keep coordinator personal memory out of worker context. Save only verified useful decisions/lessons, with attribution and commit where relevant.

Use finite Kanban tasks within existing limits, one active development task on the initial board, and no recursive agent swarm. Break work into coherent bounded deliverables. After two unsuccessful fix cycles on a problem, preserve evidence, investigate a different cause or record the blocker rather than looping indefinitely.

Finish when acceptance is met. Do not invent extra work merely to fill the night.

## Verification and visual evidence

Actually run the application and exercise its UI against the real API/database.

Verify:
1. Add a grinder, make it default and create a note using it.
2. View/edit a note, cancel an unsaved note, and delete with confirmation.
3. Refresh and restart the application; saved notes/settings persist.
4. Remove a grinder preset without damaging historical notes.
5. Invalid dates/numeric values and API failures produce useful feedback.
6. Desktop and mobile layouts work without overflow, unusable controls or broken navigation.

Run relevant API/DB tests, type/build checks and browser behavior checks. Use the existing project tooling where possible. Have independent testing/review where it adds value, including an explicit check for unnecessary complexity. Tie acceptance evidence to the final commit; source changes invalidate earlier receipts. Never claim an unavailable check passed.

Capture at least four screenshots of the actual running app:
- Populated desktop journal.
- Note editor.
- Grinder settings.
- Mobile layout.

Capture a short walkthrough video if practical, ideally showing create → save → refresh → edit. Screenshots are required; video is optional. Use synthetic test data and exclude secrets.

Save evidence under evidence/ui and attach it through the current portal if supported; otherwise report exact file paths. If browser capture is blocked, record the cause and remaining installation/access requirement rather than fabricating images or claiming visual acceptance.

## Reports and delivery

Maintain evidence/RUN-REPORT.md and evidence/DELEGATION-TRACE.jsonl, updating after each handoff, failure and completed task so partial progress remains useful. Preserve previous trace entries when resuming.

The report includes:
- Requirements and material assumptions.
- Outcome and acceptance status.
- Repository, branch and final SHA.
- Changed components.
- Exact checks and results.
- Unresolved issues.
- Launch/access and start/stop instructions.
- Database location and backup guidance.
- Screenshot/video paths.
- Elapsed time and actual API usage/cost if available; otherwise mark unavailable.
- Remaining work and how to resume if incomplete.

The trace records timestamp, task ID, profile, assignment/handoff, a short routing reason, start/end, candidate SHA, result, failures/retries/timeouts and evidence references. Preserve native Kanban task/run/event exports. Record observable actions and concise decisions; do not dump credentials or full request payloads.

## Telegram delivery

When the project is complete, send the result through the existing configured Telegram bot to its already-authorized owner chat. This Telegram delivery is explicitly authorized. Use the existing bot integration and configured owner destination; do not ask for new credentials or send to other recipients.

Send a concise completion message containing the outcome, repository/PR link if available, final commit, local access instructions, checks actually passed/failed and remaining limitations.

Attach:
- evidence/RUN-REPORT.md.
- evidence/DELEGATION-TRACE.jsonl.
- Native Kanban exports.
- UI screenshots.
- A short walkthrough video, if available.

Use document attachments for reports so they are not truncated into chat messages, and split media into a few messages if necessary. Keep copies in the project evidence directory for later analysis.

If blocked, timed out, or a task budget is exhausted, send a clearly labelled partial-result report with what works, the exact blocker, current commit, remaining work and how to resume. Do not claim completion or silently discard progress.

If Telegram delivery fails, record the failure and exact artifact paths, use only bounded retries, and preserve all results locally. Confirm delivery using the actual send result rather than assuming it succeeded; include a brief Telegram-delivery receipt in the local run report.

Also summarize completion or partial progress in this initiating conversation. Leave the finished app running locally for inspection while the VM remains on.

## VM access policy

Read /home/hermes/team/AUTONOMY-POLICY.md.

Use the fixed supported-package sudo helper for development/browser system dependencies; general sudo is unavailable. Routine command approvals now use smart approval and unattended worker handling. Protected instructions and remote deny rules remain.

Do not disable safeguards, expand credentials or bypass a blocked action through another API or command. Record a blocker and continue unaffected work instead.
