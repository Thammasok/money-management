export const meta = {
  name: "vibe-workflow",
  description:
    "Autonomous XP epic builder — loop every planned feature in build order, run its track agents sequentially (a `backend-only` feature skips the frontend track, a `frontend-only` feature skips the backend track; pre-dev and deployment always run), run a real-user UX/UI evaluator loop after the frontend track, commit/push per track, PR per feature, and halt on a conformance DRIFT.",
  whenToUse:
    "When epic.md is CONFIRMED and you want the whole epic built end-to-end without pauses. Planning is a separate step (/project:plan-epic). Pass an optional starting feature name as args; omit to resume from the first feature that is not Done. Append a track to force the start track even if its checklist stages are complete — e.g. 'F-21 frontend' (or 'F-21:frontend') re-runs F-21 from the frontend track.",
  phases: [
    {
      title: "Load",
      detail:
        "Parse epic.md + checklist.md into the build-order feature list; pick the start; halt on any DRIFT",
    },
    {
      title: "Build",
      detail:
        "Per feature: pre-dev → backend → frontend → deployment (sequential; respawn-once on incomplete). A `backend-only` feature runs pre-dev → backend → deployment; a `frontend-only` feature runs pre-dev → frontend → deployment.",
    },
    {
      title: "Evaluate",
      detail:
        "After the frontend track: an evaluator plays the running app as a real user (Playwright + Chrome-DevTools MCP) — MIRROR vs a reference frontend, or ACCEPTANCE vs the criteria + UX/UI plan — and loops findings back into the frontend agent. EVAL_BUDGET passes per round; if blockers survive a round, a verdict agent decides CONTINUE (another round) or HALT. Does NOT replace e2e.",
    },
    {
      title: "Commit",
      detail:
        "Small committer agent: branch per feature, commit+push per track, open the PR at the last track",
    },
    {
      title: "Verify",
      detail:
        "epic-conformance gate per feature — CONFORMANT advances, DRIFT halts the epic",
    },
    {
      title: "Done",
      detail: "Tear down backing services and report the epic summary",
    },
  ],
};

// vibe: Load → for each feature [ Build (sequential tracks) → Commit per track → Verify ] → Done
// Four tracks for a normal feature; three for a `backend-only` one (epic.md Surface column), which has
// no UI and therefore neither a frontend track nor an Evaluate phase, and three for a `frontend-only`
// one, which drives an API that already exists and therefore has no backend track — see tracksFor()
// below. pre-dev and deployment (and the conformance gate) run for every surface.
// Structural opposite of deep-research: deep-research fans OUT (independent branches); vibe is a
// dependency CHAIN — features run in build order (F-1 walking skeleton first), tracks run strictly
// sequentially (each reads the prior track's section of track-handoffs.md). The ONE place the
// deep-research adversarial pattern would fit is the Verify gate; per the chosen design it is
// conformance-only (validators stay inside the track agents at Stages 14/24/28).
//
// Evaluate phase: the ONE place this chain folds back on itself. Skipped entirely on a backend-only
// feature — no frontend track runs, so its `track.type === "frontend"` trigger never fires.
// After the frontend track (UI built,
// e2e green) an evaluator AGENT plays the running app as a real user via the Playwright + Chrome-
// DevTools MCP servers (observe→decide→act, NOT .spec files — e2e stays the deterministic contract).
// It runs in MIRROR mode (compare a reference frontend page→component→computed-style) or ACCEPTANCE
// mode (judge the generated app against the criteria + UX/UI design plan) — it picks the mode itself
// from epic.md. On REVISE it respawns the frontend agent to fix ONLY the reported findings, then re-
// evaluates; EVAL_BUDGET passes per round (Fix-Budget philosophy). If blocker-severity findings survive
// a round, a verdict agent decides (like the test-gate handshake) CONTINUE — another round, up to
// EVAL_MAX_EXTENSIONS — or HALT (notify the user + stop, like a conformance DRIFT). Major/minor residue
// is non-fatal and the build proceeds.
//
// Context hygiene "between features": automatic. Every agent() runs in its own fresh context; the
// JS loop below carries only a one-line summary per finished feature (heavy handoff objects are
// dropped at the boundary). There is no long-lived orchestrator session to compact, so the
// pre/post-compact pipeline-state.md mechanism does not apply here — resume is handled entirely by
// Workflow({resumeFromRunId}), which replays this run's own cached agent results.
//
// Token policy (deterministic, no waste): the heavy agentType track agents keep their .md-frontmatter
// model AND effort (see TRACKS: backend/frontend/deployment = "max", pre-dev = "medium") — the
// implementation-heavy tracks earn the higher effort, pre-dev does not. eval-fix re-uses the frontend
// agentType so it runs at FRONTEND_EFFORT (= the frontend track). Every other agent is plumbing —
// readers that turn files into structured data, and actuators (git/docker) the JS can't run itself —
// so they run on cheap models at effort:"medium". `:verdict` (eval + conformance) gates the whole epic
// (HALT/DRIFT), so it runs on opus at medium. Effort is pinned EXPLICITLY on every call so nothing
// silently inherits the launching session's effort (e.g. xhigh) and burns tokens.

// ─── Schemas ───
const FEATURE_LIST_SCHEMA = {
  type: "object",
  required: ["features", "startId"],
  properties: {
    epicName: { type: "string" },
    epicGoal: { type: "string" },
    techProfileExists: { type: "boolean" }, // .claude/tech-stack-profile.md present?
    startId: { type: "string" }, // first feature to build (not Done); "" if none left
    startTrack: { enum: ["pre-dev", "backend", "frontend", "deployment", ""] }, // first incomplete track of startId → resume mid-feature (frontend range includes Stage 25.5 eval gate)
    haltDriftId: { type: "string" }, // a feature already in DRIFT → user must resolve; "" if none
    features: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "status", "order"],
        properties: {
          id: { type: "string" }, // e.g. "F-1" — also keys the artifacts dir (artifacts/F-1/)
          name: { type: "string" }, // checklist feature-name slug — DISPLAY ONLY, may contain "/" so it is never used as a filesystem path
          status: { enum: ["planned", "in-progress", "done", "drift"] },
          surface: { enum: ["full", "backend-only", "frontend-only"] }, // epic.md Surface column; backend-only drops the frontend track + the Evaluate phase, frontend-only drops the backend track
          order: { type: "integer" }, // build-order index
        },
      },
    },
  },
};

const TRACK_SCHEMA = {
  type: "object",
  required: ["complete", "summary"],
  properties: {
    complete: { type: "boolean" }, // all of this track's stages [x] in checklist.md?
    summary: { type: "string" }, // 1-3 lines for the handoff log
    blocker: { type: "string" }, // non-empty => Stop-on-Blocker hit; halt the epic
    firstUnchecked: { type: "string" }, // stage id to resume from on respawn ("" if none)
    gateVerdict: { enum: ["HALT", "CONTINUE", ""] }, // a test gate hit its terminal verdict handshake
    gateHypothesis: { type: "string" }, // CONTINUE: the new root-cause hypothesis to try next round
  },
};

const COMMIT_SCHEMA = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    sha: { type: "string" },
    devMerged: { type: "boolean" }, // merge into develop landed and pushed (false = conflict → aborted, Blocker)
    prUrl: { type: "string" }, // set only on the PR-opening call
    error: { type: "string" },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["verdict"],
  properties: {
    verdict: { enum: ["CONFORMANT", "DRIFT"] },
    reason: { type: "string" },
    reportPath: { type: "string" }, // artifacts/{feature}/11-conformance-report.md
  },
};

// Evaluator verdict + structured findings, read from artifacts/{feature}/evaluator-report.md.
const EVAL_SCHEMA = {
  type: "object",
  required: ["verdict", "mode"],
  properties: {
    verdict: { enum: ["PASS", "REVISE"] }, // PASS = no blocker/major findings remain
    mode: { enum: ["mirror", "acceptance"] }, // mirror = vs a reference app; acceptance = vs AC + UX/UI plan
    reportPath: { type: "string" }, // artifacts/{feature}/evaluator-report.md
    summary: { type: "string" }, // 1-3 lines
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity"],
        properties: {
          page: { type: "string" },
          component: { type: "string" }, // component ID from 02-flow.md when applicable
          severity: { enum: ["blocker", "major", "minor"] },
          category: { enum: ["layout", "style", "behavior", "content", "a11y"] },
          expected: { type: "string" },
          actual: { type: "string" },
          fix: { type: "string" }, // concrete instruction the frontend generator can apply
        },
      },
    },
  },
};

