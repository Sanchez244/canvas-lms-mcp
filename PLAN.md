# PLAN — canvas-mcp

Ordered vertical slices from SPEC.md. Each ends with a runnable check. Tick when done.
Run `/clear` between slices and `/new-feature` for each one.

## Slice 0 — Token and connection
- [x] Create a token at Canvas → Account → Settings → New Access Token; pastes into `.env`.
- [x] `npm run build`, `claude mcp add -s user canvas -- node "<repo>\dist\index.js"`, `claude mcp list` shows connected.
- [x] `whoami` returns the Canvas user (verified 2026-09-11 via stdio, not yet from a fresh Claude Code session).

## Slice 1 — Courses and syllabus
- [x] `src/canvas/text.ts`: `htmlToText()`, `formatDate()` → local-offset ISO + "Tue 15 Sep 23:59". Unit tests.
- [x] `list_courses { include_past? }`
- [x] `get_course { course_id }` with syllabus as text
- Check: live `list_courses` returned the active courses. `get_course` on one course returned syllabus null (course has none; syllabus is a .docx in modules).

## Slice 2 — Weekly briefing
- [x] `list_upcoming { days = 7, include_past_days = 0 }` from `/planner/items`, sorted, with status.
- [x] Unit test against `test/fixtures/planner.json`.
- Check: live call returned real deadlines with -04:00 offsets. Not yet compared line by line against the Canvas dashboard.

## Slice 3 — Assignments
- [x] `list_assignments { course_id, bucket }`
- [x] `get_assignment { course_id, assignment_id }` with description text and rubric
- Check: live `get_assignment` on a real assignment returned full description text.

## Slice 4 — Modules and pages
- [x] `list_modules { course_id }` with items and file_id / page_url / content_id hints
- [x] `get_page { course_id, page_url }`
- Check: live `list_modules` on a real course listed modules with files and links. `get_page` not yet exercised live.

## Slice 5 — Files and downloads
- [x] `list_files { course_id, search? }`
- [x] `download_file { file_id, course_code? }` → `~/Canvas/<code>/<name>`, skip if same size, Windows-safe names
- [x] Unit tests: stream to disk, skip on repeat, no file left on failure.
- Check: live download of a course PDF (223 KB) landed in `~/Canvas/<course code>/`. `list_files` not yet exercised live.

## Slice 6 — Submit a file (confirm-gated)
- [x] `submit_assignment_file { course_id, assignment_id, file_path, confirm? }`
- [x] Preview validates upload type, extension, file existence, size, lock; warns on late / resubmission.
- [x] Confirm path: 3-step upload then create submission.
- [x] Unit tests for preview problems and the 3-step call sequence.
- Check: live previews correctly refused a non-upload assignment, a wrong extension, and returned a clean preview for a .docx on an upload assignment. **Confirmed submission never run live** — needs a low-stakes assignment that is safe to submit to.

## Slice 8 — read_document (approved 2026-09-11)
Outcome: `read_document { path, max_chars? }` returns the text of a local .docx (mammoth → html → text)
or .pdf (unpdf) so Claude can read syllabi and homework prompts. Poppler installed via winget so the
built-in Read tool can render PDF pages. Non-goals: pptx, OCR, images, auto-convert on download.
- [x] deps: mammoth, unpdf
- [x] `src/tools/documents.ts` + `test/documents.test.ts` + fixtures (generated docx/pdf)
- [x] wire in `src/index.ts`, README tool table
- [x] Poppler 25.07 installed via winget; bin dir is on the user PATH (pdftoppm -v works by absolute path).
- Check: 26 tests pass; live read_document on a syllabus .docx (15k chars) and a 10-page .pdf worked.
  Read-tool PDF rendering could not be confirmed from this session (its process predates the PATH change); verify in a fresh session.

## Slice 7 — Wrap up
- [ ] Fresh Claude Code session: "What's due in the next 7 days?" and compare against the Canvas dashboard.
- [ ] Live `get_page` and `list_files` once.
- [ ] One real confirmed submission to a practice/low-stakes assignment, then verify in Canvas.
- [ ] Update README with the tool list. `/handoff`.
