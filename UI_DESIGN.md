## ModelForge — UI Design and Build Plan

This document specifies the complete rebuild of the frontend(s) with a minimalist, Windows 11–inspired dark aesthetic. It defines principles, tech stack, information architecture, page specifications, components, motion, and an implementation roadmap.

### Objectives
- **Minimalist, modern Windows 11 dark vibe**: calm surfaces, soft elevation, rounded corners, subtle glass, consistent accent.
- **Production-grade UX**: accessibility, responsive layout, keyboard navigation, robust validation, optimistic interactions.
- **Smooth, consistent motion**: cohesive durations/easings and micro-interactions; avoid over-animation.
- **Polish and effects**: subtle blur/glass, accent glows, ambient gradients, skeletons, pleasant soundness without distraction.
- **Bring dashboard to life**: real-time charts, win rates, latency/cost insights, and run drill-down.
- **Growth space**: battle mode, ELO ratings, multi-provider comparisons, future pages and modules.

## 1) Design Language

### 1.1 Visual Style
- **Color**: Windows 11 dark palette with a single accent.
  - Background: `#0b0f13` (deep navy charcoal)
  - Surface 1: `#0f141a`
  - Surface 2 (elevated): `#141a22`
  - Text primary: `#e6edf3`
  - Text secondary: `#9fb1c1`
  - Borders: `#1e2630`
  - Accent (Windows 11 blue): `#4cc2ff` (with hover `#66d0ff`) — configurable
  - Success: `#3ddc97`, Warning: `#ffd166`, Danger: `#ff6b6b`, Muted: `#6b7785`
- **Typography**: `Segoe UI Variable`, fallback to `Inter, system-ui, -apple-system, "Segoe UI", Roboto`.
  - Base size 15px, line-height 1.5; headings use tight letter-spacing and weight 600.
- **Radii and elevation**: 12px radius default; cards 14px; dialogs 18px.
  - Shadows are soft and colored: `0 10px 30px rgba(76, 194, 255, 0.06)` on accent surfaces; `0 6px 24px rgba(0,0,0,0.35)` base.
- **Glass/Mica**: apply subtle backdrop blur on sidebar/topbar (8–12px), low-contrast noise texture optional.

### 1.2 Design Tokens (CSS variables)
Defined under `:root, .theme-dark` for dark-first design; future `.theme-light` supported.

```
:root {
  --bg: #0b0f13; --surface-1: #0f141a; --surface-2: #141a22;
  --text: #e6edf3; --text-dim: #9fb1c1; --border: #1e2630;
  --accent: #4cc2ff; --accent-600: #3fb5f2; --accent-300: #66d0ff;
  --success: #3ddc97; --warn: #ffd166; --danger: #ff6b6b; --muted: #6b7785;
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 18px;
  --elev-1: 0 6px 18px rgba(0,0,0,0.25);
  --elev-2: 0 10px 30px rgba(0,0,0,0.35);
  --elev-accent: 0 10px 30px rgba(76, 194, 255, 0.08);
  --dur-quick: 120ms; --dur-base: 200ms; --dur-slow: 320ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
  --ease-emphasized: cubic-bezier(.2,.0,0,1);
  --focus: 0 0 0 2px #0b0f13, 0 0 0 4px rgba(76, 194, 255, 0.65);
}
```

### 1.3 Motion System
- Page transitions: fade+slide 8px, `--dur-base`, `--ease-emphasized`.
- Interactive micro states: hover (elevate +2px shadow), press (scale 0.99), focus ring via `--focus`.
- Skeleton shimmer: 1400ms diagonal gradient; reduce-motion respects OS setting.

### 1.4 Accessibility
- Color contrast ≥ 4.5:1 for body text; ≥ 3:1 for large text.
- Keyboard-first navigation, focus visibility always-on.
- ARIA for charts, live regions for streaming tokens.

## 2) Technical Stack

- **App Framework**: React 18 + Vite + TypeScript.
- **Routing**: React Router 6 with nested layouts.
- **Data**: TanStack Query for caching/retries; native `EventSource` for SSE; Zod for client-side schema safety.
- **State**: Local component state + lightweight Zustand for UI-only global state (theme, toasts, drawers).
- **UI Primitives**: Radix UI for accessible components; Tailwind CSS for utility styling with custom tokens; class-variance-authority for variants.
- **Animation**: Framer Motion for page/element transitions.
- **Charts**: Apache ECharts via `echarts-for-react` for performance and theming.
- **Icons**: Lucide.
- **Forms**: React Hook Form + Zod resolver.
- **Formatting**: Prettier; ESLint later.

Note: This replaces the current frontend scaffolding; existing `apps/web` will be rebuilt using this stack and design system.

## 3) Information Architecture and Navigation

Primary navigation (persistent sidebar):
- Dashboard
- Runs
- Problem Sets
- Providers & Models
- Review (HTML tasks)
- Battle (Coming Soon)
- Settings

Secondary topbar: environment picker (Dev/Prod), quick actions (New Run), search/command palette (⌘K), profile.

## 4) Page Specifications

### 4.1 Dashboard
- Purpose: at-a-glance performance, throughput, and cost.
- Layout:
  - KPI strip: Accuracy, Avg Latency, Cost, Tokens (today/7d) with trend arrows.
  - Charts:
    - Accuracy by model (bar grouped by problem set)
    - Latency distribution (violin or box plots per model)
    - Cost over time (area)
    - Pairwise win matrix (heatmap, initial with currently available run data)
  - Recent runs table with status pills and quick actions.
