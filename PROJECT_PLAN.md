# Construction Project Management Suite

## Product Direction

This should be built as a modular React application with a strong local-first data model and clear separation between:

- project master data
- planning and execution data
- quantity and materials data
- procurement and cost control
- AI-assisted generation workflows

The right first target is not "full ERP for construction." The right first target is:

**A single-project management suite that lets a user define a project, build a schedule, generate BOQ/BOM items, track procurement, and monitor budget and progress from one dashboard.**

That scope is still ambitious, but it is realistic if implemented in phases.

## Recommended Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui for consistent primitives
- Recharts for dashboard charts
- `window.storage` for persistence behind a small repository layer
- `date-fns` for date calculations
- `zod` for schema validation
- Optional:
  - `react-hook-form` for forms
  - `uuid` for entity ids

## Product Modules

### 1. Project Setup

Purpose:
- Define the baseline project profile used by all downstream modules.

Fields:
- `name`
- `projectType`
- `location`
- `clientName`
- `totalArea`
- `floors`
- `startDate`
- `plannedDurationDays`
- `targetBudget`
- `currency`
- `description`

Outputs:
- project summary card
- baseline dates
- budget baseline

### 2. Scheduling / Gantt

Purpose:
- Build and visualize project execution plan.

Core features:
- create/edit/delete tasks
- set start date or start offset
- duration in days
- dependencies
- assigned category/trade
- progress percentage
- status
- milestone flag

Views:
- task table
- simple Gantt timeline
- dependency warnings

Suggested v1 simplification:
- support finish-to-start dependencies only
- avoid drag-and-drop in the first release

### 3. BOQ Generator

Purpose:
- Manage bill of quantities by trade and work item.

Core features:
- manual entry
- dimension-based quantity calculator
- grouping by trade
- totals by unit/trade
- AI-assisted draft generation from project description

Suggested calculation fields:
- `length`
- `width`
- `height`
- `count`
- `wastagePercent`
- computed `quantity`

### 4. BOM Generator

Purpose:
- Convert BOQ items into materials requirements.

Core features:
- link BOM items to BOQ entries
- define conversion rules
- aggregate duplicate materials
- unit cost tracking
- total material cost

Suggested v1 rule:
- keep conversion semi-manual with editable AI suggestions

### 5. Cost Estimation

Purpose:
- Track projected and actual cost across materials, labor, and equipment.

Core features:
- estimate totals by category
- compare baseline vs actual
- cost breakdown charts
- budget overrun alerts

Cost buckets:
- materials
- labor
- equipment
- subcontract
- contingency

### 6. Procurement Tracker

Purpose:
- Track ordering and delivery of materials.

Core features:
- purchase request list
- supplier tracking
- ordered vs delivered quantities
- expected delivery date
- stock/inventory snapshot
- delayed delivery alerts

Suggested v1 simplification:
- no complex warehouse transfers
- one site inventory pool

### 7. Dashboard

Purpose:
- Surface the health of the project at a glance.

Widgets:
- project summary
- progress %
- tasks at risk
- budget vs actual
- procurement status
- delivery delays
- top cost drivers

### 8. AI Assistant

Purpose:
- Generate structured suggestions from plain-language project descriptions.

Good v1 use cases:
- suggest project task breakdown
- draft BOQ items
- suggest BOM mappings
- summarize project risks

Important product rule:
- AI output should always be editable before committing to stored data.

## Recommended Information Architecture

Top-level navigation:

- Dashboard
- Schedule
- BOQ
- BOM & Cost
- Procurement
- AI Assistant
- Settings

Suggested shell layout:

- left sidebar for main modules
- top bar for project switcher and save/sync state
- content area for active module
- right drawer for contextual details when editing records

## State Model

Use normalized state with entity collections instead of large nested objects. That will make cross-module calculations much easier.

### Project

```ts
type Project = {
  id: string;
  name: string;
  projectType: string;
  location: string;
  clientName: string;
  totalArea: number;
  floors: number;
  startDate: string;
  plannedDurationDays: number;
  targetBudget: number;
  currency: string;
  description: string;
  updatedAt: string;
};
```

### Task

```ts
type Task = {
  id: string;
  projectId: string;
  name: string;
  category: string;
  startDate: string;
  durationDays: number;
  progress: number;
  status: "not_started" | "in_progress" | "blocked" | "done";
  dependencyIds: string[];
  milestone: boolean;
  assignee?: string;
  notes?: string;
};
```

### BOQ Item

```ts
type BoqItem = {
  id: string;
  projectId: string;
  trade: string;
  item: string;
  description: string;
  unit: string;
  quantity: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    count?: number;
    wastagePercent?: number;
  };
  linkedTaskIds: string[];
};
```

### BOM Item

```ts
type BomItem = {
  id: string;
  projectId: string;
  material: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  linkedBoqItemIds: string[];
};
```

### Procurement Record

