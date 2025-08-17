const logger = require('../../logger');

function register(commandBus, { backupManager }) {
  commandBus.register('backup', async (args) => {
    const backupCommand = args[0];

    if (!backupCommand) {
      return (
        '📦 *Sistema de Backup*\n\n' +
        '*Comandos Disponíveis:*\n\n' +
        '📊 *Estatísticas*\n' +
        '• /backup criar [nome] - Cria um novo backup (nome opcional)\n' +
        '• /backup listar - Lista todos os backups\n' +
        '• /backup excluir [nome] - Exclui um backup específico\n\n' +
        '📊 *Informações*\n' +
        '• /backup atual - Mostra informações do backup atual\n' +
        '• /backup info [nome] - Mostra informações de um backup específico\n\n' +
        '🔄 *Restauração e Logs*\n' +
        '• /backup restaurar [nome] - Restaura um backup específico\n' +
        '• /backup logs - Mostra as últimas operações de backup\n\n' +
        '*Exemplos:*\n' +
        '• /backup criar backup_importante\n' +
        '• /backup info "nome do backup"\n\n' +
        '*Importante:* Use /backup listar para ver os nomes exatos dos backups disponíveis.\n' +
        '*Nota:* Backups automáticos são criados a cada 6 horas e começam com "auto_".'
      );
    }

    switch (backupCommand) {
      case 'criar': {
        const customName = args.slice(1).join(' ');
        const success = backupManager.createBackup(customName || null);
        return success ? 'Backup criado com sucesso!' : 'Erro ao criar backup.';
      }
      case 'listar': {
        const backups = backupManager.listBackups();
        if (backups.length === 0) return 'Nenhum backup encontrado.';
        return `Backups disponíveis:\n${backups
          .map((b) => {
            const isAuto = b.includes('auto_');
            return `- ${b} ${isAuto ? '(Automático)' : '(Manual)'}`;
          })
          .join('\n')}`;
      }
      case 'restaurar': {
        const restoreName = args.slice(1).join(' ');
        if (!restoreName) return 'Por favor, especifique o nome do backup para restaurar.';

        const availableBackups = backupManager.listBackups();
        const matchingRestoreBackup = availableBackups.find((b) =>
          b.toLowerCase().includes(restoreName.toLowerCase())
        );
        if (!matchingRestoreBackup) {
          return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
        }
        const restored = backupManager.restoreBackup(matchingRestoreBackup);
        return restored
          ? `Backup ${matchingRestoreBackup} restaurado com sucesso!`
          : 'Erro ao restaurar backup.';
      }
      case 'info': {
        const infoBackupName = args.slice(1).join(' ');
        if (!infoBackupName) return 'Por favor, especifique o nome do backup para ver as informações.';

        const availableBackups = backupManager.listBackups();
        const matchingInfoBackup = availableBackups.find((b) =>
          b.toLowerCase().includes(infoBackupName.toLowerCase())
        );
        if (!matchingInfoBackup) {
          return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
        }
        const info = await backupManager.getBackupInfo(matchingInfoBackup);
        if (!info) return 'Erro ao obter informações do backup.';

        return (
          `📊 Informações do Backup: ${matchingInfoBackup}\n\n` +
          `👥 Total de Usuários: ${info.totalClientes}\n` +
          `💬 Total de Mensagens: ${info.totalMensagens}\n` +
          `📦 Tamanho: ${(info.size / 1024).toFixed(2)}KB\n` +
          `📅 Criado em: ${new Date(info.created_at).toLocaleString()}\n` +
          `🔄 Tipo: ${info.isAutomatic ? 'Automático' : 'Manual'}`
        );
      }
      case 'atual': {
        const currentInfo = await backupManager.getCurrentBackupInfo();
        if (!currentInfo) return 'Erro ao obter informações do backup atual.';
        return (
          `📊 Informações do Backup Atual\n\n` +
          `👥 Total de Usuários: ${currentInfo.totalClientes}\n` +
          `💬 Total de Mensagens: ${currentInfo.totalMensagens}\n` +
          `📦 Tamanho: ${(currentInfo.size / 1024).toFixed(2)}KB\n` +
          `📅 Última modificação: ${new Date(currentInfo.lastModified).toLocaleString()}`
        );
      }
      case 'excluir': {
        const deleteName = args.slice(1).join(' ');
        if (!deleteName) return 'Por favor, especifique o nome do backup para excluir.';

        const availableBackups = backupManager.listBackups();
        const matchingDeleteBackup = availableBackups.find((b) =>
          b.toLowerCase().includes(deleteName.toLowerCase())
        );
        if (!matchingDeleteBackup) {
          return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
        }
        const deleted = backupManager.deleteBackup(matchingDeleteBackup);
        return deleted
          ? `Backup ${matchingDeleteBackup} excluído com sucesso!`
          : 'Erro ao excluir backup.';
      }
      case 'logs': {
        const logs = backupManager.getLogs();
        if (logs.length === 0) return 'Nenhum log encontrado.';
        return (
          `📝 Últimas Operações de Backup:\n\n` +
          logs
            .map((log) => {
              const date = new Date(log.timestamp).toLocaleString();
              const operation = {
                create: '📦 Criado',
                restore: '🔄 Restaurado',
                delete: '🗑️ Excluído',
                auto_delete: '🧹 Limpeza Automática',
              }[log.operation] || log.operation;
              const type = log.details.type ? ` (${log.details.type})` : '';
              return `${operation}${type}: ${log.details.backupName}\n` + `📅 ${date}`;
            })
            .join('\n\n')
        );
      }
      default:
        return 'Comando inválido. Digite /backup para ver todos os comandos disponíveis.';
    }
  }, 'Gerencia backups. Use /backup para ajuda.');
}

module.exports = { register };
