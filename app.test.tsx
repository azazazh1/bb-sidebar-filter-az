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
import { computeProjectReorder, moveProjectStep } from "./app";
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
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
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

  test("rolls back when saving the mode fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const slot = renderThreadList();

    fireEvent.click(slot.getByRole("button", { name: "○ All active" }));
    expect(slot.getByRole("button", { name: "● Running" })).toBeTruthy();

    await waitFor(() =>
      expect(slot.getByRole("button", { name: "○ All active" })).toBeTruthy(),
    );
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

  test("keeps an unread error red", () => {
    const slot = renderWithThread({
      ...thread,
      isUnread: true,
      indicator: "unread-error",
    });
    const dot = slot
      .getByRole("link", { name: "Fix sidebar actions" })
      .querySelector("span");

    expect(dot?.className).toContain("bg-destructive");
    expect(dot?.className).not.toContain("bg-green-500");
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

  test("does not include an archived unread thread", () => {
    const unreadArchivedThread: PluginSidebarThread = {
      ...thread,
      id: "thread-unread",
      title: "Unread archived thread",
      isArchived: true,
      isUnread: true,
    };

    const slot = renderWith([unreadArchivedThread]);

    expect(
      slot.queryByRole("link", { name: "Unread archived thread" }),
    ).toBeNull();
  });

  test("shows empty projects when configured not to hide them", () => {
    const slot = renderSlot(threadList, slotProps, {
      settings: { hideEmptyProjects: false, activeMode: "exists" },
      sidebarThreads: { status: "ready", projects: [project], threads: [] },
    });

    expect(slot.getByRole("button", { name: "Sidebar Filter" })).toBeTruthy();
  });
});

describe("project reorder helpers", () => {
  const p1: PluginSidebarProject = {
    id: "p1",
    name: "P1",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const p2: PluginSidebarProject = {
    id: "p2",
    name: "P2",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const p3: PluginSidebarProject = {
    id: "p3",
    name: "P3",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const list = [p1, p2, p3];

  test("moves project to before target", () => {
    const res = computeProjectReorder(list, "p3", "p1", "before");
    expect(res).not.toBeNull();
    expect(res?.newOrder.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
    expect(res?.previousProjectId).toBeNull();
    expect(res?.nextProjectId).toBe("p1");
  });

  test("moves project to after target", () => {
    const res = computeProjectReorder(list, "p1", "p3", "after");
    expect(res).not.toBeNull();
    expect(res?.newOrder.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    expect(res?.previousProjectId).toBe("p3");
    expect(res?.nextProjectId).toBeNull();
  });

  test("returns null if moving to current position", () => {
    const res1 = computeProjectReorder(list, "p1", "p1", "before");
    expect(res1).toBeNull();

    const res2 = computeProjectReorder(list, "p1", "p2", "before");
    expect(res2).toBeNull();
  });

  test("moves project one step up or down", () => {
    const up = moveProjectStep(list, "p2", "up");
    expect(up?.newOrder.map((p) => p.id)).toEqual(["p2", "p1", "p3"]);

    const down = moveProjectStep(list, "p2", "down");
    expect(down?.newOrder.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);

    expect(moveProjectStep(list, "p1", "up")).toBeNull();
    expect(moveProjectStep(list, "p3", "down")).toBeNull();
  });
});

describe("drag-and-drop and menu project reordering", () => {
  const projA: PluginSidebarProject = {
    id: "proj-a",
    name: "Project Alpha",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const projB: PluginSidebarProject = {
    id: "proj-b",
    name: "Project Beta",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const threadA: PluginSidebarThread = {
    ...thread,
    id: "t-a",
    projectId: "proj-a",
  };
  const threadB: PluginSidebarThread = {
    ...thread,
    id: "t-b",
    projectId: "proj-b",
  };

  test("shows drag handle for each project row", () => {
    const slot = renderSlot(threadList, slotProps, {
      settings: { hideEmptyProjects: false, activeMode: "exists" },
      sidebarThreads: {
        status: "ready",
        projects: [projA, projB],
        threads: [threadA, threadB],
      },
    });

    expect(
      slot.getByRole("button", {
        name: "Drag to reorder project Project Alpha",
      }),
    ).toBeTruthy();
    expect(
      slot.getByRole("button", {
        name: "Drag to reorder project Project Beta",
      }),
    ).toBeTruthy();
  });

  test("triggers drag and drop reorder RPC", async () => {
    const reorderProject = vi.fn().mockResolvedValue({ ok: true });
    const slot = renderSlot(threadList, slotProps, {
      rpc: { reorderProject } as any,
      settings: { hideEmptyProjects: false, activeMode: "exists" },
      sidebarThreads: {
        status: "ready",
        projects: [projA, projB],
        threads: [threadA, threadB],
      },
    });

    const handleA = slot.getByRole("button", {
      name: "Drag to reorder project Project Alpha",
    });
    const groupB = slot.getByText("Project Beta").closest(".group\\/project")!;

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "move",
      dropEffect: "none",
    };
    fireEvent.dragStart(handleA, { dataTransfer });

    vi.spyOn(groupB, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 200,
      height: 100,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.dragOver(groupB, {
      dataTransfer,
      clientY: 180, // bottom half -> after
    });

    expect(slot.getByTestId("drop-indicator-after")).toBeTruthy();

    fireEvent.drop(groupB, { dataTransfer });

    await waitFor(() =>
      expect(reorderProject).toHaveBeenCalledWith({
        projectId: "proj-a",
        previousProjectId: "proj-b",
        nextProjectId: null,
      }),
    );
  });

  test("moves project up and down from project menu", async () => {
    const reorderProject = vi.fn().mockResolvedValue({ ok: true });
    const slot = renderSlot(threadList, slotProps, {
      rpc: { reorderProject } as any,
      settings: { hideEmptyProjects: false, activeMode: "exists" },
      sidebarThreads: {
        status: "ready",
        projects: [projA, projB],
        threads: [threadA, threadB],
      },
    });

    fireEvent.click(
      slot.getByRole("button", { name: "Project actions for Project Beta" }),
    );
    const moveUp = slot.getByRole("menuitem", { name: "Move up" });
    expect(moveUp).toBeTruthy();
    expect(slot.queryByRole("menuitem", { name: "Move down" })).toBeNull();

    fireEvent.click(moveUp);

    await waitFor(() =>
      expect(reorderProject).toHaveBeenCalledWith({
        projectId: "proj-b",
        previousProjectId: null,
        nextProjectId: "proj-a",
      }),
    );
  });
});

describe("shortlist feature and keyboard shortcut", () => {
  const projA: PluginSidebarProject = {
    id: "proj-a",
    name: "Project Alpha",
    isPersonal: false,
    href: "",
    settingsHref: "",
  };
  const threadA: PluginSidebarThread = {
    ...thread,
    id: "t-a",
    projectId: "proj-a",
    title: "Thread Alpha",
  };
  const threadB: PluginSidebarThread = {
    ...thread,
    id: "t-b",
    projectId: "proj-a",
    title: "Thread Beta",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test("toggles shortlist via star button and row menu", async () => {
    const slot = renderSlot(threadList, slotProps, {
      settings: { hideEmptyProjects: false, activeMode: "exists" },
      sidebarThreads: {
        status: "ready",
        projects: [projA],
        threads: [threadA, threadB],
      },
    });

    const starBtn = slot.getByRole("button", {
      name: "Add Thread Alpha to shortlist",
    });
    expect(starBtn).toBeTruthy();

    fireEvent.click(starBtn);

    expect(
      slot.getByRole("button", { name: "Remove Thread Alpha from shortlist" }),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("bb-plugin-sidebar-filter.shortlist") || "[]"),
    ).toContain("t-a");

    // Open row menu for threadB
    fireEvent.click(
      slot.getByRole("button", { name: "Actions for Thread Beta" }),
    );
    const addToShortlistMenuItem = slot.getByRole("menuitem", {
      name: "Add to shortlist",
    });
    fireEvent.click(addToShortlistMenuItem);

    expect(
      JSON.parse(localStorage.getItem("bb-plugin-sidebar-filter.shortlist") || "[]"),
    ).toContain("t-b");
    // Toggle shortlist via Ctrl+Click on row link
    const threadALink = slot.getByRole("link", { name: "Thread Alpha" });
    fireEvent.click(threadALink, { ctrlKey: true });

    // Should remove from shortlist
    expect(
      JSON.parse(localStorage.getItem("bb-plugin-sidebar-filter.shortlist") || "[]"),
    ).not.toContain("t-a");

    // Ctrl+Click again should add it back
    fireEvent.click(threadALink, { ctrlKey: true });
    expect(
      JSON.parse(localStorage.getItem("bb-plugin-sidebar-filter.shortlist") || "[]"),
    ).toContain("t-a");
  });

  test("filters view when shortlist mode is activated by header or shortcut", () => {
    localStorage.setItem(
      "bb-plugin-sidebar-filter.shortlist",
      JSON.stringify(["t-a"]),
    );

    const slot = renderSlot(threadList, slotProps, {
      settings: {
        hideEmptyProjects: true,
        activeMode: "exists",
        shortlistShortcut: "Ctrl+Alt+S",
      },
      sidebarThreads: {
        status: "ready",
        projects: [projA],
        threads: [threadA, threadB],
      },
    });

    // Before toggling shortlist filter, both are visible
    expect(slot.getByRole("link", { name: "Thread Alpha" })).toBeTruthy();
    expect(slot.getByRole("link", { name: "Thread Beta" })).toBeTruthy();

    // Toggle via button
    const shortlistToggleBtn = slot.getByRole("button", {
      name: "☆ Shortlist",
    });
    fireEvent.click(shortlistToggleBtn);

    // Only Thread Alpha is visible now
    expect(slot.getByRole("link", { name: "Thread Alpha" })).toBeTruthy();
    expect(slot.queryByRole("link", { name: "Thread Beta" })).toBeNull();
    expect(
      localStorage.getItem("bb-plugin-sidebar-filter.shortlist-only"),
    ).toBe("true");

    // Toggle back via shortcut Ctrl+Alt+S
    fireEvent.keyDown(window, {
      key: "s",
      code: "KeyS",
      ctrlKey: true,
      altKey: true,
    });

    expect(slot.getByRole("link", { name: "Thread Beta" })).toBeTruthy();
    expect(
      localStorage.getItem("bb-plugin-sidebar-filter.shortlist-only"),
    ).toBe("false");
  });
});
