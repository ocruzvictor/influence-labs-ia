/**
 * Nightwatch MCP — streamable HTTP JSON-RPC at /mcp.
 * Read-only tools. Auth: Authorization Bearer (NIGHTWATCH_MCP_TOKEN || ADMIN_TOKEN).
 */

const crypto = require('crypto');

const SERVER_INFO = { name: 'nightwatch-mcp-server', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2025-03-26';

const TOOLS = [
  {
    name: 'patrol_live',
    description: 'Health + events + stuck threads + orphans. last4 only.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Lookback minutes (5-180, default 15)' },
      },
    },
  },
  {
    name: 'get_thread',
    description: 'Last WhatsApp turns for a phone last4. No full numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        last4: { type: 'string', description: 'Last 4 phone digits' },
        limit: { type: 'number', description: 'Turns to return (1-24, default 12)' },
      },
      required: ['last4'],
    },
  },
  {
    name: 'verify_commit',
    description: 'I1 check: success copy vs booking.* / agent_mutation 2xx.',
    inputSchema: {
      type: 'object',
      properties: {
        last4: { type: 'string', description: 'Last 4 phone digits' },
        assistant_text: { type: 'string', description: 'Optional outbound text to judge' },
        minutes: { type: 'number', description: 'Lookback minutes (default 30)' },
      },
      required: ['last4'],
    },
  },
  {
    name: 'list_orphans',
    description: 'tags.parsed creates/reschedules without created/failed/blocked/dropped.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Lookback minutes (default 15)' },
      },
    },
  },
];

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function extractBearer(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return (match ? match[1] : header).trim();
}

function sendUnauthorized(res) {
  res.set('WWW-Authenticate', 'Bearer realm="nightwatch"');
  return res.status(401).json({
    error: 'unauthorized',
    auth: 'bearer',
    hint: 'Authorization: Bearer <NIGHTWATCH_MCP_TOKEN>. OAuth/DCR not supported.',
  });
}

function jsonResult(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function jsonError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function textContent(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

async function callTool(ops, db, getHealthLite, name, args = {}) {
  switch (name) {
    case 'patrol_live': {
      const health = getHealthLite ? await getHealthLite() : {};
      return textContent(await ops.patrolLive(db, { minutes: args.minutes, health }));
    }
    case 'get_thread':
      return textContent(await ops.getThread(db, { last4: args.last4, limit: args.limit }));
    case 'verify_commit':
      return textContent(await ops.verifyCommit(db, {
        last4: args.last4,
        assistantText: args.assistant_text,
        minutes: args.minutes,
      }));
    case 'list_orphans':
      return textContent(await ops.listOrphans(db, { minutes: args.minutes }));
    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
  }
}

async function handleJsonRpc(message, ctx) {
  if (!message || typeof message !== 'object') {
    return jsonError(null, -32600, 'Invalid Request');
  }
  const { id, method, params } = message;
  const isNotification = id === undefined && String(method || '').startsWith('notifications/');
  if (isNotification) return null;

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion || DEFAULT_PROTOCOL;
      return jsonResult(id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false }, logging: {} },
        serverInfo: SERVER_INFO,
      });
    }
    case 'ping':
      return jsonResult(id, {});
    case 'tools/list':
      return jsonResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const result = await callTool(ctx.ops, ctx.db, ctx.getHealthLite, name, args);
        return jsonResult(id, result);
      } catch (err) {
        return jsonResult(id, {
          isError: true,
          content: [{ type: 'text', text: `Tool failed: ${err.message}` }],
        });
      }
    }
    case 'resources/list':
      return jsonResult(id, { resources: [] });
    case 'prompts/list':
      return jsonResult(id, { prompts: [] });
    default:
      return jsonError(id, -32601, `Method not found: ${method}`);
  }
}

function wantsSse(req) {
  const accept = String(req.headers.accept || '');
  return accept.includes('text/event-stream') && !accept.includes('application/json');
}

function writeSse(res, payload) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const messages = Array.isArray(payload) ? payload : [payload];
  for (const msg of messages) {
    if (!msg) continue;
    res.write(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
  }
  res.end();
}

function mountNightwatchMcp(app, {
  getToken,
  db,
  ops,
  getHealthLite,
} = {}) {
  if (!app) throw new Error('express app required');

  const requireNightwatchAuth = (req, res, next) => {
    const expected = getToken ? String(getToken() || '') : '';
    if (!expected) {
      return res.status(503).json({ error: 'nightwatch_mcp_unconfigured' });
    }
    if (!timingSafeEqualString(extractBearer(req), expected)) {
      return sendUnauthorized(res);
    }
    return next();
  };

  app.get('/.well-known/mcp/server-card.json', (_req, res) => {
    res.json({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      transport: 'streamable-http',
      url: 'https://api.studiotirra.com.br/mcp',
      authentication: {
        type: 'headers',
        headers: ['Authorization'],
        scheme: 'Bearer',
        oauth: false,
      },
      tools: TOOLS.map((t) => t.name),
    });
  });

  const rejectOauth = (_req, res) => {
    res.status(404).json({
      error: 'oauth_not_supported',
      auth: 'bearer',
      hint: 'Use Authorization Bearer. Do not POST /register.',
    });
  };
  app.get('/.well-known/oauth-authorization-server', rejectOauth);
  app.get('/.well-known/oauth-protected-resource', rejectOauth);
  app.post('/register', rejectOauth);
  app.options('/register', rejectOauth);

  app.options('/mcp', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(204).end();
  });

  app.get('/mcp', requireNightwatchAuth, (_req, res) => {
    res.json({
      status: 'ok',
      server: SERVER_INFO,
      tools: TOOLS.map((t) => t.name),
    });
  });

  app.post('/mcp', requireNightwatchAuth, async (req, res) => {
    try {
      const body = req.body;
      const ctx = { db, ops, getHealthLite };
      if (Array.isArray(body)) {
        const results = [];
        for (const item of body) {
          results.push(await handleJsonRpc(item, ctx));
        }
        const filtered = results.filter(Boolean);
        if (wantsSse(req)) return writeSse(res, filtered);
        return res.json(filtered);
      }
      const result = await handleJsonRpc(body, ctx);
      if (result === null) return res.status(202).end();
      if (wantsSse(req)) return writeSse(res, result);
      return res.json(result);
    } catch (err) {
      return res.status(400).json(jsonError(null, -32700, `Parse error: ${err.message}`));
    }
  });

  const restAuth = requireNightwatchAuth;
  app.get('/ops/nightwatch/patrol', restAuth, async (req, res) => {
    try {
      const health = getHealthLite ? await getHealthLite() : {};
      const payload = await ops.patrolLive(db, { minutes: req.query.minutes, health });
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get('/ops/nightwatch/thread/:last4', restAuth, async (req, res) => {
    try {
      return res.json(await ops.getThread(db, { last4: req.params.last4, limit: req.query.limit }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get('/ops/nightwatch/verify/:last4', restAuth, async (req, res) => {
    try {
      return res.json(await ops.verifyCommit(db, {
        last4: req.params.last4,
        assistantText: req.query.assistant_text,
        minutes: req.query.minutes,
      }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get('/ops/nightwatch/orphans', restAuth, async (req, res) => {
    try {
      return res.json(await ops.listOrphans(db, { minutes: req.query.minutes }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

module.exports = {
  SERVER_INFO,
  TOOLS,
  DEFAULT_PROTOCOL,
  extractBearer,
  timingSafeEqualString,
  handleJsonRpc,
  callTool,
  mountNightwatchMcp,
};
