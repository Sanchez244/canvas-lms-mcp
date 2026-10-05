# canvas-mcp

MCP server that lets Claude Code read a Canvas LMS account (courses, assignments, due dates, modules, files, syllabus) and submit files to assignments behind an explicit confirmation step.

## Setup

```powershell
npm install
Copy-Item .env.example .env   # then set CANVAS_BASE_URL and CANVAS_TOKEN
npm run build
claude mcp add -s user canvas -- node "<path to this repo>\dist\index.js"
claude mcp list               # canvas should show as connected
```

Token: Canvas → Account → Settings → New Access Token. It has your own permissions and lives only in the gitignored `.env`.

### Deployment modes

| Env | Effect |
|---|---|
| `CANVAS_AUTH=gateway` | The process holds no token and sends no `Authorization` header; an outbound HTTPS proxy (via `HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`) injects it. `CANVAS_TOKEN` is ignored. |
| `CANVAS_READ_ONLY=1` | `submit_assignment_file` is never registered, so no Canvas write is reachable through this server. |

Together they suit a sandboxed deployment: the server runs inside an agent container and the token lives only in the proxy. Default is token auth, read-write.

## Tools

| Tool | What it does |
|---|---|
| `whoami` | The Canvas user behind the token |
| `list_courses` | Active courses (id, name, code, term); `include_past` for old ones |
| `get_course` | Course details plus syllabus as text |
| `list_upcoming` | Everything due in the next N days across all courses, with submission status |
| `list_assignments` | Assignments in a course by bucket (upcoming, overdue, unsubmitted, past, all) |
| `get_assignment` | Description as text, rubric, submission types, allowed extensions |
| `list_modules` | Modules with items; gives `file_id` for `download_file` and `page_url` for `get_page` |
| `get_page` | A course wiki page as text |
| `list_files` | Course files, optionally filtered by name |
| `download_file` | Saves a file to `~/Canvas/<course code>/<name>` and returns the path |
| `read_document` | Text of a local .docx or .pdf, page by page for PDFs |
| `submit_assignment_file` | Preview only unless `confirm: true`; then uploads and submits the file |

## Development

```powershell
npm run check     # typecheck + lint + tests
npm run build     # compile to dist/ (Claude Code runs dist, not src)
npm run inspect   # MCP Inspector UI against the built server
```

See `SPEC.md` for scope and `CLAUDE.md` for conventions.
