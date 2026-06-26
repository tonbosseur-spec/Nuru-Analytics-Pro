import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { Table2, Filter, Layers, GitPullRequest, Maximize2, Edit2, Download, FileSpreadsheet, Check, X } from 'lucide-react';
import DataTable from './DataTable';
import FilterModal from './FilterModal';
import DuplicatesModal from './DuplicatesModal';
import PipelineSidebar from './PipelineSidebar';
import FullDataModal from './FullDataModal';
import VariableCalculatorModal from './VariableCalculatorModal';
import { Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import DatasetGeneratorModal from './DatasetGeneratorModal';
import { Upload, Plus, ChevronDown, Database as DBIcon, CheckCircle2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

export default function AppLayout() {
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const isGeneratorOpen = useWorkspaceStore((state) => state.isGeneratorOpen);
  const setIsGeneratorOpen = useWorkspaceStore((state) => state.setIsGeneratorOpen);
  const [isDatasetSelectorOpen, setIsDatasetSelectorOpen] = useState(false);
  const datasets = useWorkspaceStore((state) => state.datasets);
  const activeDatasetId = useWorkspaceStore((state) => state.activeDatasetId);
  const switchDataset = useWorkspaceStore((state) => state.switchDataset);
  const triggerImport = useWorkspaceStore((state) => state.triggerImport);

  const [exportFilename, setExportFilename] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  
  const previewData = useWorkspaceStore((state) => state.previewData);
  const datasetName = useWorkspaceStore((state) => state.datasetName);
  const rowCount = useWorkspaceStore((state) => state.rowCount);
  const colCount = useWorkspaceStore((state) => state.colCount);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);
  const openCurrentDatasetInManualEditor = useWorkspaceStore((state) => state.openCurrentDatasetInManualEditor);

  const handleOpenExport = () => {
    // Clean filename: remove trailing extension if present in datasetName
    let baseName = datasetName || 'jeu_de_donnees';
    if (baseName.endsWith('.csv') || baseName.endsWith('.xlsx') || baseName.endsWith('.xls')) {
      baseName = baseName.replace(/\.[^/.]+$/, "");
    }
    setExportFilename(`${baseName}_export`);
    setIsExportModalOpen(true);
  };

  const handleExport = async () => {
    if (!previewData || previewData.length === 0) {
      toast.error("Aucune donnée disponible pour l’export.");
      return;
    }

    const finalName = exportFilename.trim() || 'jeu_de_donnees_export';

    // 1. Desktop version: use native Python file dialog and saving
    if (window.pywebview && window.pywebview.api.export_dataset) {
      const result = await window.pywebview.api.export_dataset(finalName, exportFormat);
      if (result.success) {
        toast.success(result.message);
        setIsExportModalOpen(false);
      } else {
        toast.error(`Erreur d'exportation : ${result.error}`);
      }
      return;
    }

    // 2. Browser version: use client-side file-saver (existing logic)
    try {
      const cleanedData = previewData.map(row => {
        const newRow: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          if (!key.startsWith('__')) {
            newRow[key] = row[key];
          }
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(cleanedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Données");

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: exportFormat === 'xlsx' ? `${finalName}.xlsx` : `${finalName}.csv`,
            types: exportFormat === 'xlsx' 
              ? [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
              : [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
          });
          const writable = await handle.createWritable();
          
          if (exportFormat === 'xlsx') {
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
            await writable.write(blob);
          } else {
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
            const blob = new Blob(["\ufeff" + csvOutput], { type: 'text/csv;charset=utf-8;' });
            await writable.write(blob);
          }
          
          await writable.close();
          toast.success(`Jeu de données exporté avec succès !`);
          setIsExportModalOpen(false);
          return;
        } catch (err: any) {
          console.warn('File System Access API failed:', err);
          if (err.name === 'AbortError') return;
        }
      }

      if (exportFormat === 'xlsx') {
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, `${finalName}.xlsx`);
        toast.success(`Jeu de données exporté avec succès: ${finalName}.xlsx`);
      } else {
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(["\ufeff" + csvOutput], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${finalName}.csv`);
        toast.success(`Jeu de données exporté avec succès: ${finalName}.csv`);
      }
      setIsExportModalOpen(false);
    } catch (e: any) {
      toast.error(`Erreur d'exportation : ${e.message || e}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden">
      {/* HEADER TOP BAR */}
      <header className="h-14 border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 bg-white shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setIsDatasetSelectorOpen(!isDatasetSelectorOpen)}
              className="flex items-center gap-3 hover:bg-slate-50 px-2 py-1.5 -ml-2 rounded-lg transition-colors group text-left"
            >
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-md">
                <Table2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-semibold text-zinc-900 leading-tight flex items-center gap-1">
                    {datasetName}
                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </h1>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium">
                  {rowCount.toLocaleString()} Lignes • {colCount.toLocaleString()} Colonnes
                </p>
              </div>
            </button>
            
            {isDatasetSelectorOpen && (
               <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden text-sm">
                 <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-1">
                   <button onClick={() => { setIsDatasetSelectorOpen(false); triggerImport(); }} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-sm rounded-lg w-full text-left font-medium transition-all">
                     <Upload className="w-4 h-4 text-indigo-600" /> Importer un fichier
                   </button>
                   <button onClick={() => { setIsDatasetSelectorOpen(false); useWorkspaceStore.getState().triggerImportCrosstab(); }} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-sm rounded-lg w-full text-left font-medium transition-all">
                     <Table2 className="w-4 h-4 text-purple-600" /> Importer un tableau croisé
                   </button>
                   <button onClick={() => { setIsDatasetSelectorOpen(false); setIsGeneratorOpen(true); }} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-sm rounded-lg w-full text-left font-medium transition-all">
                     <DBIcon className="w-4 h-4 text-emerald-600" /> Générateur aléatoire
                   </button>
                 </div>
                 <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                   <div className="px-3 py-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">En mémoire</div>
                   {datasets.map(ds => (
                     <button
                       key={ds.id}
                       onClick={() => { setIsDatasetSelectorOpen(false); switchDataset(ds.id); }}
                       className={`flex items-center justify-between px-3 py-2 w-full text-left rounded-lg transition-colors ${activeDatasetId === ds.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                     >
                        <div className="truncate pr-2 font-medium">{ds.name}</div>
                        {activeDatasetId === ds.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />}
                     </button>
                   ))}
                   {datasets.length === 0 && <div className="px-3 py-2 text-slate-500 text-xs italic">Aucun autre jeu de données.</div>}
                 </div>
               </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPipelineOpen(!isPipelineOpen)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors border ${isPipelineOpen ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border-zinc-200'}`}
            title="Afficher/Masquer le pipeline"
          >
            <GitPullRequest className="w-4 h-4 text-current" />
            <span className="hidden sm:inline">Pipeline</span>
          </button>
          
          <button 
            onClick={() => useWorkspaceStore.getState().setFullDataModalOpen(true)}
            className="flex items-center justify-center text-sm font-medium p-1.5 rounded-lg transition-colors border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            title="Vue complète (deux flèches)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button 
            id="btn-edit-dataset-manually"
            onClick={openCurrentDatasetInManualEditor}
            className="flex items-center justify-center text-sm font-medium p-1.5 rounded-lg transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 active:scale-95 transition-all duration-200"
            title="Modifier / Saisie Manuelle (crayon)"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button 
            id="btn-export-dataset"
            onClick={handleOpenExport}
            className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80 active:scale-95 transition-all duration-200"
            title="Exporter le jeu de données actuel au format CSV ou Excel"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span className="hidden lg:inline">Exporter le jeu de données</span>
            <span className="inline lg:hidden">Exporter</span>
          </button>

          <div className="w-px h-6 bg-zinc-200 mx-1"></div>

          <button 
            onClick={() => useWorkspaceStore.getState().setFilterModalOpen(true)}
            className="flex items-center justify-center text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded-lg transition-colors border border-zinc-200"
            title="Filtrer"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button 
            id="btn-formula-calculator"
            onClick={() => useWorkspaceStore.getState().setCalculatorModalOpen(true)}
            className="flex items-center gap-1.5 justify-center text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 p-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
            title="Calculer une nouvelle variable (Calculatrice)"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline text-xs">Calculatrice</span>
          </button>
          
          <div className="w-px h-6 bg-zinc-200 mx-1"></div>

          <button 
            onClick={resetWorkspace}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Fermer
          </button>
        </div>
      </header>

      {/* SPREADSHEET AREA */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <DataTable />
        <div className={`transition-all duration-300 ${isPipelineOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
           <PipelineSidebar />
        </div>
      </div>
      
      <FilterModal />
      <DuplicatesModal />
      <FullDataModal />
      <VariableCalculatorModal 
        isOpen={useWorkspaceStore((state) => state.isCalculatorModalOpen)} 
        onClose={() => useWorkspaceStore.getState().setCalculatorModalOpen(false)} 
      />

      {/* EXPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative overflow-hidden flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 bg-blue-50 border border-blue-150 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Exporter le jeu de données</h3>
                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Format d'exportation externe</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-450 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Filename Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nom du fichier exporté</label>
                <input 
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50/50"
                  placeholder="nom_du_fichier"
                />
              </div>

              {/* Format Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Format d'export (avec encodage UTF-8)</label>
                <div className="grid grid-cols-2 gap-3.5">
                  <button 
                    type="button"
                    onClick={() => setExportFormat('xlsx')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left ${exportFormat === 'xlsx' ? 'bg-blue-50/30 border-blue-500 text-blue-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                  >
                    <div>
                      <p className="text-xs font-bold">Microsoft Excel</p>
                      <p className="text-[9px] text-slate-400">Format riche .xlsx</p>
                    </div>
                    {exportFormat === 'xlsx' && (
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <Check className="w-2.5 h-2.5 text-current stroke-[3px]" />
                      </div>
                    )}
                  </button>

                  <button 
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left ${exportFormat === 'csv' ? 'bg-blue-50/30 border-blue-500 text-blue-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-650'}`}
                  >
                    <div>
                      <p className="text-xs font-bold font-sans">Valeurs Séparées (CSV)</p>
                      <p className="text-[9px] text-slate-400">Fichier brut .csv</p>
                    </div>
                    {exportFormat === 'csv' && (
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <Check className="w-2.5 h-2.5 text-current stroke-[3px]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="flex-1 py-3 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                onClick={handleExport}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10 cursor-pointer active:scale-98 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
