/**
 * Conversor Markdown (CommonMark/GFM) → sintaxe nativa WhatsApp.
 * Contrato: docs/WHATSAPP-MARKDOWN-MAPPING.md
 */

'use strict';

const FENCE_PH = (i) => `\u0000FENCE${i}\u0000`;
const INLINE_PH = (i) => `\u0000INLINE${i}\u0000`;
const STYLE_PH = (i) => `\u0000STYLE${i}\u0000`;

/**
 * @param {unknown} input
 * @returns {string}
 */
function markdownToWhatsapp(input) {
  if (input == null) return '';
  if (typeof input !== 'string') return '';

  let text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text) return '';

  const fences = [];
  const inlines = [];
  const styles = [];

  const stashStyle = (wa) => {
    const i = styles.length;
    styles.push(wa);
    return STYLE_PH(i);
  };

  // 1) Fences — isolar e remover tag de linguagem
  text = text.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_m, _info, body) => {
    const code = String(body ?? '').replace(/\n$/, '');
    const rendered = code.length ? `\`\`\`\n${code}\n\`\`\`` : '```\n```';
    const i = fences.length;
    fences.push(rendered);
    return FENCE_PH(i);
  });

  // 2) Inline code
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const i = inlines.length;
    inlines.push(`\`${code}\``);
    return INLINE_PH(i);
  });

  // 3) Tabelas GFM → lista rotulada
  text = convertTables(text);

  // 4) Setext headings (antes de HR)
  text = text.replace(/^(.+)\n(=+|-{3,})\s*$/gm, (_m, title, under) => {
    const t = String(title).trim();
    if (!t) return _m;
    // linha só de hífens sob título curto: setext
    if (/^-+$/.test(under) || /^=+$/.test(under)) {
      return stashStyle(`*${t}*`);
    }
    return _m;
  });

  // 5) ATX headings
  text = text.replace(/^#{1,6}\s+(.+?)\s*#*\s*$/gm, (_m, title) => {
    const t = String(title).trim();
    if (!t) return _m;
    return stashStyle(`*${t}*`);
  });

  // 6) HR (linha só com --- / *** / ___)
  text = text.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '────────');

  // 7) Imagens e links
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt, url) => {
    const label = String(alt || '').trim();
    return label ? `${label}: ${url}` : String(url);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label, url) => {
    return `${label}: ${url}`;
  });
  text = text.replace(/<(https?:\/\/[^>\s]+)>/gi, '$1');

  // 8) HTML → texto
  text = text.replace(/<\/?[^>]+>/g, '');

  // 9) Listas: achatar + preferir hífen
  // Não confundir `* texto *` (delimitadores inválidos) com bullet `* item`
  text = text.replace(/^[ \t]*([*+-])\s+(\S.*)$/gm, (full, bullet, rest) => {
    if (bullet === '*' && /\s\*$/.test(rest)) {
      return full;
    }
    return `- ${rest}`;
  });
  text = text.replace(/^[ \t]+(\d+\.)\s+/gm, '$1 ');

  // 10) Blockquotes aninhados → um nível
  text = text.replace(/^>{2,}\s?/gm, '> ');

  // 11) Ênfase — ordem: triplo → bold → strike → italic *
  // ***bold italic***
  text = text.replace(/\*\*\*([^*\n]+?)\*\*\*/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`*_${inner}_*`);
  });
  // **_italic bold_** / *__*italic*_**
  text = text.replace(/\*\*_(.+?)_\*\*/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`*_${inner}_*`);
  });
  text = text.replace(/__\*(.+?)\*__/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`*_${inner}_*`);
  });
  // **bold**
  text = text.replace(/\*\*([^*\n]+?)\*\*/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`*${inner}*`);
  });
  // __bold__
  text = text.replace(/__(?!_)([^_\n]+?)__(?!_)/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`*${inner}*`);
  });
  // ~~strike~~
  text = text.replace(/~~([^~\n]+?)~~/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`~${inner}~`);
  });
  // *italic* (MD) → _italic_ (WA); espaços nas bordas → preservar (fail-safe)
  text = text.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`_${inner}_`);
  });
  // _italic_ com fronteira de palavra (protege user_id_config)
  text = text.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, (_m, inner) => {
    if (!isValidInlineContent(inner)) return _m;
    return stashStyle(`_${inner}_`);
  });

  // 12) Escapes Markdown restantes
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1');

  // 13) Restaurar placeholders (estilos → inline → fences)
  text = text.replace(/\u0000STYLE(\d+)\u0000/g, (_m, i) => styles[Number(i)] ?? '');
  text = text.replace(/\u0000INLINE(\d+)\u0000/g, (_m, i) => inlines[Number(i)] ?? '');
  text = text.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i) => fences[Number(i)] ?? '');

  return text;
}

/** Conteúdo válido entre delimitadores WA: sem espaço colado às bordas. */
function isValidInlineContent(inner) {
  if (inner == null) return false;
  const s = String(inner);
  if (!s.length) return false;
  if (/^\s|\s$/.test(s)) return false;
  return true;
}

function splitTableRow(line) {
  let row = String(line).trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((c) => c.trim());
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function looksLikeTableRow(line) {
  const t = String(line).trim();
  if (!t.includes('|')) return false;
  return t.split('|').length >= 2;
}

function convertTables(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const headerLine = lines[i];
    const sepLine = lines[i + 1];
    if (
      looksLikeTableRow(headerLine) &&
      sepLine != null &&
      isTableSeparator(sepLine)
    ) {
      const headers = splitTableRow(headerLine);
      i += 2;
      while (i < lines.length && looksLikeTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        const cells = splitTableRow(lines[i]);
        for (let c = 0; c < headers.length; c += 1) {
          const h = headers[c] || `Coluna ${c + 1}`;
          const v = cells[c] ?? '';
          out.push(`- ${h}: ${v}`);
        }
        i += 1;
      }
      continue;
    }
    out.push(headerLine);
    i += 1;
  }
  return out.join('\n');
}

module.exports = {
  markdownToWhatsapp,
};
