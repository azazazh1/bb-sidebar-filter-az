# bb-plugin-sidebar-filter

A [bb](https://getbb.app) plugin that replaces the sidebar thread list with a
project-grouped version that **hides projects without active or unread threads**.

If you work across many projects, the built-in sidebar (in its "project"
organization mode) shows **every** project as a collapsible row — including
projects whose threads are all archived and read. This list drops those rows
entirely, while keeping projects with something active or unread in them.
Archived threads are not included in the unread part of this filter.

## Install

```sh
bb plugin install path:path/to/bb-plugin-sidebar-filter
# or
bb plugin install https://github.com/slogsdon/bb-plugin-sidebar-filter
```

## Enable

The sidebar list slot is exclusive and opt-in per client:

1. Open **Settings → Appearance → Sidebar**.
2. Choose **Sidebar Project Filter** from the list provider picker.

Until you pick it, the built-in list stays. If the plugin is disabled or
crashes, bb falls back to the built-in list automatically.

## Configuration

```sh
bb plugin config sidebar-filter set hideEmptyProjects true
bb plugin config sidebar-filter set activeMode exists   # or running
bb plugin config sidebar-filter set toggleShortcut "Alt+A"
bb plugin config sidebar-filter set shortlistShortcut "Ctrl+Alt+S"
```

| Setting             | Default      | Meaning                                                        |
| ------------------- | ------------ | -------------------------------------------------------------- |
| `hideEmptyProjects` | `true`       | Hide projects with no active or unread (non-archived) threads. `false` shows them all. |
| `activeMode`        | `exists`     | `exists` — non-archived threads count. `running` — only currently running threads count. Unread non-archived threads count in either mode. |
| `toggleShortcut`    | `Alt+A`      | Keyboard shortcut for switching between `exists` and `running`; empty disables it. |
| `shortlistShortcut` | `Ctrl+Alt+S` | Keyboard shortcut for toggling shortlist-only filter view; empty disables it. |

## What the list does

- One collapsible row per project, in bb's project order; a project appears
  only when it has active or unread matching threads. Archived unread threads
  are not included.
- **Shortlist support**:
  - Mark/unmark threads to shortlist via hover star icon (`☆`/`★`) or via row context menu (`⋯` / right-click → *Add to shortlist* / *Remove from shortlist*).
  - Starred threads keep a persistent gold star indicator.
  - Toggle **Shortlist** filter via the header button (`★ Shortlist`) or via customizable hotkey (`Ctrl+Alt+S` by default).
  - Shortlist selection and active filter mode persist across reloads (in `localStorage`).
- **Drag-and-drop project reordering**: grab the drag grip handle (`⋮⋮`) on hover to reorder projects; visual drop indicator lines indicate where the project will be placed.
- **Project menu actions**: click `⋯` on any project row to quickly "Move up" or "Move down".
- Pinned threads in their own **Pinned** section on top, like the built-in
  list.
- Live updates: projects appear/disappear as threads start, finish, are
  archived, or become read/unread — no refresh.
- Keyboard support (`thread.next` / `thread.previous` / numbered shortcuts)
  via the host's `data-sidebar-thread-*` contract.
- Middle-click opens a thread in a split; hover shows the split-drag
  affordance.
- The host search field filters rows (and projects) live.
- Click a thread row's three-dot button or right-click the row for a menu:
  shortlist toggle, pin/unpin, mark read/unread, rename, copy thread ID, archive, and delete
  (through bb's own confirmation flow).

## What it deliberately leaves out

- The New-thread/search row, plugin nav rows, and footer stay host-rendered
  (bb's thread-list contract forbids plugins from touching them).
- No "chronological sections" or "machine" organization modes — the list is
  project-organized only. If you want sections, this plugin is not it.
- Child threads render flat inside their project (indented hierarchy is
  built-in-list behavior; this list keeps it simple).
- The collapse state of project rows persists per client (localStorage).

## How it works

- Backend (`server.ts`): declares settings and `reorderProject` RPC calling `bb.sdk.projects.reorder` to persist order changes across clients.
- Frontend (`app.tsx`): registers the exclusive `experimental_threadList`
  slot and renders `experimental_useSidebarThreads()` data — the exact same
  live cache the built-in list uses — keeping threads that are active or unread, with optimistic drag-and-drop reordering.

## Development

```sh
bb plugin dev    # rebuild + reload on save
bb plugin build .   # emit dist/
```

Reference: `examples/plugins/t3sidebar` in the [bb repo](https://github.com/get-bb/bb) — the canonical sidebar thread-list replacement.
