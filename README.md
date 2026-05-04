# jjgui

A local web GUI for Jujutsu repositories.

`jjgui` runs a small local Bun server, talks to the `jj` CLI, and opens a browser UI for the repository you are working in. It is meant for people who already like Jujutsu but sometimes want to see and manipulate the commit graph visually.

It is especially nice with cmux workflows: launch `jjgui .` from a cmux session and keep the repository UI beside your shell in a cmux browser tab or split.

This is an early preview. The first supported platform is macOS.

## Features

- Visual commit graph for a local `jj` repository, including working-copy, immutable, workspace, bookmark, remote bookmark, conflict, divergent, and empty-change badges
- Expand commits to inspect changed files, discard files, move one file, or move a selected group of files to another commit
- Commit diff and file diff inspection with syntax-aware, word-level inline diff rendering
- Edit an existing commit, create a new commit on top, and update commit descriptions inline
- Split commits by selecting files, squash commits into their parent, abandon a single commit, or abandon a whole subtree
- Rebase a subtree from the context menu or by dragging a commit row onto a valid destination
- Create, move, rename, and delete local bookmarks; show or hide remote bookmarks
- Fetch all remotes, push a bookmark, or push a bookmark together with its descendants
- Recent operation drawer with running/success/failure state, operation details, revert preview, and revert confirmation
- Undo support for rebase, move/split/squash/abandon/discard operations, and fetch operations
- Live refresh through local file watching and server-sent events
- Browser or cmux browser opening, with configurable tab or split behavior

## Demo Videos

The demo clips live in [etc](etc) and are embedded here for the workflows that benefit most from motion.

### Diff Inspection

Open a commit, select a changed file, and review the rendered diff without leaving the graph.

<video src="etc/diff.mp4" controls width="960"></video>

[Open the diff demo video](etc/diff.mp4)

### Drag-and-Drop Rebase

Drag a commit row onto a valid destination to prepare a subtree rebase, then confirm it from the inline prompt.

<video src="etc/rebase.mp4" controls width="960"></video>

[Open the rebase demo video](etc/rebase.mp4)

## cmux-Friendly

`jjgui` works well inside cmux. When launched from a cmux session, `opener = "auto"` detects `CMUX_SURFACE_ID` and opens the UI in a cmux browser tab.

To force cmux:

```bash
jjgui . --opener=cmux
```

To open in a split instead of a tab:

```toml
opener = "cmux"

[cmux]
openMode = "split"
splitDirection = "right"
```

`splitDirection` can be `right` or `down`.

## Requirements

- macOS
- [Bun](https://bun.sh/)
- [Jujutsu](https://jj-vcs.github.io/jj/latest/) available as `jj`

## Install From Source

`jjgui` is not published to npm yet. For now, install it from source and link the `jjgui` command globally with Bun.

```bash
git clone https://github.com/keumky/jjgui.git
cd jjgui
bun install
bun run build
bun link
```

Make sure Bun's global bin directory is on your `PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Then open any Jujutsu repository:

```bash
cd /path/to/your/repo
jjgui .
```

## Usage

Open the current repository:

```bash
jjgui .
```

Open a different repository:

```bash
jjgui /path/to/repo
```

Stop the background server:

```bash
jjgui stop
```

Use a different port:

```bash
jjgui . --port=7788
jjgui stop --port=7788
```

By default, `jjgui` uses port `7777`.

## Configuration

Optional config lives at `~/.jjgui/config.toml`.

```toml
port = 7777
opener = "auto"

[cmux]
openMode = "tab"
splitDirection = "right"
```

Config precedence:

```text
CLI flag > config file > default
```

Supported opener values:

- `auto`: use cmux when `CMUX_SURFACE_ID` is present, otherwise use the system browser
- `browser`: always open the system browser
- `cmux`: open in cmux, falling back to the system browser if cmux is unavailable

You can also set the opener for one run:

```bash
jjgui . --opener=browser
jjgui . --opener=cmux
```

## Development

Run the server in watch mode on port `7777`:

```bash
bun run dev
```

Run the Vite client dev server:

```bash
bun run --cwd packages/client dev
```

Build the client:

```bash
bun run build
```

Run tests:

```bash
bun test
```

## Troubleshooting

If `jjgui` is not found after `bun link`, check that `~/.bun/bin` is on your `PATH`.

If port `7777` is already in use, choose another port:

```bash
jjgui . --port=7788
```

If the server does not open, check the port-specific log file:

```bash
tail -f /tmp/jjgui-7777.log
```

If you changed the port, use that port in the log filename.

## Status

`jjgui` is source-install only for now. A packaged release may come later after the install and update story feels boring enough to trust.
