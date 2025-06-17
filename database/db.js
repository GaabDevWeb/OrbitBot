const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cria conexão com o banco de dados
const db = new sqlite3.Database(path.join(__dirname, 'data/orbitbot.db'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        initDatabase();
    }
});

// Inicializa as tabelas do banco
function initDatabase() {
    db.serialize(() => {
        // Tabela de clientes
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela de histórico
        db.run(`CREATE TABLE IF NOT EXISTS historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            mensagem TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )`);

        // Índices para melhor performance
        db.run('CREATE INDEX IF NOT EXISTS idx_historico_cliente ON historico(cliente_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_historico_created ON historico(created_at)');
    });
}

// Funções de acesso ao banco
const dbOperations = {
    // Operações com clientes
    cadastrarCliente: (numero) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO clientes (numero) VALUES (?)',
                [numero],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            numero,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            );
        });
    },

    buscarCliente: (numero) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM clientes WHERE numero = ?',
                [numero],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    },

    // Operações com histórico
    adicionarMensagem: (cliente_id, mensagem, role) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO historico (cliente_id, mensagem, role) VALUES (?, ?, ?)',
                [cliente_id, mensagem, role],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            cliente_id,
                            mensagem,
                            role,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            );
        });
    },

    buscarHistorico: (cliente_id, page = 1, limit = 10) => {
        return new Promise((resolve, reject) => {
            const offset = (page - 1) * limit;
            
            // Busca total de mensagens para paginação
            db.get(
                'SELECT COUNT(*) as total FROM historico WHERE cliente_id = ?',
                [cliente_id],
                (err, countRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const total = countRow.total;
                    const totalPages = Math.ceil(total / limit);

                    // Busca mensagens da página atual
                    db.all(
                        `SELECT * FROM historico 
                         WHERE cliente_id = ? 
                         ORDER BY created_at DESC 
                         LIMIT ? OFFSET ?`,
                        [cliente_id, limit, offset],
                        (err, rows) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    messages: rows,
                                    pagination: {
                                        currentPage: page,
                                        totalPages,
                                        totalMessages: total,
                                        hasNextPage: page < totalPages,
                                        hasPreviousPage: page > 1
                                    }
                                });
                            }
                        }
                    );
                }
            );
        });
    },

    buscarUltimasMensagens: (cliente_id, limit = 5) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM historico 
                 WHERE cliente_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [cliente_id, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }
};

module.exports = dbOperations; 