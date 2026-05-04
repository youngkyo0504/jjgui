# jjgui

A local web GUI for Jujutsu repositories.

`jjgui` runs a small local Bun server, talks to the `jj` CLI, and opens a browser UI for the repository you are working in. It is meant for people who already like Jujutsu but sometimes want to see and manipulate the commit graph visually.

It is especially nice with cmux workflows: launch `jjgui .` from a cmux session and keep the repository UI beside your shell in a cmux browser tab or split.

This is an early preview. The first supported platform is macOS.

## Features

- Visual commit graph for a local `jj` repository
- Changed-file and commit-diff inspection
- Edit, create, describe, rebase, split, squash, abandon, and move changes
- Bookmark create, move, rename, delete, fetch, and push flows
- Recent operation history with preview/revert support
- Live refresh through local file watching and server-sent events
- Browser or cmux browser opening

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
