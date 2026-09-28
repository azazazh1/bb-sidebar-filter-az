// @vitest-environment jsdom
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import {
  loadPluginApp,
  renderSlot,
} from "@get-bb/plugin-sdk/testing/app";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginThreadListProps,
} from "@get-bb/plugin-sdk/app";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const project: PluginSidebarProject = {
  id: "project-1",
  name: "Sidebar Filter",
  isPersonal: false,
  href: "/projects/project-1",
  settingsHref: "/projects/project-1/settings",
};

const thread: PluginSidebarThread = {
  id: "thread-1",
  projectId: project.id,
  title: "Fix sidebar actions",
  titleFallback: null,
  displayTitle: "Fix sidebar actions",
  parentThreadId: null,
  lifecycleOwnerThreadId: null,
  sourceThreadId: null,
  sectionId: null,
  originKind: null,
  originPluginId: null,
  providerId: "codex",
  status: "idle",
  runtimeStatus: "idle",
  queuedWork: "none",
  hasPendingInteraction: false,
  activity: {
    workflows: 0,
    backgroundAgents: 0,
    backgroundCommands: 0,
    planMode: 0,
    goals: 0,
  },
  indicator: "none",
  indicatorLabel: null,
  isUnread: false,
  isPinned: false,
  pinnedAt: null,
  pinSortKey: null,
  isArchived: false,
  archivedAt: null,
  href: "/projects/project-1/threads/thread-1",
  isHidden: false,
  environment: null,
  host: null,
  createdAt: 1,
  updatedAt: 2,
  lastReadAt: 2,
  latestAttentionAt: 2,
};

const slotProps: PluginThreadListProps = {
  activeThreadId: null,
  activeProjectId: project.id,
  isCompactViewport: false,
  onNavigate: vi.fn(),
  searchQuery: "",
};

let threadList: Awaited<ReturnType<typeof loadPluginApp>>["threadLists"][number];

