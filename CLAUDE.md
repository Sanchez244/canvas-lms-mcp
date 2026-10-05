# canvas-mcp

Local MCP server (stdio) that gives Claude Code read access to the user's Canvas courses, assignments, modules and files, plus a confirm-gated file submission tool.

## Commands
- Full check (run before declaring ANY work done): `npm run check`  (typecheck + lint + vitest)
- Build: `npm run build` → `dist/index.js` (what Claude Code runs)
- Manual poke: `npm run inspect` (MCP Inspector against the built server)
- Register once: `claude mcp add -s user canvas -- node "<path to this repo>\dist\index.js"`
- No deploy target; it runs on this machine only.

## Stack
- TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk` McpServer + StdioServerTransport
- zod v4 input schemas, native fetch, `html-to-text` for Canvas HTML fields
- Vitest, unit tests mock `fetch` with `vi.stubGlobal`
- Config from `.env` at repo root (gitignored): CANVAS_BASE_URL (required), CANVAS_TOKEN, CANVAS_DOWNLOAD_DIR

## Conventions
- One file per tool in `src/tools/`, each exporting `register<Name>(server, canvas)`. Wire it in `src/index.ts`.
- Tools return `jsonResult(...)` from `src/tools/result.ts`; Canvas HTML goes through the text helper before returning.
- Never write to stdout: it is the MCP transport. Log with `process.stderr`.
- Every Canvas list call goes through `CanvasClient.getAll` (pagination + 500-item cap). Never hand-roll `page=` loops.
- Write tools (anything that POSTs to Canvas) must be no-ops unless the caller passes `confirm: true`, and must return a preview otherwise.
- Any change to a Canvas API path or field list: check https://canvas.instructure.com/doc/api/ first, don't guess.
- After changing `src/`, rebuild with `npm run build` before testing in Claude Code (it runs `dist/`, not `src/`).

## Definition of done
1. `npm run check` passes — show the output.
2. `npm run build` succeeds and the tool works via `npm run inspect` or in a fresh Claude Code session.
3. No unrelated files changed.

## Gotchas
<!-- Failure-driven section: add a line ONLY after Claude gets something wrong twice.
     If a rule here keeps being ignored, convert it to a hook in .claude/settings.json. -->
- Home paths can contain spaces on Windows: always quote paths in shell commands.

## State files
- SPEC.md — what we're building (source of truth for scope)
- PLAN.md — ordered task list with checkmarks
- HANDOFF.md — read this first when resuming work
- REVIEW.md — calibration for any code-review pass

## Commit discipline
Leave changes uncommitted when finishing a task; committing/pushing are separate, explicitly approved steps (enforced by ask-gates in .claude/settings.json).
