## AI Benchmark (MVP)

Benchmark multiple AI models across predefined problems with a neutral judge. Minimalistic, Notion‑like UI with Windows 11 colors. Monorepo powered by npm workspaces.

[![Status](https://img.shields.io/badge/status-MVP%20WIP-orange)](./PLAN.md)
![Monorepo](https://img.shields.io/badge/monorepo-npm%20workspaces-blueviolet)
![Node](https://img.shields.io/badge/node-%3E%3D18.18-339933?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)
![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![Prettier](https://img.shields.io/badge/code_style-Prettier-ff69b4?logo=prettier)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

### Monorepo Layout
- apps/web: Vite + React + TypeScript UI
- apps/api: Fastify + TypeScript API with SQLite (better-sqlite3)
- packages/shared: Shared types and utilities

See PLAN.md and UI_DESIGN.md for architecture, milestones, and UX notes.

---

## Features (MVP)
- Benchmark multiple models across a problem set (text and HTML task types)
- Neutral judge with rubric and strict JSON output; simple exact/regex/fuzzy scoring for text
- Runs execution with streaming progress via SSE; per‑problem submissions stored with latency/usage
- Provider and model registry (OpenAI‑compatible, Anthropic, Gemini, custom HTTP planned)
- Minimal dashboard and leaderboard summaries
- SQLite storage with bootstrap schema (no Prisma)

## Tech Stack
- Frontend: React 18, Vite, React Router, TanStack Query, Zustand, Framer Motion, ECharts
- Backend: Fastify 4, better‑sqlite3, @fastify/cors, @fastify/rate‑limit
- Language/Build: TypeScript 5, Prettier

---

## Quick Start

### Prerequisites
- Node.js >= 18.18
- npm >= 8

### Install
- From repo root:
  - npm install
  - Optional (explicit): npm run install:all

### Run (Dev)
- One command (recommended):
  - npm run start
  - Starts API on http://localhost:5174 and Web on http://localhost:5175 (with /api proxied to 5174)
- Individually:
  - API: npm run start:api
  - Web: npm run start:web

### Build
- Build all workspaces: npm run build
- API only: npm run build -w @ai-benchmark/api then npm run start -w @ai-benchmark/api
- Web only: npm run build -w @ai-benchmark/web then npm run preview -w @ai-benchmark/web

---

## Configuration

### Environment variables (apps/api/.env)
- PORT: API port (default 5174)
- Note: In the current MVP, provider API keys are stored as provided. Future milestone aims to encrypt at rest (see PLAN.md Security section).

### Ports & Proxy
- API: http://localhost:5174
- Web Dev: http://localhost:5175 (Vite dev server)
- Dev proxy: /api -> http://localhost:5174 (configured in apps/web/vite.config.ts)

### Database
- SQLite file lives at apps/api/var/data.sqlite (created on first run)
- WAL mode enabled; schema bootstrapped automatically on server start

---

## How It Works (High‑Level)
1) Define providers and models (e.g., OpenAI‑compatible endpoint + model IDs)
2) Create problem sets and problems (text or HTML)
3) Start a run selecting: problem set, judge model, and models to evaluate
4) Watch live progress via SSE; review submissions and judgments
5) Explore summary metrics (accuracy, latency, costs) and leaderboard

---

## Known Limitations / Considerations
- MVP; endpoints and UI are evolving—expect breaking changes
- No authentication or multi‑user access yet; do not expose publicly
- API keys stored as plain values in DB for now; prefer test keys
- HTML task sandbox, manual review flows, and multi‑provider adapters are WIP

---

## Roadmap
- See PLAN.md for milestones (Problems CRUD, Runs, HTML sandbox, Multi‑provider, Battle/ELO)
- See UI_DESIGN.md for interaction patterns and visual guidelines

## Contributing
- Code style: Prettier (npm run format)
- Issues/PRs welcome. Please keep scope tight and align with PLAN.md milestones.

## License
MIT