const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const sqlite3 = require('sqlite3').verbose();

class BackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, '../database/backups');
        this.dataDir = path.join(__dirname, '../database/data');
        this.dbFile = path.join(this.dataDir, 'orbitbot.db');
        this.logFile = path.join(this.backupDir, 'backup_log.json');
        this.ensureBackupDir();
        this.ensureLogFile();
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    ensureLogFile() {
        if (!fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, JSON.stringify([], null, 2));
        }
    }

    addLogEntry(operation, details) {
        try {
            const logs = JSON.parse(fs.readFileSync(this.logFile, 'utf-8'));
            logs.push({
                operation,
                details,
                timestamp: new Date().toISOString()
            });
            fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        } catch (err) {
            logger.error('Erro ao adicionar entrada no log', { error: err.message });
        }
    }

    getLogs(limit = 10) {
        try {
            const logs = JSON.parse(fs.readFileSync(this.logFile, 'utf-8'));
            return logs.slice(-limit).reverse();
        } catch (err) {
            logger.error('Erro ao ler logs', { error: err.message });
            return [];
        }
    }

    async getDatabaseInfo(dbPath) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                db.get(`
                    SELECT 
                        (SELECT COUNT(*) FROM clientes) as totalClientes,
                        (SELECT COUNT(*) FROM historico) as totalMensagens
                `, (err, row) => {
                    db.close();
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row);
                });
            });
        });
    }

    async getCurrentBackupInfo() {
        try {
            if (!fs.existsSync(this.dbFile)) {
                return null;
            }

            const stats = fs.statSync(this.dbFile);
            const dbInfo = await this.getDatabaseInfo(this.dbFile);

            return {
                totalClientes: dbInfo.totalClientes,
                totalMensagens: dbInfo.totalMensagens,
                size: stats.size,
                lastModified: stats.mtime.toISOString()
            };
        } catch (err) {
            logger.error('Erro ao obter informações do backup atual', { error: err.message });
            return null;
        }
    }

    async getBackupInfo(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup não encontrado: ${backupName}`);
            }

            const dbFile = path.join(backupPath, 'orbitbot.db');
            if (!fs.existsSync(dbFile)) {
                throw new Error('Arquivo do banco de dados não encontrado no backup');
            }

            const stats = fs.statSync(dbFile);
            const dbInfo = await this.getDatabaseInfo(dbFile);

            return {
                totalClientes: dbInfo.totalClientes,
                totalMensagens: dbInfo.totalMensagens,
                size: stats.size,
                created_at: stats.birthtime.toISOString(),
                isAutomatic: backupName.includes('auto_')
            };
        } catch (err) {
            logger.error('Erro ao obter informações do backup', { 
                error: err.message,
                backupName
            });
            return null;
        }
    }

    createBackup(customName = null, isAutomatic = false) {
        try {
            let backupName;
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = String(now.getFullYear()).slice(-2);
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            
            if (customName) {
                backupName = `backup ${customName}`;
            } else if (isAutomatic) {
                backupName = `backup auto_${day}-${month}-${year}_${hour}-${minute}`;
            } else {
                backupName = `backup ${day}-${month}-${year} ${hour}-${minute}`;
            }

            const backupPath = path.join(this.backupDir, backupName);
            fs.mkdirSync(backupPath);

            // Copia o arquivo do banco de dados
            fs.copyFileSync(this.dbFile, path.join(backupPath, 'orbitbot.db'));

            // Limpa backups antigos (mantém últimos 5)
            this.cleanOldBackups();

            // Adiciona ao log
            this.addLogEntry('create', { 
                backupName,
                type: isAutomatic ? 'automático' : 'manual'
            });

            logger.info('Backup criado com sucesso', { 
                path: backupPath,
                type: isAutomatic ? 'automático' : 'manual'
            });
            return true;
        } catch (err) {
            logger.error('Erro ao criar backup', { error: err.message });
            return false;
        }
    }

    deleteBackup(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup não encontrado: ${backupName}`);
            }

            fs.rmSync(backupPath, { recursive: true, force: true });
            
            this.addLogEntry('delete', { backupName });

            logger.info('Backup excluído com sucesso', { backupName });
            return true;
        } catch (err) {
            logger.error('Erro ao excluir backup', { error: err.message });
            return false;
        }
    }

    cleanOldBackups() {
        const backups = fs.readdirSync(this.backupDir)
            .filter(file => file.startsWith('backup '))
            .sort()
            .reverse();

        // Mantém apenas os últimos 5 backups
        if (backups.length > 5) {
            backups.slice(5).forEach(backup => {
                const backupPath = path.join(this.backupDir, backup);
                fs.rmSync(backupPath, { recursive: true, force: true });
                this.addLogEntry('auto_delete', { backupName: backup });
            });
        }
    }

    restoreBackup(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            logger.info('Tentando restaurar backup', { 
                backupName,
                backupPath,
                exists: fs.existsSync(backupPath)
            });

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup não encontrado: ${backupName}`);
            }

            const dbFile = path.join(backupPath, 'orbitbot.db');
            if (!fs.existsSync(dbFile)) {
                throw new Error('Arquivo do banco de dados não encontrado no backup');
            }

            // Restaura o arquivo do banco de dados
            fs.copyFileSync(dbFile, this.dbFile);

            this.addLogEntry('restore', { backupName });

            logger.info('Backup restaurado com sucesso', { backup: backupName });
            return true;
        } catch (err) {
            logger.error('Erro ao restaurar backup', { 
                error: err.message,
                backupName
            });
            return false;
        }
    }

    listBackups() {
        try {
            return fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup '))
                .sort()
                .reverse();
        } catch (err) {
            logger.error('Erro ao listar backups', { error: err.message });
            return [];
        }
    }
}

// Cria backup a cada 6 horas
const backupManager = new BackupManager();
setInterval(() => backupManager.createBackup(null, true), 6 * 60 * 60 * 1000);

module.exports = backupManager; 