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
  Activity
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { User } from '../../types';

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
  const [isOnline] = React.useState(true);

  const tiles = [
    {
      id: 'weighing',
      title: 'Pesagem & RFID',
      icon: Scale,
      gradient: 'from-blue-600 to-blue-800',
      description: 'Pesagem integrada com leitura RFID',
      stats: '1,247 peças hoje'
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
                <div className="text-sm text-gray-500 font-medium">Sistema Industrial</div>
              </div>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div>
              <div className="text-lg font-semibold text-gray-800">{user.name}</div>
              <div className="text-sm text-gray-500">Operador • ID: {user.matricula}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gray-800">1,247</div>
            <div className="text-sm text-gray-600">Peças Processadas</div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">+12% hoje</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gray-800">98.5%</div>
            <div className="text-sm text-gray-600">Taxa Conformidade</div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">+2.1% semana</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gray-800">2.4kg</div>
            <div className="text-sm text-gray-600">Peso Médio</div>
            <div className="text-xs text-blue-600 font-semibold mt-1">Estável</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-gray-800">15min</div>
            <div className="text-sm text-gray-600">Tempo Médio</div>
            <div className="text-xs text-orange-600 font-semibold mt-1">-3min hoje</div>
          </div>
        </div>

        {/* Main Tiles */}
        <div className="grid grid-cols-2 gap-8 mb-8">
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

        {/* Quick Actions */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Ações Rápidas</h3>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="secondary"
              size="md"
              icon={Cloud}
              onClick={() => {/* Sync data */}}
              className="bg-white/80 hover:bg-white border border-gray-200"
            >
              Sincronizar
            </Button>
            
            <Button
              variant="danger"
              size="md"
              icon={AlertTriangle}
              onClick={() => {/* Emergency */}}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
            >
              Emergência
            </Button>
            
            <Button
              variant="secondary"
              size="md"
              icon={LogOut}
              onClick={onLogout}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
            >
              Logout
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};