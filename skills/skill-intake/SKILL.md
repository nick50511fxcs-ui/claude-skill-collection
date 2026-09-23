---
name: skill-intake
description: Use when adding a skill, plugin or tool from a GitHub link to the claude-skill-collection repository, or when pruning/removing skills from it. Triggers on requests like "add this skill", "put this link in the collection", "clean up my skills".
---

# Skill Intake — adding to and pruning the skill collection

Procedure for bringing an external link into this repository. Install steps in
guides, blog posts or PDFs describe the author's environment at one point in
time and are often stale, so **always check the upstream repository's current
state yourself**, and **add nothing until a clean install has been proven**.

**Everything written to the repository is in English** — skill files, README
rows, UPSTREAM.txt, commit messages, PR titles and bodies. Talk to the user in
their own language.

## 0. Check the cap first (max 50 skills)

```bash
bash scripts/check-skills.sh --adding 1
```

- If it fails, do not add. Pick removal candidates (unused for a long time,
  overlapping another skill, duplicating a built-in skill) and ask the user
  which to remove.
- Every skill's name and description are read in every session, so more skills
  mean more tokens and worse skill selection. Do not add skills that duplicate
  built-ins (docx, pdf, xlsx, pptx, ...).

## 1. Classify the link

Shallow-clone the source and look at its structure
(`git clone --depth 1 <url> <scratch>/src`).

| Found | Kind | Handling |
|---|---|---|
| `SKILL.md` (root or a subfolder) | Skill | Copy into `skills/<name>/` via steps 2–5 |
| `.claude-plugin/plugin.json` with hooks, MCP servers or commands | Plugin | Do not copy; register in `.claude-plugin/marketplace.json` as `{"source":"github","repo":"owner/repo"}` |
| Neither (pip/npm program, etc.) | External tool | Document in `docs/external-tools.md`; add an `install.sh` option only if it is lightweight |

## 2. Verify the source

- Record the commit SHA (`git -C src rev-parse HEAD`) and the license file.
- No license, or one that forbids redistribution → **do not copy**; register via
  the marketplace or link to it instead.
- Security skim: in `scripts/`, hooks and install commands, flag anything that
  sends data out, touches credentials, or pipes a download into a shell
  (`curl | sh`). Tell the user before going further.

## 3. Measure the cost

- SKILL.md line count and description length (a long description costs tokens
  in every session).
- For external tools, measure the real install size (`du -sh`). The cloud setup
  script runs in every session, so anything in the hundreds of MB stays out of
  it; look for a lighter extra instead.

## 4. Copy (skills only)

- Copy `SKILL.md`, the folders its body references (`references/`, `scripts/`,
  ...) and the license. Leave out README, images and CI config.
- `name:` must match the folder name.
- Write `UPSTREAM.txt`:
  ```
  upstream: https://github.com/<owner>/<repo>
  commit: <40-character SHA>
  license: <license> (<author>)
  ```

## 5. Verify in a clean environment

```bash
bash scripts/check-skills.sh
T="$(mktemp -d)"; HOME="$T" bash install.sh --copy; ls "$T/.claude/skills"; rm -rf "$T"
```

- The new skill folder must appear in the listing.
- If `install.sh` changed, run it twice to prove a re-run is safe.

## 6. Deliver

- The default branch is `master`. Branch from the latest `master`.
- Add one row to the skill table in `README.md` (name, kind, one-line description).
- Commit → open a PR. **Merge only when the user asks.**
- Keep this repository **public** (the cloud setup script clones it without credentials).

## Pruning / removal requests

Delete `skills/<name>/`, remove its README row, confirm `bash scripts/check-skills.sh`
passes, then open a PR.

## Pre-delivery checklist (every time)

- [ ] Ran the step 0 cap check; the count is 50 or fewer
- [ ] Checked the upstream HEAD, not the guide, and wrote its SHA to `UPSTREAM.txt`
- [ ] The license allows redistribution (otherwise nothing was copied)
- [ ] Actually ran the step 5 verification and saw the new skill
- [ ] Kept heavy tools out of the setup-script defaults
- [ ] Everything committed is in English
- [ ] Waited for the user to ask before merging