// ─── Phase: Load — parse the confirmed epic into a build-order worklist ───
phase("Load");
// args: "<feature>" — or "<feature> <track>" / "<feature>:<track>" to FORCE the start track for that
// feature even if the checklist already marks those stages complete (overrides the checklist-derived
// startTrack; e.g. re-run the frontend track to regenerate UI). Track ∈ pre-dev|backend|frontend|deployment.
// Asking for a track the feature does not have (frontend on a backend-only feature, backend on a frontend-only one) starts from its
// first track instead — the loop resolves the name against THAT feature's track list, never an index.
const _argStr = (typeof args === "string" && args.trim()) || "";
const _argParts = _argStr.split(/[\s:]+/).filter(Boolean);
const START_FEATURE = _argParts[0] || "";
const _validTracks = ["pre-dev", "backend", "frontend", "deployment"];
const START_TRACK_OVERRIDE = _validTracks.includes(_argParts[1]) ? _argParts[1] : "";

// Run-scoped cleanup: a KILLED prior run can leave gate sentinels/retry counts behind in .claude/
// (stale .e2e-gate / AWAITING_VERDICT → resumed gate skips the suite; stale retry history → stops
// early). Wipe them once here so resume is driven purely by durable artifacts (checklist.md + git),
// never by leftover ephemeral gate state. Script can't run from the JS sandbox, so an actuator does it.
await agent(
  "Run `bash .claude/scripts/reset-gates.sh` exactly as written (it is allow-listed). " +
    "It removes leftover run-scoped gate sentinels/retry dotfiles so a resumed vibe run starts clean. " +
    "Return a one-line result.",
  { label: "reset-gates", phase: "Load", model: "sonnet", effort: "medium" },
);

const plan = await agent(
  "## Vibe loader\n\n" +
    "Read `epic.md` and `checklist.md` from the project root and produce the build-order feature worklist.\n\n" +
    "## Rules\n" +
    '1. If `epic.md` is missing or has no Features table, return features: [] and startId: "" (the workflow will abort with the plan-epic message).\n' +
    "2. Record whether `.claude/tech-stack-profile.md` exists.\n" +
    "3. List every feature with its id (F-1, F-2, …), checklist slug name, status, surface, and build-order index.\n" +
    "   - status: done = header `· ✅ Done`; drift = `· ⚠️ DRIFT — needs review`; in-progress = `· In Progress`; planned = `· Planned`.\n" +
    "   - surface: the `Surface` column of the epic.md Features table — `backend-only` (the feature has no UI: the frontend track and the live-evaluation gate do not apply), `frontend-only` (the feature drives an API that already exists: the backend track does not apply), or `full`. " +
    "A MISSING column, a blank cell, or any unrecognized value reads as `full` — older epics predate the column and every one of their features has both a UI and a backend. " +
    "Corroborate with `checklist.md`: a feature whose Frontend Track stages are pre-ticked `_(N/A — backend-only)_`, or whose header is suffixed `· backend-only`, is `backend-only` even if the epic.md cell is blank; likewise Backend Track stages pre-ticked `_(N/A — frontend-only)_` / a `· frontend-only` header suffix mean `frontend-only`. " +
    "If epic.md says `backend-only` but the checklist's frontend stages are plain unticked `[ ]` (or `frontend-only` with unticked backend stages, or vice versa), trust **epic.md** — it is the plan of record — and note the disagreement in your summary.\n" +
    '4. haltDriftId: the FIRST feature (build order) whose status is drift, else "". A pre-existing DRIFT is the user\'s call — the epic must not advance past it.\n' +
    "5. startId: " +
    (START_FEATURE
      ? "the user asked to start at '" +
        START_FEATURE +
        "' — use it if it exists" +
        (START_TRACK_OVERRIDE
          ? " EVEN IF its status is done (the user is forcing a re-run from the '" +
            START_TRACK_OVERRIDE +
            "' track).\n"
          : ", and is not done.\n")
      : "the FIRST feature in build order whose status is NOT done (skip done ones).\n") +
    '   If every feature is done, startId: "".\n' +
    "6. startTrack: for startId, the track owning the FIRST still-unchecked stage in `checklist.md` — map stages to tracks: pre-dev = Stages 1–8, backend = 9–14, frontend = Stages 15–25 PLUS the `Stage 25.5 · Live Evaluation Gate` (the evaluator is part of the frontend phase for resume), deployment = 26–28. " +
    'A fully-planned (untouched) feature → "pre-dev". If startId is "", startTrack: "". ' +
    "So if 15–25 are `[x]` but `Stage 25.5` is `[ ]` (the evaluator has not PASSed yet — e.g. resuming after an EVAL halt), startTrack = \"frontend\": vibe re-enters the frontend track (its 15–25 are already done, so it returns at once) and the evaluator re-runs, instead of skipping straight to deployment. " +
    "IMPORTANT — older checklists may have NO `Stage 25.5` line at all (generated before the eval gate existed). Treat a MISSING `Stage 25.5` line exactly like an unticked one: if 15–25 are `[x]` and there is no `Stage 25.5` line, the evaluator has not run → startTrack = \"frontend\" (the workflow inserts the line when the evaluator next clears). Never let a missing line skip evaluation.\n" +
    "EXCEPTION — a `backend-only` startId has no frontend track: never return startTrack = \"frontend\" for it. Its Stages 15–25 / 25.5 are N/A (pre-ticked, or absent on an older checklist), so skip that whole range when finding the first unchecked stage — if backend (9–14) is complete, startTrack = \"deployment\". " +
    "Symmetrically, a `frontend-only` startId has no backend track: never return startTrack = \"backend\" for it. Its Stages 9–14 are N/A (pre-ticked), so skip that range — if pre-dev (1–8) is complete, startTrack = \"frontend\" (and the Stage 25.5 rules above apply to it unchanged, since it does have a frontend track).\n\n" +
    "Read-only. Do not modify any file. Structured output only.",
  {
    label: "load",
    phase: "Load",
    schema: FEATURE_LIST_SCHEMA,
    model: "sonnet",
    effort: "medium",
  },
);

if (!plan)
  return { error: "Loader returned nothing — cannot read the epic plan." };
if (plan.haltDriftId) {
  return {
    halted: true,
    reason: "DRIFT",
    feature: plan.haltDriftId,
    message:
      "Feature " +
      plan.haltDriftId +
      " is marked DRIFT — the plan and the build disagree. Resolve it (see artifacts/" +
      plan.haltDriftId +
      "/11-conformance-report.md) before resuming. Resume the autonomous run with `/vibe-workflow` (the deterministic loop) — NOT `/vibe`.",
  };
}
if (!plan.features.length || !plan.startId) {
  return {
    halted: !plan.features.length,
    message: !plan.features.length
      ? 'No epic plan found. Run `/project:plan-epic "<your product idea>"` first, confirm it, then run `/vibe-workflow`.'
      : "All features are already · ✅ Done — epic complete. Nothing to build.",
    epic: plan.epicName,
  };
}
if (!plan.techProfileExists) {
  return {
    error:
      "Missing .claude/tech-stack-profile.md — run /project:create-tech-stack-profile once, then resume with `/vibe-workflow` (all pipeline skills require the profile).",
  };
}

// Build-order worklist: from startId onward, planned/in-progress only, sorted by order.
// Exception: a forced track override keeps the start feature in the list even if it is done
// (the user is deliberately re-running a completed track for that one feature).
const startOrder = plan.features.find((f) => f.id === plan.startId)?.order ?? 0;
const worklist = plan.features
  .filter(
    (f) =>
      (f.status !== "done" ||
        (START_TRACK_OVERRIDE && f.id === plan.startId)) &&
      f.order >= startOrder,
  )
  .sort((a, b) => a.order - b.order);

log(
  "Epic: " +
    (plan.epicName || "(unnamed)") +
    " — " +
    worklist.length +
    " feature(s) to build, starting at " +
    plan.startId,
);
log("Build order: " + worklist.map((f) => f.id).join(" → "));

