const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { newTraceId } = require('../src/traceClient');

describe('traceClient', () => {
  it('newTraceId gera UUID', () => {
    const id = newTraceId();
    assert.match(id, /^[0-9a-f-]{36}$/i);
  });
});
