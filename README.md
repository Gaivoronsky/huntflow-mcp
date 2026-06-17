# huntflow-mcp

MCP server for [HuntFlow](https://huntflow.ru) ATS API v2 — vacancies, candidates, resumes, funnel stages, rejection reasons, comments, accounts. **14 tools, 3 prompts.**

[![npm](https://img.shields.io/npm/v/@gaivoronsky/huntflow-mcp)](https://www.npmjs.com/package/@gaivoronsky/huntflow-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Works with HuntFlow v2 (`api.huntflow.ru` for Russia or `api.huntflow.ai` for international accounts). Transports: **stdio** and **streamable HTTP**. All data is read-only, except for adding comments.

## Installation

> 🧑‍💼 **Not a programmer?** There is a step-by-step guide in plain language: [INSTALL.md](INSTALL.md)

### Via npx — Claude Desktop (recommended)

In `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`):

```json
{
  "mcpServers": {
    "huntflow": {
      "command": "npx",
      "args": ["-y", "@gaivoronsky/huntflow-mcp"],
      "env": {
        "HUNTFLOW_TOKEN": "your-token",
        "HUNTFLOW_BASE_URL": "https://api.huntflow.ai/v2"
      }
    }
  }
}
```

After editing the config, fully restart Claude Desktop (⌘Q and reopen).

### From source (for development)

```bash
git clone https://github.com/Gaivoronsky/huntflow-mcp.git
cd huntflow-mcp
npm install
npm run build      # → dist/
```

Run from the built code with `node dist/index.js`. To connect to Claude Desktop from source, set `"command"` in the config to the **absolute** path to `node` (the GUI does not inherit the shell `PATH`; e.g. `~/.nvm/versions/node/<version>/bin/node`) and `"args"` to `["/path/to/huntflow-mcp/dist/index.js"]`.

### Streamable HTTP

```bash
HUNTFLOW_TOKEN=your-token node dist/index.js --http
# POST /mcp, GET /health on port 3000 (override with PORT=...)
```

## Getting a token

1. In HuntFlow: **Settings → API → Add token**.
2. The system will issue a link like `https://huntflow.ai/token_request/<hash>`. **Do not open it "just to check"** — that deactivates it. Open it in a browser under your account and click **Receive**.
3. Put the resulting `access_token` (a long string) into `HUNTFLOW_TOKEN`.

> The `access_token` lives for 7 days, the `refresh_token` for 14. The server does not refresh the token automatically — once it expires, obtain a new token again.

## Environment variables

| Variable | Required | Description |
|------------|:---:|----------|
| `HUNTFLOW_TOKEN` | yes | API token (Settings → API) |
| `HUNTFLOW_BASE_URL` | no | Defaults to `https://api.huntflow.ru/v2`. For an international account — `https://api.huntflow.ai/v2` |
| `HUNTFLOW_USER_AGENT` | no | The `User-Agent` header (HuntFlow requires it). Default `huntflow-mcp/<version> (+repo)`; a contact email is recommended |
| `PORT` | no | HTTP server port (defaults to 3000) |

## Tools (14)

| Tool | Description |
|------------|----------|
| `list_accounts` | List of available accounts |
| `list_vacancies` | List of vacancies (open/all), pagination `page`/`count` |
| `get_vacancy` | Full information about a vacancy |
| `list_applicants` | Candidates filtered by `vacancy`/`status`, pagination (`count`≤30) |
| `search_applicants` | Full-text search of candidates (`q`, `field`), pagination (`count`≤100) |
| `get_applicant` | Full candidate card (`external[]`, `links[]`) |
| `get_applicant_resume` | Resume (CV) with body by `external_id` (from `get_applicant`) |
| `list_stages` | Recruiting funnel stages (statuses): code → name |
| `list_rejection_reasons` | Reference list of rejection reasons: code → name |
| `list_applicant_comments` | Comments about a candidate (log, defaults to `type=COMMENT`) |
| `add_applicant_comment` | ✍️ Add a comment (**write**; editing/deletion is not available through the HuntFlow API) |
| `create_applicant` | ✍️ Create a candidate card (**write**; `first_name`+`last_name` are required, resume as text/files; a repeat → duplicate, see `doubles[]`) |
| `attach_applicant_to_vacancy` | ✍️ Attach a candidate to a vacancy and place them on a stage (**write**; `vacancy`+`status` are required) |
| `upload_resume` | ✍️ Upload a resume file (**write**, multipart; `file_path` or `content_base64`; `parse` recognizes the CV) |

## Prompts (3)

MCP prompts for typical recruiting scenarios:

| Prompt | Description |
|-------|----------|
| `skill-applicants` | Candidates for a vacancy — a table with stages and a summary |
| `skill-vacancy-stats` | Vacancy statistics — funnel, timing, conversion |
| `skill-vacancy-analytics` | Analytics: days in progress, candidates at stages with the customer, timing for sending the CV to the client |

## Development

```bash
npm install
npm test           # vitest (unit tests, mocked fetch)
npm run dev        # tsx src/index.ts (run from TS without building)
npm run build      # tsc → dist/
```

Structure: a thin HTTP client `src/client.ts` (Bearer + User-Agent, passing through API error bodies, retries only for GET), tools in `src/tools/*.ts`, server assembly in `src/index.ts`.

## License

MIT. Based on [theYahia/huntflow-mcp](https://github.com/theYahia/huntflow-mcp) (MIT) with adaptations for the real HuntFlow v2 API.
