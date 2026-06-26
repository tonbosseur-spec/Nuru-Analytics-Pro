import React, { useState } from 'react';
import { X, Plus, Trash2, Database, Play } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';

interface VarConfig {
  id: string;
  name: string;
  type: string;
  modalities?: string;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
}

export default function DatasetGeneratorModal({ onClose }: { onClose: () => void }) {
  const [numRows, setNumRows] = useState(100);
  const [variables, setVariables] = useState<VarConfig[]>([
    { id: '1', name: 'Sexe', type: 'qualitative', modalities: 'Homme, Femme' },
    { id: '2', name: 'Age', type: 'quantitative_normal', mean: 35, std: 10 },
  ]);
  const [loading, setLoading] = useState(false);

  const addVar = () => {
    setVariables([...variables, { id: Math.random().toString(), name: `Var${variables.length + 1}`, type: 'quantitative_normal', mean: 0, std: 1 }]);
  };

  const removeVar = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
  };
  
  const updateVar = (id: string, field: keyof VarConfig, value: any) => {
    setVariables(variables.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const generate = async () => {
    if (variables.length === 0) return toast.error("Ajoutez au moins une variable.");
    const api = getApi();
    if (!api.generate_random_dataset) return toast.error("Générateur non disponible");
    
    setLoading(true);
    try {
      const res = await api.generate_random_dataset({
        num_rows: numRows,
        variables: variables
      });
      if (res.success) {
        toast.success("Jeu de données simulé avec succès !");
        
        // Add to datasets and select it
        const newDs = {
          id: res.dataset_id,
          name: res.name || "Données simulées",
          rowCount: res.row_count,
          colCount: res.col_count,
          columns: res.columns,
          preview: res.preview
        };
        
        useWorkspaceStore.setState((state) => ({
          datasets: [newDs, ...state.datasets],
          activeDatasetId: newDs.id,
          isReady: true,
          datasetName: newDs.name,
          rowCount: res.row_count,
          colCount: res.col_count,
          columns: res.columns,
          previewData: res.preview,
          history: [],
          pipeline: []
        }));
        
        onClose();
      } else {
        toast.error("Erreur gènèration: " + res.error);
      }
    } catch(e) {
      toast.error("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Générateur de Données</h2>
              <p className="text-sm text-slate-500 font-medium">Créer un jeu de données aléatoire</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre de Lignes (Observations)</label>
            <input 
              type="number" min="10" max="100000" 
              value={numRows} onChange={e => setNumRows(Number(e.target.value))}
              className="w-full sm:w-1/3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-slate-100 pb-2">
              <label className="block text-sm font-semibold text-slate-700">Définition des variables</label>
              <button onClick={addVar} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md">
                <Plus className="w-4 h-4"/> Ajouter Variable
              </button>
            </div>
            
            {variables.map((v, i) => (
              <div key={v.id} className="grid grid-cols-12 gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="col-span-3">
                  <label className="text-xs text-slate-500 font-medium block mb-1">Nom</label>
                  <input value={v.name} onChange={e => updateVar(v.id, 'name', e.target.value)} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                </div>
                <div className="col-span-4">
                  <label className="text-xs text-slate-500 font-medium block mb-1">Distribution</label>
                  <select value={v.type} onChange={e => updateVar(v.id, 'type', e.target.value)} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md bg-white outline-none">
                    <option value="qualitative">Qualitative (Modalités)</option>
                    <option value="quantitative_normal">Quantitative (Normale)</option>
                    <option value="quantitative_uniform">Quantitative (Uniforme)</option>
                  </select>
                </div>
                
                <div className="col-span-4">
                  {v.type === 'qualitative' ? (
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Modalités (séparées par virgule)</label>
                      <input value={v.modalities} onChange={e => updateVar(v.id, 'modalities', e.target.value)} placeholder="Ex: Oui, Non" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                    </div>
                  ) : v.type === 'quantitative_normal' ? (
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="text-xs text-slate-500 font-medium block mb-1">Moyenne</label>
                        <input type="number" value={v.mean} onChange={e => updateVar(v.id, 'mean', Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                      </div>
                      <div className="w-1/2">
                        <label className="text-xs text-slate-500 font-medium block mb-1">Écart-Type</label>
                        <input type="number" min="0" value={v.std} onChange={e => updateVar(v.id, 'std', Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="text-xs text-slate-500 font-medium block mb-1">Min</label>
                        <input type="number" value={v.min} onChange={e => updateVar(v.id, 'min', Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                      </div>
                      <div className="w-1/2">
                        <label className="text-xs text-slate-500 font-medium block mb-1">Max</label>
                        <input type="number" value={v.max} onChange={e => updateVar(v.id, 'max', Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-md outline-none" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="col-span-1 flex items-end justify-center pb-1.5">
                   <button onClick={() => removeVar(v.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                     <Trash2 className="w-4 h-4"/>
                   </button>
                </div>
              </div>
            ))}

            {variables.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-slate-100 italic">
                Aucune variable.
              </p>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">
            Annuler
          </button>
          <button onClick={generate} disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
            <Play className="w-4 h-4"/> 
            {loading ? 'Génération...' : 'Générer Données'}
          </button>
        </div>
      </div>
    </div>
  );
}
