# Construction Project Management Suite

Initial React + TypeScript scaffold for a construction project management tool with:

- sidebar-based app shell
- project setup module
- dashboard module
- schedule module with task register and simple Gantt-style timeline
- BOQ module with dimension-based quantity calculations
- BOM & cost module with derived material rollups
- typed domain model
- local persistence through a `window.storage` adapter with `localStorage` fallback

## Current Structure

- `src/App.tsx`: top-level app state, navigation, and module switching
- `src/types/domain.ts`: project, task, BOQ, BOM, procurement, alert, and app state types
- `src/lib/storage.ts`: persistence layer
- `src/lib/calculations.ts`: derived metrics and schedule helpers
- `src/features/project/ProjectSetupTab.tsx`: project baseline form
- `src/features/dashboard/DashboardTab.tsx`: executive summary cards and signals
- `src/features/schedule/ScheduleTab.tsx`: task form, timeline, and task table
- `src/features/boq/BoqTab.tsx`: quantity takeoff form and BOQ register
- `src/features/bom/BomCostTab.tsx`: material aggregation and cost breakdown

## Running It

This workspace currently does not have a package manager configured on PATH, so dependencies were not installed in-session.

Once `npm` is available, run:

```bash
npm install
npm run dev
```

## Next Recommended Build Steps

1. Add editable BOM overrides and supplier-specific rates.
2. Add procurement records and delivery alerts.
3. Add import/export utilities and report-ready summaries.
4. Add AI draft-generation and BOQ-to-BOM suggestion workflows.
