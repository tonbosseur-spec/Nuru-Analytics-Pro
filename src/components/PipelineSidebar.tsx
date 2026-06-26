import React from 'react';
import { useWorkspaceStore } from '../store';
import { Trash2, CheckCircle2, Circle, GitCommit, GitPullRequest, SearchX, Activity, Type, Hash, Layers, Binary, Calculator } from 'lucide-react';

export default function PipelineSidebar() {
  const pipeline = useWorkspaceStore((state) => state.pipeline);
  const togglePipelineStep = useWorkspaceStore((state) => state.togglePipelineStep);
  const removePipelineStep = useWorkspaceStore((state) => state.removePipelineStep);

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'imputation': return <SearchX className="w-4 h-4" />;
      case 'filter': return <Activity className="w-4 h-4" />;
      case 'math_transform': return <Hash className="w-4 h-4" />;
      case 'formula_calculator': return <Calculator className="w-4 h-4 text-indigo-500" />;
      case 'date_extract': return <Hash className="w-4 h-4" />;
      case 'string_clean': return <Type className="w-4 h-4" />;
      case 'remove_duplicates': return <Layers className="w-4 h-4" />;
      case 'binning': return <Hash className="w-4 h-4" />;
      case 'grouping': return <Layers className="w-4 h-4" />;
      case 'encoding': return <Binary className="w-4 h-4" />;
      default: return <GitCommit className="w-4 h-4" />;
    }
  };

  const getStepTitle = (step: any) => {
    switch (step.type) {
      case 'imputation': return `Imputation - ${step.columnName}`;
      case 'filter': return `Filtre - ${step.conditions?.length} conditions`;
      case 'math_transform': return `Calcul - ${step.operation}`;
      case 'formula_calculator': return `Calculatrice - ${step.newColumnName}`;
      case 'date_extract': return `Date - ${step.columnName}`;
      case 'string_clean': return `Texte - ${step.columnName}`;
      case 'remove_duplicates': return `Doublons supprimés`;
      case 'binning': return `Discrétisation - ${step.columnName}`;
      case 'grouping': return `Regroupement - ${step.columnName}`;
      case 'encoding': return `Encodage - ${step.columnName}`;
      default: return 'Transformation';
    }
  };

  const getStepDescription = (step: any) => {
    switch (step.type) {
      case 'imputation': return `Stratégie: ${step.strategy}`;
      case 'math_transform': return `Cible: ${step.newColumnName}`;
      case 'formula_calculator': return `Formule: ${step.formula}`;
      case 'date_extract': return `Extraction: ${step.datePart}`;
      case 'string_clean': return `Opération: ${step.operation}`;
      case 'remove_duplicates': return `Garder: ${step.duplicateKeep}`;
      case 'binning': return `Classes: ${step.numBins || 'auto'}`;
      case 'grouping': return `Nouvelle col: ${step.newColumnName || step.columnName}`;
      case 'encoding': return `Méthode: ${step.encodingMethod}`;
      default: return '';
    }
  };

  return (
    <div className="w-80 h-full border-l border-zinc-200 bg-zinc-50/50 flex flex-col shrink-0">
      <div className="p-4 border-b border-zinc-200 bg-white">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4" />
          Pipeline
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Séquence des transformations</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pipeline.length === 0 ? (
          <div className="text-sm text-zinc-400 text-center py-8 italic">
            Aucune transformation appliquée
          </div>
        ) : (
          pipeline.map((step, index) => (
            <div 
              key={step.id} 
              className={`bg-white border rounded-lg p-3 shadow-sm transition-all relative group ${!step.enabled ? 'border-zinc-200 opacity-60' : 'border-zinc-300'}`}
            >
              <div className="flex gap-3">
                <button 
                  onClick={() => togglePipelineStep(step.id, !step.enabled)}
                  className="mt-0.5 shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                  title={step.enabled ? "Désactiver l'étape" : "Activer l'étape"}
                >
                  {step.enabled ? <CheckCircle2 className="w-5 h-5 text-zinc-900" /> : <Circle className="w-5 h-5" />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-500">
                      {getStepIcon(step.type)}
                    </span>
                    <h3 className={`text-sm font-medium truncate ${!step.enabled ? 'line-through text-zinc-500' : 'text-zinc-900'}`}>
                      {getStepTitle(step)}
                    </h3>
                  </div>
                  
                  <p className="text-xs text-zinc-500 truncate">
                    {getStepDescription(step)}
                  </p>
                </div>
                
                <button 
                  onClick={() => removePipelineStep(step.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Supprimer l'étape"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Timeline dot connector */}
              {index < pipeline.length - 1 && (
                <div className="absolute left-5 top-full w-0.5 h-3 bg-zinc-200"></div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
