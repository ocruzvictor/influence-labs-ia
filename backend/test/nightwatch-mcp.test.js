const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
  handleJsonRpc,
  extractBearer,
  timingSafeEqualString,
  mountNightwatchMcp,
  TOOLS,
} = require('../lib/nightwatch-mcp');

test('extractBearer reads Authorization header', () => {
  assert.equal(extractBearer({ headers: { authorization: 'Bearer abc123' } }), 'abc123');
  assert.equal(extractBearer({ headers: { authorization: 'abc123' } }), 'abc123');
  assert.equal(extractBearer({ headers: {} }), '');
});

test('timingSafeEqualString rejects length mismatch', () => {
  assert.equal(timingSafeEqualString('abcd', 'ab'), false);
  assert.equal(timingSafeEqualString('secret', 'secret'), true);
});

test('initialize echoes protocolVersion', async () => {
  const r = await handleJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05' },
  }, {});
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.equal(r.result.serverInfo.name, 'nightwatch-mcp-server');
  assert.equal(r.result.capabilities.tools.listChanged, false);
});

test('tools/list exposes the four Nightwatch tools', async () => {
  const r = await handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {});
  assert.deepEqual(r.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
});

test('tools/call patrol_live wraps ops payload', async () => {
  const ops = {
    patrolLive: async () => ({ signals: { p0_stuck: 0 }, next_action: 'standby' }),
  };
  const r = await handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'patrol_live', arguments: { minutes: 15 } },
  }, { ops, db: {}, getHealthLite: async () => ({ mode: 'OPEN' }) });
  const body = JSON.parse(r.result.content[0].text);
  assert.equal(body.next_action, 'standby');
});

test('notifications/initialized returns null', async () => {
  const r = await handleJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, {});
  assert.equal(r, null);
});

test('HTTP /mcp rejects missing bearer', async () => {
  const app = express();
  app.use(express.json());
  mountNightwatchMcp(app, {
    getToken: () => 'nightwatch-secret',
    db: {},
    ops: {},
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(denied.status, 401);
    const ok = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nightwatch-secret',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.result.tools.length, 4);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
