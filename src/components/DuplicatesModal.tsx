import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { DuplicateKeep } from '../types';
import { Layers, X } from 'lucide-react';

export default function DuplicatesModal() {
  const isOpen = useWorkspaceStore((state) => state.isDuplicatesModalOpen);
  const setDuplicatesModalOpen = useWorkspaceStore((state) => state.setDuplicatesModalOpen);
  const removeDuplicates = useWorkspaceStore((state) => state.removeDuplicates);

  const [keepStrategy, setKeepStrategy] = useState<DuplicateKeep>('first');
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleApply = async () => {
    setIsApplying(true);
    await removeDuplicates(keepStrategy);
    setIsApplying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-900">Gérer les doublons</h3>
          </div>
          <button 
            onClick={() => setDuplicatesModalOpen(false)} 
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors pointer-events-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-600">
            Supprimez les lignes strictement identiques (toutes les colonnes).
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">Conservation des données</label>
            <select 
              value={keepStrategy} 
              onChange={(e) => setKeepStrategy(e.target.value as DuplicateKeep)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
            >
              <option value="first">Conserver la première occurrence</option>
              <option value="last">Conserver la dernière occurrence</option>
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button 
            onClick={() => setDuplicatesModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-lg transition-colors pointer-events-auto"
          >
            Annuler
          </button>
          <button 
            onClick={handleApply}
            disabled={isApplying}
            className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white hover:bg-red-600 bg-red-500 rounded-lg transition-all disabled:opacity-50 pointer-events-auto"
          >
           {isApplying ? <span className="animate-pulse">Nettoyage...</span> : 'Supprimer'}
          </button>
        </div>

      </div>
    </div>
  );
}
