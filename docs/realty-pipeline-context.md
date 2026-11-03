# Realty Data Pipeline — Project Context
 
> Paste this into a new chat to bring it up to speed. It covers goals, decisions already made (and rejected), the project structure, and the build plan.
 
## Goal
 
Build a portfolio data engineering project that pulls real estate listing data from RealtyAPI into BigQuery, transforms it with dbt, and demonstrates production-grade engineering judgment to hiring managers at companies like Stripe and Instacart.
 
The audience is a senior data engineer reviewing a GitHub repo in under ten minutes. Every decision optimizes for **legibility and defensibility in an interview**, not for maximum technical sophistication.
 
**Author context:** I have about one month of Python experience. Explanations should be clear, concise, and beginner-friendly, and should say *why* each piece exists, not just what it does.
 
## The core idea (this is the differentiator)
 
RealtyAPI returns **snapshot data** — the current state of a listing, with no history. The interesting facts (price cuts, days on market, delistings, relisting at a lower price) don't exist in the source. They only exist if the pipeline reconstructs them from repeated snapshots over time.
 
This turns the project from "I loaded an API into a warehouse" into "I built a slowly-changing-dimension pipeline that answers questions the source API can't." The README should lead with a **finding** (e.g. median days-on-market by zip, or listings relisted lower after 60 days), not with the tech stack.
 
## Chosen approach: Roadmap B (lean)
 
Plain Python extraction, scheduled on a lightweight runner, dbt for transformation.
 
Rationale: writing pagination, retry, and watermark logic by hand is *better* portfolio signal than importing a library that does it invisibly. The reviewer can read every line and I can defend every line.
 
### Stack
 
| Layer | Tool |
|---|---|
| Extraction | Python + `requests` |
| Load | `google-cloud-bigquery` |
| Warehouse | BigQuery |
| Transformation | dbt Core |
| Scheduling | Modal, Prefect Cloud, or Dagster OSS (undecided — see open questions) |
| Infrastructure | Terraform |
| CI | GitHub Actions |
| Dashboard | Looker Studio |
 
### Multiple endpoints at different cadences
 
I plan to hit several RealtyAPI endpoints on different schedules (some daily, some weekly). Two axes must stay separate: **which endpoint** (what data) and **cadence** (when it runs). Consequences:
 
- Each endpoint gets its own file in `extract/endpoints/`, defining its path, fields, and destination raw table. Shared HTTP logic stays in `api_client.py`, so retry and pagination code is never copy-pasted.
- **Watermark state is tracked per endpoint.** `_pipeline_state` holds one row per endpoint. A single shared watermark would let a weekly job overwrite the daily job's watermark and silently lose data.
- **Vocabulary rule:** use "endpoint" everywhere in the Python code (folder name, function parameters, state table key). Do not mix in "source". (dbt has its own unrelated term, "sources", used in the dbt project; that stays as is.)
- **Entrypoint (chosen: Option A):** one `main.py` that takes the endpoint as an argument, e.g. `python -m extract.main --endpoint listings`. The scheduler calls it daily for daily endpoints and weekly for weekly ones. This avoids two entrypoint files drifting apart.
  - *Option B (not chosen, but valid):* separate `run_daily.py` / `run_weekly.py` entrypoints that loop over the endpoints in each cadence group. Better if "daily" grows to many endpoints. State the choice and reasoning in the README.
### Repo layout
 
```
your-repo/
├── extract/
│   ├── __init__.py            # empty
│   ├── config.py
│   ├── endpoints/
│   │   ├── __init__.py        # empty
│   │   ├── listings.py        # daily endpoint
│   │   └── agents.py          # weekly endpoint (example)
│   ├── api_client.py
│   ├── state.py
│   ├── bq_loader.py
│   ├── main.py
│   └── logging_config.py
├── tests/
│   ├── test_api_client.py
│   └── test_state.py
├── dbt/                       # dbt project
├── terraform/                 # GCP resource definitions
├── .github/                   # CI workflows
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── .gitignore
└── README.md
```
 
### What each Python file does
 
Each file has **one job**, so a reviewer can open any single file and understand it in about 30 seconds. This modularity is itself a signal of engineering maturity versus a single monolithic script.
 
