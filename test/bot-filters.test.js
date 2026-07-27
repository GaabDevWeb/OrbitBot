const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPrivateChat,
  extractText,
  isAdmin,
  loadAdminNumbers,
} = require('../src/whatsappUtils');

describe('isPrivateChat', () => {
  it('aceita chats 1:1', () => {
    assert.equal(isPrivateChat('5554999999999@s.whatsapp.net'), true);
    assert.equal(isPrivateChat('5554999999999@c.us'), true);
    assert.equal(isPrivateChat('123456789012345@lid'), true);
  });

  it('rejeita grupos e broadcasts', () => {
    assert.equal(isPrivateChat('120363@g.us'), false);
    assert.equal(isPrivateChat('status@broadcast'), false);
    assert.equal(isPrivateChat('x@broadcast'), false);
  });
});

describe('extractText', () => {
  it('lê conversation e extendedText', () => {
    assert.equal(extractText({ message: { conversation: 'olá' } }), 'olá');
    assert.equal(
      extractText({ message: { extendedTextMessage: { text: 'oi' } } }),
      'oi'
    );
  });
});

describe('isAdmin', () => {
  it('compara por dígitos ignorando sufixo JID', () => {
    const admins = loadAdminNumbers('5554999999999, 5511999999999');
    assert.equal(isAdmin('5554999999999@s.whatsapp.net', admins), true);
    assert.equal(isAdmin('5554000000000@s.whatsapp.net', admins), false);
  });
});
