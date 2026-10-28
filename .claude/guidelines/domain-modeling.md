# Domain Modeling

## Purpose
Actively build and sharpen the project's domain model while the plan is being made — challenging terms, inventing edge-case scenarios, and writing the vocabulary down the moment it crystallizes. This is the *active* discipline that produces the language; `.claude/guidelines/ubiquitous-language.md` is the *passive* one that keeps code faithful to it afterwards.

In this harness the model lives in two sections of `epic.md`: **Shared Domain Entities** (canonical names and fields) and **Domain Language** (terms, definitions, and the words to avoid). Nothing else is a glossary.

## Principles
- A term is not settled until exactly one word survives for it and the rest are written down as banned.
- Fuzzy words hide two concepts. "Account", "item", "user", "status" are suspects until proven single.
- Edge-case scenarios are how a model is tested — a boundary nobody can describe is a boundary nobody has designed.
- The glossary is a glossary and nothing else: no implementation detail, no requirements, no running spec.
- An unreviewed, agent-authored glossary is worse than none — it becomes confident-sounding lore that later sessions trust.
- The language and the code must agree out loud before either changes.

## Rules
- **DO**: Pick one canonical name per concept and list the rejected words under `_Avoid_`.
- **DO**: Challenge a term the moment it conflicts with one already in the plan.
- **DO**: Propose a precise term when the user offers a vague one, and say which two concepts you think are hiding in it.
- **DO**: Stress-test each relationship with a concrete scenario that probes its boundary.
- **DO**: Check a stated behavior against the existing code and surface any contradiction before either is changed.
- **DO**: Have the user confirm every term — the glossary is theirs, drafted by you.
- **DON'T**: Record implementation details, endpoints, or acceptance criteria in the glossary.
- **DON'T**: Carry two names for one concept into the build — sibling features will diverge and the conformance gate will halt the run.
- **DON'T**: Use domain words without doing the modeling; the right nouns over the wrong structure read correct and are not.

## Patterns
### Sharpening a Term
```
Vague:     "Users can cancel their account."
Sharpen:   "Account" — do you mean the Customer (the person who pays)
           or the Login (the credentials)? Cancelling one is a refund
           question; cancelling the other is a security question.
Settle:    Customer  — _Avoid_: account, client, user
           Login     — _Avoid_: account, credentials
```

### The `_Avoid_` List
Every canonical term carries the words it displaces. This is what makes the decision enforceable later — a reviewer can grep for a banned word.
```
**Order**: A customer's confirmed request for goods, priced and payable.
_Avoid_: purchase, transaction, basket

**Cart**: The mutable pre-order collection. Becomes an Order on checkout.
_Avoid_: basket, order-draft
```

### Edge-Case Scenario Probes
Invent the awkward case and make the user answer it:
- "A customer cancels one line of a three-line Order — is that one cancelled Order, or an Order with one cancelled Line?"
- "The payment succeeds and the stock check then fails — what exists in the system at that moment?"
- "The same person signs up twice with two emails — one Customer or two?"

Each answer either confirms the model or splits a concept in two. Record the resolution next to the term.

### Cross-Referencing Against Code
When the user states how something works, verify it before planning on it:
> "Your code cancels whole Orders only, but you just described partial cancellation — which is right?"

Whichever way it resolves, one of the two is now a task: change the language, or change the code.

### When a Decision Earns a Record
Record a decision in the epic's **Architecture Decisions** section only when **all three** hold:
1. **Hard to reverse** — changing your mind later costs real work.
2. **Surprising without context** — a future reader will ask "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one was chosen for stated reasons.

Miss any one and skip it. Most planning sessions legitimately produce zero. When a decision needs evidence before it can be made, route it to `/project:develop-research`, which produces a full decision record from `templates/decision-record.md`.

## Warning Signs
- A term in the plan that appears nowhere in the user's own words.
- Two features describing the same concept with different nouns.
- A glossary entry that explains *how* something works rather than *what it is*.
- Every answer from a grilling round being appended to the glossary — it has become a spec.
- An entity with fields but no definition, or a definition nobody has read back.

---

Adapted for this harness from the `domain-modeling` skill in [mattpocock/skills](https://github.com/mattpocock/skills) — MIT License, Copyright (c) 2026 Matt Pocock.
