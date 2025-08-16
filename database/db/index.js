const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Caminho do banco de dados: OrbitBot/database/data/orbitbot.db
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'orbitbot.db');

// Garante a existência do diretório
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Instância única do DB
const db = new sqlite3.Database(dbPath);

// Inicializa esquema
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

  // Índices úteis
  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_cliente ON historico(cliente_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico(timestamp)`);
});

function cadastrarCliente(numero) {
  return new Promise((resolve, reject) => {
    // Tenta buscar primeiro para evitar erro de UNIQUE
    db.get('SELECT id, numero FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);

      db.run('INSERT INTO clientes (numero) VALUES (?)', [numero], function (err2) {
        if (err2) return reject(err2);
        resolve({ id: this.lastID, numero });
      });
    });
  });
}

function buscarCliente(numero) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, numero FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function adicionarMensagem(clienteId, mensagem, role) {
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

function _resolveClienteId(identifier, cb) {
  if (typeof identifier === 'number') return cb(null, identifier);
  if (typeof identifier === 'string' && /^\d+@c\.us$/.test(identifier)) {
    db.get('SELECT id FROM clientes WHERE numero = ?', [identifier], (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(new Error('Cliente não encontrado'));
      cb(null, row.id);
    });
  } else if (typeof identifier === 'string' && /^\d+$/.test(identifier)) {
    // string numérica simples -> interpreta como ID
    return cb(null, parseInt(identifier, 10));
  } else {
    return cb(new Error('Identificador de cliente inválido'));
  }
}

function buscarHistorico(identifier, page = 1, pageSize = 50) {
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
              const totalPages = Math.max(1, Math.ceil(total / pageSize));

              resolve({
                messages: rows.map(r => ({ role: r.role, mensagem: r.mensagem, timestamp: r.timestamp })),
                pagination: {
                  currentPage: page,
                  pageSize,
                  totalMessages: total,
                  totalPages
                }
              });
            }
          );
        }
      );
    });
  });
}

function buscarUltimasMensagens(clienteId, limit = 20) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(clienteId, (err, resolvedId) => {
      if (err) return reject(err);
      db.all(
        'SELECT role, mensagem, timestamp FROM historico WHERE cliente_id = ? ORDER BY id DESC LIMIT ?',
        [resolvedId, limit],
        (err2, rows) => {
          if (err2) return reject(err2);
          // retorna em ordem cronológica
          resolve(rows.reverse().map(r => ({ role: r.role, mensagem: r.mensagem, timestamp: r.timestamp })));
        }
      );
    });
  });
}

module.exports = {
  cadastrarCliente,
  buscarCliente,
  adicionarMensagem,
  buscarHistorico,
  buscarUltimasMensagens,
};
