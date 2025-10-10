import React from 'react';
import { X, Delete, Check } from 'lucide-react';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  onClose: () => void;
  title?: string;
  maxLength?: number;
  allowDecimal?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  onConfirm,
  onClose,
  title = 'Digite o valor',
  maxLength = 10,
  allowDecimal = true
}) => {
  const handleKey = (key: string) => {
    if (key === 'BACKSPACE') {
      onChange(value.slice(0, -1));
    } else if (key === 'CLEAR') {
      onChange('');
    } else if (key === '.') {
      if (allowDecimal && !value.includes('.')) {
        onChange(value + key);
      }
    } else {
      if (value.length < maxLength) {
        onChange(value + key);
      }
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const KeyButton: React.FC<{ value: string; special?: boolean }> = ({ value, special = false }) => (
    <button
      type="button"
      onClick={() => handleKey(value)}
      className={`h-20 rounded-2xl font-bold text-3xl ${
        special
          ? 'bg-gray-400 hover:bg-gray-500 text-white'
          : 'bg-white hover:bg-gray-100 text-gray-900 border-4 border-gray-300'
      } active:scale-95 transition-all shadow-lg`}
    >
      {value === 'BACKSPACE' ? <Delete size={32} className="mx-auto" /> : 
       value === 'CLEAR' ? 'C' :
       value}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-gradient-to-b from-white to-gray-100 rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X size={28} />
          </button>
        </div>

        {/* Display */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6 border-4 border-gray-700">
          <div className="text-right text-5xl font-mono font-bold text-green-400 min-h-[60px] flex items-center justify-end">
            {value || '0'}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <KeyButton value="7" />
          <KeyButton value="8" />
          <KeyButton value="9" />
          <KeyButton value="4" />
          <KeyButton value="5" />
          <KeyButton value="6" />
          <KeyButton value="1" />
          <KeyButton value="2" />
          <KeyButton value="3" />
          {allowDecimal && <KeyButton value="." />}
          <KeyButton value="0" />
          <KeyButton value="BACKSPACE" special />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleKey('CLEAR')}
            className="h-16 rounded-2xl font-bold text-xl bg-gray-400 hover:bg-gray-500 text-white active:scale-95 transition-all shadow-lg"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!value || value === '0'}
            className="h-16 rounded-2xl font-bold text-xl bg-green-500 hover:bg-green-600 text-white active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={24} />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

