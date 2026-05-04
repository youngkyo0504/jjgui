# Demo Repository

Use a generated jj repository for demos and manual testing instead of pointing
jjgui at this source repository.

```bash
bun run demo:repo
```

This creates `.demo/jjgui-demo` and a local bare remote at
`.demo/jjgui-demo-remote.git`. The generated repository includes:

- a `main` bookmark already pushed to `origin`
- local feature bookmarks for dashboard, search, and settings work
- a merge-shaped integration commit
- a working-copy scratchpad change for file/diff operations

Open it in jjgui:

```bash
bun run start .demo/jjgui-demo
```

For a fresh demo that resets the generated repository and opens jjgui:

```bash
bun run demo
```

