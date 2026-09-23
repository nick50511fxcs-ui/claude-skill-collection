# External tools (not skills)

Two of the five tools from the original guide are not skills or plugins but
**programs you install and run**, so they cannot be synced through this
repository. Headroom can be installed with `install.sh --with-headroom`;
install OmniRoute by hand where you need it.

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
