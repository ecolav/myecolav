import React, { useMemo, useState } from 'react';
import { Button } from './Button';

interface NumericKeypadModalProps {
  open: boolean;
  title?: string;
  initialValue?: number;
  onConfirm: (value: number) => void;
  onClose: () => void;
}

export const NumericKeypadModal: React.FC<NumericKeypadModalProps> = ({
  open,
  title = 'Entrada Manual',
  initialValue = 0,
  onConfirm,
  onClose
}) => {
  const initialText = useMemo(() => {
    const v = Number(initialValue || 0);
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }, [initialValue]);

  const [text, setText] = useState<string>(initialText);

  if (!open) return null;

  const append = (ch: string) => {
    // Permitir apenas um separador de vírgula
    if (ch === ',') {
      if (text.includes(',')) return;
      if (text.length === 0) return setText('0,');
    }
    // Evitar zeros à esquerda desnecessários
    if (ch === '0' && text === '0') return;
    if (text === '0' && ch !== ',') setText(ch);
    else setText(text + ch);
  };

  const backspace = () => {
    if (text.length === 0) return;
    setText(text.slice(0, -1));
  };

  const clearAll = () => setText('');

  const confirm = () => {
    const normalized = text.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    onConfirm(Number.isFinite(num) ? num : 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        <div className="p-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full mb-4 px-3 py-2 border border-gray-300 rounded text-right text-xl font-semibold"
            inputMode="decimal"
            placeholder="0"
          />

          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9',',','0','⌫'].map((key) => (
              <button
                key={key}
                onClick={() => key === '⌫' ? backspace() : append(key)}
                className="h-12 rounded bg-gray-100 hover:bg-gray-200 text-lg font-semibold"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={clearAll}>Limpar</Button>
            <Button onClick={confirm}>Confirmar</Button>
          </div>
        </div>
      </div>
    </div>
  );
};


