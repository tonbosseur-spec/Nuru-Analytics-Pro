import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { 
  FileSpreadsheet, 
  X, 
  Layers, 
  Settings2, 
  Check, 
  Heading, 
  ChevronRight, 
  Eye, 
  CheckSquare, 
  Square,
  AlertCircle
} from 'lucide-react';

export default function SmartExcelPreprocessModal() {
  const isOpen = useWorkspaceStore((state) => state.isSmartExcelModalOpen);
  const filePath = useWorkspaceStore((state) => state.smartExcelFilePath);
  const sheetName = useWorkspaceStore((state) => state.smartExcelSheetName);
  const preview = useWorkspaceStore((state) => state.smartExcelPreview);
  const loadSmartExcelPreview = useWorkspaceStore((state) => state.loadSmartExcelPreview);
  const finalizeSmartExcelImport = useWorkspaceStore((state) => state.finalizeSmartExcelImport);
  const setSmartExcelModalOpen = (isOpen: boolean) => {
    useWorkspaceStore.setState({ isSmartExcelModalOpen: isOpen });
  };

  // Preprocessing Settings State
  const [manualHeader, setManualHeader] = useState<number | null>(null);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number>(0);
  const [excludeCols, setExcludeCols] = useState<string[]>([]);

  // Update preview when settings change
  useEffect(() => {
    if (isOpen && filePath) {
      // Sync local selected_block with state
      if (preview && preview.selected_block !== selectedBlockIdx) {
        setSelectedBlockIdx(preview.selected_block);
      }
    }
  }, [preview]);

  if (!isOpen || !preview || !filePath) return null;

  const fileName = filePath.split('\\').pop()?.split('/').pop() || 'Classeur.xlsx';

  const handleTweakParam = async (tweakHeader: number | null, blockIdx: number, excludedList: string[]) => {
    await loadSmartExcelPreview(filePath, sheetName, tweakHeader, blockIdx, excludedList);
  };

  const toggleExcludeColumn = (colName: string) => {
    let newList;
    if (excludeCols.includes(colName)) {
      newList = excludeCols.filter(c => c !== colName);
    } else {
      newList = [...excludeCols, colName];
    }
    setExcludeCols(newList);
    handleTweakParam(manualHeader, selectedBlockIdx, newList);
  };

  const selectBlock = (idx: number) => {
    setSelectedBlockIdx(idx);
    handleTweakParam(manualHeader, idx, excludeCols);
  };

  const changeHeaderRow = (rowStr: string) => {
    if (rowStr === '') {
      setManualHeader(null);
      handleTweakParam(null, selectedBlockIdx, excludeCols);
    } else {
      const rowNum = parseInt(rowStr, 10);
      if (!isNaN(rowNum) && rowNum >= 0) {
        setManualHeader(rowNum);
        handleTweakParam(rowNum, selectedBlockIdx, excludeCols);
      }
    }
  };

  const handleFinalImport = () => {
    finalizeSmartExcelImport(manualHeader, selectedBlockIdx, excludeCols);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header des modules */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900 text-lg">Smart Excel Preprocessing Module</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                  Nuru AI Native
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                Fichier original : <span className="text-zinc-700 font-semibold">{fileName}</span>
                {sheetName ? <> &bull; Feuille : <span className="text-zinc-700 font-semibold">{sheetName}</span></> : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSmartExcelModalOpen(false)}
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-1.5 rounded-lg hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps principal : 2 colonnes */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
          
          {/* Panneau de configuration (Gauche) */}
          <div className="col-span-1 border-r border-zinc-200 p-5 overflow-y-auto bg-zinc-50/50 space-y-5">
            
            {/* Titres / Header Déchets Détectés */}
            {preview.titles && preview.titles.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                  <Heading className="w-4 h-4" />
                  <span>En-têtes bruts nettoyés ({preview.titles.length})</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Lignes parasites supprimées automatiquement au-dessus du tableau :
                </p>
                <div className="space-y-1 max-h-[80px] overflow-y-auto">
                  {preview.titles.map((title, tIdx) => (
                    <div key={tIdx} className="text-[11px] bg-amber-100/40 text-amber-900 border border-amber-200/50 px-2 py-1 rounded truncate italic">
                      &ldquo;{title}&rdquo;
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ligne En-tête (Header Row) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-zinc-500" />
                DÉSIGNATION DE L'EN-TÊTE
              </label>
              <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-none space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Ligne d'en-tête (0-indexé)</span>
                  <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    Par défaut : {preview.detected_header_row}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Auto (détecté)"
                    value={manualHeader !== null ? manualHeader : ''}
                    onChange={(e) => changeHeaderRow(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {manualHeader !== null && (
                    <button
                      onClick={() => {
                        setManualHeader(null);
                        handleTweakParam(null, selectedBlockIdx, excludeCols);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1.5"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  * Nuru a automatiquement détecté la ligne {preview.detected_header_row} comme en-tête. Modifiez si nécessaire.
                </p>
              </div>
            </div>

            {/* Émetteurs Spécifiques / Multi-blocs de données détectés */}
            {preview.blocks && preview.blocks.length > 0 && (
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-zinc-500" />
                  SOUS-TABLEAUX UNIQUES ({preview.blocks.length})
                </label>
                <div className="space-y-2">
                  {preview.blocks.map((block) => {
                    const isSelected = selectedBlockIdx === block.index;
                    return (
                      <button
                        key={block.index}
                        onClick={() => selectBlock(block.index)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                          isSelected 
                            ? 'bg-green-50 border-green-400 shadow-sm' 
                            : 'bg-white border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                          isSelected ? 'bg-green-600 text-white border-transparent' : 'border-zinc-300 text-zinc-500'
                        }`}>
                          {itemIndexText(block.index)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isSelected ? 'text-green-900' : 'text-zinc-700'}`}>
                            {block.name || `Bloc #${block.index}`}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                            <span>Lignes: {block.nb_rows}</span>
                            <span>&bull;</span>
                            <span>Lignes {block.start_idx}-{block.end_idx}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-green-600 shrink-0 self-center" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filtre de colonnes à exclure */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-zinc-800">
                SÉLECTION DES VARIABLES ({preview.columns.length})
              </label>
              <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2 max-h-[220px] overflow-y-auto">
                <p className="text-[10px] text-zinc-400">Décochez les colonnes à ignorer pour l'import final :</p>
                <div className="space-y-1.5">
                  {preview.columns.map((col) => {
                    const isExcluded = excludeCols.includes(col.name);
                    return (
                      <button
                        key={col.name}
                        onClick={() => toggleExcludeColumn(col.name)}
                        className="w-full flex items-center gap-2.5 text-left py-1 px-1.5 rounded hover:bg-zinc-50 text-xs text-zinc-700"
                      >
                        {isExcluded ? (
                          <Square className="w-4 h-4 text-zinc-300 shrink-0" />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
                        )}
                        <span className={`truncate font-medium flex-1 ${isExcluded ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                          {col.name}
                        </span>
                        {!isExcluded && (
                          <span className="text-[10px] text-zinc-400 uppercase bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                            {translateMeasureType(col.type)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Aperçu du tableau nettoyé (Droite) */}
          <div className="col-span-2 flex flex-col overflow-hidden bg-zinc-900">
            
            {/* En-tête de l'aperçu */}
            <div className="px-5 py-3.5 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-green-400" />
                <h4 className="font-bold text-sm tracking-wide">APERÇU STATISTIQUE NETTOYÉ CONTRE-CONTRÔLÉ</h4>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 font-semibold">
                <span>Colonnes retenues: <span className="text-white">{preview.nb_columns}</span></span>
                <span>Lignes d'observation: <span className="text-green-400">{preview.nb_rows_detected}</span></span>
              </div>
            </div>

            {/* Tableaux de données */}
            <div className="flex-1 overflow-auto p-4 content-scrollbar">
              {preview.sample_data && preview.sample_data.length > 0 ? (
                <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/80 border-b border-zinc-700 text-zinc-300">
                        <th className="p-2.5 border-r border-zinc-700 font-bold text-center text-zinc-500 w-12">#</th>
                        {preview.columns.filter(c => !excludeCols.includes(c.name)).map(col => (
                          <th key={col.name} className="p-2.5 border-r border-zinc-700 font-bold text-zinc-200">
                            <div className="truncate">{col.name}</div>
                            <div className="text-[10px] text-green-400 uppercase font-medium mt-0.5">
                              {translateMeasureType(col.type)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample_data.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 transition-colors">
                          <td className="p-2.5 bg-zinc-800/40 border-r border-zinc-700 font-semibold text-center text-zinc-500">
                            {rIdx + 1}
                          </td>
                          {preview.columns.filter(c => !excludeCols.includes(c.name)).map(col => (
                            <td key={col.name} className="p-2.5 border-r border-zinc-700/60 truncate font-mono text-zinc-400 max-w-[150px]">
                              {formatValue(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2 py-10">
                  <AlertCircle className="w-10 h-10 text-zinc-500" />
                  <p className="font-semibold text-sm">Aucune donnée disponible</p>
                  <p className="text-xs text-zinc-500">Veuillez vérifier les filtres ou la ligne d'en-tête sélectionnée.</p>
                </div>
              )}
            </div>

            {/* Pied de page d'informations */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 text-[10px] text-zinc-400 shrink-0 font-medium">
              &bull; Les types d'observations ({preview.columns.map(c => c.name).join(', ')}) ont été indexés à l'aide de filtres statistiques. Le détecteur élimine automatiquement les notes de bas de page.
            </div>

          </div>

        </div>

        {/* Pied de page général (Actions) */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 font-medium">
            Prêt pour validation dans le moteur analytique Nuru Analytics.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSmartExcelModalOpen(false)}
              className="px-4 py-2 border border-zinc-300 hover:border-zinc-400 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all font-semibold text-sm"
            >
              Annuler les modifications
            </button>
            <button
              onClick={handleFinalImport}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-bold text-sm flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Valider l'importation propre
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Helpers
function itemIndexText(idx: number): string {
  // Convert 0, 1, 2 to A, B, C
  return String.fromCharCode(65 + idx);
}

function translateMeasureType(type: string): string {
  switch (type) {
    case 'nominal': return 'nominal';
    case 'ordinal': return 'ordinal';
    case 'continuous': return 'continu';
    case 'discrete': return 'discret';
    case 'datetime': return 'datetime';
    default: return type;
  }
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
  return String(val);
}