// ─── Per-track prompt: each agentType already owns its stage definitions ───
// effort mirrors each agent's own .md frontmatter (the single source of truth for its effort) rather
// than a blanket medium pin — implementation-heavy tracks (backend/frontend/deployment) run at max,
// pre-dev at medium. Still pinned EXPLICITLY here so nothing inherits the launching session's effort.
const TRACKS = [
  {
    type: "pre-dev",
    label: "pre-dev",
    effort: "medium",
    stages:
      "1–8 (requirements → flow → scenarios → test data → test plans → author E2E specs → dev plan)",
  },
  {
    type: "backend",
    label: "backend",
    effort: "max",
    stages:
      "9–14 (seed data → backing service → interfaces → implement → integration → validate)",
  },
  {
    type: "frontend",
    label: "frontend",
    effort: "max",
    stages:
      "15–25 (plain UI → interfaces → service → components → bind → UI tests → beautify → E2E)",
  },
  {
    type: "deployment",
    label: "deployment",
    effort: "max",
    stages: "26–28 (plan deploy → CI/CD config → README → validate)",
  },
];
// eval-fix re-uses the frontend agentType, so it MUST run at the same effort as the frontend track.
const FRONTEND_EFFORT = TRACKS.find((t) => t.type === "frontend").effort;

// ─── Surface — which tracks a feature actually has ───
// `backend-only` (epic.md Surface column) = no UI at all: an API another service consumes, a worker, a
// scheduled job, a webhook receiver. It drops the frontend track AND, with it, the whole Evaluate phase
// (there is nothing to play as a real user).
// `frontend-only` = a UI over an API that ALREADY exists (an earlier feature's backend, another repo's
// service, or a third party behind a Mountebank impostor) with no backend change of its own. It drops
// the backend track; the Evaluate phase still runs because the frontend track does.
// pre-dev and deployment are never optional — every surface keeps them, and the conformance gate after.
// Anything unrecognized — including a missing column on an epic drafted before Surface existed — reads
// as "full", so the optionality can never silently swallow a UI or a backend. Everything downstream
// reads the per-feature `tracks` array, never the global TRACKS.
const isBackendOnly = (feature) => feature.surface === "backend-only";
const isFrontendOnly = (feature) => feature.surface === "frontend-only";
const surfaceOf = (feature) =>
  isBackendOnly(feature) ? "backend-only" : isFrontendOnly(feature) ? "frontend-only" : "full";
const skippedTrackFor = (feature) =>
  isBackendOnly(feature) ? "frontend" : isFrontendOnly(feature) ? "backend" : "";
const tracksFor = (feature) => {
  const skipped = skippedTrackFor(feature);
  return skipped ? TRACKS.filter((t) => t.type !== skipped) : TRACKS;
};

const trackPrompt = (track, feature, isRespawn, resumeFrom) =>
  "## VIBE MODE — autonomous, no pauses\n\n" +
  "Build the **" +
  track.label +
  "** track (Stages " +
  track.stages +
  ") for feature **" +
  feature.name +
  "** (" +
  feature.id +
  ").\n\n" +
  "## Rules\n" +
  (isBackendOnly(feature)
    ? "- **Surface: backend-only** — this feature has NO UI. The frontend track and the live-evaluation gate are not part of this run at all, and the **Bruno API suite is the acceptance contract in place of the Playwright E2E suite**. Stages 5 / 7.5 / 15–25 / 25.5 are already `[x] _(N/A — backend-only)_` in `checklist.md`: leave those ticks alone, and produce no `05-ui-test-plan.md`, no Playwright specs under `e2e/`, and no UI code. Do NOT build frontend work \"for later\" — the next track after backend is deployment. If the requirements you read clearly describe a screen, that contradicts the plan: record it under `Blockers` in track-handoffs.md and stop rather than deciding it yourself.\n"
    : isFrontendOnly(feature)
      ? "- **Surface: frontend-only** — this feature is a UI over an API that ALREADY exists (an earlier feature's backend, another service, or a third party behind a Mountebank impostor). The backend track is not part of this run at all: Stages 9–14 are already `[x] _(N/A — frontend-only)_` in `checklist.md` — leave those ticks alone, and produce no entities, endpoints, Liquibase changesets, or `08-backend-report.md`. The next track after pre-dev is frontend, then deployment. The Playwright E2E suite stays the acceptance contract; Stage 6/7 describe the CONSUMED API's contract as the impostor the UI is built against, not a backend to build. If the requirements you read need even one new endpoint, field, or migration, that contradicts the plan: record it under `Blockers` in track-handoffs.md and stop rather than building backend work yourself.\n"
      : "") +
  '- Ignore every `Ask:`, "type continue", and "review and edit" instruction — run every stage and proceed.\n' +
  "- ALL artifacts for this feature live in `artifacts/" +
  feature.id +
  "/` — every `artifacts/{feature}` or `artifacts/{feature-name}` path in any stage skill resolves to that EXACT directory. NEVER build an artifacts path from the feature NAME/title: titles may contain `/` (a path separator) and would create broken nested directories.\n" +
  "- Read `artifacts/" +
  feature.id +
  "/track-handoffs.md` for all prior tracks' context, then APPEND your own section when done.\n" +
  "- Consult `.claude/tech-stack-profile.md` to translate generic layer names to this project's concrete tech.\n" +
  "- Tick a stage `[x]` in `checklist.md` ONLY AFTER that stage's own verification has actually" +
  " SUCCEEDED — its tests/build executed and reported GREEN this run. Code merely written, a test" +
  " merely authored, or specs merely discovered/collected (`--list`) do NOT count as passing. Never" +
  " tick on an assumption or a stale earlier result; if you did not just see it pass, leave it" +
  " unchecked so the workflow resumes and finishes it.\n" +
  "- Do NOT run git — a separate committer handles commits/PRs.\n" +
  "- Honor the Fix Budget (.claude/rules/failure-protocol.md). On a Stop-on-Blocker, record it in track-handoffs.md and return blocker set.\n" +
  (isRespawn
    ? "\n## RESPAWN — INCREMENTAL RESUME (read carefully)\n" +
      "A previous attempt already completed every stage marked `[x]` in `checklist.md`. Those stages are " +
      "DONE and durable — do NOT re-run, re-verify, re-open, or re-confirm them. Re-doing settled stages is " +
      "the #1 reason a respawn runs out of budget and dies at the same tail with zero progress.\n" +
      "- Read `artifacts/" +
      feature.id +
      "/track-handoffs.md` for context, then go STRAIGHT to the first unchecked stage (" +
      (resumeFrom || "the first `[ ]` stage of this track") +
      ") and do ONLY the still-unchecked stages.\n" +
      "- Often the deliverables of the remaining stages were already produced and ONLY the bookkeeping is " +
      "missing (the final `[x]` ticks + the track section in track-handoffs.md). If so, verify the " +
      "deliverable exists, then just tick the box and write the handoff — do not regenerate it.\n"
    : "") +
  "\n## Finishing — MANDATORY (this is itself a step; do NOT end your turn before it)\n" +
  "A track is NOT finished until BOTH are true, even if the substantive work is done: (1) every completed " +
  "stage is `[x]` in `checklist.md`, and (2) your track section is appended to `artifacts/" +
  feature.id +
  "/track-handoffs.md` (record any Stop-on-Blocker under a `Blockers` heading). Do this checkoff + handoff " +
  "write as your final action — tail-truncating here (stopping after the work but before the boxes/handoff) " +
  "forces a wasteful respawn. Only tick a stage you actually completed/verified GREEN this run; a failing or " +
  "unverified stage stays unchecked. Then return a brief plain-text summary — the workflow reads the artifacts, not your message.";

