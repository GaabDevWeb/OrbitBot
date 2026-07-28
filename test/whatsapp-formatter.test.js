const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { markdownToWhatsapp } = require('../src/utils/whatsappFormatter');

describe('markdownToWhatsapp — contratos da matriz', () => {
  it('caso 1 — negrito ** → *', () => {
    assert.equal(markdownToWhatsapp('**urgente**'), '*urgente*');
  });

  it('caso 2 — itálico * MD → _ WA', () => {
    assert.equal(markdownToWhatsapp('*ênfase*'), '_ênfase_');
  });

  it('caso 3 — itálico _ preservado', () => {
    assert.equal(markdownToWhatsapp('_ênfase_'), '_ênfase_');
  });

  it('caso 4 — negrito+itálico ***', () => {
    assert.equal(markdownToWhatsapp('***crítico***'), '*_crítico_*');
  });

  it('caso 5 — tachado ~~ → ~', () => {
    assert.equal(markdownToWhatsapp('~~cancelado~~'), '~cancelado~');
  });

  it('caso 6 — código inline protegido dentro de negrito', () => {
    assert.equal(
      markdownToWhatsapp('**Execute `npm test` antes do deploy.**'),
      '*Execute `npm test` antes do deploy.*'
    );
  });

  it('caso 7 — heading ATX → negrito WA', () => {
    assert.equal(markdownToWhatsapp('# Plano'), '*Plano*');
  });

  it('caso 8 — lista aninhada achatada', () => {
    assert.equal(markdownToWhatsapp('- alfa\n  - beta'), '- alfa\n- beta');
  });

  it('caso 9 — citação preservada', () => {
    assert.equal(markdownToWhatsapp('> observação'), '> observação');
  });

  it('caso 10 — link Markdown degradado', () => {
    assert.equal(
      markdownToWhatsapp('[Documentação](https://exemplo.test/docs)'),
      'Documentação: https://exemplo.test/docs'
    );
  });

  it('caso 11 — underscore em identificador intacto', () => {
    assert.equal(markdownToWhatsapp('produto_id_novo'), 'produto_id_novo');
  });

  it('caso 12 — delimitadores com espaços preservados (fail-safe)', () => {
    assert.equal(markdownToWhatsapp('* texto *'), '* texto *');
  });

  it('caso 13 — ***com espaços internos***', () => {
    assert.equal(markdownToWhatsapp('***muito crítico***'), '*_muito crítico_*');
  });

  it('caso 14 — fence com linguagem + literais internos', () => {
    const input = '```js\nconst valor = "**literal**";\n```';
    const expected = '```\nconst valor = "**literal**";\n```';
    assert.equal(markdownToWhatsapp(input), expected);
  });

  it('caso 15 — tabela GFM → pares rotulados', () => {
    const input = '| Chave | Valor |\n| --- | --- |\n| A | 1 |';
    assert.equal(markdownToWhatsapp(input), '- Chave: A\n- Valor: 1');
  });

  it('caso 16 — imagem Markdown degradada', () => {
    assert.equal(
      markdownToWhatsapp('![Diagrama](https://exemplo.test/a.png)'),
      'Diagrama: https://exemplo.test/a.png'
    );
  });
});

describe('markdownToWhatsapp — bordas e extras', () => {
  it('trata null/undefined/não-string sem lançar', () => {
    assert.equal(markdownToWhatsapp(null), '');
    assert.equal(markdownToWhatsapp(undefined), '');
    assert.equal(markdownToWhatsapp(42), '');
    assert.equal(markdownToWhatsapp({}), '');
    assert.equal(markdownToWhatsapp(''), '');
  });

  it('converte __bold__ e ## heading', () => {
    assert.equal(markdownToWhatsapp('__Atenção__'), '*Atenção*');
    assert.equal(markdownToWhatsapp('## Instalação'), '*Instalação*');
  });

  it('remove HTML e autolink', () => {
    assert.equal(markdownToWhatsapp('<u>texto</u>'), 'texto');
    assert.equal(markdownToWhatsapp('<https://exemplo.test>'), 'https://exemplo.test');
  });

  it('HR e setext', () => {
    assert.equal(markdownToWhatsapp('---'), '────────');
    assert.equal(markdownToWhatsapp('Resumo\n---'), '*Resumo*');
  });

  it('lista * item → hífen', () => {
    assert.equal(markdownToWhatsapp('* um\n* dois'), '- um\n- dois');
  });
});
