const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'orbitbot.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_cliente ON historico(cliente_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico(timestamp)`);
});

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function _resolveClienteId(identifier, cb) {
  if (typeof identifier === 'number' && Number.isFinite(identifier)) {
    return cb(null, identifier);
  }

  if (typeof identifier === 'string') {
    if (/^\d+$/.test(identifier) && !identifier.includes('@')) {
      const asId = parseInt(identifier, 10);
      return db.get('SELECT id FROM clientes WHERE id = ?', [asId], (err, row) => {
        if (err) return cb(err);
        if (row) return cb(null, row.id);
        // fallback: tratar como número WhatsApp sem sufixo
        const dig = digitsOnly(identifier);
        db.get(
          'SELECT id FROM clientes WHERE numero = ? OR replace(replace(numero, "@c.us", ""), "@s.whatsapp.net", "") = ?',
          [identifier, dig],
          (err2, row2) => {
            if (err2) return cb(err2);
            if (!row2) return cb(new Error('Cliente não encontrado'));
            cb(null, row2.id);
          }
        );
      });
    }

    const dig = digitsOnly(identifier);
    return db.get(
      `SELECT id FROM clientes
       WHERE numero = ?
          OR replace(replace(numero, '@c.us', ''), '@s.whatsapp.net', '') = ?`,
      [identifier, dig],
      (err, row) => {
        if (err) return cb(err);
        if (!row) return cb(new Error('Cliente não encontrado'));
        cb(null, row.id);
      }
    );
  }

  return cb(new Error('Identificador de cliente inválido'));
}

function getOrCreateClient(numero) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, numero FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);

      const dig = digitsOnly(numero);
      db.get(
        `SELECT id, numero FROM clientes
         WHERE replace(replace(numero, '@c.us', ''), '@s.whatsapp.net', '') = ?`,
        [dig],
        (err2, row2) => {
          if (err2) return reject(err2);
          if (row2) return resolve(row2);

          db.run('INSERT INTO clientes (numero) VALUES (?)', [numero], function (err3) {
            if (err3) return reject(err3);
            resolve({ id: this.lastID, numero });
          });
        }
      );
    });
  });
}

function appendHistory(clienteId, role, mensagem) {
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    db.run(
      'INSERT INTO historico (cliente_id, role, mensagem, timestamp) VALUES (?, ?, ?, ?)',
      [clienteId, role, mensagem, ts],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, cliente_id: clienteId, role, mensagem, timestamp: ts });
      }
    );
  });
}

function getPagedHistory(identifier, page = 1, pageSize = 50) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(identifier, (err, clienteId) => {
      if (err) return reject(err);

      const offset = (page - 1) * pageSize;
      db.all(
        'SELECT role, mensagem, timestamp FROM historico WHERE cliente_id = ? ORDER BY id ASC LIMIT ? OFFSET ?',
        [clienteId, pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);

          db.get(
            'SELECT COUNT(*) as total FROM historico WHERE cliente_id = ?',
            [clienteId],
            (err3, countRow) => {
              if (err3) return reject(err3);
              const total = countRow.total || 0;
              resolve({
                messages: rows.map((r) => ({
                  role: r.role,
                  mensagem: r.mensagem,
                  timestamp: r.timestamp,
                })),
                pagination: {
                  currentPage: page,
                  pageSize,
                  totalMessages: total,
                  totalPages: Math.max(1, Math.ceil(total / pageSize)),
                },
              });
            }
          );
        }
      );
    });
  });
}

function getRecentHistory(identifier, limit = 50) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(identifier, (err, resolvedId) => {
      if (err) {
        // cliente ainda inexistente → histórico vazio
        if (String(err.message).includes('não encontrado')) {
          return resolve({ messages: [] });
        }
        return reject(err);
      }
      db.all(
        'SELECT role, mensagem, timestamp FROM historico WHERE cliente_id = ? ORDER BY id DESC LIMIT ?',
        [resolvedId, limit],
        (err2, rows) => {
          if (err2) return reject(err2);
          resolve({
            messages: rows.reverse().map((r) => ({
              role: r.role,
              mensagem: r.mensagem,
              timestamp: r.timestamp,
            })),
          });
        }
      );
    });
  });
}

function getConfig(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

function setConfig(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value)],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function resetAllData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM historico', (err1) => {
        if (err1) return reject(err1);
        db.run('DELETE FROM clientes', (err2) => {
          if (err2) return reject(err2);
          db.run(
            'DELETE FROM sqlite_sequence WHERE name IN ("historico", "clientes")',
            (err3) => {
              // sqlite_sequence pode não existir em DBs novos — ignorar
              if (err3 && !/no such table/i.test(err3.message)) return reject(err3);
              resolve(true);
            }
          );
        });
      });
    });
  });
}

// Aliases legados (compatibilidade interna durante transição)
const cadastrarCliente = (numero) => getOrCreateClient(numero);
const buscarCliente = (numero) =>
  new Promise((resolve, reject) => {
    db.get('SELECT id, numero FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
const adicionarMensagem = (clienteId, mensagem, role) => appendHistory(clienteId, role, mensagem);
const buscarHistorico = getPagedHistory;
const buscarUltimasMensagens = async (identifier, limit) => {
  const { messages } = await getRecentHistory(identifier, limit);
  return messages;
};

module.exports = {
  getOrCreateClient,
  appendHistory,
  getRecentHistory,
  getPagedHistory,
  getConfig,
  setConfig,
  resetAllData,
  // legado
  cadastrarCliente,
  buscarCliente,
  adicionarMensagem,
  buscarHistorico,
  buscarUltimasMensagens,
};
