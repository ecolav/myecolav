import React from 'react';
import { Button } from '../ui/Button';

export interface CageItem {
  id: string;
  barcode: string;
  tareWeight: number;
  createdAt?: string;
}

interface CageSelectModalProps {
  open: boolean;
  cages: CageItem[];
  onSelect: (cage: CageItem) => void;
  onClose: () => void;
}

export const CageSelectModal: React.FC<CageSelectModalProps> = ({ open, cages, onSelect, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Selecionar Gaiola</h3>
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-auto">
          {cages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm">Nenhuma gaiola disponível.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Tara (kg)</th>
                  <th className="py-2 pr-4">Criada em</th>
                  <th className="py-2 pr-0"></th>
                </tr>
              </thead>
              <tbody>
                {cages.map((cage) => (
                  <tr key={cage.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{cage.barcode}</td>
                    <td className="py-2 pr-4">{Number(cage.tareWeight ?? 0).toFixed(2)}</td>
                    <td className="py-2 pr-4">{cage.createdAt ? new Date(cage.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="py-2 pr-0 text-right">
                      <Button size="sm" onClick={() => onSelect(cage)}>Selecionar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};


