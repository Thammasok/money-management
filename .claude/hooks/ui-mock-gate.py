#!/usr/bin/env python3
"""Stop hook — registered in frontend.md only.
Validates that Stages 21 and 23 (Playwright + Mountebank UI mock tests)
completed successfully before the frontend agent is allowed to stop.

The frontend agent writes .claude/.ui-mock-gate after Stage 23 passes.
"""

import os
import sys

SENTINEL = ".claude/.ui-mock-gate"
RETRY_FILE = ".claude/.ui-mock-gate-retries"
MAX_RETRIES = 5


def main():
    sys.stdin.read()

    if os.path.isfile(SENTINEL):
        feature = open(SENTINEL).read().strip()
        os.remove(SENTINEL)
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print(f"✅ UI mock gate: Stages 21/23 passed for feature '{feature}'.")
        sys.exit(0)

    retries = int(open(RETRY_FILE).read().strip()) if os.path.exists(RETRY_FILE) else 0
    retries += 1

    if retries >= MAX_RETRIES:
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print(f"⚠️ UI mock gate: sentinel missing after {MAX_RETRIES} attempts — releasing. Record under **Blockers** in track-handoffs.md.")
        sys.exit(0)

    with open(RETRY_FILE, "w") as f:
        f.write(str(retries))

    sys.stderr.write(
        f"🚫 UI mock gate (attempt {retries}/{MAX_RETRIES}): Stage 21/23 (UI mock tests) did not complete successfully.\n\n"
        "Run `/project:run-ui-mock-tests` and `/project:rerun-ui-tests` and ensure all Playwright+Mountebank tests pass, then finish again.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