- Interactions: filter by problem set, model(s), time range; deep-link to run details.

### 4.2 Runs
- List: searchable, filter by status; columns: Name, Problem Set, Models count, Judge, Status, Created.
- Actions: New Run (drawer), Start/Resume, View Details.
- Create Run (drawer/modal):
  - Select problem set, judge model, models to test, streaming toggle.
  - Validations (judge required).
- Run Detail:
  - Header: metadata, status, start/stop controls, export (CSV/JSON).
  - Live stream panel (SSE): per-problem per-model tokens; compact diff-like tickers.
  - Results grid: problem × model matrix with verdict chips; click cell for full output/trace.

### 4.3 Problem Sets
- List and CRUD.
- Problem Set Detail: tabs for Problems, Analytics, Settings.
- Problem Editor:
  - Type: text | html
  - Prompt editor with markdown preview; expected answer for text tasks.
  - For HTML tasks: tri-pane editors (HTML/CSS/JS) with live sandbox preview (iframe with strict sandbox flags, timeouts, no network).

### 4.4 Providers & Models
- Providers: list and create/edit provider (name, adapter, base URL, API key; show masked key; security footnote).
- Models: scoped by provider; add/edit model IDs and settings.
- Validation: adapter normalization mirrors server; ping button to check connectivity.

### 4.5 Review (HTML)
- Queue of HTML results needing manual review.
- Two-pane layout: left submissions list, right sandbox viewer with decision controls (Pass/Fail + notes).
- Persist via `POST /api/run-results/:id/review`.

### 4.6 Battle (Coming Soon)
- Placeholder with explanation, mock ELO card, and disabled controls.
- Design space for N-way comparisons and ELO ratings; future ready charts and matrix.

### 4.7 Settings
- Theme toggles, accent color, data export, API health check, about.

## 5) Components and Design System

### 5.1 App Shell
- Sidebar (glass), topbar (glass), content area; responsive: collapsible sidebar, mobile sheet.

### 5.2 Core Components
- Button, IconButton, Input, Textarea, Select, Combobox, Switch, Checkbox, Radio, Slider.
- Card, Metric, Badge/Status Pill, Tabs, Tooltip, Toast/Sonner, Popover, Dialog/Drawer.
- Table with virtualization for large result sets, Empty states, Pagination.
- Code/Pre blocks with copy; Diff viewer for model outputs.
- Chart wrapper with consistent theming.
- Skeleton loaders and shimmer.

### 5.3 Patterns
- List + Drawer Create/Edit
- Wizard (New Run)
- Matrix view (problem × model)
- Sandbox iframe component with security guardrails.

## 6) Data Integration

### 6.1 API
- REST via fetch bound to TanStack Query hooks.
- Zod schemas mirror server payloads and responses.

### 6.2 Streaming (SSE)
- `EventSource` to `/api/runs/:id/stream`.
- Event types: `run_status`, `candidate_token`, `candidate_done`, `html_candidate_done`, `judge_done`.
- Reconcile into Query cache; optimistic UI on token stream; backpressure with chunk batching.

### 6.3 Error Handling
- Global error boundary; inline error banners with retry.
- Network status indicator; exponential backoff for SSE reconnect.

## 7) Effects and Motion Details

- Subtle glass via `backdrop-filter: blur(10px)` and low-contrast gradient overlays.
- Accent glow on active nav items, focus rings with layered outline.
- Page transition: fade 8px slide; cards lift on hover; buttons ripple-lite (opacity pulse, not material ripple).
- Reduce-motion support.

## 8) Responsive and Layout

- Grid container max width 1440px; content gutters 24px.
- Breakpoints: 480 / 768 / 1024 / 1280 / 1536.
- Sidebar collapses under 1024; mobile bottom bar for primary sections.

## 9) Folder Structure (new `apps/web`)

```
apps/web/
  src/
    app/                 # routes/layouts
    components/          # design system
    features/            # domain modules (runs, providers, problems, dashboard)
    lib/                 # api, sse, query, zod schemas, utils
    styles/              # tokens.css, globals.css, tailwind.css
    index.tsx
```

## 10) Security and Privacy in UI

- Never display full API keys; masked with reveal-on-hover (opt-in) + copy masked.
- Warn on leaving page with unsaved changes.
- Sandbox viewer strictly prevents external network and limits execution time.

## 11) Implementation Roadmap

- M1: Foundation
  - Tooling (Vite, Tailwind, Radix, TanStack Query, Framer Motion, Lucide)
  - App shell, tokens, theming, routing, base components
- M2: Providers & Models
  - CRUD flows, validation, connectivity checks
- M3: Problem Sets & Problems
  - CRUD, editors, HTML sandbox render
- M4: Runs
  - Create run wizard, runs list, run detail, SSE live stream, exports
- M5: Dashboard
  - KPIs, charts, filters, drill-downs
- M6: Review
  - Manual HTML decision workflow
- M7: Battle (Placeholder → Alpha)
  - Pairwise view, proto ELO computation (read-only from existing results)

## 12) Success Criteria

- Consistent 60fps interactions, LCP < 2.5s on desktop, a11y checks pass, keyboard-only workable.
- Clear mental model: users can set up providers, create problems, run benchmarks, and view insights without docs.
- Visual polish aligned with Windows 11 dark aesthetics.

## 13) Open Questions / Future

- Theming per-user and preset packs.
- Import/export problem sets (JSON) and marketplace.
- Multi-tenant separation if needed later.


