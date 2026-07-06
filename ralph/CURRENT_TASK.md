# Current Task — WS-Q: Checklist engine (starter-template materialization) — COMPLETE, see STATE.md

**Workstream:** WS-Q — Checklist Engine
**Attempt:** 1
**Files (Primary):** `src/lib/checklists.ts`

## Scope

`src/lib/checklists.ts` already has a near-complete scaffold: `STARTER_TEMPLATES`
(4 templates), `instantiateTemplate(template, weekendId?, weekendName?)`, and
`checklistProgress(list)`. The gap: `STARTER_TEMPLATES` entries have
`items: string[]` (plain labels), but `instantiateTemplate()` requires a real
`ChecklistTemplate` with `items: ChecklistTemplateItem[]` (`{id, text}`). There
is currently no function that turns a starter-template definition into a real,
ID-bearing, user-owned `ChecklistTemplate` — meaning WS-R (UI) would have
nothing to call to actually offer the starter templates to a user.

1. Add `materializeStarterTemplate(starter: typeof STARTER_TEMPLATES[number]): ChecklistTemplate`
   that converts a starter entry into a full `ChecklistTemplate`: generates an
   `id` (reuse the existing `uid()` helper, prefix `'tmpl'`), maps each string
   item to `{ id: uid('tmpli'), text }`, sets `updatedAt` to now.
2. Export it alongside the existing exports.
3. Do not change `STARTER_TEMPLATES` data, `instantiateTemplate`, or
   `checklistProgress`.
4. Do NOT wire into `App.tsx`/UI — that's WS-R.

## Out of scope
- No UI changes, no App.tsx state, no sync.ts changes.
- No changes to the 4 starter template contents/order.

## Acceptance criteria
- [ ] `materializeStarterTemplate()` exists, returns a valid `ChecklistTemplate`
      with unique `id`s for the template and every item.
- [ ] `npm run lint` — baseline 3 errors only, no new errors.
- [ ] `npm run build` — succeeds.
- [ ] Diff confined to `src/lib/checklists.ts`.

## Human prerequisites
None.

<!-- Template (ws-planner fills this in):

# Current Task — WS-x: <title>

**Workstream:** WS-x — <title>
**Attempt:** 1

## Scope
1. ...numbered, concrete implementation steps...

## Files
- Primary: ...
- Shared (touch minimally): ...

## Out of scope
- ...

## Acceptance criteria
- [ ] ...testable bullets ws-qa grades against...

## Human prerequisites
- ...or "none"

## QA findings
_(ws-qa appends numbered findings per failed attempt)_
-->
