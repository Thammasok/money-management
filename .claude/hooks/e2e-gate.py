#!/usr/bin/env python3
"""Stop hook — registered in frontend.md only.
Runs the full Playwright E2E suite (feature-scoped first, then full regression)
before the frontend agent is allowed to stop.

The frontend agent writes .claude/.e2e-gate (containing the feature name)
as its last step before stopping.
"""

import hashlib
import glob
import os
import re
import subprocess
import sys

SENTINEL = ".claude/.e2e-gate"
RETRY_FILE = ".claude/.e2e-gate-retries"
VIBE_MARKER = ".claude/.vibe-active"
MAX_RETRIES = 5

_ANSI = re.compile(r"\x1b\[[0-9;]*m")
# Strip volatile tokens (durations, clock times, line:col) so a genuinely
# identical failure fingerprints the same across re-runs, while a *different*
# error (e.g. a changed assertion value) still produces a new fingerprint.
_VOLATILE = re.compile(r"\d+(?:\.\d+)?\s?m?s\b|\d{1,2}:\d{2}:\d{2}|:\d+:\d+")


def failure_fingerprint(text):
    t = _ANSI.sub("", text)
    t = _VOLATILE.sub("", t)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return hashlib.sha1(t.encode("utf-8", "replace")).hexdigest()


def awaiting_verdict():
    """True if the previous stop requested a Gate Verdict (AWAITING marker in retry file)."""
    if not os.path.exists(RETRY_FILE):
        return False
    lines = open(RETRY_FILE).read().splitlines()
    return bool(lines) and lines[0].strip() == "AWAITING_VERDICT"


def verdict_directive(gate, n, feature):
    return (
        f"🛑 {gate}: {n} failing attempts with no progress (a repeat of an earlier error, or the "
        f"attempt cap). Per Stop-on-Blocker, make an explicit decision now and record it in "
        f"`artifacts/{feature}/track-handoffs.md` under a `Blockers` heading, then finish. "
        "Write exactly one line:\n\n"
        "  Gate Verdict: HALT — <why this blocks: real bug / environment / out of distinct ideas>\n"
        "  Gate Verdict: CONTINUE — <a concrete NEW root-cause hypothesis you have NOT tried>\n\n"
        "Choose CONTINUE only if you truly have a new approach — it buys exactly ONE more bounded "
        "round, and an identical failure stops immediately. Do NOT edit or skip tests to force a "
        "pass. Record the verdict line, then finish."
    )


def run_e2e(feature, reporter="list"):
    cmd = ["bash", ".claude/scripts/run-e2e.sh", feature, reporter]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = (result.stdout + result.stderr).strip()
    return result.returncode, output


def project_of(feature):
    """The sub-project owning `e2e/<feature>`, as a `PROJECT:` prefix for run-e2e.sh.

    Empty string in a single-app repo, where the repo root IS the project and the historic
    `run_e2e("")` is already correct.

    This exists because a bare `run_e2e("")` resolves to the REPO ROOT playwright.config.ts,
    which in a monorepo can belong to a different service than the one under test -- so the
    full-regression pass silently runs the wrong suite and reports green. Mirrors run-e2e.sh's
    own rule: a directory qualifies only if it owns BOTH the e2e tree and its own config.
    """
    if not feature or os.path.isdir(os.path.join("e2e", feature)):
        return ""
    matches = []
    for depth in ("*", os.path.join("*", "*")):
        for cand in sorted(glob.glob(depth + os.sep)):
            if os.path.isdir(os.path.join(cand, "e2e", feature)) and os.path.isfile(
                os.path.join(cand, "playwright.config.ts")
            ):
                matches.append(cand.rstrip(os.sep))
    # Exactly one, never first-match-wins. Feature ids DO collide across sibling services, and
    # picking the alphabetically-first is the very bug this function exists to fix, one layer up.
    # An ambiguous id cannot reach here anyway: run-e2e.sh refuses it, so pass 1 fails and pass 2
    # never runs. Returning "" keeps the historic behaviour rather than guessing.
    return matches[0] + ":" if len(matches) == 1 else ""


