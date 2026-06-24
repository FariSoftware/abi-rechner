# abi-rechner-mcp

MCP server exposing the Baden-Württemberg Abitur calculator as tools for LLMs.
Wraps the pure rules in [`../abi-core.js`](../abi-core.js) — the same logic the
website uses, so the tool and the site can never disagree.

## Tools

| Tool | Purpose |
|------|---------|
| `list_subjects` | All BW subjects with id, name, Aufgabenfeld, LF-eligibility. Call first to map scanned names → ids. |
| `calculate_abitur` | Block I + Block II + Gesamtpunktzahl + Durchschnittsnote + Bestehen, with hard errors and hints. |
| `validate_combo` | Check an LF + mündliche-PF + Basisfach combination against the BW rules, without grades. |

Intended split of labour: the LLM does OCR/extraction of scanned Zeugnisse into
`{ fach, halbjahr, punkte }`; this server does the deterministic rules.

## Run

```bash
npm install

# stdio — Claude Desktop / local agents
npm start

# Streamable HTTP — remote connector (ChatGPT/Claude), k8s
npm run start:http        # PORT env, default 3000, endpoint /mcp, health /healthz
```

## Test

```bash
npm test   # spawns the stdio server and exercises every tool
```

## Notes

- HTTP mode is **stateless** (fresh server+transport per request) — fits a pure
  calculator and scales horizontally with no shared state.
- Rules are **Baden-Württemberg specific**. Not valid for other Bundesländer.
- Auth: the HTTP endpoint is currently open. Add a gateway token / OAuth before
  exposing it as a public remote connector (see deployment notes).
