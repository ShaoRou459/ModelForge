# AI Benchmark - Project Plan

This document captures the scoped MVP and phased delivery so we don't get lost during implementation. It also doubles as the living spec for the codebase.

## 1. Goals

- Benchmark multiple AI models via user-provided API endpoints (OpenAI-compatible, Anthropic, Gemini, and custom).
- Define problems (text and HTML coding tasks) and run benchmarks across N models (2–8+) including pairwise battle mode.
- Auto-judge using a neutral model with a strict JSON schema, plus manual decision for HTML questions.
- Minimalistic, Notion-like web UI using Windows 11 colors.
- MVP-first: deliver a reliable, simple product with a clear iteration path.

## 2. Architecture Overview

- Monorepo with npm workspaces:
  - apps/web: Vite + React + TypeScript UI.
  - apps/api: Fastify + TypeScript server.
  - packages/shared: Shared types and utilities.
- Database: SQLite (better-sqlite3), no Prisma. Bootstrap SQL on server start. Optional migration to Turso/LibSQL later.
- Provider adapters:
  - OpenAI-compatible (OpenAI, OpenRouter, local vLLM/llama.cpp, etc.)
  - Anthropic (Claude Messages)
  - Google Gemini (REST)
  - Custom HTTP (experimental)
- Judging:
  - Heuristics for text (exact/regex/fuzzy).
  - LLM judge with rubric and strict JSON output.
  - HTML judge via DOM snapshot + rules; manual review UI override.
- Security: Encrypt stored API keys with AES-GCM using env key. Do not leak keys to the frontend. Strict CORS, basic rate limits.
- HTML sandbox: iframe with sandbox flags, CSP, runtime that blocks external network, and timeouts.

## 3. Data Model (SQLite)

Tables (columns are concise; many JSON fields stored as TEXT):
- providers(id TEXT PK, name TEXT, adapter TEXT, base_url TEXT, api_key_enc BLOB, default_model TEXT, created_at INTEGER)
- models(id TEXT PK, provider_id TEXT, label TEXT, model_id TEXT, settings TEXT)
- problem_sets(id TEXT PK, name TEXT, description TEXT, created_at INTEGER)
- problems(id TEXT PK, problem_set_id TEXT, type TEXT, prompt TEXT, expected_answer TEXT, html_assets TEXT, scoring TEXT)
- runs(id TEXT PK, problem_set_id TEXT, judge_model_id TEXT, status TEXT, created_at INTEGER)
- run_models(id TEXT PK, run_id TEXT, model_id TEXT)
- submissions(id TEXT PK, run_id TEXT, problem_id TEXT, model_id TEXT, request TEXT, response TEXT, latency_ms INTEGER, token_usage TEXT, cost REAL, created_at INTEGER)
- judgments(id TEXT PK, submission_id TEXT, judge_model_id TEXT, verdict TEXT, confidence REAL, rationale TEXT, created_at INTEGER)
- manual_overrides(id TEXT PK, submission_id TEXT, verdict TEXT, notes TEXT, reviewer TEXT, created_at INTEGER)

Notes:
- Store timestamps as epoch ms (INTEGER).
- token_usage/cost may be null if provider doesn't return.

## 4. API Surface (Initial)

- Providers/Models:
  - POST /providers
  - GET /providers
  - POST /models
  - GET /models
- Problem Sets/Problems:
  - POST /problem-sets
  - GET /problem-sets
  - POST /problems
  - GET /problems?problemSetId=
- Runs:
  - POST /runs
  - GET /runs
  - GET /runs/:id
  - POST /runs/:id/start
  - GET /runs/:id/results
- Submissions:
  - POST /submissions/:id/manual-override

## 5. Provider Adapters Interface

TypeScript signature (shared):
- provider.invokeChat(args): { content, tokenUsage, raw, latencyMs }
- provider.invokeText(promptArgs) → implemented via invokeChat
- provider.invokeHtmlTask(args): returns { html, css, js, tokenUsage, raw }

Adapters normalize:
- OpenAI-compatible chat.completions
- Anthropic messages
- Gemini generative model

## 6. Judging Strategies

- Text:
  - exact/regex/fuzzy threshold
  - LLM judge JSON: { "verdict": "pass|fail|unknown", "confidence": number, "rationale": string }
- HTML:
  - DOM checks (selectors/innerText)
  - LLM judge using simplified DOM snapshot
  - Manual review override wins

LLM Judge prompt (system):
You are a strict but fair evaluator. Output only strict JSON: {"verdict":"pass|fail|unknown","confidence":0..1,"rationale":"string"}

User template:
Problem: "{prompt}"
Expected: "{expected}"
Candidate: "{output}"
Rules: {rulesJSON}
Decide pass/fail/unknown and provide rationale.

## 7. Battle Mode (N-way)

- Select 2–8+ models.
- Pairwise comparisons across the selected subset (round-robin) using a neutral judge or human A/B.
- Aggregate: win rates per model, ELO-like rating, significance via binomial CI.

## 8. UI Pages (MVP)

- Providers & Models:
  - Add provider (base URL, API key, adapter, default model).
  - Add model configs (label, modelId, settings).
- Problem Sets & Problems:
  - CRUD sets.
  - CRUD problems: type = text | html; for html include assets tabs (HTML/CSS/JS) and live preview.
- Runs:
  - Create run: choose problem set, judge model, models to test, params.
  - Start + live progress; per-task detail view with model output and judgment.
- Dashboard:
  - Accuracy per model, latency distributions, cost table.
  - Battle view: matrix of pairwise win rates.
- Review:
  - HTML sandbox renderer in iframe; manual pass/fail.

Style:
- Notion-like layout with Windows 11 accent color.
- Large line-height, rounded cards, subtle shadows.

## 9. Security

- API keys encrypted at rest (AES-GCM with env key).
- Never return secrets via API.
- CORS limited to local/dev origins initially.
- Iframe sandbox for HTML tasks; injected runtime blocks network.

## 10. Deployment

- Dev: both web and api on localhost, with proxy.
- Prod:
  - API on Render/Fly.
  - Web on Netlify/Vercel.
  - SQLite with Litestream or migrate to Turso.

## 11. Milestones

M1: Scaffolding
- npm workspaces, MIT license, .editorconfig, .gitignore, Prettier, TS strict.
- apps/web Vite + React baseline.
- apps/api Fastify baseline.
- packages/shared: types, utils stubs.

M2: Data/Providers
- SQLite bootstrap, DB helpers.
- Providers/models endpoints.
- OpenAI-compatible adapter.

M3: Problems
- Problem sets and problems CRUD.
- Simple text judging (exact/regex/fuzzy).

M4: Runs
- Execution loop, submission storage, LLM judge (one adapter).
- Results endpoint and basic dashboard.

M5: HTML Tasks
- Sandbox preview, DOM checks, manual overrides.

M6: Multi-provider & Battle
- Anthropic and Gemini adapters.
- N-way battle and ELO-like summary.

## 12. Dev Conventions

- TypeScript strict: true.
- ESM modules across projects.
- Import aliases via tsconfig paths (@shared/*).
- Prettier for formatting; .editorconfig for line endings and spaces.
- Commit style: Conventional Commits (feat:, fix:, chore:, refactor:, docs:).

## 13. Risks and Mitigations

- Provider response variance → robust parsing, retries, and schema guards.
- SQLite concurrency → better-sqlite3 is sync and safe for single-node MVP.
- HTML sandbox escapes → CSP + interceptors + timeouts.
- Cost tracking accuracy → allow manual pricing overrides.