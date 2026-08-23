const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

describe('kernelProvider.chat', () => {
  let server;
  let lastReq;

  beforeEach(async () => {
    lastReq = null;
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        lastReq = {
          url: req.url,
          method: req.method,
          auth: req.headers.authorization || null,
          traceId: req.headers['x-trace-id'] || null,
          body: body ? JSON.parse(body) : null,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          answer: 'resposta kernel',
          discipline: null,
          sources: [],
          confidence: 0.9,
          metadata: {},
        }));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('POST /v1/chat com context e Bearer opcional', async () => {
    const { chat } = require('../src/providers/kernelProvider');
    const { port } = server.address();
    const answer = await chat({
      baseUrl: `http://127.0.0.1:${port}`,
      token: 'tok-test',
      userId: '5511@s.whatsapp.net',
      channelId: '5511@s.whatsapp.net',
      message: 'oi',
      resetContext: false,
      timeoutMs: 5000,
    });
    assert.equal(answer, 'resposta kernel');
    assert.equal(lastReq.method, 'POST');
    assert.equal(lastReq.url, '/v1/chat');
    assert.equal(lastReq.auth, 'Bearer tok-test');
    assert.equal(lastReq.body.context.platform, 'whatsapp');
    assert.equal(lastReq.body.context.user_id, '5511@s.whatsapp.net');
    assert.equal(lastReq.body.message, 'oi');
    assert.equal(lastReq.body.reset_context, false);
    assert.equal(lastReq.body.stream, false);
  });

  it('reset_context true + sem token', async () => {
    const { chat } = require('../src/providers/kernelProvider');
    const { port } = server.address();
    await chat({
      baseUrl: `http://127.0.0.1:${port}`,
      token: '',
      userId: 'a@s.whatsapp.net',
      channelId: 'g@g.us',
      message: 'olá',
      resetContext: true,
      timeoutMs: 5000,
    });
    assert.equal(lastReq.auth, null);
    assert.equal(lastReq.body.reset_context, true);
    assert.equal(lastReq.body.message, 'olá');
  });

  it('envia X-Trace-Id quando traceId é passado', async () => {
    const { chat } = require('../src/providers/kernelProvider');
    const { port } = server.address();
    await chat({
      baseUrl: `http://127.0.0.1:${port}`,
      token: '',
      userId: 'u@s.whatsapp.net',
      channelId: 'u@s.whatsapp.net',
      message: 'trace me',
      traceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      timeoutMs: 5000,
    });
    assert.equal(lastReq.traceId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
