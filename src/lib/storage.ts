import type {
  AppState,
  BoqInput,
  BoqItem,
  Project,
  ProjectInput,
  Task,
  TaskInput,
} from "../types/domain";
import { createId } from "./ids";
import { defaultState } from "./sampleData";

const STORAGE_KEY = "construction-project-management-suite";

type MaybeStorageResult = { value?: string } | string | null;

type StorageLike = {
  get?: (key: string) => Promise<MaybeStorageResult> | MaybeStorageResult;
  set?: (key: string, value: string) => Promise<void> | void;
  getItem?: (key: string) => Promise<string | null> | string | null;
  setItem?: (key: string, value: string) => Promise<void> | void;
};

declare global {
  interface Window {
    storage?: StorageLike;
  }
}

function getStorage(): StorageLike {
  if (typeof window !== "undefined" && window.storage) {
    return window.storage;
  }

  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}

async function persistState(state: AppState): Promise<void> {
  const storage = getStorage();
  if (storage.set) {
    await storage.set(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  await storage.setItem?.(STORAGE_KEY, JSON.stringify(state));
}

export async function loadAppState(): Promise<AppState> {
  const storage = getStorage();
  const rawValue = storage.get ? await storage.get(STORAGE_KEY) : await storage.getItem?.(STORAGE_KEY);
  const raw = typeof rawValue === "string" || rawValue === null
    ? rawValue
    : rawValue?.value ?? null;

  if (!raw) {
    await persistState(defaultState);
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    return parsed;
  } catch {
    await persistState(defaultState);
    return defaultState;
  }
}

export async function saveAppState(state: AppState): Promise<AppState> {
  await persistState(state);
  return state;
}

export async function upsertProject(
  state: AppState,
  input: ProjectInput,
  projectId?: string,
): Promise<AppState> {
  const nextProject: Project = {
    id: projectId ?? createId("project"),
    updatedAt: new Date().toISOString(),
    ...input,
  };

  const existingIndex = state.projects.findIndex((project) => project.id === nextProject.id);
  const projects = [...state.projects];

  if (existingIndex >= 0) {
    projects[existingIndex] = nextProject;
  } else {
    projects.push(nextProject);
  }

  return saveAppState({
    ...state,
    projects,
    activeProjectId: nextProject.id,
  });
}

export async function upsertTask(
  state: AppState,
  activeProjectId: string,
  input: TaskInput,
  taskId?: string,
): Promise<AppState> {
  const nextTask: Task = {
    id: taskId ?? createId("task"),
    projectId: activeProjectId,
    ...input,
  };

  const existingIndex = state.tasks.findIndex((task) => task.id === nextTask.id);
  const tasks = [...state.tasks];

  if (existingIndex >= 0) {
    tasks[existingIndex] = nextTask;
  } else {
    tasks.push(nextTask);
  }

  return saveAppState({
    ...state,
    tasks,
  });
}

export async function upsertBoqItem(
  state: AppState,
  activeProjectId: string,
  input: BoqInput,
  quantity: number,
  boqItemId?: string,
): Promise<AppState> {
  const nextBoqItem: BoqItem = {
    id: boqItemId ?? createId("boq"),
    projectId: activeProjectId,
    quantity,
    ...input,
  };

  const existingIndex = state.boqItems.findIndex((item) => item.id === nextBoqItem.id);
  const boqItems = [...state.boqItems];

  if (existingIndex >= 0) {
    boqItems[existingIndex] = nextBoqItem;
  } else {
    boqItems.push(nextBoqItem);
  }

  return saveAppState({
    ...state,
    boqItems,
  });
}
