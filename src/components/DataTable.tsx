import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { Tags, Ruler, Hash, Calendar, ListOrdered, Edit2, AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { StatType, ColumnMetadata } from '../types';
import ColumnEditModal from './ColumnEditModal';
import MissingValuesModal from './MissingValuesModal';
import OutliersModal from './OutliersModal';
import { toast } from 'sonner';

const TypeIcon = ({ type, className }: { type: StatType, className?: string }) => {
  switch (type) {
    case 'nominal': return <Tags className={className} />;
    case 'ordinal': return <ListOrdered className={className} />;
    case 'continuous': return <Ruler className={className} />;
    case 'discrete': return <Hash className={className} />;
    case 'datetime': return <Calendar className={className} />;
    default: return <Tags className={className} />;
  }
};

const TypeLabel = ({ type }: { type: StatType }) => {
  const colors = {
    nominal: 'bg-blue-50 text-blue-700 border-blue-200',
    ordinal: 'bg-purple-50 text-purple-700 border-purple-200',
    continuous: 'bg-green-50 text-green-700 border-green-200',
    discrete: 'bg-orange-50 text-orange-700 border-orange-200',
    datetime: 'bg-pink-50 text-pink-700 border-pink-200'
  };
  return (
    <span className={`text-[10px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded border ${colors[type]}`}>
      {type}
    </span>
  );
};

export default function DataTable() {
  const columns = useWorkspaceStore((state) => state.columns);
  const previewData = useWorkspaceStore((state) => state.previewData);
  const editCell = useWorkspaceStore((state) => state.editCell);
  const deleteRow = useWorkspaceStore((state) => state.deleteRow);
  const deleteColumn = useWorkspaceStore((state) => state.deleteColumn);

  const [editingCol, setEditingCol] = useState<ColumnMetadata | null>(null);
  const [missingValCol, setMissingValCol] = useState<ColumnMetadata | null>(null);
  const [outliersCol, setOutliersCol] = useState<ColumnMetadata | null>(null);

  // Cell editing states
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState('');

  // Calculate outlier bounds client-side using IQR (Q1 - 1.5*IQR to Q3 + 1.5*IQR) for continuous/discrete columns
  const outlierBounds = React.useMemo(() => {
    const bounds: Record<string, { min: number; max: number }> = {};
    columns.forEach(col => {
      if (col.type === 'continuous' || col.type === 'discrete') {
        const values = previewData
          .map(row => Number(row[col.name]))
          .filter(val => !isNaN(val) && val !== null && val !== undefined)
          .sort((a, b) => a - b);
          
        if (values.length > 0) {
          const q1Idx = Math.floor(values.length * 0.25);
          const q3Idx = Math.floor(values.length * 0.75);
          const q1 = values[q1Idx];
          const q3 = values[q3Idx];
          const iqr = q3 - q1;
          bounds[col.name] = {
            min: q1 - (1.5 * iqr),
            max: q3 + (1.5 * iqr)
          };
        }
      }
    });
    return bounds;
  }, [columns, previewData]);

  const handleSaveCell = async (rowIdx: number, colName: string) => {
    if (editingCell) {
      await editCell(rowIdx, colName, editCellValue.trim());
      setEditingCell(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50/50 relative flex flex-col h-full">
      {/* Legend Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-zinc-200/80 p-2.5 px-4 flex flex-wrap items-center justify-between text-xs text-zinc-500 gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-extrabold text-zinc-700 tracking-tight">OPTIONS DE SAISIE :</span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[9px] font-extrabold flex items-center justify-center">123</span>
            <span className="text-[11px] text-zinc-600 font-medium font-sans">Valeur aberrante (Outlier IQR)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 border border-zinc-300 rounded bg-zinc-50 text-[10px] font-mono shadow-xs">Double-clic</kbd>
            <span className="text-[11px] text-zinc-600 font-medium">Modifier cellule</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-medium italic">
            💡 Survoler un numéro de ligne pour la supprimer
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-zinc-100 shadow-[0_1px_0_0_#e4e4e7]">
            <tr>
              <th className="w-12 h-10 border-r border-zinc-200 bg-zinc-100 sticky left-0 z-20"></th>
              {columns.map((col, idx) => (
                <th key={idx} className="group h-10 px-4 font-semibold text-zinc-700 border-r border-zinc-200 min-w-[200px] hover:bg-zinc-200/50 transition-colors">
                  <div className="flex flex-col gap-1.5 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={col.type} className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="truncate">{col.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingCol(col)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-800 p-1 rounded hover:bg-zinc-300/50 transition-all pointer-events-auto"
                          title="Modifier la variable (Nom / Type)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            toast("Confirmer la suppression", {
                              description: `Voulez-vous vraiment supprimer intégralement et définitivement la colonne '${col.name}' ?`,
                              action: {
                                label: "Supprimer",
                                onClick: () => deleteColumn(col.name)
                              },
                              cancel: {
                                label: "Annuler",
                                onClick: () => {}
                              },
                              duration: 5000
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-all pointer-events-auto"
                          title="Supprimer entièrement la colonne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <TypeLabel type={col.type} />
                        <span className="text-[10px] text-zinc-400 font-mono bg-white px-1 py-0.5 rounded border border-zinc-200">
                          {col.raw_dtype}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {col.missing_values > 0 && (
                        <button 
                          onClick={() => setMissingValCol(col)}
                          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-colors pointer-events-auto"
                          title="Gérer les valeurs manquantes"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {col.missing_values} manquantes
                        </button>
                      )}
                      {(col.type === 'continuous' || col.type === 'discrete') && (
                        <button 
                          onClick={() => setOutliersCol(col)}
                          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded border border-rose-200 transition-colors pointer-events-auto"
                          title="Analyser et traiter les valeurs aberrantes (outliers)"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Anomalies / Outliers
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {previewData.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-zinc-50 transition-colors group">
                <td className="relative h-9 px-2 text-center text-xs font-mono text-zinc-400 border-b border-r border-zinc-200 bg-zinc-50 sticky left-0 group-hover:bg-zinc-100 transition-colors">
                  <span className="group-hover:opacity-0 transition-opacity duration-150">{rowIdx + 1}</span>
                  <button
                    onClick={() => {
                      toast("Confirmer la suppression", {
                        description: `Voulez-vous vraiment supprimer intégralement et définitivement la ligne ${rowIdx + 1} ?`,
                        action: {
                          label: "Supprimer",
                          onClick: () => deleteRow(rowIdx)
                        },
                        cancel: {
                          label: "Annuler",
                          onClick: () => {}
                        },
                        duration: 5000
                      });
                    }}
                    className="absolute inset-0 m-auto w-6 h-6 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                    title="Supprimer entièrement la ligne"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
                {columns.map((col, colIdx) => {
                  const val = row[col.name];
                  const isNull = val === null || val === undefined;
                  const isNumber = typeof val === 'number';
                  
                  // Check if cell is outlier
                  const colBounds = outlierBounds[col.name];
                  const numericVal = Number(val);
                  const isOutlier = colBounds && !isNaN(numericVal) && !isNull && (numericVal < colBounds.min || numericVal > colBounds.max);

                  const isBeingEdited = editingCell?.rowIdx === rowIdx && editingCell?.colName === col.name;

                  if (isBeingEdited) {
                    return (
                      <td key={colIdx} className="h-9 p-1 border-b border-r border-zinc-100 bg-indigo-50/50">
                        <input
                          type="text"
                          value={editCellValue}
                          onChange={(e) => setEditCellValue(e.target.value)}
                          onBlur={() => handleSaveCell(rowIdx, col.name)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveCell(rowIdx, col.name);
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          autoFocus
                          className="w-full h-full px-2 text-xs border border-indigo-500 rounded bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
                        />
                      </td>
                    );
                  }

                  return (
                    <td 
                      key={colIdx} 
                      onDoubleClick={() => {
                        setEditingCell({ rowIdx, colName: col.name });
                        setEditCellValue(isNull ? '' : String(val));
                      }}
                      className={`h-9 px-4 border-b border-r border-zinc-100 transition-colors select-none cursor-pointer hover:bg-zinc-100/30 ${
                        isOutlier 
                          ? 'font-mono bg-rose-50/70 text-rose-600 font-extrabold border-rose-100' 
                          : isNumber ? 'font-mono text-zinc-700' : 'text-zinc-600'
                      } ${isNull ? 'italic text-zinc-300' : ''}`}
                      title={isOutlier ? "Valeur aberrante de la colonne (IQR). Double-cliquez pour la corriger !" : "Double-cliquez pour modifier"}
                    >
                      {isNull ? 'NaN' : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 text-center text-xs text-zinc-400 font-medium bg-zinc-50 border-t border-zinc-100">
        Aperçu des 100 premières lignes
      </div>

      <ColumnEditModal 
        column={editingCol} 
        onClose={() => setEditingCol(null)} 
      />

      <MissingValuesModal 
        column={missingValCol}
        onClose={() => setMissingValCol(null)}
      />

      <OutliersModal 
        column={outliersCol}
        onClose={() => setOutliersCol(null)}
      />
    </div>
  );
}
