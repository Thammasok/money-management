#!/usr/bin/env python3
"""Stop hook — registered in frontend.md only.
Runs component test suites for changed *.tsx files.
Unit tests (*.ts) are handled separately by unit-gate.py.
"""

import hashlib
import json
import os
import re
import subprocess
import sys

RETRY_FILE = ".claude/.component-gate-retries"
MAX_RETRIES = 5
# Worker count passed to the test runner. A percentage like "50%" rounds DOWN to
# 0 on a 1-core host, which Tinypool (Vitest) and Jest both reject — that is why
# app vitest configs had to pin a single thread. An explicit integer floored at 1
# never rounds to 0, so those configs can use the cores instead of pinning.
MAX_WORKERS = max(1, (os.cpu_count() or 2) // 2)

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


def verdict_directive(gate, n):
    return (
        f"🛑 {gate}: {n} failing attempts with no progress (a repeat of an earlier error, or the "
        "attempt cap). Per Stop-on-Blocker, make an explicit decision now and record it in THIS "
        "feature's `artifacts/<feature>/track-handoffs.md` under a `Blockers` heading, then finish. "
        "Write exactly one line:\n\n"
        "  Gate Verdict: HALT — <why this blocks: real bug / environment / out of distinct ideas>\n"
        "  Gate Verdict: CONTINUE — <a concrete NEW root-cause hypothesis you have NOT tried>\n\n"
        "Choose CONTINUE only if you truly have a new approach — it buys exactly ONE more bounded "
        "round, and an identical failure stops immediately. Do NOT edit or skip tests to force a "
        "pass. Record the verdict line, then finish."
    )


def git_changed_files():
    files = set()
    for cmd in (
        ["git", "diff", "--name-only", "HEAD"],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ):
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
            files.update(out.splitlines())
        except subprocess.CalledProcessError:
            pass
    return [f for f in files if os.path.isfile(f)]


def find_js_root(start_dir):
    root = start_dir
    while root not in (".", "/", ""):
        pkg = os.path.join(root, "package.json")
        if os.path.isfile(pkg):
            try:
                with open(pkg) as f:
                    data = json.load(f)
            except Exception:
                data = {}
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            if "vitest" in deps or any(
                f.startswith("vitest.config") for f in os.listdir(root)
            ):
                return (root, "vitest")
            if "jest" in deps:
                return (root, "jest")
        root = os.path.dirname(root)
    if os.path.isfile("package.json"):
        try:
            with open("package.json") as f:
                data = json.load(f)
        except Exception:
            data = {}
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        if "vitest" in deps or any(f.startswith("vitest.config") for f in os.listdir(".")):
            return (".", "vitest")
        if "jest" in deps:
            return (".", "jest")
    return None


def run_suite(root, runner):
    if runner == "vitest":
        result = subprocess.run(
            ["npx", "vitest", "run", f"--maxWorkers={MAX_WORKERS}"],
            cwd=root, capture_output=True, text=True,
        )
    else:
        result = subprocess.run(
            ["npx", "jest", "--no-coverage", f"--maxWorkers={MAX_WORKERS}"],
            cwd=root, capture_output=True, text=True,
        )
    output = (result.stdout + result.stderr).strip()
    return result.returncode, output


def main():
    sys.stdin.read()

    try:
        subprocess.check_output(
            ["git", "rev-parse", "--is-inside-work-tree"], stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError:
        sys.exit(0)

    # Verdict handshake: if we requested a Gate Verdict last turn, this stop releases the agent
    # (no re-run) so the workflow can read HALT/CONTINUE from track-handoffs.md.
    if awaiting_verdict():
        os.remove(RETRY_FILE)
        print("✅ Component gate: released for Gate Verdict — workflow reads HALT/CONTINUE from track-handoffs.md.")
        sys.exit(0)

    changed = [f for f in git_changed_files() if f.endswith(".tsx")]
    if not changed:
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        sys.exit(0)

    suites = {}
    for f in changed:
        result = find_js_root(os.path.dirname(f) or ".")
        if result:
            suites[result[0]] = result[1]

    if not suites:
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        sys.exit(0)

    failures = []
    for root, runner in suites.items():
        status, output = run_suite(root, runner)
        if status != 0:
            tail = "\n".join(output.splitlines()[-60:])
            failures.append(f"=== FAIL: {runner} suite in {root} ===\n{tail}")

    if not failures:
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print("✅ Component gate: all component test suites pass.")
        sys.exit(0)

    digest = failure_fingerprint("\n\n".join(failures))
    history = [ln.strip() for ln in open(RETRY_FILE).read().splitlines() if ln.strip()] \
        if os.path.exists(RETRY_FILE) else []

    # Terminal — a repeat of an earlier failure (cycle) OR the attempt cap reached. Don't silently
    # bury it: request a Gate Verdict. Persist AWAITING + fingerprints seen; the NEXT stop releases
    # (see awaiting_verdict above) and the workflow reads the verdict from track-handoffs.md.
    seen = history + ([digest] if digest not in history else [])
    if digest in history or len(seen) >= MAX_RETRIES:
        with open(RETRY_FILE, "w") as f:
            f.write("AWAITING_VERDICT\n" + "\n".join(seen))
        sys.stderr.write(verdict_directive("Component gate", len(seen)) + "\n")
        sys.exit(2)

    with open(RETRY_FILE, "w") as f:
        f.write("\n".join(seen))

    sys.stderr.write(
        f"🚫 Component gate (attempt {len(seen)}/{MAX_RETRIES}): component test suites are failing — fix them before finishing.\n\n"
        + "\n\n".join(failures)
        + "\n\nFix the root cause (do not delete or skip tests), then finish again — the gate re-runs automatically.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
