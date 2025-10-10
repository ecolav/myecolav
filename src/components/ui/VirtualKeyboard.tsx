import React from 'react';
import { X, Delete } from 'lucide-react';

interface VirtualKeyboardProps {
  onKey: (key: string) => void;
  onClose: () => void;
  showNumbers?: boolean;
  uppercase?: boolean;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ 
  onKey, 
  onClose,
  showNumbers = true,
  uppercase = false
}) => {
  const [isUppercase, setIsUppercase] = React.useState(uppercase);

  const numbersRow = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const firstRow = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const secondRow = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const thirdRow = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  const handleKey = (key: string) => {
    if (key === 'SPACE') {
      onKey(' ');
    } else if (key === 'BACKSPACE') {
      onKey('BACKSPACE');
    } else if (key === 'SHIFT') {
      setIsUppercase(!isUppercase);
    } else {
      onKey(isUppercase ? key.toUpperCase() : key.toLowerCase());
    }
  };

  const KeyButton: React.FC<{ value: string; width?: string; special?: boolean }> = ({ 
    value, 
    width = 'w-14', 
    special = false 
  }) => (
    <button
      type="button"
      onClick={() => handleKey(value)}
      className={`${width} h-14 rounded-lg font-bold text-lg ${
        special 
          ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' 
          : 'bg-white hover:bg-gray-100 text-gray-800 border-2 border-gray-200'
      } active:scale-95 transition-all shadow-sm`}
    >
      {value === 'BACKSPACE' ? <Delete size={20} className="mx-auto" /> : 
       value === 'SPACE' ? '___' :
       value === 'SHIFT' ? '⇧' :
       isUppercase && !special ? value.toUpperCase() : value.toLowerCase()}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div 
        className="w-full bg-gradient-to-b from-gray-100 to-gray-200 rounded-t-3xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-700">Teclado Virtual</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-2">
          {/* Números */}
          {showNumbers && (
            <div className="flex justify-center gap-2">
              {numbersRow.map(key => (
                <KeyButton key={key} value={key} />
              ))}
            </div>
          )}

          {/* Primeira linha */}
          <div className="flex justify-center gap-2">
            {firstRow.map(key => (
              <KeyButton key={key} value={key} />
            ))}
          </div>

          {/* Segunda linha */}
          <div className="flex justify-center gap-2">
            {secondRow.map(key => (
              <KeyButton key={key} value={key} />
            ))}
          </div>

          {/* Terceira linha */}
          <div className="flex justify-center gap-2">
            <KeyButton value="SHIFT" width="w-20" special />
            {thirdRow.map(key => (
              <KeyButton key={key} value={key} />
            ))}
            <KeyButton value="BACKSPACE" width="w-20" special />
          </div>

          {/* Linha especial */}
          <div className="flex justify-center gap-2">
            <KeyButton value="-" />
            <KeyButton value="SPACE" width="w-96" special />
            <KeyButton value="." />
          </div>
        </div>
      </div>
    </div>
  );
};

