# Design Grilling

## Purpose
Reach shared understanding with the user **before** a plan is written down, by interviewing relentlessly instead of guessing. The most expensive failure in an autonomous pipeline is not bad code — it is a confidently-built epic nobody asked for. Grilling is the gate that catches misalignment while it is still one conversation, not twenty-eight stages.

## Principles
- A design is a **tree**: every decision branches into the decisions that hang off it.
- The **frontier** is every decision whose prerequisites are already settled — the questions answerable *now*, without guessing at answers not yet heard.
- Work in **rounds**: ask the whole frontier at once, then wait. Each set of answers reshapes the tree and pushes the frontier outward.
- **Facts are yours; decisions are theirs.** Anything discoverable from the repo, the filesystem, or a document is yours to find. Only genuine choices go to the user.
- Every question carries **your recommended answer**, so the user can reply "1, 3, yes" and be done.
- The session ends when the **frontier is empty** — every branch visited, nothing silently assumed.

## Rules
- **DO**: Number every question and pair it with a recommended answer.
- **DO**: Ask the entire current frontier in one round, then stop and wait for the user.
- **DO**: Dispatch a subagent to find any fact a question depends on, and ask the rest of the frontier while it runs.
- **DO**: Write each round's answers into the plan document as they land — the interview and the writing are one job, not two.
- **DO**: Record anything still unresolved in the plan's Open Questions & Assumptions section.
- **DON'T**: Ask a question whose answer depends on another question still open in this round — it belongs to a later round.
- **DON'T**: Ask the user for anything you could look up yourself.
- **DON'T**: Treat your own recommendation as the decision — a recommendation is an offer, not an answer.
- **DON'T**: Stop because the plan looks complete — stop when the frontier is empty and the user confirms.

## Patterns
### Question Format
```
❓ **Q1** — **{short title}**: {the question; list the options when there are options}

➡️ {your recommended answer, with a one-line reason}
```

### The Round Loop
1. Compute the frontier — decisions whose prerequisites are settled.
2. Send any fact-finding to a subagent; questions downstream of it wait, the rest do not.
3. Ask the whole frontier as one numbered round. Stop.
4. Apply the answers to the plan document immediately.
5. Recompute the frontier and repeat. Empty frontier = done.

### Question Bank — Epic Statement
- **Actor and job**: who is this for, and what can they do when it's complete that they can't today?
- **Success metric**: which number moves, and what is it now?
- **Out of scope**: what will a reader assume is included that isn't?
- **Riskiest assumption**: which belief, if wrong, invalidates the whole epic?
- **Greenfield or brownfield**: does this change behavior that already exists? (Brownfield binds the FeatBit flag rule.)
- **Invisible constraints**: compliance, deadline, partner contract, budget, response-time obligation — anything not readable from the code.
- **Definition of done**: what demo would you give to call this epic finished?

### Question Bank — Domain Language
- For each recurring noun: is this **one** concept or two wearing one name?
- Are two words in play for the same thing? Pick one; the rest go on the `_Avoid_` list.
- Does one word cover two things? Split it and name both.
- **Lifecycle**: what states can it be in, and what moves it between them?
- **Ownership**: which concept owns which data, and who is allowed to change it?
- **Identity**: what identifies it, and is that generated client-side or server-side?

### Question Bank — Service Architecture
- What are the top-level **modules**, and what does each one **hide**?
- For each module, what must a caller know — signature, invariants, ordering, error modes, required config, performance?
- Where does each **seam** go, and **what varies across it**? Two adapters justify a seam; one is indirection.
- What **dependency category** is each dependency (see `.claude/guidelines/deep-modules.md`)? This fixes the test strategy.
- Across each seam: synchronous or asynchronous, and what happens when the far side is down?
- **Data ownership**: which module owns which store, and does anything else read it directly?
- **Deployment shape**: one service or several — and does the epic actually require more than one?
- Which seam is the **acceptance boundary** the E2E suite drives?
- What should explicitly **not** be a seam?

### Question Bank — Decomposition and Delivery Risk
- Does each feature cut a **complete path through every layer**, or is it a slice of one layer?
- Is each feature demoable on its own?
- Which feature is the **walking skeleton**, and which integration risk does it retire?
- Any change too wide to land as one tracer bullet? Sequence it expand-migrate-contract (`.claude/guidelines/parallel-change.md`).
- Which features sit behind a feature flag?
- Which features have **no UI of their own** (`Surface: backend-only` — API consumed by another service, worker, scheduled job, webhook receiver)? Whether a feature ships a screen is the user's decision, not yours to infer from a description — but only ask where it's genuinely ambiguous: a tech-stack profile with no frontend settles it for the whole epic, and a description that names a screen settles that feature.
- For each backend-only feature, what is the API surface its **Bruno suite** drives as the acceptance contract, now that there is no Playwright E2E?
- Which features are a **screen over an API that already exists** (`Surface: frontend-only` — an earlier feature's backend, another repo's service, a third party) and need **no backend change at all**? Name the consumed API per feature; if the screen needs even one new endpoint or field, it is `full`, not frontend-only.
- What must be true for each feature to be called done?

### Facts vs Decisions
| Question | Whose job |
|---|---|
| "Which auth library is already in this repo?" | Yours — read the repo |
| "Does the target API support pagination?" | Yours — read the docs |
| "Should sessions expire in 30 or 90 days?" | Theirs — a real choice |
| "Is a partial refund one Refund or many?" | Theirs — a domain decision |

### When a Question Needs a Runnable Answer
Some questions can't be settled in conversation — they need something executed and measured (a throughput number, a library's real behavior, a state model that has to be driven). Don't guess and don't stall the round: record it as an open question and route it to `/project:develop-research`, which spikes it under a timebox and returns a decision record.

## Warning Signs
- Questions asked one at a time instead of a round — the frontier isn't being computed.
- A question with no recommended answer — the user is doing your thinking.
- The user is asked something the repo already answers.
- Answers land in chat but never reach the plan document.
- The plan is confirmed with assumptions that were never spoken aloud.

---

Adapted for this harness from the `grilling` skill in [mattpocock/skills](https://github.com/mattpocock/skills) — MIT License, Copyright (c) 2026 Matt Pocock.
