import React from 'react';
import { 
  Scale, 
  Radio, 
  BarChart3, 
  Settings, 
  Users, 
  Cloud, 
  LogOut, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Activity,
  Package
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { User } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface DashboardScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  user, 
  onNavigate, 
  onLogout 
}) => {
  const { settings } = useSettings();
  const { selectedClient } = useClients();
  const [isOnline] = React.useState(true);

  // Filtrar tiles baseado no tipo de totem
  const getAvailableTiles = () => {
    const allTiles = [
      {
        id: 'weighing',
        title: settings.totem.type === 'clean' ? 'Pesagem & RFID' : 'Pesagem & Coleta',
        icon: Scale,
        gradient: 'from-blue-600 to-blue-800',
        description: settings.totem.type === 'clean' 
          ? 'Pesagem integrada com leitura RFID' 
          : 'Pesagem e coleta de roupas sujas',
        stats: '1,247 peças hoje'
      },
      {
        id: 'distribution',
        title: 'Distribuição',
        icon: Package,
        gradient: 'from-orange-500 to-orange-700',
        description: 'Gestão de enxoval por cliente',
        stats: '342 itens distribuídos'
      },
      {
        id: 'rfid',
        title: 'Análise RFID',
        icon: Radio,
        gradient: 'from-emerald-500 to-emerald-700',
        description: 'Leitura automática e inconformidades',
        stats: '98.5% conformidade'
      },
      {
        id: 'reports',
        title: 'Relatórios',
        icon: BarChart3,
        gradient: 'from-purple-600 to-purple-800',
        description: 'Dashboards e análises',
        stats: '15 relatórios'
      },
      {
        id: 'settings',
        title: 'Configurações',
        icon: Settings,
        gradient: 'from-gray-600 to-gray-800',
        description: 'Ajustes do sistema',
        stats: 'Sistema OK'
      }
    ];

    // Filtrar tiles baseado no tipo de totem
    if (settings.totem.type === 'dirty') {
      // Totem de área suja - apenas pesagem e coleta
      return allTiles.filter(tile => 
        ['weighing', 'rfid', 'reports', 'settings'].includes(tile.id)
      );
    } else {
      // Totem de área limpa - distribuição e pesagem
      return allTiles.filter(tile => 
        ['weighing', 'distribution', 'rfid', 'reports', 'settings'].includes(tile.id)
      );
    }
  };

  const tiles = getAvailableTiles();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center">
                <Activity className="text-white" size={28} />
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                  MyEcoLav
                </div>
                <div className="text-sm text-gray-500 font-medium">MyEcoLav Rouparia</div>
              </div>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div>
              {selectedClient && (
                <div className="text-sm text-gray-600 mt-1">
                  Cliente: {selectedClient.name}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Totem Type Status */}
            <div className={`flex items-center gap-3 rounded-full px-4 py-2 ${
              settings.totem.type === 'clean' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                settings.totem.type === 'clean' ? 'bg-green-500' : 'bg-orange-500'
              }`}></div>
              <span className="text-sm font-semibold">
                {settings.totem.type === 'clean' ? 'Área Limpa' : 'Área Suja'}
              </span>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-3 bg-white/60 rounded-full px-4 py-2">
              {isOnline ? (
                <>
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                  <Wifi className="text-emerald-600" size={20} />
                  <span className="text-sm font-semibold text-emerald-700">Online</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <WifiOff className="text-red-600" size={20} />
                  <span className="text-sm font-semibold text-red-700">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8">
        {/* Stats Cards removidos */}

        {/* Main Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {tiles.map((tile) => (
            <Card
              key={tile.id}
              onClick={() => onNavigate(tile.id)}
              className="h-80 relative overflow-hidden group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tile.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
              <div className="relative z-10 h-full flex flex-col justify-between p-8">
                <div>
                  <div className={`w-16 h-16 bg-gradient-to-br ${tile.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <tile.icon size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">{tile.title}</h3>
                  <p className="text-lg text-gray-600 mb-4">{tile.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-500">{tile.stats}</span>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <span className="text-gray-600">→</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Ações rápidas removidas */}
      </main>
    </div>
  );
};