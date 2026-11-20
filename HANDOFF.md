# Handoff (2026-11-20)

## Goal
- Repo: keep the user's Claude skills/plugins in this public marketplace repo for cloud sessions.
- Main work this session: "AI 첫걸음", a Korean beginner AI guide site published as a claude.ai Artifact:
  https://claude.ai/artifact/BgbdKLtEhEs9mhkzeRttV3 (version 11; capability `sample` declared).

## Decisions
- Skills: removed `design-taste-frontend` (overlapped); keep `impeccable` (broad) + `hallmark` (new pages).
- Site: formal Korean tone (~합니다), audience = every adult new to AI. Fonts IBM Plex Sans KR (heads) + Noto Sans KR.
  Palette from the Stitch draft (paper / ink navy / amber), light + dark tokens. Stitch only for the first draft.
- Every AI name in body text gets its brand icon (`<span class="ai b-xxx">`); brand colors per AI.
  Icons: Simple Icons paths (ChatGPT from v13.21; Claude/Gemini/Perplexity/GitHub v16.30); Grok, Higgsfield, Midjourney
  traced from user-supplied images; Runway/Kling/Genspark use letter badges (no official icon yet).
- Clawd (Claude Code mascot) drawn as pixel SVG, one pose per page, wiggles on hover/tap.
- Prompt scoring page uses `sample` (Claude) with a rule-based fallback.
- Sharing: the user handles it themselves; leave as is. Do not commit the site HTML to this public repo.

## Current state
- Views (hash routes): home, about-ai, compare, ai-claude, ai-chatgpt, ai-gemini, prompt, score, advanced, vibe, faq, glossary.
- Content: 6-AI comparison + image/video AIs, star recommendations by persona, "손을 쫙 펴" prompt section,
  12 prompt templates, 40 glossary terms, 22 FAQs, vibe-coding page, GitHub skill install (Claude / Codex).
- Checked on 15 device profiles and widths 320-1440: no overflow, no script errors.
- Repo branch `claude/inspiring-cannon-ygx5em`: removal of design-taste-frontend (no PR yet).

## Next steps
1. To edit the site: `Artifact` action `read` on the URL above to get the HTML, edit, republish to the same URL.
2. If the user wants: official icons for Runway/Kling/Genspark (ask for images); re-check model names (2026-11 data).
3. Ask before opening a PR for the skill removal branch.

## Notes
- Pitfall: never use class names `ai`, `pick` for other things (`.ai` = nowrap brand span). Twice caused text overflow.
- Name-wrapper regex must skip already-wrapped spans (`\bai\b`) and handle Korean particles (no `\b` after names).
- Grid/flex children need `minmax(0,1fr)` / `min-width:0`; `.stack`/`.stack-lg` already set.
- Stitch MCP times out at 60s on generate; calling the MCP endpoint with curl works (proxy injects the key).
- User works in cloud sessions only, prefers plain-language Korean, wants questions/opinions raised proactively.
