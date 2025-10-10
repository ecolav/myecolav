import React, { useRef, useEffect, useState } from 'react';
import { Scan, X, Keyboard } from 'lucide-react';
import { VirtualKeyboard } from './VirtualKeyboard';

interface ScannerInputProps {
  value: string;
  onChange: (value: string) => void;
  onScan?: (value: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  showKeyboard?: boolean;
}

export const ScannerInput: React.FC<ScannerInputProps> = ({
  value,
  onChange,
  onScan,
  placeholder = 'Escaneie o código de barras',
  label,
  autoFocus = false,
  showKeyboard = true
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(false);
  
  // Buffer para detectar scan (scanner envia tudo de uma vez + Enter)
  const scanBufferRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Se Enter e tem valor, considera como scan
    if (e.key === 'Enter' && value) {
      e.preventDefault();
      if (onScan) {
        setScanAnimation(true);
        onScan(value);
        setTimeout(() => setScanAnimation(false), 500);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Detectar scan rápido (múltiplos caracteres em < 100ms)
    clearTimeout(scanTimeoutRef.current);
    scanBufferRef.current += newValue.slice(-1);
    
    if (scanBufferRef.current.length > 5) {
      // Provavelmente é um scanner
      setScanAnimation(true);
      setTimeout(() => setScanAnimation(false), 500);
    }

    scanTimeoutRef.current = setTimeout(() => {
      scanBufferRef.current = '';
    }, 100);
  };

  const handleClear = () => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleVirtualKey = (key: string) => {
    if (key === 'BACKSPACE') {
      onChange(value.slice(0, -1));
    } else {
      onChange(value + key);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xl font-bold text-gray-800 mb-3">
          {label}
        </label>
      )}
      
      <div className="relative">
        <div className={`
          flex items-center gap-4 bg-white border-4 rounded-2xl p-4 transition-all
          ${scanAnimation ? 'border-green-500 ring-4 ring-green-200' : 'border-gray-300'}
        `}>
          <Scan 
            size={32} 
            className={`flex-shrink-0 ${scanAnimation ? 'text-green-500' : 'text-gray-400'}`}
          />
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-2xl font-mono font-semibold text-gray-900 outline-none bg-transparent placeholder-gray-400"
          />

          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center active:scale-95 transition-all"
            >
              <X size={24} />
            </button>
          )}

          {showKeyboard && (
            <button
              type="button"
              onClick={() => setShowVirtualKeyboard(true)}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center active:scale-95 transition-all"
            >
              <Keyboard size={24} />
            </button>
          )}
        </div>

        {scanAnimation && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-4 border-green-500 rounded-2xl animate-pulse" />
          </div>
        )}
      </div>

      {/* Teclado Virtual */}
      {showVirtualKeyboard && (
        <VirtualKeyboard
          onKey={handleVirtualKey}
          onClose={() => setShowVirtualKeyboard(false)}
          showNumbers={true}
          uppercase={true}
        />
      )}
    </div>
  );
};


