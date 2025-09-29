import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';
import { NumericKeypadModal } from '../ui/NumericKeypadModal';
import { CageSelectModal, CageItem } from './CageSelectModal';

type ClothingCategory = 'MISTO' | 'LENÇÓIS' | 'TOALHAS' | 'COBERTORES';

interface WeighingEntry {
  id: string;
  category: ClothingCategory;
  pieceCount: number;
  timestamp: Date;
  tare: number;
  gross: number;
  net: number;
  cageCode: string;
}

export interface WeighingFormViewProps {
  step: 'weighing' | 'confirmation';
  weight: number;
  isStable: boolean;
  connected: boolean;
  selectedType?: ClothingCategory; // deprecated in UI (removido do layout)
  rfidCounts: Record<string, number>;
  rfidTotal: number;
  isRfidReading: boolean;
  cageBarcode: string;
  cageTare: number;
  manualTare: number;
  useManualTare: boolean;
  onCageBarcodeChange: (value: string) => void;
  onCageTareChange: (value: number) => void;
  onUseManualTareChange: (checked: boolean) => void;
  onManualTareChange: (value: number) => void;
  onSubmitWeighing: () => void;
  onSimulateRfid: () => void;
  onNewWeighing: () => void;
  onBack: () => void;
  entries: WeighingEntry[];
  cages: CageItem[];
}