```ts
type ProcurementRecord = {
  id: string;
  projectId: string;
  material: string;
  supplier: string;
  qtyRequested: number;
  qtyOrdered: number;
  qtyDelivered: number;
  unit: string;
  unitCost: number;
  expectedDate?: string;
  receivedDate?: string;
  status: "draft" | "ordered" | "partial" | "delivered" | "delayed";
};
```

### Alert

```ts
type Alert = {
  id: string;
  projectId: string;
  type: "schedule" | "budget" | "procurement";
  severity: "info" | "warning" | "critical";
  message: string;
  relatedEntityId?: string;
  createdAt: string;
  resolved: boolean;
};
```

## Derived Data

Keep these as computed selectors rather than stored fields whenever possible:

- total planned cost
- total actual cost
- project progress average
- delayed tasks
- delayed procurements
- material shortages
- budget variance
- schedule variance

## Persistence Strategy

Wrap `window.storage` in a dedicated data access layer so UI components never directly read/write raw storage keys.

Suggested storage shape:

```ts
type AppState = {
  projects: Project[];
  tasks: Task[];
  boqItems: BoqItem[];
  bomItems: BomItem[];
  procurementRecords: ProcurementRecord[];
  alerts: Alert[];
  activeProjectId?: string;
};
```

Recommended repository methods:

- `loadAppState()`
- `saveAppState(state)`
- `upsertProject(project)`
- `upsertTask(task)`
- `upsertBoqItem(item)`
- `upsertBomItem(item)`
- `upsertProcurement(record)`
- `deleteEntity(type, id)`

## AI Integration Design

Do not hardwire AI calls directly into components. Use an adapter:

```ts
type AiProvider = {
  generateTaskPlan(input: string): Promise<...>;
  generateBoq(input: string): Promise<...>;
  generateBom(input: string): Promise<...>;
  summarizeRisks(input: string): Promise<...>;
};
```

This keeps the app flexible whether the backend uses Claude, OpenAI, or another provider later.

Recommended UX:

- user enters a project description
- AI returns structured draft items
- app shows preview table
- user reviews and edits
- user clicks import

## Suggested Folder Structure

```txt
src/
  app/
    App.tsx
    routes/
    providers/
  components/
    layout/
    dashboard/
    gantt/
    boq/
    bom/
    procurement/
    ai/
    shared/
  features/
    project/
    scheduling/
    boq/
    bom/
    costing/
    procurement/
    alerts/
  lib/
    storage/
    ai/
    calculations/
    charts/
    dates/
    validation/
  hooks/
  types/
  data/
```

## Feature Sequencing

### Phase 1: Foundation

Build:
- app shell
- project setup form
- persistent state layer
- shared tables/forms
- dashboard skeleton

Goal:
- user can create and persist a project

### Phase 2: Schedule

Build:
- task CRUD
- dependency validation
- simple Gantt visualization
- progress tracking

Goal:
- user can plan execution timeline

### Phase 3: BOQ + BOM

Build:
- BOQ item CRUD
- quantity calculator
- BOM aggregation
- cost rollups

Goal:
- user can generate quantities and material requirements

### Phase 4: Procurement + Alerts

Build:
- procurement tracking
- delivery status monitoring
- low-stock / delay alerts

Goal:
- user can track material flow and procurement risk

### Phase 5: AI Assistant

Build:
- prompt input
- AI adapter integration
- review/import workflow

Goal:
- user can accelerate drafting without losing control

## MVP Recommendation

The strongest MVP is:

- single-project mode
- project setup
- task scheduling
- BOQ management
- BOM + cost rollup
- dashboard summaries
- local persistence

Leave these for later:

- multi-project portfolio analytics
- complex critical path engine
- drag-and-drop Gantt editing
- offline sync conflicts
- multi-warehouse inventory
- role-based permissions
- document management

## Key Risks

### 1. Scope risk

Combining scheduling, costing, procurement, and AI in one first release is a classic overbuild trap.

Mitigation:
- build around one project
- prioritize editable tables and dependable calculations over flashy automation

### 2. Data coupling risk

BOQ, BOM, cost, and procurement all influence each other.

Mitigation:
- use stable ids and explicit relationships
- centralize calculations in utility functions/selectors

### 3. AI reliability risk

AI can produce inconsistent units, duplicate items, and invalid cost assumptions.

Mitigation:
- require preview + manual confirmation
- validate units and required fields before import

### 4. Gantt complexity risk

Interactive Gantt components become expensive fast.

Mitigation:
- start with a read/write table plus rendered timeline
- defer drag behavior

## Recommended Build Decision

If we start implementation next, the best first build is:

1. scaffold React + TypeScript + Tailwind app
2. create app shell with sidebar tabs
3. implement project setup and persistent store
4. add dashboard cards using derived data
5. add schedule module with task table and simple Gantt bars

That creates a usable backbone for the rest of the suite.

## What I Would Build First

If we move from planning into coding, I would start with:

- domain types
- storage repository
- seeded empty state
- app shell and navigation
- Project Setup tab
- Dashboard tab
- Schedule tab

That gives us a stable foundation before touching BOQ/BOM/procurement logic.