// Thin status reader — runs AFTER the heavy track agent. Its ONLY job is to read the artifacts the
// track wrote and emit TRACK_SCHEMA. A single-purpose fresh-context agent reliably calls
// StructuredOutput, whereas a 30-min multi-stage agentType agent ends per its own prompt and skips it.
const trackStatusPrompt = (track, feature) =>
  "## Track status reader (READ-ONLY — do no track work)\n\n" +
  "The **" +
  track.label +
  "** track (Stages " +
  track.stages +
  ") for feature **" +
  feature.name +
  "** (" +
  feature.id +
  ") just ran. Determine its status purely from the artifacts it left behind.\n\n" +
  "1. Read `checklist.md`: are ALL of this track's stages (" +
  track.stages +
  ") marked `[x]` for " +
  feature.name +
  "?\n" +
  "2. Read `artifacts/" +
  feature.id +
  "/track-handoffs.md`. Set `blocker` ONLY to the text of a GENUINE, unresolved Stop-on-Blocker that PREVENTED this track from finishing its stages. A `Blockers` HEADING is NOT itself a blocker: tracks routinely write `Blockers: None` followed by documented NON-blocking findings (known limitations, accepted test-design gaps, notes for a later track). Return blocker=\"\" when the section says None / is empty, when it only documents findings marked non-blocking, or when this track completed ALL its stages (a completed track has no blocker by definition). Only an actual stop that left work unfinished → a non-empty blocker.\n" +
  "3. In that same `Blockers` section, look for a `Gate Verdict:` line (a test gate hit its limit and asked the track to decide):\n" +
  "   - `Gate Verdict: CONTINUE — <hypothesis>` → gateVerdict=\"CONTINUE\", gateHypothesis=<the hypothesis text>.\n" +
  "   - `Gate Verdict: HALT — <reason>` → gateVerdict=\"HALT\", gateHypothesis=<the reason>.\n" +
  "   - A test-gate Blocker exists but NO explicit `Gate Verdict:` line → default gateVerdict=\"HALT\" (safest).\n" +
  "   - No test-gate handshake at all → gateVerdict=\"\".\n\n" +
  "Return: complete (true only if every one of this track's stages is `[x]`), a 1-3 line summary of what the track produced, " +
  "blocker (per step 2: a real unresolved Stop-on-Blocker's text, else empty — NEVER populated from a `Blockers: None` note or a documented non-blocking finding), firstUnchecked (first still-unchecked stage id of this track, else \"\"), " +
  "gateVerdict (\"HALT\" | \"CONTINUE\" | \"\" per above), gateHypothesis (the hypothesis/reason text, else \"\"). " +
  "Modify nothing. Structured output only.";

// respawn-once per develop.md: if a track returns incomplete (maxTurns / interrupted) but not a
// hard blocker, give it ONE fresh context to finish. Null result (user-skip / agent death) or a
// blocker, or still-incomplete after respawn → halt the epic.
async function runTrack(track, feature) {
  // Layer-1 note (stall-timeout alignment): the agent() API exposes no per-agent no-progress /
  // stall-timeout option, so we CANNOT raise the supervisor's stall budget from this script to
  // match the e2e-gate hook's own 1200s timeout. The collision (a slow cold-start E2E vs a shorter
  // supervisor stall window) is instead defused at the source — the e2e-gate runs feature-scoped
  // only and defers full regression under vibe (.vibe-active marker), so the gate finishes fast.
  //
  // 1. Heavy agent does the stages. NO schema — its agentType prompt ends by writing
  //    track-handoffs.md + ticking checklist.md, so forcing a trailing StructuredOutput call
  //    is unreliable (it considers itself done and skips it). Its prose return is ignored.
  await agent(trackPrompt(track, feature, false), {
    agentType: track.type,
    label: track.type + ":" + feature.id,
    phase: "Build",
    effort: track.effort,
  });
  // 2. Thin reader extracts structured status from the artifacts (reliable StructuredOutput).
  let r = await agent(trackStatusPrompt(track, feature), {
    label: track.type + ":" + feature.id + ":status",
    phase: "Build",
    schema: TRACK_SCHEMA,
    model: "sonnet",
    effort: "medium",
  });
  // Gate-verdict handshake: at a test gate's terminal point (cycle/cap) the agent records a
  // `Gate Verdict` in track-handoffs.md. CONTINUE (with a NEW hypothesis) buys exactly ONE more
  // bounded round — the gate's own cycle-detection still prevents thrash. HALT, or a 2nd CONTINUE,
  // surfaces as a blocker so the main loop halts + pings Slack.
  if (r && r.gateVerdict === "CONTINUE") {
    log(
      feature.id +
        "/" +
        track.label +
        ": gate verdict CONTINUE — one more bounded round: " +
        (r.gateHypothesis || "(no hypothesis given)"),
    );
    await agent(
      trackPrompt(track, feature, true, r.firstUnchecked) +
        "\n\n## Gate Verdict CONTINUE — the test gate was retried to its limit\n" +
        "New root-cause hypothesis to try THIS round: " +
        (r.gateHypothesis || "see the Gate Verdict line in track-handoffs.md") +
        "\nApply it and make the failing tests pass. This is the ONE extra round — if the same " +
        "failure recurs the gate stops immediately and the epic halts for the user.",
      {
        agentType: track.type,
        label: track.type + ":" + feature.id + ":gate-continue",
        phase: "Build",
        effort: track.effort,
      },
    );
    r = await agent(trackStatusPrompt(track, feature), {
      label: track.type + ":" + feature.id + ":status-gc",
      phase: "Build",
      schema: TRACK_SCHEMA,
      model: "sonnet",
      effort: "medium",
    });
    // No second extension: any verdict still present after the extra round is terminal.
    if (r && r.gateVerdict) {
      r.blocker =
        r.blocker ||
        "Gate Verdict " +
          r.gateVerdict +
          " after one extension — " +
          (r.gateHypothesis || "unresolved test-gate failure");
    }
  } else if (r && r.gateVerdict === "HALT") {
    r.blocker =
      r.blocker || "Gate Verdict HALT — " + (r.gateHypothesis || "unresolved test-gate failure");
  }

  // Respawn-WHILE-PROGRESS: a track that does the work but tail-truncates (ends after the substantive
  // stages but before the final `[x]` ticks + handoff write) comes back incomplete. With incremental
  // resume the respawn skips settled `[x]` stages and pushes the tail forward. Keep respawning as long
  // as each respawn ADVANCES the first-unchecked stage (real progress); stop the moment a respawn makes
  // NO progress (genuinely stuck → let the caller halt) or the cap is hit. This auto-ratchets through
  // per-track tails in one workflow run instead of halting after a single respawn and forcing the user
  // to re-launch once per tail.
  const RESPAWN_CAP = 4;
  let respawns = 0;
  while (r && !r.complete && !r.blocker && !r.gateVerdict && respawns < RESPAWN_CAP) {
    const before = r.firstUnchecked || "";
    respawns++;
    log(
      feature.id +
        "/" +
        track.label +
        ": incomplete — respawn " +
        respawns +
        "/" +
        RESPAWN_CAP +
        " from " +
        (before || "first unchecked"),
    );
    await agent(trackPrompt(track, feature, true, r.firstUnchecked), {
      agentType: track.type,
      label: track.type + ":" + feature.id + ":respawn" + respawns,
      phase: "Build",
      effort: track.effort,
    });
    r = await agent(trackStatusPrompt(track, feature), {
      label: track.type + ":" + feature.id + ":status" + (respawns + 1),
      phase: "Build",
      schema: TRACK_SCHEMA,
      model: "sonnet",
      effort: "medium",
    });
    // No progress — the same stage is still first-unchecked → a further respawn would just re-die at
    // the same tail. Stop ratcheting and let the caller halt on !complete.
    if (r && !r.complete && !r.blocker && (r.firstUnchecked || "") === before) {
      log(
        feature.id +
          "/" +
          track.label +
          ": respawn made no progress (stuck at " +
          (before || "first unchecked") +
          ") — stopping respawns",
      );
      break;
    }
  }
  return r;
}