beforeAll(async () => {
  const app = await loadPluginApp(() => import("./app"));
  threadList = app.threadLists[0]!;
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderThreadList() {
  return renderSlot(threadList, slotProps, {
    settings: { hideEmptyProjects: true, activeMode: "exists" },
    sidebarThreads: { status: "ready", projects: [project], threads: [thread] },
  });
}

describe("sidebar thread actions", () => {
  test("opens the row menu from a visible actions button", () => {
    const slot = renderThreadList();

    fireEvent.click(
      slot.getByRole("button", { name: "Actions for Fix sidebar actions" }),
    );

    const menu = slot.getByRole("menu");
    expect(menu).toBeTruthy();
    expect(menu.parentElement).toBe(document.body);
    expect(menu.getAttribute("data-bb-portaled-overlay")).toBe("");
    expect(menu.className).toContain("z-[70]");
    expect(slot.getByRole("menuitem", { name: "Archive" })).toBeTruthy();
    expect(slot.getByRole("menuitem", { name: "Delete…" })).toBeTruthy();
  });

  test("renames a thread through the host sidebar action", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Renamed thread");
    const slot = renderThreadList();

    fireEvent.click(
      slot.getByRole("button", { name: "Actions for Fix sidebar actions" }),
    );
    fireEvent.click(slot.getByRole("menuitem", { name: "Rename…" }));

    await waitFor(() =>
      expect(slot.inspection.sidebarActionCalls).toContainEqual({
        method: "rename",
        threadId: thread.id,
        title: "Renamed thread",
      }),
    );
  });

  test("copies the thread id without opening the thread", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const slot = renderThreadList();

    fireEvent.contextMenu(
      slot.getByRole("link", { name: "Fix sidebar actions" }),
    );
    fireEvent.click(slot.getByRole("menuitem", { name: "Copy thread ID" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(thread.id));
    expect(slot.inspection.sidebarActionCalls).toEqual([]);
  });

  test("routes archive and delete through the host flows", () => {
    const slot = renderThreadList();
    const actionsButton = slot.getByRole("button", {
      name: "Actions for Fix sidebar actions",
    });

    fireEvent.click(actionsButton);
    fireEvent.click(slot.getByRole("menuitem", { name: "Archive" }));
    fireEvent.click(actionsButton);
    fireEvent.click(slot.getByRole("menuitem", { name: "Delete…" }));

    expect(slot.inspection.sidebarActionCalls).toEqual([
      { method: "archive", threadId: thread.id },
      { method: "requestDelete", threadId: thread.id },
    ]);
  });
});

describe("active mode toggle", () => {
  test("toggles between all active and running-only projects", () => {
    const slot = renderThreadList();

    expect(slot.getByRole("button", { name: "○ All active" })).toBeTruthy();
    fireEvent.click(slot.getByRole("button", { name: "○ All active" }));
    expect(slot.getByRole("button", { name: "● Running" })).toBeTruthy();

    fireEvent.keyDown(window, {
      key: "a",
      code: "KeyA",
      altKey: true,
    });
    expect(slot.getByRole("button", { name: "○ All active" })).toBeTruthy();
  });
});

describe("thread status colors", () => {
  function renderWithThread(statusThread: PluginSidebarThread) {
    return renderSlot(threadList, slotProps, {
      settings: { hideEmptyProjects: true, activeMode: "exists" },
      sidebarThreads: {
        status: "ready",
        projects: [project],
        threads: [statusThread],
      },
    });
  }

  test("uses yellow for a working thread", () => {
    const slot = renderWithThread({ ...thread, indicator: "runtime" });
    const dot = slot
      .getByRole("link", { name: "Fix sidebar actions" })
      .querySelector("span");

    expect(dot?.className).toContain("bg-yellow-400");
  });

  test("uses green for an unread thread", () => {
    const slot = renderWithThread({ ...thread, isUnread: true });
    const dot = slot
      .getByRole("link", { name: "Fix sidebar actions" })
      .querySelector("span");

    expect(dot?.className).toContain("bg-green-500");
  });
});

describe("project menu and nesting", () => {
  const childThread: PluginSidebarThread = {
    ...thread,
    id: "thread-child",
    title: "Child thread",
    parentThreadId: thread.id,
  };

  function renderWith(threads: PluginSidebarThread[]) {
    return renderSlot(threadList, slotProps, {
      settings: { hideEmptyProjects: true, activeMode: "exists" },
      sidebarThreads: { status: "ready", projects: [project], threads },
      rpc: {
        renameProject: async () => ({ ok: true }),
        deleteProject: async () => ({ ok: true }),
        archiveAllThreads: async () => ({ ok: true }),
      },
    });
  }

  test("opens a project-level menu with built-in-style actions", () => {
    const slot = renderWith([thread]);

    fireEvent.click(
      slot.getByRole("button", { name: "Project actions for Sidebar Filter" }),
    );

    expect(slot.getByRole("menu")).toBeTruthy();
    expect(slot.getByRole("menuitem", { name: "New thread" })).toBeTruthy();
    expect(slot.getByRole("menuitem", { name: "Rename…" })).toBeTruthy();
    expect(
      slot.getByRole("menuitem", { name: "Archive all threads" }),
    ).toBeTruthy();
    expect(
      slot.getByRole("menuitem", { name: "Delete project…" }),
    ).toBeTruthy();
  });

  test("New thread routes through the host sidebar action", () => {
    const slot = renderWith([thread]);

    fireEvent.click(
      slot.getByRole("button", { name: "Project actions for Sidebar Filter" }),
    );
    fireEvent.click(slot.getByRole("menuitem", { name: "New thread" }));

    expect(slot.inspection.sidebarActionCalls).toContainEqual({
      method: "openNewThread",
      options: { projectId: project.id },
    });
  });

  test("Archive all threads calls the project rpc", async () => {
    const slot = renderWith([thread]);

    fireEvent.click(
      slot.getByRole("button", { name: "Project actions for Sidebar Filter" }),
    );
    fireEvent.click(
      slot.getByRole("menuitem", { name: "Archive all threads" }),
    );

    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({
        method: "archiveAllThreads",
        input: { projectId: project.id },
      }),
    );
  });

  test("Rename drives the project rpc with the prompted name", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Renamed project");
    const slot = renderWith([thread]);

    fireEvent.click(
      slot.getByRole("button", { name: "Project actions for Sidebar Filter" }),
    );
    fireEvent.click(slot.getByRole("menuitem", { name: "Rename…" }));

    await waitFor(() =>
      expect(slot.inspection.rpcCalls).toContainEqual({
        method: "renameProject",
        input: { projectId: project.id, name: "Renamed project" },
      }),
    );
  });

  test("nests a child thread under its parent", () => {
    const slot = renderWith([thread, childThread]);

    const parentLink = slot.getByRole("link", { name: "Fix sidebar actions" });
    const childLink = slot.getByRole("link", { name: "Child thread" });

    expect(parentLink).toBeTruthy();
    expect(childLink).toBeTruthy();
    // Child is indented one level deeper than the parent.
    expect(childLink.style.paddingLeft).not.toEqual(
      parentLink.style.paddingLeft,
    );
    expect(parseFloat(childLink.style.paddingLeft)).toBeGreaterThan(
      parseFloat(parentLink.style.paddingLeft),
    );
  });

  test("keeps an inactive parent visible when a child matches", () => {
    const inactiveParent: PluginSidebarThread = {
      ...thread,
      id: "thread-parent",
      title: "Idle parent",
      isArchived: true,
    };
    const activeChild: PluginSidebarThread = {
      ...thread,
      id: "thread-child",
      title: "Running child",
      parentThreadId: "thread-parent",
      isArchived: false,
      indicator: "runtime",
    };

    const slot = renderWith([inactiveParent, activeChild]);

    // Both render because the active child pulls its parent into view.
    expect(slot.getByRole("link", { name: "Idle parent" })).toBeTruthy();
    expect(slot.getByRole("link", { name: "Running child" })).toBeTruthy();
  });

  test("keeps a project visible when its only thread is unread", () => {
    const unreadArchivedThread: PluginSidebarThread = {
      ...thread,
      id: "thread-unread",
      title: "Unread archived thread",
      isArchived: true,
      isUnread: true,
    };

    const slot = renderWith([unreadArchivedThread]);

    expect(
      slot.getByRole("link", { name: "Unread archived thread" }),
    ).toBeTruthy();
  });
});
