const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const tessAuthPath = require.resolve('../lib/tess-auth');

function loadFresh() {
  delete require.cache[tessAuthPath];
  return require(tessAuthPath);
}

const savedToken = process.env.TESS_API_TOKEN;
const savedWorkspace = process.env.TESS_WORKSPACE_ID;

beforeEach(() => {
  process.env.TESS_API_TOKEN = 'test-token';
  delete process.env.TESS_WORKSPACE_ID;
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.TESS_API_TOKEN;
  else process.env.TESS_API_TOKEN = savedToken;
  if (savedWorkspace === undefined) delete process.env.TESS_WORKSPACE_ID;
  else process.env.TESS_WORKSPACE_ID = savedWorkspace;
  delete require.cache[tessAuthPath];
});

test('AC1: tessAuthHeaders inclui Bearer e x-workspace-id', () => {
  process.env.TESS_WORKSPACE_ID = '1458234';
  const { tessAuthHeaders } = loadFresh();
  const headers = tessAuthHeaders({ 'Content-Type': 'application/json' });
  assert.equal(headers.Authorization, 'Bearer test-token');
  assert.equal(headers['x-workspace-id'], '1458234');
  assert.equal(headers['Content-Type'], 'application/json');
});

test('AC1: lança se TESS_WORKSPACE_ID ausente', () => {
  const { tessAuthHeaders } = loadFresh();
  assert.throws(() => tessAuthHeaders(), /TESS_WORKSPACE_ID/);
});

test('AC1: lança se TESS_WORKSPACE_ID não é só dígitos', () => {
  process.env.TESS_WORKSPACE_ID = 'abc';
  const { tessAuthHeaders } = loadFresh();
  assert.throws(() => tessAuthHeaders(), /TESS_WORKSPACE_ID/);
});

test('AC1: trim e rejeita vazio', () => {
  process.env.TESS_WORKSPACE_ID = '  ';
  const { tessAuthHeaders, tessWorkspaceConfigured } = loadFresh();
  assert.equal(tessWorkspaceConfigured(), false);
  assert.throws(() => tessAuthHeaders(), /TESS_WORKSPACE_ID/);
});

test('AC1: tessWorkspaceConfigured true só com dígitos', () => {
  process.env.TESS_WORKSPACE_ID = '1458234';
  const { tessWorkspaceConfigured, tessWorkspaceId } = loadFresh();
  assert.equal(tessWorkspaceConfigured(), true);
  assert.equal(tessWorkspaceId(), '1458234');
});
