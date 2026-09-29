# External tools (not skills)

Some tools are not skills or plugins but **programs you install and run** (or
reference files you copy per project), so they cannot be synced through this
repository. Headroom and Playwright MCP can be installed with `install.sh`
(`--with-headroom`, `--with-playwright`); set up the others by hand where you need them.

## Headroom — context-compression MCP

- Source: https://github.com/headroomlabs-ai/headroom
- Requires: Python 3.10+

```bash
pip install "headroom-ai[mcp]"
headroom mcp install && claude
# VS Code extension: headroom wrap vscode-claude   (undo: headroom unwrap vscode-claude)
```

`install.sh --with-headroom` installs `headroom-ai[mcp]` into a dedicated venv at
`~/.headroom-venv` and then runs `headroom mcp install`.

The guide's `headroom-ai[all]` pulls GPU machine-learning libraries (torch, CUDA)
and is **about 7 GB**. The MCP tools (compress, retrieve, stats) only need
`[mcp]` (about 430 MB), which is what the script uses. Install `[all]` only on a
local machine, and only if you need its extra features (image/document compression).

Note: `headroom mcp install` registers only the **tools**. Compressing every
request automatically needs the proxy running and Claude Code pointed at it
(local machines only; not applicable to cloud sessions):
```bash
headroom proxy                                           # keep this terminal open
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 claude          # in a new terminal
```

## OmniRoute — free-model routing gateway

- Source: https://github.com/diegosouzapw/OmniRoute

```bash
npm install -g omniroute
omniroute                                   # keep this terminal open
# in a new terminal
export ANTHROPIC_BASE_URL=http://localhost:20128/v1   # Windows: $env:ANTHROPIC_BASE_URL="http://localhost:20128/v1"
claude
```

⚠️ Caution
- With this on, your prompts and code go to **third-party free model providers**,
  not to Claude. Do not use it on work code or sensitive material.
- Answer quality and tool-call compatibility vary by model.
- Cloud sessions (claude.ai/code) cannot use a local gateway.
- To go back, run `claude` in a new terminal without `ANTHROPIC_BASE_URL`.

## Playwright MCP — browser control and screenshots

- Source: https://github.com/microsoft/playwright-mcp (Apache-2.0)
- Requires: Node.js (`npx`)

```bash
claude mcp add -s user playwright -- npx @playwright/mcp@latest
```

`install.sh --with-playwright` runs the same command (skipped if `playwright` is
already registered). Nothing is downloaded until the server first starts. Then ask
Claude to "open it in the browser, check it, and fix what looks off".

## awesome-design-md — design-system reference files

- Source: https://github.com/VoltAgent/awesome-design-md (MIT)
- Nothing to install: each folder under `design-md/` holds one `DESIGN.md`
  (colors, type, spacing rules) for a well-known site.

Copy the one you like into a project and ask Claude to follow it:
```bash
curl -fsSL https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/stripe/DESIGN.md -o DESIGN.md
```
Not vendored here: the whole set is ~2.8 MB and only one file is used per project.

## 21st.dev Magic MCP — UI component library

- Source: https://21st.dev/mcp
- Requires: a 21st.dev account and API key (the free tier limits component imports per day;
  AI generation uses credits)

```bash
npx @21st-dev/cli@latest init --client claude    # Cursor: --client cursor
```

Not in `install.sh`: it needs an interactive sign-up and a personal API key.
Then ask for things like "find a pricing-table component that fits the checkout page".
