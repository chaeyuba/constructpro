# Construction Project Management Suite

React + TypeScript construction project management app for planning, quantity takeoff, costing, scheduling, procurement tracking, reporting, and AI-assisted review.

## Current Modules

- Smart Compute wizard for generating BOQ, BOM, and schedule baselines
- Dashboard with progress, budget, and procurement snapshots
- Schedule tab with Gantt-style visualization and task progress sliders
- BOQ register for quantity review
- BOM & Cost tab with cost rollups
- Procurement tracker for ordered vs delivered materials
- Reports tab for cash-flow and benchmark views
- AI assistant wired for a backend proxy endpoint

## Stack

- React 18
- TypeScript
- Vite
- Recharts

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The local workspace build has been verified successfully with Vite.

## Notes

- The AI assistant is configured to call a backend proxy endpoint instead of exposing provider secrets in the browser.
- The app supports a `window.storage` API when available and falls back to `localStorage`.
