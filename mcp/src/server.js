#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
//  server.js — Abitur MCP server. Two transports:
//    node src/server.js          → stdio   (Claude Desktop, local)
//    node src/server.js --http   → HTTP    (ChatGPT/Claude remote
//                                           connector, k8s)
//  HTTP mode is stateless: a fresh server+transport per request,
//  which suits a pure calculator (no sessions to keep).
// ══════════════════════════════════════════════════════════════

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';

const SERVER_INFO = { name: 'abi-rechner', version: '0.1.0' };

function makeServer() {
  const server = new McpServer(SERVER_INFO);
  registerTools(server);
  return server;
}

async function runStdio() {
  const server = makeServer();
  await server.connect(new StdioServerTransport());
  // stdio: do not write to stdout (it is the protocol channel).
  process.stderr.write('abi-rechner MCP server ready (stdio)\n');
}

async function runHttp() {
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => res.json({ ok: true, server: SERVER_INFO }));

  // Stateless Streamable HTTP: new instances per request.
  app.post('/mcp', async (req, res) => {
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      process.stderr.write(`MCP request error: ${err?.stack || err}\n`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  // GET/DELETE not supported in stateless mode.
  const methodNotAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => process.stderr.write(`abi-rechner MCP server ready (http) on :${port}/mcp\n`));
}

const http = process.argv.includes('--http') || process.env.MCP_HTTP === '1';
(http ? runHttp() : runStdio()).catch((err) => {
  process.stderr.write(`Fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
