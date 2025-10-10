import React from 'react';
import { useNavigation } from './hooks/useNavigation';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { WeighingScreen } from './components/screens/WeighingScreen';
import { DistributionAndOrdersScreen } from './components/screens/DistributionAndOrdersScreen';
import { RFIDScreen } from './components/screens/RFIDScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { SpecialRollsScreen } from './components/screens/SpecialRollsScreen';
import { User } from './types';

function App() {
  const { currentScreen, user, navigateTo, goBack, logout } = useNavigation();

  // Mock user - always logged in
  const mockUser: User = {
    id: '1',
    name: 'João Silva',
    matricula: '12345',
    role: 'operator'
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return (
          <DashboardScreen 
            user={mockUser} 
            onNavigate={navigateTo} 
            onLogout={logout} 
          />
        );
      
      case 'weighing':
        return <WeighingScreen onBack={goBack} onNavigate={navigateTo} />;
      
      case 'distribution':
      case 'distribution-orders':
        return <DistributionAndOrdersScreen onBack={goBack} />;
      
      case 'rfid':
        return <RFIDScreen onBack={goBack} />;
      
      case 'specialrolls':
        return <SpecialRollsScreen onBack={goBack} />;
      
      case 'reports':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Relatórios</h1>
              <p className="text-xl text-gray-600 mb-8">Tela em desenvolvimento</p>
              <button
                onClick={goBack}
                className="bg-blue-800 text-white px-8 py-4 rounded-xl text-xl font-bold hover:bg-blue-900"
              >
                Voltar
              </button>
            </div>
          </div>
        );
      
      case 'settings':
        return <SettingsScreen onBack={goBack} />;
      
      case 'users':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Gestão de Usuários</h1>
              <p className="text-xl text-gray-600 mb-8">Tela em desenvolvimento</p>
              <button
                onClick={goBack}
                className="bg-blue-800 text-white px-8 py-4 rounded-xl text-xl font-bold hover:bg-blue-900"
              >
                Voltar
              </button>
            </div>
          </div>
        );
      
      default:
        return (
          <DashboardScreen 
            user={mockUser} 
            onNavigate={navigateTo} 
            onLogout={logout} 
          />
        );
    }
  };

  return (
    <div className="app">
      {renderCurrentScreen()}
    </div>
  );
}

export default App;