| File | Job | Key contents |
|---|---|---|
| `config.py` | Settings in one place | Constants plus secrets read from environment variables: API key, BigQuery project ID, dataset names, base URL. Nothing else. |
| `endpoints/*.py` | One file per API endpoint | Endpoint path, which fields to extract, which raw BigQuery table it lands in. Calls the shared client; contains no retry logic. |
| `api_client.py` | Talks to RealtyAPI (most important file) | `fetch_page()` makes one HTTP request; `paginate()` is a generator that yields every page until done; `request_with_backoff()` retries on 429 and 5xx with exponentially increasing delay. |
| `state.py` | The watermark, per endpoint | `get_last_watermark(endpoint=...)` at run start; `set_watermark(endpoint=..., value=...)` only after a successful load. Backed by the `_pipeline_state` table. |
| `bq_loader.py` | Gets data into BigQuery | `load_raw_json(records, ingested_at)` writes to the date-partitioned raw table via `load_table_from_json`; `merge_into_deduped()` runs a `MERGE` so reprocessing never creates duplicates. |
| `main.py` | Orchestrator, short (~30-40 lines) | For the given endpoint: get watermark, paginate, load raw, merge, set watermark, log, alert on exception. Readable top to bottom as the pipeline's control flow. |
| `logging_config.py` | Structured logging | `setup_logging()` configures Python's `logging` for JSON-ish output: rows fetched, rows loaded, duration, errors. |
| `tests/test_api_client.py` | Proves retry and pagination work | Uses `unittest.mock` to fake API responses; asserts pagination stops correctly and a 429 triggers a retry. Run by CI on every PR. |
| `tests/test_state.py` | Proves watermark logic works | Tests per-endpoint read/write behavior. |
 
### `__init__.py` files
 
- Their presence marks a folder as a Python package, enabling imports like `from extract.api_client import paginate`.
- **Keep them empty.** Re-exports and package constants are possible, but re-exports add a layer of indirection, and explicit imports (`from extract.endpoints.listings import fetch_listings`) are more legible for a ten-minute review.
### Dependency files (repo root)
 
Both live at the **repo root**, next to `README.md`, because the first thing a cloner runs is `pip install -r requirements.txt`.
 
- `requirements.txt` (runtime): `requests`, `google-cloud-bigquery`, `python-dotenv` (loads a local `.env` so `config.py` can read env vars).
- `requirements-dev.txt` (dev/CI only): `pytest`, `ruff`. Splitting runtime from dev dependencies is a small signal that I know what production needs versus what only CI needs.
- **Pin versions** (e.g. `requests==2.32.3`) so the project is reproducible and avoids "works on my machine, breaks in CI." Generate with `pip freeze`, then trim to only the packages actually imported (freeze also dumps sub-dependencies).
- `.env.example` shows every environment variable `config.py` expects, with placeholder values and no real secrets. It answers "how do I run this" at a glance. The real `.env` goes in `.gitignore`.
### BigQuery layering
 
`realty_raw` → `realty_staging` → `realty_marts`
 
- **raw** — full JSON payload preserved, plus `ingested_at`. Date-partitioned, clustered on a common filter key (zip or state). Append-only, then `MERGE`d into a deduplicated layer on the natural key. One raw table per endpoint.
- **staging** — one model per source. Light casting and renaming only.
- **marts** — business-facing. Includes the SCD2 listing history.
## Build plan
 
**Week 1 — extraction**
1. Create GCP project and datasets. Terraform them (~40 lines; cheapest credibility available).
2. Set up the repo skeleton: folder layout above, `requirements.txt`, `requirements-dev.txt`, `.env.example`, `.gitignore`.
3. Write `api_client.py` (pagination, exponential backoff on 429s) and `state.py` (watermark read from a `_pipeline_state` table in BigQuery at run start and written at run end, **keyed by endpoint**). *The state table is what makes this a pipeline rather than a script.*
4. Write the first endpoint file (`endpoints/listings.py`) and `main.py --endpoint listings`.
5. Load via `load_table_from_json` into the date-partitioned raw table, then `MERGE` on the natural key. Prove reruns are safe.
**Week 2 — schedule**
6. Deploy to the chosen runner, with one schedule per cadence calling `main.py` with the right `--endpoint` argument. Add the weekly endpoint.
7. Structured logging (rows fetched, rows loaded, duration) plus a failure alert (email or Slack webhook).
 
**Week 3 — transform**
8. dbt Core: sources with `freshness` blocks, staging models, `dbt snapshot` using the **`check` strategy** for listing history, then marts.
9. Run `dbt build` immediately after a successful extract, in the same scheduled job.
 
