---
description: Stage 15 of 28 — build plain unstyled UI pages with the component IDs from 02-flow.md. Invoked by the frontend track agent.
user-invocable: false
---
# /project:create-plain-ui

## Stage
15 of 28 — Create Plain UI Page (Frontend)

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/simple-design.md`
- `guidelines/ubiquitous-language.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:ubiquitous-language` — when naming classes, methods, or variables

## Input
Read:
- `artifacts/{feature}/02-flow.md` — UI structure and component IDs
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/03-scenarios.md` — what the pages need to support

## Task
Create plain UI pages with structure only — no styling, no logic, no data binding. This is the HTML skeleton.

1. **Read** the flow to identify pages and components needed.

2. **For each page**, create the structural markup:
   - Use semantic HTML elements
   - Add component IDs as defined in the flow (these will be used by Playwright later)
   - Include placeholder text for dynamic content
   - No styling — default browser styles only
   - No JavaScript logic — static structure only

3. **Page structure example**:
   ```html
   <!-- Login Page -->
   <main id="login-page">
     <h1>Login</h1>
     <form id="login-form">
       <label for="email">Email</label>
       <input id="email" type="email" name="email" />

       <label for="password">Password</label>
       <input id="password" type="password" name="password" />

       <button id="login-submit" type="submit">Login</button>
     </form>
     <div id="login-error" role="alert"></div>
     <a id="register-link" href="/register">Register</a>
   </main>
   ```

4. **Create route/page structure** following the project's framework conventions.

5. **Verify**: Pages render in the browser, all IDs are present, navigation between pages works (static links).

### Constraints
- Walking skeleton page(s) FIRST
- Structure only — no CSS, no JavaScript behavior
- All IDs from the flow must be present (Playwright will target these)
- Use ubiquitous language for labels and placeholder text
- Only pages needed for current scenarios

## Output
- Plain UI page files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Pages created
- Component IDs placed
- Navigation structure

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
