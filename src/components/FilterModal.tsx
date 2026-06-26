import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { FilterCondition, FilterLogic, FilterOperator } from '../types';
import { Filter, X, Plus, Trash2 } from 'lucide-react';

export default function FilterModal() {
  const isOpen = useWorkspaceStore((state) => state.isFilterModalOpen);
  const setFilterModalOpen = useWorkspaceStore((state) => state.setFilterModalOpen);
  const columns = useWorkspaceStore((state) => state.columns);
  const getUniqueValues = useWorkspaceStore((state) => state.getUniqueValues);
  const applyFilter = useWorkspaceStore((state) => state.applyFilter);

  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [columnValues, setColumnValues] = useState<Record<string, any[]>>({});
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen && conditions.length === 0 && columns.length > 0) {
      setConditions([{ column: columns[0].name, operator: '==', value: '', logic: 'AND' }]);
    }
  }, [isOpen, columns]);

  useEffect(() => {
    conditions.forEach((cond) => {
      if (cond.column) {
        const colMeta = columns.find(c => c.name === cond.column);
        if (colMeta && (colMeta.type === 'nominal' || colMeta.type === 'ordinal')) {
          setColumnValues((prev) => {
            // Si on a déjà chargé ou initié le chargement pour cette colonne, on passe
            if (prev[cond.column] !== undefined) return prev;
            
            // Sinon, on lance le chargement asynchrone
            getUniqueValues(cond.column).then((vals) => {
              setColumnValues((current) => ({ ...current, [cond.column]: vals }));
            });
            
            // On retourne un tableau vide temporaire pour éviter de relancer la requête
            return { ...prev, [cond.column]: [] };
          });
        }
      }
    });
  }, [conditions, columns, getUniqueValues]);

  if (!isOpen) return null;

  const addCondition = () => {
    setConditions([
      ...conditions, 
      { column: columns[0]?.name || '', operator: '==', value: '', logic: 'AND' }
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof FilterCondition, value: any) => {
    setConditions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleApply = async () => {
    setIsApplying(true);
    await applyFilter(conditions);
    setIsApplying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
              <Filter className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-900">Filtrer les observations</h3>
          </div>
          <button 
            onClick={() => setFilterModalOpen(false)} 
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors pointer-events-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          <p className="text-sm text-zinc-500 mb-2">
            Définissez des critères pour filtrer votre jeu de données.
          </p>

          <div className="space-y-3">
            {conditions.map((cond, index) => {
              const colMeta = columns.find(c => c.name === cond.column);
              const isNumeric = colMeta?.type === 'continuous' || colMeta?.type === 'discrete';
              const isDate = colMeta?.type === 'datetime';
              const showDropdown = !isNumeric && !isDate && columnValues[cond.column] !== undefined;
              const uniqueVals = columnValues[cond.column] || [];

              return (
                <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  
                  {/* Logic operator (hidden for first) */}
                  {index > 0 ? (
                    <select 
                      value={cond.logic}
                      onChange={(e) => updateCondition(index, 'logic', e.target.value as FilterLogic)}
                      className="text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="AND">ET</option>
                      <option value="OR">OU</option>
                    </select>
                  ) : (
                    <div className="w-14 shrink-0 text-center text-xs font-semibold text-zinc-400">Si</div>
                  )}

                  {/* Column */}
                  <div className="flex-1 min-w-[140px]">
                    <select
                      value={cond.column}
                      onChange={(e) => {
                        updateCondition(index, 'column', e.target.value);
                        updateCondition(index, 'value', ''); // reset value
                      }}
                      className="w-full text-sm text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    >
                      {columns.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Operator */}
                  <div className="w-32 shrink-0">
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value as FilterOperator)}
                      className="w-full text-sm text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    >
                      <option value="==">Égal à</option>
                      <option value="!=">Différent de</option>
                      {(isNumeric || isDate) && (
                        <>
                          <option value=">">{isDate ? 'Après' : 'Supérieur à'}</option>
                          <option value="<">{isDate ? 'Avant' : 'Inférieur à'}</option>
                          <option value=">=">{isDate ? 'À partir de' : 'Sup. ou égal à'}</option>
                          <option value="<=">{isDate ? 'Jusqu\'au' : 'Inf. ou égal à'}</option>
                        </>
                      )}
                      {!isNumeric && !isDate && (
                        <option value="contains">Contient</option>
                      )}
                    </select>
                  </div>

                  {/* Value */}
                  <div className="flex-1 min-w-[140px]">
                    {showDropdown && cond.operator !== 'contains' ? (
                      <select
                         value={cond.value}
                         onChange={(e) => updateCondition(index, 'value', e.target.value)}
                         className="w-full text-sm text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      >
                        <option value="">Sélectionner...</option>
                        {uniqueVals.map((val, vIdx) => (
                          <option key={vIdx} value={val}>{String(val)}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={isDate ? "date" : (isNumeric ? "number" : "text")}
                        value={(cond.value === undefined || cond.value === null || (typeof cond.value === 'number' && isNaN(cond.value))) ? '' : cond.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        placeholder={isDate ? "Date..." : "Valeur..."}
                        className="w-full text-sm text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    )}
                  </div>

                  <button 
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length === 1}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                </div>
              );
            })}
          </div>

          <button
            onClick={addCondition}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une condition
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button 
            onClick={() => setFilterModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleApply}
            disabled={isApplying || conditions.some(c => c.value === '')}
            className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 bg-zinc-900 rounded-lg transition-all disabled:opacity-50"
          >
           {isApplying ? 'Application...' : 'Appliquer le filtre'}
          </button>
        </div>

      </div>
    </div>
  );
}