**Week 4 — polish**
10. CI: `ruff`, `pytest` on pagination and watermark logic against a mocked API response, `dbt build` against a dev dataset on PR.
11. Looker Studio dashboard, README with architecture diagram and a "tradeoffs and what I'd do at 1000x scale" section.
 
## Key decisions and why
 
**One job per file, endpoints as first-class.** A monolithic `extract.py` forces a reviewer to read everything to understand anything. Small single-purpose files with clear names fit a ten-minute review. Splitting `endpoints/` from the shared `api_client.py` shows I recognized that endpoint and cadence are separate axes.
 
**Watermarks are per endpoint.** A single shared watermark corrupts incremental logic as soon as two endpoints run on different schedules. Worth walking an interviewer through.
 
**`dbt snapshot` with the `check` strategy, not `timestamp`.** The API may not expose a reliable `updated_at` field. The `check` strategy compares a specified column list (price, status, description) and works either way. Choosing it *for that reason* is a defensible design decision worth stating explicitly in the README.
 
**dbt is table stakes, not a differentiator.** Its absence reads as a gap; its presence alone impresses nobody. What counts is layer discipline, a small number of tests that encode real invariants (including at least one custom singular test), and explicit `unique_key` / `incremental_strategy` on incremental models. Avoid: 40 models on 3 sources, `select *` staging models, blank descriptions.
 
**Idempotency is the thing interviewers probe.** Rerunning yesterday's load must not duplicate rows. Be able to demonstrate this on demand ("run it twice, row count doesn't change").
 
**Cost awareness is a cheap differentiator.** BigQuery bills on bytes scanned. Partition pruning is *why* the raw table is date-partitioned. Set a partition expiration.
 
**Reproducibility.** Pinned, split requirements files and an `.env.example` mean a reviewer can clone and run the project.
 
## Explicitly rejected (do not re-suggest)
 
- **dlt (dltHub)** — real, capable Apache-2.0 library, but ~5.7k GitHub stars and limited enterprise penetration. For a project whose entire purpose is legibility, obscurity is a cost: interview time gets spent explaining the library instead of the design. Keep as a "what I'd use in production" line in the README only.
- **BigQuery Data Transfer Service** — fixed connector list (Google Ads, Campaign Manager, YouTube, Analytics, S3, Azure Blob, Redshift). Cannot hit arbitrary REST APIs.
- **Datastream** — CDC from Postgres/MySQL/Oracle. Not for APIs.
- **Cloud Composer** — managed Airflow, hundreds of dollars per month even idle.
- **Dataflow / Dataproc** — Beam and Spark are for parallel processing of large data, wrong shape for a rate-limited API pull.
- **Cloud Workflows** — capable, but YAML gets unpleasant with real pagination logic and it's a proprietary DSL, so less portable signal.
- **Dataform** — Google's dbt competitor, free in BigQuery. Rejected in favor of dbt for ecosystem and job-description keyword match. Worth *mentioning* as an evaluated alternative.
- **Kafka / Spark / Kubernetes** — resume-driven overkill at a few thousand rows a day. Reads as poor judgment.
- **Populating `__init__.py` with re-exports** — adds indirection; keep the files empty and use explicit imports.
- **A single monolithic `extract.py`** — hard to review and test.
## Open questions
 
1. **Which RealtyAPI?** The name maps to several products (RentCast/Realty Mole, RapidAPI "Realty in US", ATTOM). They differ in pagination style, rate limits, and auth.
2. **Does each endpoint expose a per-listing last-updated timestamp?** Determines the incremental strategy on extraction, per endpoint. (Does *not* affect the dbt snapshot decision — `check` works either way.)
3. **Which scheduler?**
   - *Modal* — `@app.function(schedule=modal.Cron(...))`, no Docker, generous free tier. Fastest path.
   - *Prefect Cloud* — free tier, real orchestration UI with retries and run history. Best resume vocabulary.
   - *Dagster OSS* — most work, best asset-lineage story.
   - Any of them can call `main.py --endpoint <name>` on separate daily and weekly schedules.
4. **Which endpoints, and at what cadence?** Final list of endpoints (beyond the listings and agents examples) and which run daily versus weekly.
## Possible phase 2
 
Migrate the same pipeline to Cloud Run jobs + Cloud Scheduler + Artifact Registry, containerized with Docker. The migration itself becomes a README section — "started simple, moved to Cloud Run when I needed scheduling reliability" is a stronger story than either endpoint alone, and it adds containerization and cloud deployment to the demonstrated skill set.
 