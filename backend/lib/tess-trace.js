const crypto = require('crypto');

const TRACE_MAX = 64;

function newTraceId() {
  return crypto.randomUUID();
}

function clipTraceId(traceId) {
  if (traceId == null || traceId === '') return null;
  return String(traceId).slice(0, TRACE_MAX);
}

function withTrace(turns, traceId) {
  const id = clipTraceId(traceId);
  if (!id || !Array.isArray(turns)) return turns || [];
  return turns.map((turn) => ({ ...turn, trace_id: turn.trace_id || id }));
}

module.exports = {
  TRACE_MAX,
  newTraceId,
  clipTraceId,
  withTrace,
};
