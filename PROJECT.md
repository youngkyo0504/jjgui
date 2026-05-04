# visual-jj (jjgui)

A web-based GUI for the Jujutsu (jj) version control system.

It visualizes commit graphs with SVG and lets you perform common jj operations such as rebase, split, squash, and bookmark management in the browser.

## Requirements

- [Bun](https://bun.sh) v1.0+
- [Jujutsu (jj)](https://github.com/martinvonz/jj) CLI

## Quick Start

```bash
# Run inside a jj repository
bun run bin/jjgui.ts .

# Or pass an explicit path
bun run bin/jjgui.ts /path/to/jj-repo

# Stop the server
bun run bin/jjgui.ts stop
```

The server starts automatically in the background and opens the browser.

## CLI Options

```bash
bun run bin/jjgui.ts [--opener=auto|browser|cmux] [path]
```

| Option | Description |
|------|------|
| `path` | jj repository path (default: `.`) |
| `--opener=auto` | Automatically choose based on the environment (default) |
| `--opener=browser` | Always open in the system browser |
| `--opener=cmux` | Always open in the built-in cmux browser |
| `stop` | Stop the running server |

## Configuration File

You can define defaults in `~/.jjgui/config.toml`. If the file does not exist, jjgui uses the built-in defaults.

### Create a Configuration File

```bash
mkdir -p ~/.jjgui
touch ~/.jjgui/config.toml
```

### Full Configuration Example

```toml
# ~/.jjgui/config.toml
#
# Browser opening mode
# - "auto"    : use cmux when CMUX_SURFACE_ID exists, otherwise use the system browser (default)
# - "browser" : always use the system default browser (Safari, Chrome, etc.)
# - "cmux"    : always use the built-in cmux browser
opener = "auto"

# cmux settings (applied when opener is "cmux" or auto selects cmux)
[cmux]
# Open mode
# - "tab"   : open in a new tab (default)
# - "split" : open in a split pane
openMode = "tab"

# Split direction (only applied when openMode = "split")
# - "right" : split to the right (default)
# - "down"  : split downward
splitDirection = "right"
```

### Scenario Examples

cmux user - auto-detect without extra configuration:
```toml
# config.toml is optional
# When run inside cmux, jjgui automatically uses the built-in browser
```

cmux user - always open in a split pane:
```toml
opener = "cmux"

[cmux]
openMode = "split"
splitDirection = "right"
```

Always use the system browser, even inside cmux:
```toml
opener = "browser"
```

### TOML Syntax Reference

```toml
# Comments start with #

# Top-level key = value (wrap strings in quotes)
opener = "auto"

# Sections start with [name]
[cmux]
# key = value inside a section
openMode = "tab"
splitDirection = "right"
```

### Configuration Precedence

Higher entries take precedence:

1. CLI flag (`--opener=cmux`)
2. Configuration file (`~/.jjgui/config.toml`)
3. Environment auto-detection (checks `CMUX_SURFACE_ID` when `opener = "auto"`)
4. Defaults (`opener = "auto"`, `cmux.openMode = "tab"`, `cmux.splitDirection = "right"`)

### Error Handling

- Missing configuration file → run normally with defaults
- TOML parse failure → fall back to defaults and ignore the parse error
- Invalid opener value → print an error message and exit
- cmux mode without cmux installed → fall back to the system browser

### cmux Integration

When run inside a cmux terminal, jjgui automatically detects the `CMUX_SURFACE_ID` environment variable and opens the built-in browser. No extra configuration is required.

## Features

### Commit Graph
- SVG-based visualization (circular nodes, vertical connectors, and Bezier curve branches/merges)
- Working copy: green node
- Immutable commits: diamond shape
- Unique colors per lane
- Dark and light theme support

### Commit Operations (Right-click Menu)
- Edit — switch the working copy
- New — create a new commit on top of the selected commit
- Describe — edit the commit message
- Split — split a commit by file
- Squash — merge into the parent commit
- Move changes — move changes to another commit
- Rebase — rebase a subtree with drag and drop

### Bookmark Management (Right-click Badge)
- Create / Delete / Rename
- Move — move to another commit
- Push — push to a git remote, including force-push confirmation

### File List
- Click the chevron (▸/▾) in a commit row to show changed files inline
- Preserve vertical graph line continuity

### Live Refresh
- Automatically refresh the graph via SSE when files change
