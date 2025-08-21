import React, { useState, useEffect } from 'react';
import { Scale, ArrowLeft, Check, X, FileText, Printer, Radio, Play, Square, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ClothingType } from '../../types';

interface WeighingScreenProps {
  onBack: () => void;
}

interface RFIDTag {
  id: string;
  type: ClothingType;
  status: 'conforme' | 'costura' | 'manchado' | 'descarte';
  weight: number;
}

export const WeighingScreen: React.FC<WeighingScreenProps> = ({ onBack }) => {
  const [step, setStep] = useState<'select-type' | 'weighing' | 'confirmation'>('select-type');
  const [selectedType, setSelectedType] = useState<ClothingType | null>(null);
  const [weight, setWeight] = useState(0);
  const [observations, setObservations] = useState('');
  const [isRFIDReading, setIsRFIDReading] = useState(false);
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [autoReading, setAutoReading] = useState(true);

  const clothingTypes = [
    { 
      id: 'industrial', 
      name: 'Uniformes Industriais', 
      icon: '🦺', 
      gradient: 'from-blue-600 to-blue-800',
      avgWeight: '2.5kg'
    },
    { 
      id: 'hospital', 
      name: 'Roupas Hospitalares', 
      icon: '🏥', 
      gradient: 'from-emerald-500 to-emerald-700',
      avgWeight: '1.8kg'
    },
    { 
      id: 'common', 
      name: 'Vestuário Comum', 
      icon: '👔', 
      gradient: 'from-purple-600 to-purple-800',
      avgWeight: '1.2kg'
    },
    { 
      id: 'other', 
      name: 'Outros', 
      icon: '📦', 
      gradient: 'from-gray-600 to-gray-800',
      avgWeight: '2.0kg'
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

  const handleTypeSelect = (type: ClothingType) => {
    setSelectedType(type);
    setStep('weighing');
    if (autoReading) {
      startRFIDReading();
    }
  };

  const startRFIDReading = () => {
    setIsRFIDReading(true);
    setRfidTags([]);
    
    // Simulate RFID reading with different statuses
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const statuses: Array<'conforme' | 'costura' | 'manchado' | 'descarte'> = ['conforme', 'costura', 'manchado', 'descarte'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const weights = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0];
        
        const newTag: RFIDTag = {
          id: `RF${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          type: selectedType!,
          status: randomStatus,
          weight: weights[Math.floor(Math.random() * weights.length)]
        };
        
        setRfidTags(prev => [...prev, newTag]);
        setWeight(prev => prev + newTag.weight);
      }
    }, 1500);

    setTimeout(() => {
      clearInterval(interval);
      setIsRFIDReading(false);
    }, 12000);
  };

  const stopRFIDReading = () => {
    setIsRFIDReading(false);
  };

  const handleConfirmWeight = () => {
    setStep('confirmation');
  };

  const resetTare = () => {
    setWeight(0);
    setRfidTags([]);
  };

  const getStatusCounts = () => {
    return rfidTags.reduce((acc, tag) => {
      acc[tag.status] = (acc[tag.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
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
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
            <Scale size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Pesagem & RFID Integrada</h1>
        </div>
      </header>

      <main className="p-8">
        {step === 'select-type' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Selecione o Tipo de Roupa</h2>
              <p className="text-lg text-gray-600">Escolha a categoria para iniciar a pesagem com leitura RFID automática</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
              {clothingTypes.map((type) => (
                <Card
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id as ClothingType)}
                  className="h-64 relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${type.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                  <div className="relative z-10 h-full flex flex-col justify-between p-8">
                    <div className="text-center">
                      <div className={`w-20 h-20 bg-gradient-to-br ${type.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                        <span className="text-4xl">{type.icon}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{type.name}</h3>
                      <p className="text-gray-600">Peso médio: {type.avgWeight}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 'weighing' && (
          <div className="grid grid-cols-3 gap-8">
            {/* Weight Display */}
            <div className="col-span-1">
              <Card className="h-full">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">Peso Total</h3>
                  
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-emerald-400 p-8 rounded-2xl mb-6">
                    <div className="text-6xl font-mono font-bold">
                      {weight.toFixed(2)}
                    </div>
                    <div className="text-2xl font-mono">kg</div>
                  </div>

                  <div className="space-y-4">
                    <Button
                      onClick={resetTare}
                      variant="secondary"
                      size="md"
                      className="w-full"
                    >
                      Tara (Zerar)
                    </Button>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <span className="font-semibold">Leitura Automática</span>
                      <button
                        onClick={() => setAutoReading(!autoReading)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          autoReading ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          autoReading ? 'translate-x-6' : 'translate-x-0.5'
                        }`}></div>
                      </button>
                    </div>

                    {!autoReading && (
                      <Button
                        onClick={isRFIDReading ? stopRFIDReading : startRFIDReading}
                        variant={isRFIDReading ? "danger" : "success"}
                        size="md"
                        icon={isRFIDReading ? Square : Play}
                        className="w-full"
                      >
                        {isRFIDReading ? 'Parar RFID' : 'Iniciar RFID'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* RFID Reading */}
            <div className="col-span-2">
              <Card className="h-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">Leitura RFID</h3>
                  <div className="flex items-center gap-2">
                    <Radio className={`${isRFIDReading ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} size={24} />
                    <span className={`font-semibold ${isRFIDReading ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {isRFIDReading ? 'Lendo...' : 'Aguardando'}
                    </span>
                  </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {Object.entries(statusLabels).map(([status, label]) => {
                    const count = getStatusCounts()[status] || 0;
                    return (
                      <div key={status} className="text-center p-4 bg-gray-50 rounded-xl">
                        <div className={`w-8 h-8 ${statusColors[status as keyof typeof statusColors]} rounded-full mx-auto mb-2`}></div>
                        <div className="text-2xl font-bold text-gray-800">{count}</div>
                        <div className="text-sm text-gray-600">{label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Tags List */}
                <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold text-gray-800 mb-3">Peças Detectadas ({rfidTags.length})</h4>
                  <div className="space-y-2">
                    {rfidTags.map((tag, index) => (
                      <div key={index} className="bg-white p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 ${statusColors[tag.status]} rounded-full`}></div>
                          <span className="font-mono text-sm">{tag.id}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">{tag.weight}kg</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            tag.status === 'conforme' ? 'bg-emerald-100 text-emerald-700' :
                            tag.status === 'costura' ? 'bg-yellow-100 text-yellow-700' :
                            tag.status === 'manchado' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {statusLabels[tag.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="col-span-3">
              <Card>
                <div className="grid grid-cols-3 gap-6">
                  <Button
                    onClick={() => setStep('select-type')}
                    variant="danger"
                    size="lg"
                    icon={X}
                  >
                    Cancelar
                  </Button>
                  
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-2">Observações</label>
                    <textarea
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none"
                      rows={3}
                      placeholder="Observações sobre esta pesagem..."
                    />
                  </div>
                  
                  <Button
                    onClick={handleConfirmWeight}
                    variant="success"
                    size="lg"
                    icon={Check}
                    disabled={weight <= 0 || rfidTags.length === 0}
                  >
                    Confirmar Pesagem
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="max-w-4xl mx-auto">
            <Card>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-800 mb-4">Pesagem Confirmada</h2>
                <p className="text-xl text-gray-600">Dados registrados com sucesso no sistema</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Resumo da Pesagem</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <span className="font-semibold">{clothingTypes.find(t => t.id === selectedType)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peso Total:</span>
                      <span className="font-bold text-2xl text-blue-800">{weight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peças:</span>
                      <span className="font-semibold">{rfidTags.length} unidades</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horário:</span>
                      <span className="font-semibold">{new Date().toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Análise de Conformidade</h3>
                  <div className="space-y-3">
                    {Object.entries(getStatusCounts()).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 ${statusColors[status as keyof typeof statusColors]} rounded-full`}></div>
                          <span className="text-gray-600">{statusLabels[status as keyof typeof statusLabels]}:</span>
                        </div>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxa de Conformidade:</span>
                      <span className="font-bold text-emerald-700">
                        {((getStatusCounts().conforme || 0) / rfidTags.length * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center mb-8">
                <div className="inline-block bg-white p-6 border-4 border-gray-200 rounded-2xl shadow-lg">
                  <div className="w-48 h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-lg font-mono rounded-xl">
                    <div className="text-center">
                      <div className="text-2xl mb-2">📱</div>
                      <div>QR CODE</div>
                      <div className="text-sm mt-2">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                    </div>
                  </div>
                </div>
                <p className="text-lg text-gray-600 mt-4">Escaneie para acompanhar o processamento</p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-6">
                <Button
                  onClick={() => {
                    setStep('select-type');
                    setSelectedType(null);
                    setWeight(0);
                    setObservations('');
                    setRfidTags([]);
                  }}
                  variant="secondary"
                  size="lg"
                >
                  Nova Pesagem
                </Button>
                <Button
                  onClick={() => alert('Gerando relatório de conformidade...')}
                  variant="success"
                  size="lg"
                  icon={Printer}
                >
                  Gerar Relatório
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};