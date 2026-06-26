import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { FolderOpen, Plus } from 'lucide-react';

interface FolderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function FolderSelector({ value, onChange, className = '' }: FolderSelectorProps) {
  const history = useWorkspaceStore((state) => state.history);
  
  const existingGroups = React.useMemo(() => {
    return Array.from(new Set(history.map(h => h.group).filter(Boolean))) as string[];
  }, [history]);

  const [mode, setMode] = useState<'select' | 'new'>(
    value && !existingGroups.includes(value) ? 'new' : 'select'
  );
  const [customName, setCustomName] = useState(
    value && !existingGroups.includes(value) ? value : ''
  );

  useEffect(() => {
    if (mode === 'select') {
      setCustomName('');
    }
  }, [mode]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      setMode('new');
      onChange(customName);
    } else {
      onChange(val);
    }
  };

  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomName(val);
    onChange(val);
  };

  return (
    <div className={`space-y-2 pb-2 ${className}`}>
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
        Dossier de classification
      </label>
      
      {mode === 'select' ? (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={handleSelectChange}
            className="flex-1 bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all cursor-pointer"
          >
            <option value="">-- Aucun dossier (Racine) --</option>
            {existingGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="__new__" className="font-semibold text-indigo-600">+ Créer un nouveau dossier...</option>
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={handleCustomNameChange}
              placeholder="Saisissez le nom du nouveau dossier..."
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all shadow-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setMode('select');
                onChange('');
              }}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 cursor-pointer"
            >
              Sélectionner existant
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Ce dossier sera créé automatiquement lors de la génération du calcul.
          </p>
        </div>
      )}
    </div>
  );
}