// committer: the ONLY actor that runs git. Branches stack (F-2 created off F-1's tip) so build-order
// shared entities are present without merging. commit+push per track; after every track that changed
// runnable code the branch is merged into `develop` (= dev-env deploy, .claude/rules/git-flow.md); the
// PR to the release branch is opened once, at the last track. A develop-merge conflict is aborted and
// reported (devMerged=false), never resolved by the agent.
const commitPrompt = (feature, trackLabel, opts) =>
  "## Committer (git only)\n\n" +
  "Feature **" +
  feature.name +
  "** (" +
  feature.id +
  "), after the **" +
  trackLabel +
  "** track.\n\n" +
  (opts.createBranch
    ? "1. Get onto branch `feat/" +
      feature.name +
      "`: if it already exists (a prior run started this feature), check it out; otherwise create it off the CURRENT HEAD (do NOT switch to main first — branches stack so this feature sees the prior feature's entities). Skip if already on it.\n"
    : "") +
  "2. Stage ONLY this track's files (never `git add .`). Commit: `feat(" +
  feature.name +
  "): " +
  trackLabel +
  " track — <one-line>`.\n" +
  "3. Push: `git push -u origin feat/" +
  feature.name +
  "`.\n" +
  (opts.mergeDevelop
    ? "3b. Merge into `develop` — this IS the dev-env deploy (`.claude/rules/git-flow.md`). One command per Bash call, in this order: `git fetch origin` → `git checkout -B develop origin/develop` → `git merge --no-ff feat/" +
      feature.name +
      ' -m "merge(feat/' +
      feature.name +
      "): into develop for dev testing\"` → `git push origin develop` → `git checkout feat/" +
      feature.name +
      "`. ALWAYS finish back on `feat/" +
      feature.name +
      "` — the next track's commit must not land on develop. If the merge CONFLICTS: `git merge --abort`, `git checkout feat/" +
      feature.name +
      '`, then `bash .claude/scripts/notify-slack.sh "⚠️ vibe: feat/' +
      feature.name +
      " merge into develop conflicted — dev deploy skipped, needs a human\"`, set devMerged=false with the conflicting paths in error, and CONTINUE (still open the PR if this is the PR step). Never resolve the conflict yourself; never merge develop into the feature branch.\n"
    : "") +
  (opts.openPR
    ? '4. Open the feature PR (once) via the GitHub MCP tool `create_pull_request` (load it with ToolSearch "+github pull request" if needed; NEVER `gh pr create` — GitHub-side gh commands are deny-listed and bash-lint blocks them): title "feat(' +
      feature.name +
      '): ' +
      (opts.surface === "backend-only"
        ? "backend-only feature"
        : opts.surface === "frontend-only"
          ? "frontend-only feature"
          : "full feature") +
      '". Body in the standard bullet format (see templates/pr-body.md), three lines: `- Problem:` one line summarizing artifacts/' +
      feature.name +
      '/01-requirements.md; `- Solution:` one line summarizing the approach in artifacts/' +
      feature.name +
      '/07-development-plan.md; `- Change:` "' +
      (opts.surface === "backend-only"
        ? "backend-only feature (no UI) — backend + Bruno API suite green"
        : opts.surface === "frontend-only"
          ? "frontend-only feature (no backend change) — frontend + E2E green against the existing API"
          : "full feature — backend + frontend + E2E green") +
      ", see artifacts/" +
      feature.name +
      "/.\"; add a fourth line `- Dev:` saying whether the branch is merged into develop (or that the merge conflicted and is pending a human). Base it on the prior feature's branch if one exists, else the RELEASE branch — the repo default (`main` or `master`; read it once from `git symbolic-ref refs/remotes/origin/HEAD`). NEVER base a PR on develop. If a PR for this branch already exists (resume), skip creation and return its existing URL. If the GitHub MCP is not connected, do not retry gh — leave prUrl empty and note it in error. Return prUrl.\n"
    : "") +
  "Never force-push. Never commit on develop or on main/master. Never merge develop into the feature branch. Return ok, sha, " +
  (opts.mergeDevelop ? "devMerged, " : "") +
  (opts.openPR ? "prUrl, " : "") +
  "error. Structured output only.";

async function commit(feature, trackLabel, opts) {
  const r = await agent(commitPrompt(feature, trackLabel, opts), {
    label: "git:" + feature.id + ":" + trackLabel,
    phase: "Commit",
    schema: COMMIT_SCHEMA,
    model: "sonnet",
    effort: "medium",
  });
  if (!r || !r.ok)
    log(
      feature.id +
        "/" +
        trackLabel +
        ": commit issue — " +
        (r?.error || "no result") +
        " (continuing; git is non-fatal)",
    );
  else {
    // develop merge is the dev deploy; a conflict is aborted by the committer and needs a human.
    if (opts.mergeDevelop && r.devMerged === false)
      log(
        feature.id +
          "/" +
          trackLabel +
          ": merge into develop conflicted — dev deploy skipped, Slack pinged (" +
          (r.error || "no detail") +
          ")",
      );
    if (r.prUrl) log(feature.id + ": PR opened — " + r.prUrl);
  }
  return r;
}

// ─── Evaluate phase — real-user UX/UI evaluator ⇄ frontend convergence loop ───
const EVAL_BUDGET = 4; // evaluate→fix passes per round (raised from 3; Fix-Budget philosophy)
// On exhausting a round with blocker-severity findings still unresolved, an agent decides (like the
// test-gate verdict handshake) whether ANOTHER EVAL_BUDGET round is worth it (CONTINUE) or it should
// notify the user and halt (HALT). EVAL_MAX_EXTENSIONS bounds the CONTINUE choices so it can't run away.
const EVAL_MAX_EXTENSIONS = 4; // ≤ 5 rounds total (1 initial + 4 extensions) = up to 20 passes

// Heavy evaluator: picks its mode from epic.md, drives a live browser via the Playwright + Chrome-
// DevTools MCP servers like a human, and writes the structured findings report. NO schema — like the
// track agents it ends by writing its artifact, so a trailing StructuredOutput call is unreliable.
const evalPrompt = (feature, iteration, isRecheck) =>
  "## Evaluator — play the web as a REAL USER (VIBE MODE)\n\n" +
  "Feature **" +
  feature.name +
  "** (" +
  feature.id +
  "). Evaluation pass " +
  iteration +
  "/" +
  EVAL_BUDGET +
  ".\n\n" +
  "You are the UX/UI evaluator. You do NOT author or run Playwright `.spec` files and you do NOT replace e2e — the Stage 25 suite already passed and remains the deterministic contract. Your job is to USE the running app like a human and judge it.\n\n" +
  "## 0. Time-box & degrade — CRITICAL (never hang the epic)\n" +
  "- Drive the browser ONLY through the Playwright / Chrome DevTools **MCP** tools. NEVER launch Chromium or Playwright directly via Bash — raw Chromium cannot run in this sandbox and will HANG the whole run; only the MCP browser works here.\n" +
  "- Bound every step: bringing up the dev server (`run-eval.sh`) and initializing the MCP browser get at most 2 attempts each; any single navigation / snapshot that stalls or errors gets at most 2 retries — then STOP retrying that path. Never sit waiting on a browser call.\n" +
  "- Degradation ladder when the live browser will not cooperate: (a) MCP-browser walkthrough → (b) if the browser can't initialize, fall back to a STRUCTURAL review (read the rendered markup / built output + the design docs) → (c) if even that is impossible, write the report with a single `minor` finding titled `could not evaluate (environment)` plus what you tried, end with `Verdict: REVISE`, and FINISH.\n" +
  "- A partial or degraded report that lets the epic proceed always beats a stall. A degraded/environment report MUST use only `minor` severity so it never blocks the build.\n\n" +
  "## 1. Pick the mode (read `epic.md` + `artifacts/" +
  feature.id +
  "/` docs first)\n" +
  "- **MIRROR** — the epic/feature entry names a reference frontend source. Stand up BOTH the reference app and the generated app, navigate both to equivalent states, and compare **page-by-page → component-by-component** (use the component IDs in `02-flow.md`) → **computed styles** (color, spacing, font, radius).\n" +
  "- **ACCEPTANCE** — no reference is provided. Stand up ONLY the generated app. Read the acceptance criteria (`01-requirements.md`, `03-scenarios.md`) and the UX/UI design plan (`02-flow.md`, `05-ui-test-plan.md`, design tokens in `.claude/tech-stack-profile.md`). Judge whether a real user's experience satisfies the criteria and the design intent.\n\n" +
  "## 2. Drive like a user (NOT a script)\n" +
  "- Launch dev servers ONLY via `bash .claude/scripts/run-eval.sh` (sandbox-safe). Never start the browser or a dev server any other way.\n" +
  "- Control a live browser through the **Playwright MCP** + **Chrome DevTools MCP** tools: observe (screenshot + accessibility snapshot) → decide → act (click / type / scroll) → observe. Improvise navigation as a person would.\n" +
  "- Screenshots are for YOUR observation, not deliverables — and a bare/relative name writes to the repo ROOT for BOTH browsers. The image is returned to you inline regardless of where the file goes, so prefer NOT naming a file at all: Playwright MCP `browser_take_screenshot` WITHOUT a `filename` auto-saves into the pinned `.playwright-mcp/` dir; Chrome DevTools `take_screenshot` WITHOUT a `filePath` returns inline and writes nothing. If you must name one, prefix it with `.playwright-mcp/` (e.g. `filename: \".playwright-mcp/foo.png\"`) — an explicit bare name like `\"foo.png\"` ignores the output-dir pin and lands at the repo root. NEVER write a screenshot to the repo root.\n" +
  "- When something looks wrong, use Chrome DevTools MCP for console errors, failed network requests, and perf.\n\n" +
  "## 3. Report\n" +
  "Write `artifacts/" +
  feature.id +
  "/evaluator-report.md`: per page → per component, each finding tagged severity (blocker | major | minor) and category (layout | style | behavior | content | a11y), with **expected vs actual** and a concrete **fix** the frontend generator can apply. End with a `Verdict: PASS` (no blocker/major remain) or `Verdict: REVISE` line.\n" +
  (isRecheck
    ? "This is a RE-CHECK after the generator applied fixes — re-verify the prior findings first and drop everything now correct; only report what is still wrong or newly broken.\n"
    : "") +
  "Edit NO source code — you only observe and report; the frontend generator applies fixes. Return a brief plain-text summary; the workflow reads the report.";

