Synchronize the living documentation in `docs/` with the current state of the codebase.

## Step 1 — Scan the codebase

Gather the current state by reading these sources:

1. **Routes:** Glob `app/**/*.tsx` — list every screen/layout file.
2. **Services:** Glob `src/services/*.ts` — list every service file (ignore `.test.ts`).
3. **Hooks:** Glob `src/hooks/*.ts` — list every hook file.
4. **Components:** Glob `src/components/**/*.tsx` — list every component.
5. **Schema interfaces:** Read `src/db/schema.ts` — extract all TypeScript interfaces.
6. **Migrations / tables:** Read `src/db/migrations.ts` — extract all CREATE TABLE statements.
7. **Auth files:** Glob `src/auth/*` — list auth-related files.
8. **Config / env:** Check for any new environment variables or config files.

## Step 2 — Read the current docs

Read these three files in full:
- `docs/architecture.md`
- `docs/spec.md`
- `docs/architecture-diagram.mmd`

## Step 3 — Diff and report

Compare the codebase scan (Step 1) against the docs (Step 2). For each doc, identify:

**Items in code but MISSING from docs:**
- New route files not listed in the navigation/route sections
- New service files not listed in the service layer section
- New hooks not listed in the hook layer section
- New components not mentioned anywhere
- New database tables or columns not in the ER diagram or schema section
- New environment variables not documented

**Items in docs but NOT in code:**
- Files, routes, or tables referenced in docs that no longer exist
- Services or hooks marked as "planned" that now exist (status should be "implemented")
- Services or hooks marked as "implemented" that were deleted

**Phase status mismatches:**
- Phases described as "Planned" in spec.md whose code is now implemented
- Acceptance criteria in spec.md that should be checked off based on existing code

Print a structured report like:

```
=== DOCS-SYNC REPORT ===

architecture.md:
  MISSING: <list items in code but not in doc>
  STALE:   <list items in doc but not in code>

spec.md:
  MISSING: <list items in code but not in doc>
  STALE:   <list items in doc but not in code>
  PHASE STATUS: <list phases needing status update>

architecture-diagram.mmd:
  MISSING: <list items in code but not in diagram>
  STALE:   <list items in diagram but not in code>
```

## Step 4 — Apply updates

For each discrepancy found, apply targeted edits:

### architecture.md
- Add new files/services/hooks/routes to their respective sections.
- Update "planned" labels to "implemented" for services/hooks that now exist.
- Add new tables or columns to the database schema section.
- Update the System Context or Layer descriptions if new integrations appeared.
- Update the Document Control version table: add a new row with today's date and a summary of changes.

### spec.md
- Check off acceptance criteria (change `[ ]` to `[x]`) for features that are implemented.
- Update phase status from "Planned" to "Complete" / "In Progress" where applicable.
- Add new features or user stories if significant new functionality was added.
- Update the Document Control version table: add a new row with today's date and a summary of changes.

### architecture-diagram.mmd
- Add new screen files to the Screen Layer.
- Add new hooks to the Hook Layer.
- Add new services to the Service Layer (remove "planned" suffix if present).
- Add new tables or columns to the ER diagram.
- Add new navigation edges if new routes connect to existing screens.
- Update the Navigation Route Map if new screens were added.

## Step 5 — Summary

After all edits, print a final summary:

```
=== DOCS-SYNC COMPLETE ===

Files modified:
  - docs/architecture.md — <N changes>: <brief list>
  - docs/spec.md — <N changes>: <brief list>
  - docs/architecture-diagram.mmd — <N changes>: <brief list>

No changes needed:
  - <list any docs that were already in sync>
```

If everything is already in sync, say so:

```
=== DOCS-SYNC COMPLETE ===
All three documents are in sync with the codebase. No changes needed.
```