def main():
    sys.stdin.read()

    feature = open(SENTINEL).read().strip() if os.path.isfile(SENTINEL) else ""

    # Verdict handshake: if we requested a Gate Verdict last turn, this stop releases the agent
    # (no re-run — skips the expensive suite) so the workflow can read HALT/CONTINUE from
    # track-handoffs.md.
    if awaiting_verdict():
        for fpath in (SENTINEL, RETRY_FILE):
            if os.path.exists(fpath):
                os.remove(fpath)
        print("✅ E2E gate: released for Gate Verdict — workflow reads HALT/CONTINUE from track-handoffs.md.")
        sys.exit(0)

    # Unlike the presence-only gates, this one RUNS run-e2e.sh against the
    # sentinel value as a feature path — so a backend-only feature can't just
    # pass a note as the value. It writes a sentinel starting with "N/A" to skip
    # the run for a feature that has no UI/E2E surface.
    if feature.upper().startswith("N/A"):
        os.remove(SENTINEL)
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print(f"✅ E2E gate: Stage 25 documented N/A — pass. ({feature})")
        sys.exit(0)

    # Under an autonomous vibe run (.vibe-active armed at Load by reset-gates.sh), scope to the
    # current feature and DEFER the full-regression pass. Rationale: (1) regression cold-starts a
    # server per worker and blows the cold-start budget the agent must race against the supervisor's
    # stall timeout; (2) the epic's evaluator, cross-feature journey specs, and conformance gate
    # already cover cross-feature behavior; (3) running it on every feature currently fails on
    # pre-existing, unrelated mock-mode specs and would stall the loop on every feature. Manual
    # `develop` runs (no marker) keep full regression.
    vibe = os.path.exists(VIBE_MARKER)

    # Pass 1: feature-scoped (fast feedback)
    status, output = (0, "") if not feature else run_e2e(feature)

    # Pass 2: full regression — skipped under vibe (deferred, see above).
    # Scoped to the feature's OWN sub-project: a bare "" uses the repo-root config, which in a
    # monorepo may be another service's, so this pass would run the wrong suite and pass.
    if status == 0 and not vibe:
        status, output = run_e2e(project_of(feature))

    if status == 0:
        if os.path.exists(SENTINEL):
            os.remove(SENTINEL)
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        scope = (
            f"feature-scoped E2E pass — full regression deferred (vibe run, feature: {feature})"
            if vibe
            else "all Playwright tests pass"
        )
        print(f"✅ E2E gate: {scope}.")
        sys.exit(0)

    tail = "\n".join(output.splitlines()[-80:])

    digest = failure_fingerprint(tail)
    history = [ln.strip() for ln in open(RETRY_FILE).read().splitlines() if ln.strip()] \
        if os.path.exists(RETRY_FILE) else []

    # Terminal — a repeat of an earlier failure (cycle) OR the attempt cap reached. Don't silently
    # bury it: request a Gate Verdict. Persist AWAITING + fingerprints seen; the NEXT stop releases
    # (see awaiting_verdict above) and the workflow reads the verdict from track-handoffs.md.
    seen = history + ([digest] if digest not in history else [])
    if digest in history or len(seen) >= MAX_RETRIES:
        with open(RETRY_FILE, "w") as f:
            f.write("AWAITING_VERDICT\n" + "\n".join(seen))
        sys.stderr.write(verdict_directive("E2E gate", len(seen), feature) + "\n")
        sys.exit(2)

    with open(RETRY_FILE, "w") as f:
        f.write("\n".join(seen))
    sys.stderr.write(
        f"🚫 E2E gate (attempt {len(seen)}/{MAX_RETRIES}): Playwright tests are failing — fix the root cause before finishing.\n\n"
        f"{tail}\n\n"
        "Fix the integration mismatch (UI vs API contract), then finish again — the gate re-runs automatically.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
