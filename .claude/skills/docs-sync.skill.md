# Skill: docs-sync — Automatic Living Documentation Sync

## Purpose

Keep living documentation in `docs/` in sync with the codebase. This skill
is **auto-invoked by Claude** — no user action required. It can also be
triggered manually via `/docs-sync`.

This file is portable. Copy it to any repo's `.claude/skills/` directory and
reference it from that repo's CLAUDE.md.

---

## Trigger Conditions

Claude MUST run this skill automatically when ANY of the following occur:

1. **Phase completion** — A development phase (feature milestone) is finished.
2. **New file created** — A route, service, hook, component, or migration file is added.
3. **File deleted or renamed** — Any file tracked by the docs is removed or moved.
4. **Schema change** — Tables, columns, or TypeScript interfaces in the schema file change.
5. **New integration** — A new external dependency or API is introduced.
6. **Route change** — Screens are added, removed, or navigation structure changes.
7. **Pre-commit** — Before Claude creates a git commit that includes structural changes.

Claude should NOT run this skill for:
- Cosmetic-only changes (comments, formatting, variable renames within a file)
- Changes to files outside the tracked layers (e.g., config tweaks, README edits)
- Test-only changes that don't add new files or alter public APIs

---

## What Docs to Sync

Look for a `docs/` directory in the repo root. The skill manages any subset
of these files that exist:

| File | Contains | Update for... |
|------|----------|---------------|
| `docs/architecture.md` | System design, layers, file listings, tech stack, security | New files, layers, routes, tables, services, hooks, integrations, security changes |
| `docs/spec.md` | Product spec, feature status, acceptance criteria, roadmap | Phase status (planned → done), acceptance criteria checkboxes, new features, risk register |
| `docs/architecture-diagram.mmd` | Mermaid diagrams (ER, navigation, layer, context) | New tables, screens, routes, services, hooks, external integrations |

If a doc file doesn't exist, skip it — don't create it.

---

## Procedure

### 1. Scan the codebase

Gather current state from these locations (adapt paths to the repo):

- **Routes/screens:** `app/**/*.tsx`
- **Services:** `src/services/*.ts` (exclude `*.test.ts`)
- **Hooks:** `src/hooks/*.ts`
- **Components:** `src/components/**/*.tsx`
- **Schema:** `src/db/schema.ts` — all TypeScript interfaces
- **Migrations:** `src/db/migrations.ts` — all CREATE TABLE statements
- **Auth:** `src/auth/*`
- **Config/env:** `.env`, `app.config.*`, `tsconfig.json`

If a directory doesn't exist in the repo, skip it.

### 2. Read current docs

Read every doc file listed in the table above that exists in `docs/`.

### 3. Diff

Compare code state vs doc state. Identify:

- **MISSING:** In code but not documented (new files, routes, tables, columns)
- **STALE:** In docs but no longer in code (deleted files, renamed items)
- **STATUS MISMATCH:** Phase/feature marked "Planned" but code exists, or
  acceptance criteria unchecked but feature is implemented

### 4. Report

Print a structured diff report:

```
=== DOCS-SYNC REPORT ===

architecture.md:
  MISSING: [list]
  STALE:   [list]

spec.md:
  MISSING: [list]
  STALE:   [list]
  STATUS:  [list of phase/criteria updates needed]

architecture-diagram.mmd:
  MISSING: [list]
  STALE:   [list]

Verdict: [N items to update / All in sync]
```

### 5. Apply updates

For each discrepancy, use the Edit tool to make targeted changes:

- Add new items to the correct section of each doc
- Remove or mark stale items
- Update phase status labels and check off acceptance criteria
- Update Mermaid diagram nodes and edges
- **Always** update the Document Control version table in each modified doc:
  add a new row with today's date and a brief change summary

### 6. Confirm

Print a final summary of what was changed:

```
=== DOCS-SYNC COMPLETE ===

Modified:
  - docs/architecture.md — added 2 services, updated hook layer
  - docs/architecture-diagram.mmd — added 1 screen node, 2 edges

Already in sync:
  - docs/spec.md

Done.
```

---

## Integration

To enable this skill in a repo, add the following to that repo's CLAUDE.md:

```markdown
## Living Documentation

Docs in `docs/` are kept in sync with the codebase automatically.
Claude follows the docs-sync skill (`.claude/skills/docs-sync.skill.md`)
to detect when documentation needs updating and applies changes without
being asked. The skill can also be triggered manually with `/docs-sync`.
```
