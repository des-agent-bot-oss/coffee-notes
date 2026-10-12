# Self-review — how the automated team actually performed

Written by the **coordinator profile** that ran this project, immediately after finishing it, from the
Kanban database, the receipts and its own transcripts. It is deliberately unflattering where the
evidence is unflattering: the numbers below are queried from the board and the repository, not
recalled. This is the coordinator reviewing itself and its workers, not an independent audit.

## The task

An owner brief (in [`docs/BRIEF.md`](docs/BRIEF.md)) asked for a polished, locally hosted coffee
journal: real frontend + backend API + durable database, loopback-only, with accessibility, sample
data, and — importantly for this review — **browser-verified acceptance evidence**: screenshots, a
walkthrough video, a run report, a delegation trace, and independent testing and review.

The owner was asleep and explicitly delegated technical and design decisions, so the coordinator
pinned a technical contract first ([`docs/SPEC.md`](docs/SPEC.md)) and recorded twelve material
assumptions ([`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md)) rather than asking questions.

## How the team was structured

A coordinator session (the owner's main assistant) plus three dispatched worker profiles
(`coder`, `tester`, `reviewer`) sharing one Linux user, one model and one GitHub identity. Work was
routed through a durable Kanban board: the coordinator wrote each task contract, chose the handoff
order, and gated later cards behind earlier ones so that exactly one development task ran at a time.

**One correction to the usual mental model:** the coordinator does not "become" the coder. The
gateway spawns a *separate process and session per task* (`hermes -p coder … chat -q work kanban task
<id>`) with its own fresh memory. What blurred the line here is that the coordinator also did a large
share of the verification work inline — that is the job, but it means the "independent" layer was
only partly load-bearing.

## What was delivered

25 commits, 9 Kanban cards, 17 worker runs. The app: 1,209 lines of server JS, 1,361 lines of
frontend JS (3,046 including CSS and HTML), 749 lines of tests, plus docs, receipts and evidence.

Verified at the end: `npm run check` exit 0, `npm test` 25/25, a 36/36 coordinator browser sweep with
zero page errors, an independent tester re-verification where every verdict passed (including a real
process-restart persistence check), and an independent review that reproduced the checks, ran 12 API
probes and a 13/13 XSS probe and judged the code appropriately simple.

## What worked

- **Contract-first paid for itself.** Pinning the schema, API envelope, validation rules and design
  tokens up front made the worker cards mechanical. The stack choice survived contact
  (Node 26 + built-in `node:sqlite`, zero runtime dependencies, no build step) and no worker invented
  a framework.
- **Dependency gating kept the board sane.** One active development task at a time, promoted
  automatically when its parent finished, meant no two writers touched the same worktree.
- **Small, precisely-located fix cards worked.** Every fix card that named the file, the line range,
  the root cause and the exact reproduction was completed in a single run with a small diff.
- **Treating worker claims as claims worked.** Verification (by the tester, the reviewer and the
  coordinator) found **five real defects** that no implementation receipt had reported, including two
  accessibility failures and a discarded draft that could still be written to the API.
- **Independent review earned its place.** The reviewer found the fifth defect, plus a documentation
  drift and two accepted rough edges, and its XSS/API probes were genuinely independent of anything
  the coordinator had run.
- **Receipts-in-the-repo worked.** The paper trail is complete enough to reconstruct who did what,
  which is why this review can quote numbers instead of impressions.

## What did not work

1. **The per-run iteration budget was the dominant failure mode — 8 of 17 worker runs (47%) were
   stopped by it.** Typical pattern: the worker did the work, then ran out of tool calls while
   writing its receipt or finishing its checks, leaving committed-but-unverified work or an
   uncommitted fix in the tree. Three cards had to be closed by a coordinator override, and two cards
   needed a retry run to land work that was already written.
2. **My own card design made that worse.** The first implementation card bundled a store, an API, a
   test suite and an operations guide into one deliverable, and — worse — I told workers to
   *commit last* ("a source change after your receipt invalidates it, so commit last"). When the
   budget ran out, the work was uncommitted. I only started saying "commit early" several cards
   later. That instruction was a self-inflicted wound.
3. **Session-slot contention.** One worker crashed at startup (`Hermes is at the active session limit
   (1/1). Held by: cli`) because the coordinator's own session occupied the only slot. It recovered on
   the dispatcher's retry, but it means a busy coordinator can starve its own workers.
4. **A gate chain wedged.** I gated the reviewer behind the tester; when the tester's runs exhausted
   their budget the gate could never open, so I had to unlink both dependencies to let the review run.
   Gating on *card completion* rather than on an *artifact* is fragile.
5. **Duplicated verification effort.** The coordinator swept 36 browser checks while the tester ran an
   overlapping 45-check suite. Both found value, but roughly half the work was redundant — the
   wasteful kind of redundancy, not the useful independent kind.
6. **Evidence hygiene lagged.** The coordinator's own check logs were not preserved under `evidence/`
   until the reviewer pointed out the gap. Verification you cannot re-inspect is only marginally
   better than a claim.
7. **Worker self-reporting was unreliable in both directions.** Two worker-reported "failures" were
   races or wrong expectations in the workers' own throwaway scripts. One coder declared its own work
   "NOT accepted" because its test script raced — while missing a real defect in the same area that
   the coordinator then reproduced. Conversely, real defects went unreported in four implementation
   receipts. Every reported failure had to be reproduced before it was believed, and every "all good"
   receipt had to be re-checked.
8. **I made the same class of mistake I criticised.** My first acceptance sweep needed three
   corrective iterations (dirty database reuse, a non-idempotent default-grinder step, an impossible
   `datetime-local` value); my persistence harness initially failed for two of my own reasons (missing
   environment variables, restarting before the old process exited) and once reported a false FAIL
   that did not reproduce; and my final fix-probe reported one failure that was purely my assertion
   looking for typed input values in `innerText`. I labelled all of those honestly in the report, but
   the pattern is real: harnesses written quickly are wrong at roughly the same rate as the code they
   check.

## Honest overall verdict

The workflow produced a genuinely decent artifact with real defect discovery, honest evidence and no
fabricated results — but it was **not hands-off**. The coordinator wrote the contracts, reproduced
every important finding, ran the acceptance sweep, closed three stalled cards, captured all the
evidence, and wrote the report. The workers contributed most of the code and most of the *detection*,
but the coordinator carried the judgement and the verification load. As an evaluation: promising,
worth repeating on a second project, and clearly improvable rather than proven.

## What I would change, in priority order

1. **Size the budget to the card, or the card to the budget.** Raise worker iteration limits, and
   split any card whose deliverable spans more than roughly one focused run. A 47% exhaustion rate is
   a configuration bug, not a worker failing.
2. **Make commit-early and receipt-first mandatory.** Commit as soon as checks pass; write the receipt
   skeleton (task id, candidate SHA, verdict table) *before* the checks and fill it in as you go. The
   one tester card given that instruction produced usable evidence despite being killed mid-run.
3. **Gate on artifacts, not on cards.** Let downstream work start from a commit or a receipt file;
   never let one stalled card be the only path to another.
4. **One canonical acceptance suite.** Coordinator-owned harness, executed by the tester — so the
   independent run is independent in *who runs it and how it is judged*, not in being a second,
   differently-buggy script.
5. **Keep the coordinator out of the worker session slot** during dispatch, or raise the limit.
6. **Require every failure report to include a reproduction another agent can run.** "It failed" is a
   claim; a command and its output is evidence.
7. **Give the reviewer a different model when available.** Role separation here is organisational —
   all four profiles share one model, so the "independence" is context and discipline, not diversity
   of reasoning.

## Cost and time

Wall clock: roughly 2 hours 20 minutes for the whole project including evidence capture. Provider API
usage and cost are **not available** from inside the VM — no billing or token accounting is exposed —
so this review cannot state them, and will not estimate them.