// Thin reader — turns the report into EVAL_SCHEMA (reliable StructuredOutput in a fresh context).
const evalStatusPrompt = (feature) =>
  "## Evaluator report reader (READ-ONLY — drive nothing)\n\n" +
  "The UX/UI evaluator just reviewed feature **" +
  feature.name +
  "** (" +
  feature.id +
  "). Read `artifacts/" +
  feature.id +
  "/evaluator-report.md` and extract its result.\n\n" +
  "Return: verdict (PASS only if the report's verdict line says PASS / no blocker or major findings remain; else REVISE), mode (mirror | acceptance, whichever the report used), the findings list (page, component, severity, category, expected, actual, fix), reportPath, and a 1-3 line summary. Modify nothing. Structured output only.";

// Respawn the frontend agent in a narrow fix-only pass against the evaluator's findings.
const evalFixPrompt = (feature) =>
  "## VIBE MODE — frontend evaluator-fix pass (no pauses)\n\n" +
  "Feature **" +
  feature.name +
  "** (" +
  feature.id +
  "). The UX/UI evaluator drove the running app and recorded issues in `artifacts/" +
  feature.id +
  "/evaluator-report.md`.\n\n" +
  "Fix ONLY the findings in that report:\n" +
  "- Address blocker and major findings first; apply each finding's `fix`.\n" +
  "- Do NOT change component IDs or the e2e contract — the Stage 25 Playwright suite MUST stay green (your Stop hooks enforce it).\n" +
  "- This is refinement, not new stages: tick nothing new in `checklist.md`. Re-run the relevant UI tests and keep them green.\n" +
  "- Do NOT run git — the committer handles commits.\n" +
  "Append a short `Evaluator Fixes` note to `artifacts/" +
  feature.id +
  "/track-handoffs.md` listing what you changed. Return a brief plain-text summary.";

// Decision for the eval-budget verdict handshake (mirrors the test-gate CONTINUE/HALT handshake).
const EVAL_VERDICT_SCHEMA = {
  type: "object",
  required: ["decision"],
  properties: {
    decision: { enum: ["CONTINUE", "HALT"] }, // CONTINUE = run another EVAL_BUDGET round; HALT = notify + stop
    reason: { type: "string" },
  },
};

// At eval-budget exhaustion with blocker-severity findings still open, an agent decides whether one
// more EVAL_BUDGET round is worth it — CONTINUE only if blockers are trending down / there's a concrete
// untried fix; HALT if stuck/oscillating/out of ideas (→ notify the user and halt the epic).
const evalVerdictPrompt = (feature, roundsDone, roundsLeft) =>
  "## Eval-budget verdict — decide CONTINUE or HALT\n\n" +
  "Feature **" + feature.name + "** (" + feature.id + ") ran " + roundsDone + " round(s) of " +
  EVAL_BUDGET + " evaluate→fix passes each and STILL has blocker-severity UX/UI findings open. " +
  "Read `artifacts/" + feature.id + "/evaluator-report.md` (latest findings) and the `Evaluator Fixes` " +
  "notes in `artifacts/" + feature.id + "/track-handoffs.md` (what was already tried).\n\n" +
  "- **CONTINUE** — choose ONLY if the blocker count is genuinely trending down across rounds (fixes are " +
  "landing) OR there is a concrete, not-yet-tried fix that would plausibly close the remaining blockers in " +
  "one more round. " + roundsLeft + " extension round(s) remain.\n" +
  "- **HALT** — choose if the findings are stuck, oscillating, or regressing, the same blockers keep " +
  "recurring, or you are out of distinct ideas. This notifies the user and halts the epic for review.\n\n" +
  "Bias toward HALT when uncertain — a wasted extra round is expensive, a human review is cheap. Structured output only.";

// evaluate → (on REVISE) frontend fix → re-evaluate, EVAL_BUDGET passes per round. On exhausting a round
// with blocker(s) still open, a verdict agent decides CONTINUE (another round, ≤ EVAL_MAX_EXTENSIONS) or
// HALT. Returns the last EVAL_SCHEMA report; sets report.evalHalt=true when the run must stop for the user.
// Major/minor-only residue after a round is non-fatal — returns without evalHalt so the caller proceeds.
// null if the evaluator produced nothing (treated as non-fatal — evaluation is additive, not the gate).
async function runEvaluation(feature) {
  let report = null;
  let extensions = 0; // CONTINUE verdicts taken so far (0 = the initial round)
  while (true) {
    for (let it = 1; it <= EVAL_BUDGET; it++) {
      const pass = extensions * EVAL_BUDGET + it;
      await agent(evalPrompt(feature, pass, pass > 1), {
        agentType: "evaluator",
        label: "eval:" + feature.id + ":" + pass,
        phase: "Evaluate",
        effort: "medium",
      });
      report = await agent(evalStatusPrompt(feature), {
        label: "eval:" + feature.id + ":" + pass + ":status",
        phase: "Evaluate",
        schema: EVAL_SCHEMA,
        model: "sonnet",
        effort: "medium",
      });
      if (!report) {
        log(feature.id + ": evaluator produced no report — skipping evaluation (non-fatal)");
        return null;
      }
      if (report.verdict === "PASS") {
        log(feature.id + ": ✅ evaluation PASS (" + report.mode + " mode, pass " + pass + ")");
        return report;
      }
      const blocking = (report.findings || []).filter(
        (f) => f.severity === "blocker" || f.severity === "major",
      ).length;
      log(
        feature.id + ": evaluation REVISE (" + report.mode + ") — " + blocking +
          " blocking/major finding(s), pass " + pass + " (round " + (extensions + 1) + ")",
      );
      // Fix only when a re-evaluation will follow IN THIS round (passes 1…EVAL_BUDGET-1). The LAST
      // pass's fix is deferred to the CONTINUE branch below and run only if another round is granted —
      // so a fix is never applied without a verifying eval after it (no unverified last-pass fix).
      if (it < EVAL_BUDGET) {
        await agent(evalFixPrompt(feature), {
          agentType: "frontend",
          label: "frontend:" + feature.id + ":eval-fix" + pass,
          phase: "Evaluate",
          effort: FRONTEND_EFFORT, // tied to the frontend track's effort — same agentType, same work
        });
      }
    }
    // Round exhausted, still REVISE. Only blocker-severity findings warrant a halt/extension —
    // major/minor residue is non-fatal (caller proceeds, as before).
    const blockers = (report.findings || []).filter((f) => f.severity === "blocker").length;
    if (blockers === 0) {
      log(feature.id + ": evaluation REVISE but no blocker-severity findings remain — proceeding");
      return report;
    }
    if (extensions >= EVAL_MAX_EXTENSIONS) {
      report.evalHalt = true;
      report.evalHaltReason =
        blockers + " blocker finding(s) unresolved after " + (extensions + 1) + " eval rounds (extension cap reached)";
      log(feature.id + ": " + report.evalHaltReason + " — halting for review");
      return report;
    }
    // Blocker(s) remain and extensions left → agent decides CONTINUE another round vs HALT.
    const verdict = await agent(
      evalVerdictPrompt(feature, extensions + 1, EVAL_MAX_EXTENSIONS - extensions),
      {
        label: "eval:" + feature.id + ":verdict" + (extensions + 1),
        phase: "Evaluate",
        schema: EVAL_VERDICT_SCHEMA,
        model: "opus", // verdict gates the epic → opus, like the conformance verdict
        effort: "medium", // token policy: effort pinned to medium on every call
      },
    );
    if (!verdict || verdict.decision === "HALT") {
      report.evalHalt = true;
      report.evalHaltReason = (verdict && verdict.reason) || blockers + " blocker finding(s) unresolved";
      log(feature.id + ": eval verdict HALT — " + report.evalHaltReason);
      return report;
    }
    extensions++;
    log(
      feature.id + ": eval verdict CONTINUE (extension " + extensions + "/" + EVAL_MAX_EXTENSIONS + ") — " +
        (verdict.reason || "another round"),
    );
    // Apply the deferred fix for the round we just finished, BEFORE the next round begins — the next
    // round's first eval verifies it. Keeps the invariant: every fix is followed by an evaluation.
    await agent(evalFixPrompt(feature), {
      agentType: "frontend",
      label: "frontend:" + feature.id + ":eval-fix-continue" + extensions,
      phase: "Evaluate",
      effort: FRONTEND_EFFORT,
    });
  }
}

