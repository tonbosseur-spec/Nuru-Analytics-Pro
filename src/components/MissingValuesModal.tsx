import React, { useState, useEffect } from 'react';
import { ColumnMetadata, ImputationStrategy } from '../types';
import { X, AlertCircle, Trash2, Calculator, BarChart3, Hash } from 'lucide-react';
import { useWorkspaceStore } from '../store';

interface Props {
  column: ColumnMetadata | null;
  onClose: () => void;
}

export default function MissingValuesModal({ column, onClose }: Props) {
  const handleMissingValues = useWorkspaceStore((state) => state.handleMissingValues);
  const [strategy, setStrategy] = useState<ImputationStrategy>('drop_rows');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset strategy when column changes, picking a smart default
    if (column) {
      if (column.type === 'nominal' || column.type === 'ordinal') {
        setStrategy('mode');
      } else {
        setStrategy('mean');
      }
    }
  }, [column]);

  if (!column) return null;

  const onSave = async () => {
    setIsSaving(true);
    await handleMissingValues(column.name, strategy);
    setIsSaving(false);
    onClose();
  };

  const isNumeric = column.type === 'continuous' || column.type === 'discrete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-900">Valeurs manquantes</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors pointer-events-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm text-zinc-600">
              La variable <span className="font-semibold text-zinc-900">{column.name}</span> contient <span className="font-semibold text-red-600">{column.missing_values}</span> valeurs manquantes (NaN).
            </p>
            <p className="text-xs text-zinc-500 mt-1">Sélectionnez une stratégie pour les traiter :</p>
          </div>
          
          <div className="space-y-2">
            <label 
              className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                strategy === 'drop_rows' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              <input type="radio" className="mt-1" name="imputation" checked={strategy === 'drop_rows'} onChange={() => setStrategy('drop_rows')} />
              <div className="ml-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  Supprimer les lignes
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Supprime toutes les lignes contenant un NaN pour cette colonne.</p>
              </div>
            </label>

            <label 
              className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                !isNumeric ? 'opacity-50 cursor-not-allowed' : strategy === 'mean' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              <input type="radio" className="mt-1" name="imputation" disabled={!isNumeric} checked={strategy === 'mean'} onChange={() => setStrategy('mean')} />
              <div className="ml-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  Remplacer par la Moyenne
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Adapté aux variables continues réparties normalement.</p>
              </div>
            </label>

            <label 
              className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                !isNumeric ? 'opacity-50 cursor-not-allowed' : strategy === 'median' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              <input type="radio" className="mt-1" name="imputation" disabled={!isNumeric} checked={strategy === 'median'} onChange={() => setStrategy('median')} />
              <div className="ml-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                  Remplacer par la Médiane
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Robuste contre les valeurs extrêmes (outliers).</p>
              </div>
            </label>

             <label 
              className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                strategy === 'mode' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              <input type="radio" className="mt-1" name="imputation" checked={strategy === 'mode'} onChange={() => setStrategy('mode')} />
              <div className="ml-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <Hash className="w-3.5 h-3.5 text-green-600" />
                  Remplacer par le Mode
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Remplace par la valeur la plus fréquente (idéal pour catégories).</p>
              </div>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-lg transition-colors pointer-events-auto"
          >
            Annuler
          </button>
          <button 
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 bg-zinc-900 rounded-lg transition-all disabled:opacity-50 pointer-events-auto"
          >
           {isSaving ? <span className="animate-pulse">Application...</span> : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>
  );
}
