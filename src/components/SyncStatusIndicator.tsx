import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { syncManager, SyncStatus } from '../services/syncManager';
import { useOfflineRFID } from '../hooks/useOfflineRFID';

export const SyncStatusIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncManager.getStatus());
  const { isOnline, stats } = useOfflineRFID();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.onStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const handleForceSync = () => {
    syncManager.forceSyncNow();
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-500';
    if (syncStatus.error) return 'bg-red-500';
    if (syncStatus.pendingCount > 0) return 'bg-amber-500';
    if (syncStatus.syncing || syncStatus.downloading) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus.syncing) return 'Sincronizando...';
    if (syncStatus.downloading) return 'Baixando...';
    if (syncStatus.error) return 'Erro';
    if (syncStatus.pendingCount > 0) return `${syncStatus.pendingCount} pendente(s)`;
    return 'Sincronizado';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff size={14} />;
    if (syncStatus.syncing || syncStatus.downloading) return <RefreshCw size={14} className="animate-spin" />;
    if (syncStatus.error) return <AlertCircle size={14} />;
    if (syncStatus.pendingCount > 0) return <CloudOff size={14} />;
    return <Cloud size={14} />;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-semibold transition-all ${getStatusColor()} hover:opacity-90`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </button>

      {showDetails && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Database size={16} />
                Status de Sincronização
              </h3>
            </div>

            <div className="p-4 space-y-3">
              {/* Status de Conexão */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2">
                  {isOnline ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-gray-400" />}
                  Conexão
                </span>
                <span className={`font-semibold ${isOnline ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Cache Local */}
              {stats && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Tags em cache</span>
                  <span className="font-semibold text-blue-600">
                    {stats.rfid_items_cached.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Operações Pendentes */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Operações pendentes</span>
                <span className={`font-semibold ${syncStatus.pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {syncStatus.pendingCount}
                </span>
              </div>

              {/* Última Sincronização */}
              {syncStatus.lastSync > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Última sync</span>
                  <span className="text-gray-800 text-xs">
                    {new Date(syncStatus.lastSync).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Erro */}
              {syncStatus.error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {syncStatus.error}
                  </p>
                </div>
              )}

              {/* Botão de Sincronização Manual */}
              <button
                onClick={handleForceSync}
                disabled={syncStatus.syncing || syncStatus.downloading || !isOnline}
                className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className={syncStatus.syncing || syncStatus.downloading ? 'animate-spin' : ''} />
                {syncStatus.syncing || syncStatus.downloading ? 'Sincronizando...' : 'Sincronizar Agora'}
              </button>

              {/* Informação sobre modo offline */}
              {!isOnline && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    📵 Modo offline ativo. As operações serão sincronizadas automaticamente quando a conexão for restaurada.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

