#!/usr/bin/env python3
"""Stop hook — registered in pre-dev.md only.
Validates that Stage 7 (Bruno + Mountebank API mock tests) completed
successfully before the pre-dev agent is allowed to stop.

The pre-dev agent writes .claude/.api-mock-gate after Stage 7 passes.
"""

import os
import sys

SENTINEL = ".claude/.api-mock-gate"
RETRY_FILE = ".claude/.api-mock-gate-retries"
MAX_RETRIES = 5


def main():
    sys.stdin.read()

    if os.path.isfile(SENTINEL):
        feature = open(SENTINEL).read().strip()
        os.remove(SENTINEL)
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print(f"✅ API mock gate: Stage 7 passed for feature '{feature}'.")
        sys.exit(0)

    retries = int(open(RETRY_FILE).read().strip()) if os.path.exists(RETRY_FILE) else 0
    retries += 1

    if retries >= MAX_RETRIES:
        if os.path.exists(RETRY_FILE):
            os.remove(RETRY_FILE)
        print(f"⚠️ API mock gate: sentinel missing after {MAX_RETRIES} attempts — releasing. Record under **Blockers** in track-handoffs.md.")
        sys.exit(0)

    with open(RETRY_FILE, "w") as f:
        f.write(str(retries))

    sys.stderr.write(
        f"🚫 API mock gate (attempt {retries}/{MAX_RETRIES}): Stage 7 (API mock tests) did not complete successfully.\n\n"
        "Run `/project:run-api-mock-tests` and ensure all Bruno tests pass against Mountebank, then finish again.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
