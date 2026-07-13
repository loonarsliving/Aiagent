# AI Governance — the Approval Matrix and per-worker profiles

Every AI Worker's authority is bounded, declared, and auditable. This is
not a promise in prose — it's `packages/security/src/governance.ts`,
tested (`governance.test.ts`), and built directly on top of the same
`@mkh/security` package that already enforces Meta Ads Specialist's
Owner-only approval gate in real code (`approval-gate.ts`).

## The Approval Matrix

| Level | Label | Meaning |
|---|---|---|
| 0 | Read Only | Observing data; no output that could influence a decision |
| 1 | Suggestion Only | A recommendation, notification, or report — never executes anything, never requires a human decision before it happens |
| 2 | Requires Branch Manager Approval | A single-branch operational action |
| 3 | Requires Director Operations Approval | A cross-branch or company-level operational action |
| 4 | Requires Owner Approval | A financial, brand-risk, or company-strategic action |

**No AI Worker may execute an action above its own `permissionLevel`.**
This is checked by `isActionWithinPermission(profile, actionLevel)` — any
future code path that would let a worker act (a real `execute()` on a
connector, an MK Connect-triggered action) must call this before doing
anything, the same way `assertApproved()` already gates Meta Ads execution
today.

## What every worker actually does today

This table reflects **actual runtime behavior**, verified by reading every
`module.ts` — not aspirational levels. Every worker except Meta Ads
Specialist is Level 0/1 only: nothing in this codebase writes to business
data, executes a campaign, changes a price, or takes any action a human
hasn't already decided on. See `docs/audits/PRODUCTION_READINESS.md`'s AI
Safety section for the audit that verified this.

| Worker | Permission Level | Auto Action Level | Requires Approval At | Enforced By |
|---|---|---|---|---|
| CEO Assistant | 1 | 1 | — | — (nothing gated) |
| Marketing Intelligence | 1 | 1 | — | — |
| Content Planner | 1 | 1 | — | — |
| **Meta Ads Specialist** | **4** | 1 | **4 (Owner)** | `@mkh/security`'s `canApprove()` — real, tested code |
| Sales Supervisor | 1 | 1 | — | — |
| Branch Performance Manager | 1 | 1 | — | — |
| Finance Analyst | 1 | 1 | — | — (READ ONLY MUTLAK) |
| HR Officer | 1 | 1 | — | — |
| OTA Manager | 1 | 1 | — | — |
| SOP Guardian | 1 | 1 | — | — |
| Notification Coordinator | 1 | 1 | — | — |

Meta Ads Specialist is the sole exception because it's the only worker
with an actual (if still execution-less) approval workflow today —
`proposeAction()` creates a pending `ApprovalRequest`, and
`decideOnApproval()` is hard-gated to the `owner` role. Every other
worker's "authority" today is limited to reading data and calling
`notify()` — there is no write path for any of them to reach, by design
(see `docs/ARCHITECTURE.md`'s "Security boundaries" section, which
predates this governance layer and independently confirms the same
invariant from the `Repository` interface's shape).

## Per-worker governance profile

Each worker's full profile — forbidden actions, escalation rules, and
Owner/Dir Ops/Branch Manager approval rules — is declared in
`GOVERNANCE_PROFILES` (`packages/security/src/governance.ts`). Highlights:

- **Finance Analyst**: forbidden from ever suggesting or implying a
  transaction change — this is enforced both in its Prompt Engine
  `restriction` field (`docs/PROMPT_ENGINE.md`) and its governance
  profile's `forbiddenActions`, a deliberate belt-and-suspenders design:
  the AI is told not to via its prompt, and the codebase has no write
  method it could call even if it tried.
- **Meta Ads Specialist**: `requiresApprovalLevel: 4` — any actionable
  recommendation or new campaign draft it produces requires Owner sign-off
  before it could ever take effect, and no execution code path exists yet
  regardless (see `docs/ROADMAP.md`'s "Explicitly deferred" list).
- **Branch Performance Manager / OTA Manager**: today's `permissionLevel`
  is 1 (pure recommendation), but their profiles document the **future**
  approval level a real execute path would need (Branch Manager for
  single-branch actions, Director Operations for pricing with direct
  revenue impact) — this is forward-looking documentation for Sprint 3+,
  not a currently-enforced gate, and is explicitly labeled as such in each
  profile's rule text.
- **Notification Coordinator**: forbidden from inventing facts or
  changing the severity/target a sending employee already decided —
  matches its Prompt Engine restriction (`docs/PROMPT_ENGINE.md`).

## Roles

`packages/security/src/roles.ts`'s `ROLES` gained one addition this round:
`branch_manager`, added specifically so Level 2 of the Approval Matrix has
a real role to resolve to (previously `ROLES` had no branch-level role at
all — a real gap, since a governance matrix that names a decision-maker
who doesn't exist as a role is not meaningfully auditable). No new
`APPROVAL_AUTHORITY` entries were added for it yet — no code path reaches
Level 2 today (see table above), so there's nothing to gate. Adding the
real gate is Sprint 3+ work, once a Level 2 action actually exists.

## What this layer is, and isn't, today

**Is**: a declared, tested, auditable classification of every worker's
authority — the foundation Sprint 3's execution paths (Meta Ads publish,
OTA pricing, any future MK Connect-triggered action) must build on top of.

**Isn't**: a runtime enforcement gate wired into every code path yet —
because, as the table above shows, there is currently no code path in
this repository that does anything above Level 1 except Meta Ads
Specialist's proposal workflow, which is already gated by
`assertApproved()`/`canApprove()`. `isActionWithinPermission()` and
`requiresHumanApproval()` exist and are tested so that Sprint 3's first
real execute() path has an immediate, ready-made check to call — adding
governance enforcement retroactively to code that doesn't exist yet isn't
possible; the discipline is that **no new execute path may ship without
calling these functions first**, and this document is the explicit
record of that expectation.
