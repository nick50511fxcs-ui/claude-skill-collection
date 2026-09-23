# Claude Skill Collection

A personal collection of Claude skills (`SKILL.md`). The repository is itself a
**Claude Code plugin marketplace**, so the same skills can be loaded with one
command on any machine or in any cloud session.

> Repository convention: everything stored here (skills, docs, scripts, handoff
> notes, commit messages, PR descriptions) is written in **English** — it is
> cheaper in tokens and followed more reliably. Conversations with Claude can
> stay in any language.

## Contents

| Name | Kind | What it does | How it is installed |
|---|---|---|---|
| `task-observer` | Skill (`skills/`) | Watches work sessions and proposes new skills / skill improvements from repeated patterns ([upstream](https://github.com/rebelytics/one-skill-to-rule-them-all), CC BY 4.0) | Part of the `skill-collection` plugin |
| `task` | Shortcut (`skills/`) | `/task` turns on task-observer; `/task <request>` also runs the request. User-invoked only, so no idle token cost | Part of the plugin (named `/skill-collection:task` when installed as a plugin) |
| `new` | Shortcut (`skills/`) | `/new` saves a short handoff note to `HANDOFF.md`, pushes it, and prints a one-line starter for a new session. User-invoked only | Part of the plugin |
| `skill-intake` | Skill (`skills/`) | Procedure for adding or pruning skills from GitHub links (verify upstream → measure cost → clean-install test → PR) | Part of the plugin |
| `claude-code-setup` | Official plugin | Scans a project and recommends hooks, skills, MCP servers (Anthropic) | Installed by default |
| `claude-mem` | External plugin | Memory that persists across sessions ([thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)) | Optional (`--with-claude-mem`) |
| Headroom | External tool (MCP) | Context compression ([headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom)) | Optional (`--with-headroom`) |
| OmniRoute | External tool | Routes requests to free third-party models | Not installed → [docs/external-tools.md](docs/external-tools.md) |

## Layout

```
.claude-plugin/marketplace.json   registers this repo as a marketplace
.claude-plugin/plugin.json        bundles all of skills/ as the "skill-collection" plugin
.claude/skills -> ../skills       sessions opened on this repo load the skills directly (symlink)
.claude/settings.json             suggests the claude-code-setup plugin
skills/<name>/SKILL.md            the skills (add new ones as folders here)
hooks/                            long-conversation reminder hook (/new)
scripts/check-skills.sh           skill count cap and format checks
install.sh / install.ps1          one-shot installers
```

## Usage

### 1. Inside Claude Code (simplest, any machine)

```
/plugin marketplace add nick50511fxcs-ui/claude-skill-collection
/plugin install skill-collection@claude-skill-collection
```

### 2. From a terminal (new machine)

macOS / Linux:
```bash
git clone https://github.com/nick50511fxcs-ui/claude-skill-collection.git
cd claude-skill-collection && bash install.sh              # optional: --with-claude-mem --with-headroom
```

Windows PowerShell:
```powershell
git clone https://github.com/nick50511fxcs-ui/claude-skill-collection.git
cd claude-skill-collection; .\install.ps1                   # optional: -WithClaudeMem -WithHeadroom
```

Without the `claude` CLI, or to install files instead of a plugin, use `--copy` / `-Copy`:
the skill folders are copied to `~/.claude/skills/`.

### 3. Cloud sessions (claude.ai/code, web and mobile)

- **Sessions opened on this repo** see the skills immediately through the `.claude/skills` symlink.
- **Sessions on any other repo**: put this in the environment's **Setup script**
  (environment menu in the session title bar → Edit). Every new session in that
  environment then gets the skills, the `/new` reminder hook and Headroom.
  ```bash
  git clone --depth 1 https://github.com/nick50511fxcs-ui/claude-skill-collection.git /tmp/skills \
    && bash /tmp/skills/install.sh --copy --with-headroom || true
  ```
  - `|| true` keeps a failed install from blocking the session start.
  - The setup script runs without GitHub credentials, so this repository must stay
    **public**. Making it private fails with `could not read Username` (exit 128).

### 4. claude.ai chat app (web / desktop)

Upload a skill folder as a ZIP under Settings → Capabilities → Skills.
```bash
cd skills && zip -r task-observer.zip task-observer
```

## Long-conversation reminder (`/new`)

Every reply re-reads the whole conversation, so long sessions cost more per reply.
`hooks/new-reminder.sh` measures the conversation size on each message; **past
100k tokens** it has Claude ask once whether to run `/new` (and again every
further 100k). The hook runs outside the model, so it costs no tokens otherwise.

- Installed automatically with the plugin, and by `install.sh --copy` (disable with `--no-new-reminder`)
- Threshold: environment variable `NEW_REMINDER_TOKENS` (default 100000)
- Flow: reminder → type `/new` → paste the printed line into a new session

## Skill cap: 50

Every skill's name and description are read in every session, so more skills
mean more tokens and less accurate skill selection. `scripts/check-skills.sh`
fails above 50 skills, and the `check-skills` GitHub Action runs it on every PR.
Change the cap with the `MAX_SKILLS` environment variable.

## Adding a skill

Give Claude a link and say "add this skill to the collection"; the `skill-intake`
skill follows this procedure:

1. Add `skills/<name>/SKILL.md` (plus `references/`, `scripts/` if needed).
2. Run `bash scripts/check-skills.sh`, then commit and push.
3. On other machines, re-run `bash install.sh`, or run these in Claude Code and restart:
   ```
   /plugin marketplace update claude-skill-collection
   /plugin update skill-collection@claude-skill-collection
   ```
   Do not put a `version` in `plugin.json`: a pinned version keeps new skills from
   reaching installed copies until the version is bumped.

For skills taken from other repositories, keep an `UPSTREAM.txt` (source URL,
commit, license) in the skill folder so updates are easy later.
