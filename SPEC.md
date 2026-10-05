# SPEC — canvas-mcp

<!-- Written by Claude after interviewing the author. Self-contained: a fresh session
     with zero context should be able to build from this file alone. -->

## Problem
The user is a student whose coursework lives in a Canvas LMS instance.
Today they have to click through each course to find deadlines, readings and syllabus
details. They want Claude Code to answer "what's due this week and what do I need to
read for it" directly, pull the reading files to disk so Claude can read them, and
eventually submit a finished file to an assignment without leaving the terminal.
Success: a local MCP server that Claude Code loads on startup, exposing Canvas as tools.

## Core flows (v1)
1. **Weekly briefing**: user asks "what's due this week?" → Claude calls
   `list_upcoming` and gets every assignment/quiz/event across active courses with
   course name, due date (local time), points, submission state and a link.
2. **Assignment detail**: user asks "what does HW3 in Marketing want?" →
   `list_courses` → `list_assignments` → `get_assignment` returns the description
   as plain text (HTML stripped), rubric, submission types, allowed extensions.
3. **Pull the readings**: user asks "download this week's readings for 15.401" →
   `list_modules` (with items) → `download_file` saves each file under
   `CANVAS_DOWNLOAD_DIR/<course code>/<filename>` and returns the local path, so
   Claude can then Read the PDF.
4. **Syllabus and pages**: `get_course` returns the syllabus body as text;
   `get_page` returns any wiki page (module text pages, course info).
5. **Submit a file**: user says "submit report.pdf to HW3" → Claude calls
   `submit_assignment_file` without `confirm` → tool returns a preview (course,
   assignment, due date, file name, size, extension check against
   `allowed_extensions`) and makes NO change → user says yes → Claude calls again
   with `confirm: true` → file is uploaded and the submission is created; tool
   returns the submission id, timestamp and `late` flag.

## Data model
No local database. All state lives in Canvas; the server is a thin, typed client.
Entities surfaced (Canvas REST v1 field names in parentheses):
- **Course** (`id`, `name`, `course_code`, `term`, `enrollment_term_id`,
  `syllabus_body`) — only courses where the user has an active enrollment.
- **Assignment** (`id`, `course_id`, `name`, `description`, `due_at`, `points_possible`,
  `submission_types[]`, `allowed_extensions[]`, `html_url`, `rubric[]`,
  `submission{workflow_state, submitted_at, score, late}` via `include[]=submission`).
- **PlannerItem** (`plannable_type`, `plannable{title, due_at}`, `context_name`,
  `html_url`, `submissions{submitted, graded, missing}`) from `/planner/items`.
- **Module** (`id`, `name`, `position`, `state`, `items[]{id, title, type,
  content_id, html_url, url}`) via `include[]=items`.
- **File** (`id`, `display_name`, `filename`, `size`, `content-type`, `url`,
  `folder_id`, `updated_at`).
- **Page** (`url` slug, `title`, `body`).
- **Submission** (`id`, `submitted_at`, `workflow_state`, `late`, `attachments[]`).

Auth: one personal access token (`CANVAS_TOKEN`) in a local `.env`, sent as
`Authorization: Bearer`. The token has the user's own permissions; the server never
widens or narrows them. Downloads use the file's signed `url` from the API response.

Pagination: Canvas returns `Link` headers; every list call follows `rel="next"` up to
a hard cap (default 500 items) so Claude never sees a silently truncated list.

## Tools (this project's "routes")
Read tools:
- `list_courses` — `{ include_past?: boolean }` → active courses (id, name, code, term).
- `get_course` — `{ course_id }` → course + syllabus as plain text.
- `list_upcoming` — `{ days?: number = 7 }` → planner items across all courses,
  sorted by due date, with course name and submission state.
- `list_assignments` — `{ course_id, bucket?: "upcoming"|"overdue"|"unsubmitted"|"past"|"all" }`
  → assignments with submission summary.
- `get_assignment` — `{ course_id, assignment_id }` → full detail, description as text, rubric.
- `list_modules` — `{ course_id }` → modules with items (files, pages, assignments, links).
- `list_files` — `{ course_id, folder_id?, search?: string }` → files in the course.
- `download_file` — `{ file_id, course_code? }` → saves to
  `CANVAS_DOWNLOAD_DIR/<course_code or "misc">/<display_name>`, skips if same size
  already on disk, returns absolute path.
- `get_page` — `{ course_id, page_url }` → page body as text.

Write tool:
- `submit_assignment_file` — `{ course_id, assignment_id, file_path, confirm?: boolean }`.
  Without `confirm: true`: validates (assignment accepts `online_upload`, extension
  allowed, file exists and is under 500 MB) and returns a preview; no side effects.
  With `confirm: true`: three-step Canvas upload
  (`POST .../submissions/self/files` → `POST` to the returned upload URL → `POST
  .../submissions` with `submission_type=online_upload` and `file_ids[]`).

Every tool returns compact JSON text. HTML fields are converted to plain text
(links preserved as `text (url)`). Dates are returned in ISO 8601 with the user's
local offset, plus a human string ("Tue 15 Sep, 23:59").

## Stack
- TypeScript, Node 24, `@modelcontextprotocol/sdk` (stdio transport), `zod` for
  tool input schemas, native `fetch`. `html-to-text` for descriptions.
- Vitest for unit tests (Canvas client mocked with recorded JSON fixtures);
  one integration test that hits the real API when `CANVAS_TOKEN` is set, skipped otherwise.
- Config via env: `CANVAS_BASE_URL` (required, the school's Canvas host),
  `CANVAS_TOKEN` (required), `CANVAS_DOWNLOAD_DIR` (default `~/Canvas`).
- Registered in Claude Code with
  `claude mcp add -s user canvas -e CANVAS_TOKEN=... -- node "<repo>/dist/index.js"`.
- No deploy target; it runs locally.

## Out of scope for v1
- Announcements, discussions (read or write), grades summary, inbox messages.
- Text-entry or URL submissions; quiz taking; group submissions.
- Planner writes (mark done, notes).
- Remote/HTTP transport, OAuth, claude.ai web/mobile use.
- Caching across runs; multi-account support.

## Open decisions
- Token storage: `.env` in the repo dir (gitignored) read by the server at startup;
  the `claude mcp add -e` form also works. Default: `.env`.
- Download dir default `~/Canvas` (expanded to the user's home directory).
- Item cap for paginated lists: 500. Raise if a course ever exceeds it.
- If the school's Canvas blocks student token generation, fall back to asking IT for a
  developer key; nothing in the code changes except auth.

## Verification (definition of done for v1)
1. `cp .env.example .env`, set `CANVAS_BASE_URL`, paste a token from Canvas → Account → Settings →
   New Access Token.
2. `npm run check` (typecheck + lint + unit tests) passes; paste the output.
3. `npm run build`, then `claude mcp add -s user canvas -- node "<repo>\dist\index.js"`;
   `claude mcp list` shows `canvas` as connected.
4. In a fresh Claude Code session ask: "What's due in the next 7 days across my
   courses?" → answer lists real assignments with correct due dates and courses.
5. Ask: "Download the files from the current module of <one course>" → files land in
   `~/Canvas/<course code>/` and Claude can Read one of the PDFs.
6. Ask: "Submit <small test file> to <a low-stakes or practice assignment>" →
   first call returns the preview and changes nothing (verify in Canvas UI); after
   confirming, the submission appears in Canvas with the file attached.
