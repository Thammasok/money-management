# Pause Signal — CRITICAL (headless Runs only)

**This rule is inert unless `AGENT_RUNNER_PAUSE_SIGNAL=1` is set in the environment.** In an ordinary
interactive session it changes nothing: a PAUSE gate asks the human, exactly as its skill says. Read
the condition first and stop reading if it does not apply to you.

## Why this exists

When the Tag-to-PR Runner executes a Run, it spawns this harness headless:

```
claude -p --output-format stream-json --input-format stream-json --verbose
```

and writes `/project:task` plus the Brief to stdin. There is **no human on the other end of a PAUSE
gate**. The Runner supervises the child and can park the Run — write a Checkpoint, ask the question on
the GitHub issue, tear the pod down, and resume days later with the answer as a Directive — but only if
it is *told* a gate was reached. Left to itself, a headless run treats a PAUSE gate as prose, produces
its final `result` event, and the Run ends as if it had finished. The question never reaches anyone.

This rule is the producing half of that signal. `packages/runner/src/harness/claude-cli-harness-invoker.ts`
is the consuming half.

## The contract

When `AGENT_RUNNER_PAUSE_SIGNAL=1` and you reach **any** point where a skill would wait for the
developer — an `Ask:`, a `PAUSE`, a "type continue", a "review and open a pull request before
continuing", or any question you cannot answer from the repository — do this and nothing else:

1. Emit **exactly one line**, as the entire content of your message, with no prose before or after it,
   no code fence, and no trailing commentary:

   ```
   {"type":"pause_request","question":"<the one question, in plain text>"}
   ```

2. **Stop.** Do not proceed on an assumption, do not pick a default, do not ask again in prose, and do
   not end the session. Your next input will be the answer, delivered as a new user message.
3. When that answer arrives, continue from where you paused. If you reach another gate, emit the line
   again — there is no limit on how many times a Run may pause.

### Rules for the line itself

- **Valid JSON on one line.** It is parsed, not read. A trailing period, smart quotes, or a line break
  inside the string makes it unparseable and the Run will end instead of parking.
- **`question` is required in practice.** It becomes the comment on the GitHub issue and is the only
  thing the person answering will see. "Please advise" wastes a park that can last 28 days. Ask the
  specific thing: name the choice and the options.
- **No secrets, no file contents, no diffs.** The question is posted publicly on the issue. Slack is a
  doorbell (AD-14) and so is this: a pointer and a question, never the payload.
- **One question per pause.** If two things are genuinely unresolved, ask the blocking one — the answer
  usually settles the other, and a compound question gets a compound answer nobody can act on.

## What NOT to do

- **Do not emit it when the variable is unset.** In an interactive session that line is noise printed at
  a human who was about to be asked a question properly.
- **Do not emit it for something you can settle yourself.** A gate exists for decisions that are the
  developer's — scope, product behaviour, a trade-off with no repo-internal answer. Facts you can
  establish by reading the code are yours to establish (`.claude/guidelines/design-grilling.md`: facts
  are the agent's, decisions are the user's). Every unnecessary pause costs a real park: a pod torn
  down, a Checkpoint written, and a person interrupted.
- **Do not end the session instead.** Ending produces a `result` event, which the Runner reads as a
  terminal outcome. The Run is then `succeeded` or `failed` with the question unasked, which is the
  exact failure this rule prevents.

## Where the line actually goes

You do not write to the pipe directly, and you do not need to. In `--output-format stream-json` the
harness wraps your message in an `assistant` event; the Runner's invoker looks **inside** that event's
text for this line, as well as accepting it as a bare top-level line for a future hook-based producer.
Emitting it as your whole message is enough — do not try to construct the wrapper yourself.
