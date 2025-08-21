import React, { useState } from 'react';
import { Radio, ArrowLeft, Play, Square, Search, RotateCcw, Filter, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface RFIDScreenProps {
  onBack: () => void;
}

interface RFIDAnalysis {
  id: string;
  type: string;
  status: 'conforme' | 'costura' | 'manchado' | 'descarte';
  confidence: number;
  timestamp: Date;
  issues?: string[];
}

export const RFIDScreen: React.FC<RFIDScreenProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'select' | 'automatic' | 'assembly' | 'analysis' | 'search'>('select');
  const [isReading, setIsReading] = useState(false);
  const [analyses, setAnalyses] = useState<RFIDAnalysis[]>([]);
  const [searchId, setSearchId] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'conforme' | 'issues'>('all');

  const modes = [
    {
      id: 'automatic',
      title: 'Leitura Automática',
      description: 'Análise contínua com IA',
      icon: '🤖',
      gradient: 'from-blue-600 to-blue-800',
      stats: '98.5% precisão'
    },
    {
      id: 'assembly',
      title: 'Montagem por Tipo',
      description: 'Organização visual por categoria',
      icon: '📊',
      gradient: 'from-emerald-500 to-emerald-700',
      stats: '4 categorias ativas'
    },
    {
      id: 'analysis',
      title: 'Análise de Inconformidades',
      description: 'Detecção de problemas',
      icon: '🔍',
      gradient: 'from-orange-500 to-orange-700',
      stats: '15 alertas hoje'
    },
    {
      id: 'search',
      title: 'Consulta de Histórico',
      description: 'Buscar por ID específico',
      icon: '📋',
      gradient: 'from-purple-600 to-purple-800',
      stats: '1.2M registros'
    }
  ];

  const statusColors = {
    conforme: 'bg-emerald-500',
    costura: 'bg-yellow-500',
    manchado: 'bg-orange-500',
    descarte: 'bg-red-500'
  };

  const statusLabels = {
    conforme: 'Conforme',
    costura: 'Problema Costura',
    manchado: 'Manchado',
    descarte: 'Descarte'
  };

  const startReading = () => {
    setIsReading(true);
    setAnalyses([]);
    
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const statuses: Array<'conforme' | 'costura' | 'manchado' | 'descarte'> = ['conforme', 'costura', 'manchado', 'descarte'];
        const types = ['Uniforme Industrial', 'Roupa Hospitalar', 'Vestuário Comum'];
        const issues = [
          'Costura solta na manga',
          'Mancha de óleo detectada',
          'Desgaste excessivo',
          'Rasgado na lateral',
          'Descoloração'
        ];
        
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const newAnalysis: RFIDAnalysis = {
          id: `RF${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          type: types[Math.floor(Math.random() * types.length)],
          status,
          confidence: Math.random() * 30 + 70, // 70-100%
          timestamp: new Date(),
          issues: status !== 'conforme' ? [issues[Math.floor(Math.random() * issues.length)]] : undefined
        };
        
        setAnalyses(prev => [newAnalysis, ...prev].slice(0, 20));
      }
    }, 1200);

    setTimeout(() => {
      clearInterval(interval);
      setIsReading(false);
    }, 15000);
  };

  const stopReading = () => {
    setIsReading(false);
  };

  const getStatusCounts = () => {
    return analyses.reduce((acc, analysis) => {
      acc[analysis.status] = (acc[analysis.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getFilteredAnalyses = () => {
    if (selectedFilter === 'all') return analyses;
    if (selectedFilter === 'conforme') return analyses.filter(a => a.status === 'conforme');
    return analyses.filter(a => a.status !== 'conforme');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20 px-8 py-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            className="bg-white/60"
          >
            Voltar
          </Button>
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
            <Radio size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Análise RFID Inteligente</h1>
        </div>
      </header>

      <main className="p-8">
        {mode === 'select' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Selecione o Modo de Operação</h2>
              <p className="text-lg text-gray-600">Escolha como deseja analisar as peças com tecnologia RFID</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
              {modes.map((modeItem) => (
                <Card
                  key={modeItem.id}
                  onClick={() => setMode(modeItem.id as any)}
                  className="h-64 relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${modeItem.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                  <div className="relative z-10 h-full flex flex-col justify-between p-8">
                    <div className="text-center">
                      <div className={`w-20 h-20 bg-gradient-to-br ${modeItem.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                        <span className="text-4xl">{modeItem.icon}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{modeItem.title}</h3>
                      <p className="text-gray-600 mb-4">{modeItem.description}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-500">{modeItem.stats}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {(mode === 'automatic' || mode === 'analysis') && (
          <div className="space-y-8">
            {/* Control Panel */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">
                  {mode === 'automatic' ? 'Leitura Automática' : 'Análise de Inconformidades'}
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Radio className={`${isReading ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} size={24} />
                    <span className={`font-semibold ${isReading ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {isReading ? 'Analisando...' : 'Aguardando'}
                    </span>
                  </div>
                  {isReading ? (
                    <Button onClick={stopReading} variant="danger" size="sm" icon={Square}>
                      Parar
                    </Button>
                  ) : (
                    <Button onClick={startReading} variant="success" size="sm" icon={Play}>
                      Iniciar
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {Object.entries(statusLabels).map(([status, label]) => {
                  const count = getStatusCounts()[status] || 0;
                  const percentage = analyses.length > 0 ? (count / analyses.length * 100).toFixed(1) : '0';
                  return (
                    <div key={status} className="text-center p-6 bg-white/60 rounded-2xl border border-white/20">
                      <div className={`w-12 h-12 ${statusColors[status as keyof typeof statusColors]} rounded-full mx-auto mb-3 flex items-center justify-center`}>
                        {status === 'conforme' && <span className="text-white text-xl">✓</span>}
                        {status !== 'conforme' && <AlertCircle className="text-white" size={20} />}
                      </div>
                      <div className="text-3xl font-bold text-gray-800">{count}</div>
                      <div className="text-sm text-gray-600">{label}</div>
                      <div className="text-xs text-gray-500 mt-1">{percentage}%</div>
                    </div>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <Filter size={20} className="text-gray-600" />
                <div className="flex gap-2">
                  {[
                    { id: 'all', label: 'Todas', count: analyses.length },
                    { id: 'conforme', label: 'Conformes', count: getStatusCounts().conforme || 0 },
                    { id: 'issues', label: 'Com Problemas', count: analyses.length - (getStatusCounts().conforme || 0) }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedFilter(filter.id as any)}
                      className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                        selectedFilter === filter.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/60 text-gray-700 hover:bg-white/80'
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Analysis Results */}
            <Card>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Resultados da Análise</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getFilteredAnalyses().map((analysis, index) => (
                  <div key={index} className="bg-white/60 p-4 rounded-xl border border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 ${statusColors[analysis.status]} rounded-full`}></div>
                        <div>
                          <div className="font-mono text-sm font-semibold">{analysis.id}</div>
                          <div className="text-sm text-gray-600">{analysis.type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm px-3 py-1 rounded-full ${
                            analysis.status === 'conforme' ? 'bg-emerald-100 text-emerald-700' :
                            analysis.status === 'costura' ? 'bg-yellow-100 text-yellow-700' :
                            analysis.status === 'manchado' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {statusLabels[analysis.status]}
                          </span>
                          <span className="text-sm text-gray-500">
                            {analysis.confidence.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analysis.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    {analysis.issues && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                          <strong>Problemas detectados:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {analysis.issues.map((issue, i) => (
                              <li key={i} className="text-red-600">{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-6">
              <Button onClick={() => setMode('select')} variant="secondary" size="lg">
                Voltar
              </Button>
              <Button onClick={() => setAnalyses([])} variant="secondary" size="lg" icon={RotateCcw}>
                Limpar Resultados
              </Button>
              <Button onClick={() => alert('Exportando relatório...')} variant="success" size="lg" icon={TrendingUp}>
                Exportar Relatório
              </Button>
            </div>
          </div>
        )}

        {mode === 'assembly' && (
          <div>
            <Card>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Montagem por Tipo</h3>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { type: 'Uniformes Industriais', count: 45, icon: '🦺', color: 'blue' },
                  { type: 'Roupas Hospitalares', count: 32, icon: '🏥', color: 'emerald' },
                  { type: 'Vestuário Comum', count: 28, icon: '👔', color: 'purple' },
                  { type: 'Outros', count: 15, icon: '📦', color: 'gray' }
                ].map((category) => (
                  <div key={category.type} className={`bg-${category.color}-50 p-6 rounded-2xl border border-${category.color}-200`}>
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">{category.icon}</div>
                      <h4 className="text-xl font-bold text-gray-800">{category.type}</h4>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-800 mb-2">{category.count}</div>
                      <div className="text-sm text-gray-600">peças detectadas</div>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {Array.from({ length: Math.min(category.count, 25) }).map((_, i) => (
                        <div key={i} className={`w-6 h-6 bg-${category.color}-400 rounded`}></div>
                      ))}
                      {category.count > 25 && (
                        <div className="text-xs text-gray-500 col-span-5 text-center mt-2">
                          +{category.count - 25} mais
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Button onClick={() => setMode('select')} variant="secondary" size="lg">
                  Voltar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {mode === 'search' && (
          <div className="max-w-4xl mx-auto">
            <Card>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Consulta de Histórico</h2>
                <p className="text-xl text-gray-600">Digite o ID da tag para consultar seu histórico completo</p>
              </div>

              <div className="mb-8">
                <label className="block text-2xl font-bold text-gray-700 mb-3">
                  <Search className="inline mr-2" size={28} />
                  ID da Tag RFID
                </label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                  className="w-full px-6 py-6 text-2xl border-4 border-gray-300 rounded-xl font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="RF12345678"
                />
              </div>

              {searchId && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">Histórico da Tag: {searchId}</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Status Atual</div>
                        <div className="text-xl font-bold text-emerald-600">Conforme</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Última Análise</div>
                        <div className="text-xl font-bold">Hoje, 14:30</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Tipo</div>
                        <div className="text-xl font-bold">Uniforme Industrial</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Peso Registrado</div>
                        <div className="text-xl font-bold">2.5 kg</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Operador</div>
                        <div className="text-xl font-bold">João Silva</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl">
                        <div className="text-sm text-gray-600">Localização</div>
                        <div className="text-xl font-bold">Setor de Lavagem</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-blue-200">
                    <h4 className="font-bold text-gray-800 mb-3">Histórico de Análises</h4>
                    <div className="space-y-2">
                      {[
                        { date: 'Hoje 14:30', status: 'Conforme', confidence: '98.5%' },
                        { date: 'Ontem 09:15', status: 'Conforme', confidence: '97.2%' },
                        { date: '2 dias atrás', status: 'Problema Costura', confidence: '89.1%' }
                      ].map((entry, i) => (
                        <div key={i} className="bg-white p-3 rounded-lg flex justify-between items-center">
                          <span className="text-gray-600">{entry.date}</span>
                          <span className={`px-3 py-1 rounded-full text-sm ${
                            entry.status === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {entry.status}
                          </span>
                          <span className="text-gray-500 text-sm">{entry.confidence}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <Button onClick={() => setMode('select')} variant="secondary" size="lg">
                  Voltar
                </Button>
                <Button onClick={() => setSearchId('')} variant="primary" size="lg">
                  Nova Consulta
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};