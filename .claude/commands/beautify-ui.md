---
description: Stage 22 of 28 — apply design tokens and aesthetic direction without changing component IDs or structure. Invoked by the frontend track agent.
user-invocable: false
---
# /project:beautify-ui

## Stage
22 of 28 — Beautify UI (Apply Design Tokens)

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:simple-design` — when tempted to add speculative functionality
- **In-repo design skills work together at this stage (under `.claude/skills/`); all are optional — if any is absent, proceed with the design-token steps below alone, do not fail the stage:**
  1. **`ui-ux-pro-max`** — invoke FIRST to **select concrete tokens** from its databases for this project's stack: a named visual style, a color palette, a font pairing, chart types, and stack-specific guidance (Tailwind/shadcn/etc.). On greenfield it also structures the selection into a token architecture (primitive → semantic → component layers, CSS variables, spacing/type scales, component states). This produces the actual values you apply.
  2. **`frontend-design`** — invoke SECOND as the **direction/quality gate**: confirm the selection above is a deliberate aesthetic for the product's purpose and audience, and reject generic AI aesthetics (system fonts, predictable purple gradients, cookie-cutter components).
  3. **`web-design-guidelines`** — invoke THIRD to **audit** the styled result against Web Interface Guidelines (accessibility, contrast, focus states, responsive correctness).
  - Division of labor: `ui-ux-pro-max` = *what* (concrete style/palette/type, plus token layers on greenfield); `frontend-design` = *whether it's any good* (deliberate, non-generic); `web-design-guidelines` = *whether it's correct* (accessibility/UX compliance). None may override the ID/structure constraints below.

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/02-flow.md` — UI structure reference
- Design system / design tokens documentation (project-specific)
- Component files from Stages 15, 18, 19

## Task
Apply visual styling to the plain UI using design tokens. This is the LAST step before final verification — all functionality must already work.

### Steps

1. **Read design tokens / design system**:
   - Colors, typography, spacing, shadows, borders
   - Component-specific styles (buttons, inputs, cards, etc.)
   - Layout patterns (grid, flex, responsive breakpoints)
   - Animation / transition tokens

2. **Apply tokens systematically** (do NOT change component structure or IDs):
   - Layout and spacing
   - Typography (font family, size, weight, line height)
   - Colors (backgrounds, text, borders, states)
   - Component styling (buttons, inputs, forms, cards)
   - Interactive states (hover, focus, active, disabled)
   - Responsive adjustments

3. **Preserve all component IDs and structure**:
   ```
   BEFORE: <button id="login-submit" type="submit">Login</button>
   AFTER:  <button id="login-submit" type="submit" class="btn btn-primary">Login</button>

   ✅ ID preserved — Playwright tests still work
   ✅ Structure preserved — component tests still work
   ✅ Only visual classes/styles added
   ```

4. **Verify visually**:
   - Check each page in the browser
   - Verify responsive breakpoints
   - Verify interactive states work
   - Verify accessibility (contrast, focus indicators)

### Constraints
- DO NOT change component IDs — Playwright tests depend on them
- DO NOT change component structure or behavior — only add visual styling
- DO NOT add new functionality during beautification
- If the project has a design system, apply ONLY its tokens. If it does not (greenfield), the selection from `ui-ux-pro-max` (vetted by `frontend-design`, audited by `web-design-guidelines`) BECOMES the design system: record the resulting primitive/semantic/component tokens in the project's design-tokens file so later features reuse them instead of re-inventing
- Keep it simple — bold direction, restrained execution; the chosen aesthetic must never override the ID/structure constraints above

### Warning
After beautification, all existing tests (component tests + Playwright tests) MUST still pass. If a test breaks due to styling, the styling changed structure — revert and apply differently.

## Output
- Updated component files with styling applied
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Pages styled
- Design tokens applied
- Visual verification status

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