// ─── Main loop — strictly sequential over features, sequential over tracks ───
const built = []; // one small summary per finished feature; heavy objects dropped at the boundary
let haltInfo = null;

for (let fi = 0; fi < worklist.length; fi++) {
  const feature = worklist[fi];
  log(
    "══ " +
      feature.id +
      " — " +
      feature.name +
      " (" +
      (fi + 1) +
      "/" +
      worklist.length +
      ") ══",
  );

  // No pipeline-state.md checkpoint agent: inside a deterministic workflow there is no session being
  // compacted, so that file has no functional role (resume = resumeFromRunId). A free log() gives the
  // same progress signal in /workflows without spending an agent call.
  // Mid-feature resume: the start feature (fi===0) may have tracks already complete from a prior
  // run — begin at its first incomplete track (from checklist.md, via plan.startTrack) instead of
  // redoing pre-dev/backend. Later worklist features are planned, so they start at pre-dev.
  // A forced track override (args "<feature> <track>") wins for the start feature only — it begins
  // at that track even when the checklist marks its stages complete.
  // The `Stage 25.5 · Live Evaluation Gate` checklist line keeps resume purely checklist-driven: if the
  // evaluator hasn't PASSed, 25.5 is `[ ]`, so the loader returns startTrack="frontend" and we re-enter
  // the frontend track here (it completes at once since 15–25 are `[x]`) and the evaluator re-runs. No
  // separate eval-state read needed — the checklist is the single source of truth.
  // A `backend-only` feature has no frontend track, so every index here is against THIS feature's
  // track list — not the global TRACKS. Resolving the resume/forced track by NAME (not by a fixed
  // 0..3 map) is what keeps that honest: on a backend-only feature "deployment" is index 2, and a
  // requested "frontend" resolves to nothing at all rather than to the deployment slot.
  const tracks = tracksFor(feature);
  if (isBackendOnly(feature))
    log(
      feature.id +
        ": Surface = backend-only — frontend track and live evaluation skipped (Bruno API suite is the acceptance contract)",
    );
  if (isFrontendOnly(feature))
    log(
      feature.id +
        ": Surface = frontend-only — backend track skipped (UI over an existing API; Playwright E2E stays the acceptance contract)",
    );
  const forcedTrack = fi === 0 ? START_TRACK_OVERRIDE : "";
  const wantedTrack = forcedTrack || (fi === 0 ? plan.startTrack : "");
  let startTi = wantedTrack ? tracks.findIndex((t) => t.type === wantedTrack) : 0;
  if (startTi < 0) {
    // The requested track does not exist on this feature (in practice: "frontend" on a backend-only
    // feature or "backend" on a frontend-only one — from stale args or a loader slip). Start from the top rather than silently landing on
    // whatever track happens to occupy that index.
    log(
      feature.id +
        ': requested track "' +
        wantedTrack +
        '" does not exist on this feature (tracks: ' +
        tracks.map((t) => t.label).join(", ") +
        ") — starting from " +
        tracks[0].label,
    );
    startTi = 0;
  }
  log(
    feature.id +
      ": next stage = " +
      tracks[startTi].label +
      (forcedTrack
        ? " (FORCED via args — re-running even if checklist-complete)"
        : startTi > 0
          ? " (resuming — earlier tracks already complete in checklist.md)"
          : ""),
  );

  let trackResults = [];
  let aborted = false;
  let ranAnyTrack = false; // false until the first track we actually run this feature

  for (let ti = startTi; ti < tracks.length; ti++) {
    const track = tracks[ti];
    const r = await runTrack(track, feature);

    // Halt on a track that did not COMPLETE (a real Stop-on-Blocker leaves stages
    // unchecked) or a terminal test-gate HALT — NOT on the mere presence of `blocker`
    // text. A completed track that only DOCUMENTED a non-blocking finding under a
    // `Blockers` heading must proceed; trusting blocker-text alone false-halted the
    // epic repeatedly (a `Blockers: None …` note read as a stop). `blocker` is still
    // used below purely as the human-readable reason when the track is genuinely stuck.
    if (!r || !r.complete || r.gateVerdict === "HALT") {
      const why = !r
        ? "track agent returned nothing (skipped/died)"
        : r.blocker
          ? "Stop-on-Blocker: " + r.blocker
          : "track still incomplete after respawn-once";
      haltInfo = {
        halted: true,
        reason: "BLOCKER",
        feature: feature.id,
        track: track.label,
        detail: why,
        message:
          feature.id +
          "/" +
          track.label +
          " halted the epic — " +
          why +
          ". See artifacts/" +
          feature.id +
          "/track-handoffs.md (Blockers).",
      };
      aborted = true;
      break;
    }

    log(feature.id + "/" + track.label + ": ✓ " + r.summary);
    trackResults.push({ track: track.label, summary: r.summary });

    // After the frontend track (UI built, e2e green): play the app as a real user and converge.
    let evalReport = null;
    if (track.type === "frontend") {
      phase("Evaluate");
      evalReport = await runEvaluation(feature);
      if (evalReport)
        trackResults.push({
          track: "evaluate",
          summary:
            evalReport.verdict +
            " (" +
            evalReport.mode +
            "): " +
            (evalReport.summary || ""),
        });
      // Tick the Stage 25.5 eval-gate box whenever the evaluator CLEARED (PASS, or non-fatal
      // major/minor residue we proceed past) — i.e. anything but an EVAL halt. The box is the durable,
      // checklist-native signal: an EVAL halt leaves it `[ ]`, so a resume re-enters the frontend track
      // and re-runs the evaluator (see the loader's startTrack rule). Runs before the commit so the
      // frontend commit captures the tick. (script can't edit files — an actuator does it.)
      if (evalReport && !evalReport.evalHalt) {
        await agent(
          "In `checklist.md`, under feature **" +
            feature.name +
            "** (" +
            feature.id +
            "), mark the live-evaluation gate done — the evaluator gate cleared this run.\n" +
            "- If a `Stage 25.5 · Live Evaluation Gate` line exists for this feature, tick it `[x]`.\n" +
            "- If it does NOT exist (older checklist generated before the eval gate), INSERT it as " +
            "`- [x] Stage 25.5 · Live Evaluation Gate _(evaluator ran & cleared)_` immediately AFTER this " +
            "feature's `Stage 25 · Run E2E Integration` line, so the checklist self-heals. Do NOT label it " +
            "`N/A` — the evaluator actually ran this round (that is why this step is firing).\n" +
            "Change nothing else in the file. Return one line.",
          { label: "eval-tick:" + feature.id, phase: "Evaluate", model: "sonnet", effort: "medium" },
        );
      }
    }

    // commit+push this track; merge into develop (dev deploy) after every track that changed runnable
    // code — pre-dev only adds the failing-by-design e2e contract, nothing to deploy; open the PR on the
    // last track only. For the frontend track this runs AFTER the evaluation loop so the commit also
    // captures any evaluator-driven fixes.
    await commit(feature, track.label, {
      createBranch: !ranAnyTrack, // first track actually run (fresh pre-dev, or the resume track)
      mergeDevelop: track.type !== "pre-dev",
      openPR: ti === tracks.length - 1, // LAST track this feature actually has — on a backend-only
      // feature that is deployment at index 2, not TRACKS.length-1 (which would never be reached, so
      // the feature would finish with no PR at all).
      surface: feature.surface,
    });
    ranAnyTrack = true;

    // runEvaluation already ran its verdict handshake (CONTINUE another EVAL_BUDGET round vs HALT). It
    // sets evalHalt ONLY after the budget + extensions are exhausted and the verdict agent chose to stop
    // — that halts the epic for the user (same philosophy as a conformance DRIFT). Any other REVISE
    // (major/minor residue, or blockers the agent judged not worth halting for) is logged and proceeds.
    if (evalReport && evalReport.evalHalt) {
      const rp =
        evalReport.reportPath ||
        "artifacts/" + feature.id + "/evaluator-report.md";
      haltInfo = {
        halted: true,
        reason: "EVAL",
        feature: feature.id,
        reportPath: rp,
        message:
          feature.id +
          " halted at UX/UI evaluation — " +
          (evalReport.evalHaltReason || "blocker-severity findings remain") +
          " (" +
          (evalReport.mode || "?") +
          " mode). See " +
          rp +
          ".",
      };
      aborted = true;
      break;
    } else if (evalReport && evalReport.verdict === "REVISE") {
      log(
        feature.id +
          ": evaluation left non-blocking findings — proceeding (see artifacts/" +
          feature.id +
          "/evaluator-report.md)",
      );
    }
  }

  if (aborted) break;

  // ─── Verify gate — conformance only (chosen design) ───
  phase("Verify");
  // 1. Conformance gate runs as its full agentType (no schema). It writes the report, flips the
  //    checklist header, updates app CLAUDE.md, and pings Slack — all per its own prompt.
  await agent(
    "## Epic-conformance gate (VIBE MODE)\n\n" +
      "The full pipeline for feature **" +
      feature.name +
      "** (" +
      feature.id +
      ") just finished. Verify the delivered feature still matches its `epic.md` entry.\n\n" +
      "- CONFORMANT → mark the feature header `· ✅ Done` in checklist.md, append the `## Feature " +
      feature.id +
      " — DONE` memory section to the app CLAUDE.md, notify Slack that " +
      feature.id +
      " finished.\n" +
      "- DRIFT → mark `· ⚠️ DRIFT — needs review`, ping Slack, and the run will halt for the user.\n" +
      "Write `artifacts/" +
      feature.id +
      "/11-conformance-report.md`. The workflow reads your verdict from the checklist header + report, " +
      "so just complete those updates and return a brief plain-text summary.",
    {
      agentType: "epic-conformance",
      label: "conformance:" + feature.id,
      phase: "Verify",
      effort: "medium",
    },
  );
  // 2. Thin reader extracts the verdict from the artifacts (reliable StructuredOutput).
  //    On OPUS (not the cheap-reader tier): this is the only reader that gates the WHOLE epic —
  //    a DRIFT verdict halts the run, and a header/report disagreement needs real judgment.
  const verdict = await agent(
    "## Conformance verdict reader (READ-ONLY)\n\n" +
      "The epic-conformance gate for feature **" +
      feature.name +
      "** (" +
      feature.id +
      ") just ran. Read `checklist.md` and `artifacts/" +
      feature.id +
      "/11-conformance-report.md` and report the verdict it recorded:\n" +
      "- feature header `· ✅ Done` → CONFORMANT.\n" +
      "- feature header `· ⚠️ DRIFT — needs review` → DRIFT.\n" +
      "If the report and header disagree, trust the report. Return verdict, reason (1-2 lines), reportPath. " +
      "Modify nothing. Structured output only.",
    {
      label: "conformance:" + feature.id + ":verdict",
      phase: "Verify",
      schema: VERDICT_SCHEMA,
      model: "opus",
      effort: "medium",
    },
  );

  if (!verdict || verdict.verdict === "DRIFT") {
    haltInfo = {
      halted: true,
      reason: "DRIFT",
      feature: feature.id,
      reportPath:
        verdict?.reportPath ||
        "artifacts/" + feature.id + "/11-conformance-report.md",
      message:
        feature.id +
        " drifted from the epic plan — " +
        (verdict?.reason || "see the conformance report") +
        ". The plan and the build disagree; that is your call. Backing services left UP for review.",
    };
    break;
  }

  log(feature.id + ": ✅ Done (conformant) — " + (verdict.reason || ""));
  built.push({
    id: feature.id,
    name: feature.name,
    surface: surfaceOf(feature),
    trackCount: tracks.length,
    tracks: trackResults.map((t) => t.track),
  });
  // boundary: trackResults goes out of scope next iteration — only the tiny `built` summary survives.
}

