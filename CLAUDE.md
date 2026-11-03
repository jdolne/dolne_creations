# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a **dbt (data build tool)** project using **BigQuery** on **GCP** as the
data warehouse, on **dbt-core 1.11.9**. It demonstrates various dbt concepts
including models, macros, packages, and custom transformations.

## Working Style (read before starting any task)

- **Ask before building.** Always ask clarifying questions about my request
  before writing code. Confirm your understanding of the requirement, the grain,
  and how it fits the existing holistic project before producing anything.
- **Explain your plan.** Before implementing, lay out the concrete steps you'll
  take. Make sure the work fits the project as a whole — don't just start
  editing files.
- **Align to the project.** What you deliver must fit the existing structure,
  naming, and modeling conventions. If a request seems to conflict with them,
  raise it rather than silently diverging.

## Project Structure

The dbt project lives in **`dbt/`** at the repo root. Everything dbt needs to
run is inside it; the repo root holds only tooling (`.claude/`, `.github/`,
`.vscode/`) and top-level docs (`CLAUDE.md`, `README.md`). **All paths below are
relative to `dbt/`**, and dbt commands must be run from `dbt/` (or via the
develop-dbt driver, which finds the project itself).

- **models/** - dbt models organized by area:
  - `example/` - Basic dbt model examples (materialized as tables)
  - `learning_macros/` - Models that demonstrate custom macros
  - `learning_packages/` - Models using dbt packages
  - `person_project/` - Project-specific models
  - `sources/` - Source definitions for raw data
- **macros/** - Jinja2 SQL macros for reusable transformations:
  - `cents_to_dollars.sql` - Converts amounts in cents to dollars
  - `_macros_docs.yml` - Documentation for macros
- **seeds/** - CSV files for static reference data (e.g.,
  `snowflake_contract_rates.csv`)
- **tests/** - dbt test definitions (currently minimal)
- **dbt_documentation/** - Learning materials about dbt concepts
- **dbt_packages/** - External packages (dbt_utils, dbt_artifacts, codegen,
  dbt_bigquery_monitoring)

## Configuration

- **dbt_project.yml** - Paths, profiles, and model materializations
- **packages.yml** - External package dependencies
- **profiles.yml** (not in repo) - Connection config, expected in `~/.dbt/`
- **.vscode/settings.json** (at repo root) - Points to the `dbt/dbt-env` Python
  environment and declares `dbt` as the dbt project path

## Environment Setup

The project uses a Python virtual environment (`dbt/dbt-env/`) with dbt
installed. The VSCode settings use:
```
/Users/Dolne_Creations/Desktop/Personal_Projects_Master/dolne_creations/dbt/dbt-env/bin/python3
```
If dbt commands fail, ensure the virtual environment is activated or use the
full path to the dbt binary. Run all dbt commands from `dbt/` using the
`dbt/dbt-env/` virtualenv:
```bash
cd dbt && dbt-env/bin/dbt <command>
```
To rebuild the virtualenv from scratch (it is Python 3.12.13):
```bash
cd dbt && dbt-env/bin/python3 -m pip freeze > /tmp/reqs.txt
rm -rf dbt/dbt-env && /usr/local/bin/python3.12 -m venv dbt/dbt-env
dbt/dbt-env/bin/python3 -m pip install -r /tmp/reqs.txt
```

## SQL Style

- All SQL must conform to the project's **sqlfluff** configuration in `.sqlfluff`
  (BigQuery dialect). Treat that file as the source of truth for linting and
  formatting, and write code that passes `sqlfluff lint` before a task is done.
  > NOTE: `.sqlfluff` is not yet created — this rule is aspirational until it exists.

## dbt Modeling — Kimball

- Organize **models by business process, not by team or department** (e.g.,
  orders, shipments, payments), following Kimball best practices. This is the
  standard for all new work.
  > The existing `learning_*` directories predate this convention and are
  > topic-based; treat them as legacy and do not use them as a pattern for new
  > models.
- Declare the **grain** of every model explicitly.
- Use **conformed dimensions** across business processes where applicable.

## Macros

- Prefer **macros** when logic is repeated across models, or when a block of
  complex SQL would be cleaner extracted into a macro. Keep macros focused and
  documented (in `macros/*_docs.yml`).
- To use macros from packages, call them as `{{ package_name.macro_name(...) }}`.

## dbt Development, Documentation & Testing

For creating, editing, and validating dbt artifacts (models, macros, tests,
sources, `schema.yml`), use the **develop-dbt** skill in
`.claude/skills/develop-dbt/`. It owns this project's authoring conventions and a
local validation workflow (`parse`, `validate`, `compile`, `list`) that runs
**without touching BigQuery**.

- **Sequence matters: write and validate the model first, then document and test
  it.** Get the transformation correct before adding documentation and tests —
  do not interleave the two phases.
- Documentation and testing coverage applies to the **entire project**. No model
  is "done" without both a `.yml` description (model + columns) and dbt tests
  (at minimum `not_null`/`unique` on the key, plus `relationships` on FKs to
  dimensions where applicable).

Commands that run against the warehouse (not covered by the skill). Run these
from `dbt/`, using the `dbt-env/bin/dbt` binary there:
```bash
dbt run                          # Build all models
dbt run --select model_name      # Build a specific model
dbt test                         # Run tests
dbt build                        # Run models + tests in DAG order
dbt seed                         # Load CSV seed files
dbt docs generate                # Build documentation (then `dbt docs serve`)
dbt debug                        # Check the warehouse connection and config
```

## Installed Packages

- **dbt_utils** (1.3.3) - Utility functions and macros
- **dbt_artifacts** (2.10.1) - Metadata and lineage information
- **codegen** (0.14.1) - Auto-generate model SQL
- **dbt_bigquery_monitoring** (0.26.0) - BigQuery cost and performance monitoring

## Key Notes

- This is a learning repository; some directories (like `tests/`) are mostly empty.
- dbt-core 1.11.9 is installed; 1.11.11 is the latest available.
- BigQuery on GCP is the target warehouse.