export const WeighingFormView: React.FC<WeighingFormViewProps> = ({
  step,
  weight,
  isStable,
  connected,
  rfidCounts,
  rfidTotal,
  isRfidReading,
  cageBarcode,
  cageTare,
  manualTare,
  useManualTare,
  onCageBarcodeChange,
  onCageTareChange,
  onUseManualTareChange,
  onManualTareChange,
  onSubmitWeighing,
  onSimulateRfid,
  onNewWeighing,
  onBack,
  entries,
  cages
}) => {
  const totalGross = entries.reduce((sum, e) => sum + e.gross, 0);
  const totalPieces = entries.reduce((sum, e) => sum + e.pieceCount, 0);
  const [manualOpen, setManualOpen] = useState(false);
  const [cageOpen, setCageOpen] = useState(false);
  return (
    <main className="p-3">
      {step === 'weighing' && (
        <div className="space-y-3">
          {/* Barra 1: Campos compactos, tipo, contadores e status */}
          <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-widest text-gray-700">PESO</span>
              <input
                readOnly
                value={weight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                className="w-24 h-8 px-2 border border-gray-300 rounded text-right font-semibold"
              />
              <Button size="sm" variant="secondary" onClick={() => setManualOpen(true)} className="h-8 px-2 text-xs">Manual</Button>
              {/* Campos da lógica mapeados em visual compacto */}
              <input
                type="text"
                value={cageBarcode}
                onChange={(e) => onCageBarcodeChange(e.target.value)}
                placeholder="Gaiola"
                className="w-28 h-8 px-2 border border-gray-300 rounded text-sm"
              />
              <Button size="sm" variant="secondary" onClick={() => setCageOpen(true)} className="h-8 px-2 text-xs">Gaiola</Button>
              <input
                type="number"
                step="0.01"
                value={cageTare}
                onChange={(e) => onCageTareChange(Number(e.target.value))}
                placeholder="Tara (kg)"
                className="w-28 h-8 px-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Antena</span>
                <span className={`inline-block w-3 h-3 rounded-full ${true ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Balança</span>
                <span className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </div>
            </div>
          </div>

          {/* Barra 2: Abas visuais */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCageOpen(true)} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm">Gaiolas</button>
            <span className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm">Quantidade</span>
            <span className="px-3 py-1.5 rounded border border-blue-500 bg-blue-600 text-white text-sm font-semibold">Pesagem</span>
          </div>

          {/* Duas colunas como no print */}
          <div className="grid grid-cols-2 gap-3">
            {/* Esquerda: tabela de tipos x quantidade (usa rfidCounts) */}
            <div className="border border-gray-200 bg-white rounded-md overflow-hidden">
              <div className="grid grid-cols-2 text-sm bg-gray-100 border-b border-gray-200">
                <div className="px-3 py-2 font-semibold">Tipo de roupa</div>
                <div className="px-3 py-2 font-semibold">Quantidade</div>
              </div>
              <div className="h-80 flex items-center justify-center text-gray-500 text-sm" style={{display: Object.keys(rfidCounts).length === 0 ? 'flex' : 'none'}}>Não há valores</div>
              {Object.keys(rfidCounts).length > 0 && (
                <div className="divide-y">
                  {Object.entries(rfidCounts).map(([type, count]) => (
                    <div key={type} className="grid grid-cols-2 text-sm">
                      <div className="px-3 py-2">{type}</div>
                      <div className="px-3 py-2">{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direita: tabela de entradas (gaiolas) */}
            <div className="border border-gray-200 bg-white rounded-md overflow-hidden">
              <div className="grid grid-cols-6 text-sm bg-gray-100 border-b border-gray-200">
                <div className="px-3 py-2 font-semibold">Gaiola</div>
                <div className="px-3 py-2 font-semibold">Tipo de roupa</div>
                <div className="px-3 py-2 font-semibold">Peso (Kg)</div>
                <div className="px-3 py-2 font-semibold">Peça</div>
                <div className="px-3 py-2 font-semibold">Hora</div>
                <div className="px-3 py-2 font-semibold">...</div>
              </div>
              <div className="h-80 overflow-auto">
                {entries.map((e) => (
                  <div key={e.id} className="grid grid-cols-6 text-sm border-b">
                    <div className="px-3 py-2 truncate">{e.cageCode}</div>
                    <div className="px-3 py-2">{e.category}</div>
                    <div className="px-3 py-2">{e.gross.toFixed(1)}</div>
                    <div className="px-3 py-2">{e.pieceCount}</div>
                    <div className="px-3 py-2">{e.timestamp.toLocaleTimeString('pt-BR')}</div>
                    <div className="px-3 py-2"><input type="checkbox" className="accent-blue-600" /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Barra inferior com totais e ações */}
          <div className="grid grid-cols-6 items-center gap-3">
            <div className="col-span-2 flex items-center gap-2 text-lg">
              <span className="text-gray-700">Total lidas:</span>
              <span className="font-bold">{rfidTotal}</span>
            </div>
            <div className="col-span-1 text-center text-sm">
              <div>Total cliente inválido:</div>
              <div className="font-semibold">0</div>
              <div className="mt-1">Total sem cadastro:</div>
              <div className="font-semibold">0</div>
            </div>
            <div className="col-span-1 text-right">
              <div className="text-3xl font-extrabold">{totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xl font-bold">Kg</span></div>
            </div>
            <div className="col-span-1 text-center">
              <div className="text-2xl font-extrabold">{totalPieces} <span className="text-lg font-bold">PÇs</span></div>
              <div className="text-sm text-gray-600 mt-1">Col: 0 Kg</div>
              <div className="text-sm text-gray-600">Pronto: 0 %</div>
            </div>
            <div className="col-span-1 flex items-center justify-end gap-3">
              <Button onClick={onSimulateRfid} disabled={isRfidReading} variant="secondary">Iniciar</Button>
              <Button onClick={onSubmitWeighing} disabled={!isStable || weight <= 0}>Finalizar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Confirmação */}
      {step === 'confirmation' && (
        <div className="max-w-2xl mx-auto text-center">
          <Card className="border-white/20">
            <div className="p-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Pesagem Concluída!</h2>
              <p className="text-lg text-gray-600 mb-6">
                A pesagem foi registrada com sucesso.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={onNewWeighing} variant="secondary">
                  Nova Pesagem
                </Button>
                <Button onClick={onBack}>
                  Voltar ao Menu
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      <NumericKeypadModal
        open={manualOpen}
        title="Tara manual da gaiola"
        initialValue={cageTare}
        onConfirm={(v) => onCageTareChange(v)}
        onClose={() => setManualOpen(false)}
      />
      <CageSelectModal
        open={cageOpen}
        cages={cages}
        onSelect={(cage) => {
          onCageBarcodeChange(cage.barcode);
          onCageTareChange(cage.tareWeight);
          setCageOpen(false);
        }}
        onClose={() => setCageOpen(false)}
      />
    </main>
  );
};


