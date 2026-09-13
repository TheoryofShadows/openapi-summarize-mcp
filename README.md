# @mcpx-digital/openapi-summarize

**MCP server for local OpenAPI / Swagger analysis.**

Load a local OpenAPI 3 or Swagger 2 JSON/YAML file, summarize endpoints by tag, find operations missing auth, list deprecated ops, and generate a short agent-friendly API cheat sheet.

> **Local files only.** This server never fetches remote specs or credentials. Point tools at files you already have on disk.

## Install

```bash
npx -y @mcpx-digital/openapi-summarize
```

> **Publish note:** Prepared for npm as `@mcpx-digital/openapi-summarize`. Until published, run from a local clone or GitHub.

## Cursor `mcp.json` example

```json
{
  "mcpServers": {
    "openapi-summarize": {
      "command": "npx",
      "args": ["-y", "@mcpx-digital/openapi-summarize"]
    }
  }
}
```

Local clone:

```json
{
  "mcpServers": {
    "openapi-summarize": {
      "command": "node",
      "args": ["/absolute/path/to/openapi-summarize-mcp/index.js"]
    }
  }
}
```

## Tools

| Tool | What it does |
|------|----------------|
| `summarize_by_tag` | Group endpoints by OpenAPI tag |
| `find_missing_auth` | List ops with no security (heuristic) |
| `list_deprecated` | List `deprecated: true` operations |
| `generate_cheat_sheet` | Short markdown cheat sheet for agents |

## Example prompts

- “Summarize `./openapi.yaml` by tag”
- “Which paths in `petstore.json` are missing auth?”
- “Generate an API cheat sheet from `api.json`”

## Development

```bash
git clone https://github.com/TheoryofShadows/openapi-summarize-mcp.git
cd openapi-summarize-mcp
npm install
npm test
```

## License

MIT
