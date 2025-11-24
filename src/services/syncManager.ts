import { invoke } from '@tauri-apps/api/tauri';
import { API_CONFIG } from '../config/api';

interface PendingOperation {
  id: number;
  operation_type: string;
  payload: string;
  created_at: number;
  retry_count: number;
  last_error?: string;
}

export class SyncManager {
  private syncInterval: number | null = null;
  private downloadInterval: number | null = null;
  private isSyncing = false;
  private isDownloading = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  private status: SyncStatus = {
    lastSync: 0,
    pendingCount: 0,
    syncing: false,
    downloading: false,
    error: null,
  };

  start() {
    console.log('🔄 SyncManager iniciado');

    // Sincroniza operações pendentes a cada 30 segundos
    this.syncInterval = window.setInterval(() => {
      this.syncPendingOperations();
    }, 30000);

    // Baixa atualizações a cada 5 minutos
    this.downloadInterval = window.setInterval(() => {
      this.downloadUpdates();
    }, 300000);

    // Sincroniza ao voltar online
    window.addEventListener('online', () => {
      console.log('🌐 Conexão restaurada, sincronizando...');
      this.syncPendingOperations();
      this.downloadUpdates();
    });

    // Sincronização inicial
    setTimeout(() => {
      this.syncPendingOperations();
      this.downloadUpdates();
    }, 2000);
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.downloadInterval) {
      clearInterval(this.downloadInterval);
      this.downloadInterval = null;
    }
    console.log('⏹️ SyncManager parado');
  }

  async syncPendingOperations(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;
    this.updateStatus({ syncing: true, error: null });

    try {
      const pending = await invoke<PendingOperation[]>('get_pending_operations', { limit: 50 });
      
      if (pending.length === 0) {
        this.updateStatus({ pendingCount: 0 });
        return;
      }

      console.log(`📤 Sincronizando ${pending.length} operação(ões) pendente(s)...`);

      let successCount = 0;
      let errorCount = 0;

      for (const op of pending) {
        try {
          // Não tentar operações que já falharam muitas vezes
          if (op.retry_count >= 5) {
            console.warn(`⚠️ Operação ${op.id} excedeu limite de tentativas (${op.retry_count})`);
            continue;
          }

          await this.sendOperation(op);
          await invoke('delete_operation', { id: op.id });
          successCount++;
          console.log(`✅ Operação ${op.id} (${op.operation_type}) sincronizada`);
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Erro ao sincronizar operação ${op.id}:`, errorMsg);
          await invoke('increment_retry_count', { id: op.id, error: errorMsg });
        }
      }

      const remainingCount = await invoke<number>('get_pending_count');
      this.updateStatus({ 
        pendingCount: remainingCount,
        lastSync: Date.now(),
      });

      console.log(`✅ Sincronização concluída: ${successCount} sucesso, ${errorCount} erro(s), ${remainingCount} pendente(s)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Erro na sincronização:', errorMsg);
      this.updateStatus({ error: errorMsg });
    } finally {
      this.isSyncing = false;
      this.updateStatus({ syncing: false });
    }
  }

  private async sendOperation(op: PendingOperation): Promise<void> {
    const payload = JSON.parse(op.payload);

    switch (op.operation_type) {
      case 'distribute':
        await this.sendDistribution(payload);
        break;
      case 'reception':
        await this.sendReception(payload);
        break;
      case 'retire':
        await this.sendRetire(payload);
        break;
      case 'associate':
        await this.sendAssociate(payload);
        break;
      default:
        throw new Error(`Tipo de operação desconhecido: ${op.operation_type}`);
    }
  }

  private async sendDistribution(payload: any): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_DISTRIBUTE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na distribuição: ${errorText}`);
    }
  }

  private async sendReception(payload: any): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_RECEPTION}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na recepção: ${errorText}`);
    }
  }

  private async sendRetire(payload: any): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_RETIRE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na baixa: ${errorText}`);
    }
  }

  private async sendAssociate(payload: any): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_ASSOCIATE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na associação: ${errorText}`);
    }
  }

  async downloadUpdates(): Promise<void> {
    if (this.isDownloading || !navigator.onLine) {
      return;
    }

    this.isDownloading = true;
    this.updateStatus({ downloading: true });

    try {
      const lastSync = await invoke<number>('get_last_sync', { entity: 'rfid_items' });
      console.log(`📥 Baixando atualizações desde ${new Date(lastSync * 1000).toLocaleString()}...`);

      // Endpoint de sincronização incremental (precisa ser implementado no servidor)
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/totem/sync/rfid-items?since=${lastSync}`,
        {
          headers: { 'x-api-key': API_CONFIG.API_KEY },
          signal: AbortSignal.timeout(30000), // Timeout de 30s
        }
      );

      if (response.ok) {
        const items = await response.json();
        
        if (Array.isArray(items) && items.length > 0) {
          console.log(`📦 Recebidos ${items.length} item(ns) atualizado(s)`);
          
          // Salvar em lote no SQLite
          const count = await invoke<number>('bulk_cache_rfid_items', { items });
          await invoke('update_sync_log', { entity: 'rfid_items', count });
          
          console.log(`✅ ${count} item(ns) sincronizado(s) no cache local`);
        } else {
          console.log('ℹ️ Nenhuma atualização disponível');
        }
      } else {
        console.warn('⚠️ Endpoint de sincronização não disponível ou retornou erro');
      }
    } catch (error) {
      // Não logar erro se for timeout ou endpoint não implementado
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('❌ Erro ao baixar atualizações:', error);
      }
    } finally {
      this.isDownloading = false;
      this.updateStatus({ downloading: false });
    }
  }

  private updateStatus(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach(listener => listener(this.status));
  }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener);
    // Enviar status atual imediatamente
    listener(this.status);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  async forceSyncNow(): Promise<void> {
    console.log('🔄 Sincronização forçada pelo usuário');
    await this.syncPendingOperations();
    await this.downloadUpdates();
  }
}

export interface SyncStatus {
  lastSync: number;
  pendingCount: number;
  syncing: boolean;
  downloading: boolean;
  error: string | null;
}

// Instância global do SyncManager
export const syncManager = new SyncManager();