// ─── Halt path — surface and stop; leave services up so the user can review ───
if (haltInfo) {
  // Deterministic Slack on ANY halt. The per-feature conformance ping is prompt-driven and only
  // fires at the conformance gate, so a BLOCKER or EVAL halt (or a died conformance/verdict agent)
  // would otherwise stop the run SILENTLY. A workflow script can't run bash, so a tiny agent runs
  // the allow-listed notify-slack.sh. On a genuine DRIFT this may double with the agent's own ping —
  // a duplicate alert is strictly safer than a silent halt, and notify-slack.sh no-ops if the
  // webhook is unconfigured.
  await agent(
    "Run these two commands (each exactly as written), then return the notify command's one-line stdout:\n" +
      '1. bash .claude/scripts/notify-slack.sh "🛑 vibe halted — ' +
      haltInfo.reason +
      " on " +
      haltInfo.feature +
      ": " +
      haltInfo.message.replace(/"/g, "'").replace(/\n/g, " ") +
      " — resume the autonomous run with /vibe-workflow (the deterministic loop), NOT /vibe." +
      '"\n' +
      "2. bash .claude/scripts/reset-gates.sh done   (clears the .vibe-active marker so a later manual `develop` run gets full E2E regression again)",
    { label: "halt-notify:" + haltInfo.feature, phase: "Verify", model: "sonnet", effort: "low" },
  );
  return {
    epic: plan.epicName,
    built: built.map((b) => b.id),
    ...haltInfo,
    // Resume the deterministic loop, never the prompt-driven /vibe (which does one feature and can drop
    // the self-re-invocation). vibe-continue/`/vibe` is the legacy path; this Workflow IS long-horizon.
    resumeWith: "/vibe-workflow",
    stats: { featuresPlanned: worklist.length, featuresBuilt: built.length },
  };
}

// ─── Done — every feature conformant. Tear down (script can't run bash, so an agent does it). ───
phase("Done");
await agent(
  "Run these two commands, then return a one-line result:\n" +
    "1. `docker compose -f docker-compose.backing-service.yml down` (skip silently if the file does not exist) — finished stacks lingering in Docker Desktop's small VM have OOM-killed it on long runs.\n" +
    "2. `bash .claude/scripts/reset-gates.sh done` — clears the .vibe-active marker so a later manual `develop` run gets full E2E regression again.",
  { label: "teardown", phase: "Done", model: "sonnet", effort: "medium" },
);

return {
  epic: plan.epicName,
  goal: plan.epicGoal,
  complete: true,
  message:
    "Epic complete — all " +
    built.length +
    " feature(s) built, validated, and confirmed conformant with the plan.",
  featuresDelivered: built.map(
    (b) =>
      b.id +
      " (" +
      b.name +
      (b.surface !== "full" ? ", " + b.surface : "") +
      ")",
  ),
  buildOrder: built.map((b) => b.id).join(" → "),
  stats: {
    featuresBuilt: built.length,
    backendOnlyFeatures: built.filter((b) => b.surface === "backend-only")
      .length,
    frontendOnlyFeatures: built.filter((b) => b.surface === "frontend-only")
      .length,
    tracksPerFeature:
      TRACKS.length + " (backend-only / frontend-only features: " + (TRACKS.length - 1) + ")",
    evaluatorPassesPerFeature:
      "1-" + EVAL_BUDGET * (1 + EVAL_MAX_EXTENSIONS) + " (EVAL_BUDGET/round × up to " + (1 + EVAL_MAX_EXTENSIONS) + " rounds; + a fix each, + a verdict agent per extension)",
    // Base count excludes the variable Evaluate phase (evaluator + reader pairs per pass, a frontend
    // fix per REVISE, and a verdict agent at each round boundary) added per feature after the frontend track.
    baseAgentCalls:
      1 /* gate reset */ +
      1 /* loader */ +
      built.reduce(
        (n, b) =>
          n +
          b.trackCount * 3 /* per track: heavy + status reader + commit */ +
          2 /* conformance gate + verdict reader (state agent dropped) */,
        0,
      ) +
      1 /* teardown */,
  },
};
