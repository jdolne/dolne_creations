---
name: develop-dbt
description: Create, edit, and validate dbt models, macros, tests, analyses, sources, and schema.yml files in this BigQuery dbt project. Use whenever writing or changing a dbt artifact, or to check that dbt YAML/SQL/Jinja is valid without running models against the warehouse.
---

# Develop dbt Artifacts

Workflow for authoring and validating dbt artifacts in this project. Validation runs through real `dbt parse` / `dbt compile` (via the `dbt/dbt-env/` virtualenv), so it reports dbt's actual errors — not hand-rolled approximations.

The dbt project lives in **`dbt/`** at the repo root — `dbt_project.yml`, `models/`, `macros/`, `seeds/`, and the `dbt-env/` virtualenv are all inside it. Paths in this document that name dbt directories (`models/`, `macros/`, `tests/`, …) are relative to `dbt/`.

## The driver

`.claude/skills/develop-dbt/driver.mjs` wraps the dbt commands you need while developing. It finds the project root automatically — from any subdirectory, and from the repo root, where it looks into `dbt/` — and runs dbt from `dbt/dbt-env/`. Every command prints the underlying `dbt` invocation, streams dbt's real output (including errors), and exits non-zero on failure.

| Command | What it does | Warehouse? |
|---|---|---|
| `node .claude/skills/develop-dbt/driver.mjs parse` | Validate **all** YAML, Jinja, and `ref()`/`source()` links across the project. **Run this after every edit.** | No |
| `… validate <file>` | `.yml`: precise YAML syntax check, then parse. `.sql`: parse (catches Jinja errors). | No |
| `… compile [model]` | Render Jinja → SQL into `target/compiled/`. Pass a model name to inspect one model's compiled SQL. | Yes |
| `… list` | List this project's **own** models/macros/seeds/tests (not the hundreds from installed packages). | No |
| `… help` | Command reference. | — |

## Validation loop

After editing any `.sql` or `.yml` file:

1. Run **`parse`**. It is fast, needs no warehouse, and catches the common failures: YAML syntax errors, Jinja errors (`{% if %}` without `{% endif %}`, unbalanced `{{ }}`), and unresolved `ref()`/`source()`.
2. Fix whatever it reports (the dbt error names the file and line), then re-run until clean.
3. Optionally `compile <model>` to confirm the Jinja renders to the SQL you expect.

Prefer `parse` to the old per-file regex checks — `dbt parse` understands Jinja, so it won't (for example) wrongly flag a valid inline `{% set x = ... %}`.

## How this project wants dbt artifacts written

Follow these conventions (from CLAUDE.md) when creating or editing files:

- **Models are views.** Don't override the materialization to table unless explicitly asked.
- **Every model needs a `schema.yml` entry** in its own directory that lists **all** columns with `description`s, plus tests. Put tests (`unique`, `not_null`, `relationships`, `accepted_values`, `dbt_utils.*`) in `schema.yml`; only write SQL in `tests/` for genuinely bespoke checks.
- **Reference, don't hardcode:** use `{{ ref('other_model') }}` and `{{ source('name', 'table') }}`. Define sources in `models/sources/<name>/schema.yml`.
- **Repeated logic → a macro.** Add macros under `macros/` and document each in `macros/_macros_docs.yml`. Installed package macros are called as `{{ package.macro(...) }}` (dbt_utils, codegen, dbt_artifacts, dbt_bigquery_monitoring).
- **YAML style:** `version: 2` at the top, 2-space indentation, no tabs.

## Notes

- Run commands from inside the project; the driver locates `dbt_project.yml` by walking up. File paths resolve against the project root (absolute paths also work).
- Only `compile` opens a BigQuery connection. `parse`, `validate`, and `list` never touch the warehouse.
- To build documentation, run `dbt docs generate` directly — it requires a warehouse connection and is intentionally out of scope here.
