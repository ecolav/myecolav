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
  rfidEnabled?: boolean;
  cageBarcode: string;
  cageTare: number;
  manualTare: number;
  useManualTare: boolean;
  onCageBarcodeChange: (value: string) => void;
  onCageTareChange: (value: number) => void;
  onUseManualTareChange: (checked: boolean) => void;
  onManualTareChange: (value: number) => void;
  onCaptureWeighing: () => void;
  onFinalize: () => void;
  onSimulateRfid: () => void;
  onNewWeighing: () => void;
  onBack: () => void;
  entries: WeighingEntry[];
  cages: CageItem[];
  targetKg?: number;
  progressPercent?: number;
  onCageSelected?: (id: string) => void;
  [key: string]: any;
}

export const WeighingFormView: React.FC<WeighingFormViewProps> = ({
  step,
  weight,
  isStable,
  connected,
  rfidCounts,
  rfidTotal,
  isRfidReading,
  rfidEnabled = true,
  cageBarcode,
  cageTare,
  manualTare,
  useManualTare,
  onCageBarcodeChange,
  onCageTareChange,
  onUseManualTareChange,
  onManualTareChange,
  onCaptureWeighing,
  onFinalize,
  onSimulateRfid,
  onNewWeighing,
  onBack,
  entries,
  cages,
  targetKg = 0,
  progressPercent = 0,
  onCageSelected
}) => {
  const totalGross = entries.reduce((sum, e) => sum + e.gross, 0);
  const totalPieces = entries.reduce((sum, e) => sum + e.pieceCount, 0);
  const [manualOpen, setManualOpen] = useState(false);
  const [cageOpen, setCageOpen] = useState(false);
  const isDev = (import.meta as any)?.env?.DEV ?? false;
  const hasRfid = Object.keys(rfidCounts).length > 0;
  return (
    <main className="p-3">
      {step === 'weighing' && (
        <div className="space-y-3">
          {/* Barra 1: Campos compactos - ajuste touch +4px */}
          <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-md px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-widest text-gray-700">PESO (kg)</span>
              <input
                readOnly
                value={weight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                className="w-28 h-10 px-3 border border-gray-300 rounded text-right text-base font-bold"
              />
              {/* Campos da lógica mapeados em visual compacto */}
              <input
                type="text"
                value={cageBarcode}
                onChange={(e) => onCageBarcodeChange(e.target.value)}
                placeholder="Código da gaiola"
                className="w-32 h-10 px-3 border border-gray-300 rounded text-base"
              />
              <Button size="md" variant="secondary" onClick={() => setCageOpen(true)}>Gaiola</Button>
              <input
                type="text"
                step="0.01"
                value={cageTare}
                readOnly
                onClick={() => setManualOpen(true)}
                placeholder="Tara (kg)"
                className="w-28 h-10 px-3 border border-gray-300 rounded text-base cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-4">
              {!connected && (
                <div className="flex items-center gap-2 text-base text-red-700 font-semibold">
                  <span>Balança Desconectada</span>
                  <span className="inline-block w-4 h-4 rounded-full bg-red-500"></span>
                </div>
              )}
              {isStable && (
                <div className="flex items-center gap-2 text-base text-green-700 font-semibold">
                  <span className="inline-block w-4 h-4 rounded-full bg-green-500 animate-pulse"></span>
                  <span>✓ Estável</span>
                </div>
              )}
            </div>
          </div>

          {/* Barra 2: Abas visuais */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm">Gaiolas</span>
            <span className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm">Quantidade</span>
            <span className="px-3 py-1.5 rounded border border-blue-500 bg-blue-600 text-white text-sm font-semibold">Pesagem</span>
          </div>

          {/* Duas colunas - formato perfeito para RFID */}
          <div className={"grid grid-cols-2 gap-3"}>
            {/* Esquerda: tabela de tipos x quantidade (usa rfidCounts) */}
            <div className="border border-gray-200 bg-white rounded-md overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 text-base bg-gray-100 border-b border-gray-200">
                <div className="px-4 py-3 font-bold text-gray-800">Tipo de roupa</div>
                <div className="px-4 py-3 font-bold text-gray-800">Peças</div>
              </div>
              {(hasRfid && rfidEnabled) ? (
                <div className="divide-y divide-gray-200">
                  {Object.entries(rfidCounts).map(([type, count]) => (
                    <div key={type} className="grid grid-cols-2 text-base">
                      <div className="px-4 py-3 text-gray-700">{type}</div>
                      <div className="px-4 py-3 font-semibold text-blue-700">{count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500 text-base">{rfidEnabled ? 'Aguardando RFID...' : 'RFID desativado'}</div>
              )}
            </div>

            {/* Direita: tabela de entradas (gaiolas) */}
            <div className="border border-gray-200 bg-white rounded-md overflow-hidden shadow-sm">
              <div className="grid grid-cols-6 text-sm bg-gray-100 border-b border-gray-200">
                <div className="px-3 py-3 font-bold text-gray-800">Gaiola</div>
                <div className="px-3 py-3 font-bold text-gray-800">Líquido (kg)</div>
                <div className="px-3 py-3 font-bold text-gray-800">Peças</div>
                <div className="px-3 py-3 font-bold text-gray-800">Horário</div>
                <div className="px-3 py-3 font-bold text-gray-800">RFID(s)</div>
                <div className="px-3 py-3 font-bold text-gray-800">...</div>
              </div>
              <div className="h-80 overflow-auto">
                {entries.map((e) => (
                  <div key={e.id} className="grid grid-cols-6 text-base border-b border-gray-200 hover:bg-blue-50">
                    <div className="px-3 py-3 truncate font-medium text-gray-900">{e.cageCode}</div>
                    <div className="px-3 py-3 font-bold text-blue-700">{e.net.toFixed(2)}</div>
                    <div className="px-3 py-3 font-semibold text-gray-900">{e.pieceCount}</div>
                    <div className="px-3 py-3 text-gray-600">{e.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="px-3 py-3 truncate text-xs text-gray-500">{(e as any).rfidSummary || '-'}</div>
                    <div className="px-3 py-3"><input type="checkbox" className="w-5 h-5 accent-blue-600" /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Barra inferior com totais e ações - ajuste touch */}
          <div className="grid grid-cols-5 items-center gap-3 bg-white border border-gray-200 rounded-md px-4 py-3 shadow-sm">
            <div className="col-span-2 flex items-center gap-2 text-lg">
              <span className="text-gray-700">Total de peças:</span>
              <span className="font-bold text-blue-700">{rfidTotal}</span>
            </div>
            <div className="col-span-1 text-right">
              <div className="text-3xl font-extrabold text-green-700">{totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xl font-bold text-gray-700">Kg</span></div>
            </div>
            <div className="col-span-1 text-center">
              <div className="text-2xl font-extrabold text-gray-900">{totalPieces} <span className="text-lg font-bold">peças</span></div>
              <div className="text-sm text-gray-600 mt-1">Meta: {targetKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg</div>
              <div className="text-sm text-gray-600">Progresso: {Math.max(0, Math.min(100, Number(progressPercent?.toFixed?.(2) ?? 0)))}%</div>
            </div>
            <div className="col-span-1 flex items-center justify-end gap-2">
              {isDev && (
                <Button onClick={onSimulateRfid} disabled={isRfidReading} variant="secondary" size="md">Iniciar</Button>
              )}
              <Button onClick={onCaptureWeighing} disabled={weight <= 0 || (!isStable)} variant="success" size="md">Pesar</Button>
              <Button onClick={onFinalize} disabled={entries.length === 0} variant="primary" size="md">Finalizar</Button>
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
          if (onCageSelected) onCageSelected(cage.id);
          setCageOpen(false);
        }}
        onClose={() => setCageOpen(false)}
      />
    </main>
  );
};
