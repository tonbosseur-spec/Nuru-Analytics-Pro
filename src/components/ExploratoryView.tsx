import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import { 
  Compass, 
  Search, 
  Settings2, 
  Save, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Activity, 
  HelpCircle, 
  BookOpen, 
  Maximize2, 
  Download,
  Info
} from 'lucide-react';

type CorrelationMethod = 'pearson' | 'spearman';

interface CorrelationCell {
  colA: string;
  colB: string;
  r: number;
  n: number;
}

export default function ExploratoryView() {
  const decimals = useWorkspaceStore((state) => state.decimals);
  const columns = useWorkspaceStore((state) => state.columns) || [];
  const previewDataFromStore = useWorkspaceStore((state) => state.previewData) || [];
  const addAnalysisResult = useWorkspaceStore((state) => state.addAnalysisResult);

  const [method, setMethod] = useState<CorrelationMethod>('pearson');
  const [searchVar, setSearchVar] = useState('');
  const [fullDataset, setFullDataset] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColA, setSelectedColA] = useState<string | null>(null);
  const [selectedColB, setSelectedColB] = useState<string | null>(null);
  const [minStrength, setMinStrength] = useState<number>(0.1);

  // Identify numeric columns
  const numericColumns = useMemo(() => {
    return columns.filter(c => c.type === 'continuous' || c.type === 'discrete');
  }, [columns]);

  // Track checked/selected variables for the matrix
  const [selectedVars, setSelectedVars] = useState<string[]>([]);

  // Initialize selected variables to all numeric columns on load or change
  useEffect(() => {
    const names = numericColumns.map(c => c.name);
    setSelectedVars(names);
    if (names.length >= 2) {
      setSelectedColA(names[0]);
      setSelectedColB(names[1]);
    } else {
      setSelectedColA(null);
      setSelectedColB(null);
    }
  }, [numericColumns]);

  // Fetch full dataset for precision analysis on load
  const loadFullData = async () => {
    setIsLoading(true);
    const api = getApi();
    if (!api) {
      setFullDataset(previewDataFromStore);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get_full_dataset();
      if (res && res.success && res.data) {
        setFullDataset(res.data);
      } else {
        setFullDataset(previewDataFromStore);
      }
    } catch (e) {
      console.warn("Retrying with preview data...", e);
      setFullDataset(previewDataFromStore);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFullData();
  }, [previewDataFromStore]);

  const activeData = fullDataset || previewDataFromStore;

  // Helper functions for rank computation to support Spearman
  const getRanks = (values: number[]): number[] => {
    const indexed = values.map((val, idx) => ({ val, originalIdx: idx }));
    indexed.sort((a, b) => a.val - b.val);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].val === indexed[i].val) {
        j++;
      }
      const sumPositions = ((i + 1) + j) * (j - i) / 2;
      const avgRank = sumPositions / (j - i);
      for (let k = i; k < j; k++) {
        ranks[indexed[k].originalIdx] = avgRank;
      }
      i = j;
    }
    return ranks;
  };

  // Pairwise calculations keeping track of N
  const matrixCells: CorrelationCell[] = useMemo(() => {
    if (activeData.length === 0 || selectedVars.length === 0) return [];

    const cells: CorrelationCell[] = [];

    for (let i = 0; i < selectedVars.length; i++) {
      for (let j = 0; j < selectedVars.length; j++) {
        const colA = selectedVars[i];
        const colB = selectedVars[j];

        if (colA === colB) {
          cells.push({ colA, colB, r: 1.0, n: activeData.length });
          continue;
        }

        // Filter valid pairwise rows
        const valA: number[] = [];
        const valB: number[] = [];

        for (const row of activeData) {
          const rawA = row[colA];
          const rawB = row[colB];

          if (rawA !== null && rawA !== undefined && rawB !== null && rawB !== undefined) {
            const numA = Number(rawA);
            const numB = Number(rawB);

            if (!isNaN(numA) && !isNaN(numB)) {
              valA.push(numA);
              valB.push(numB);
            }
          }
        }

        const n = valA.length;
        if (n < 2) {
          cells.push({ colA, colB, r: 0, n });
          continue;
        }

        if (method === 'pearson') {
          let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
          for (let k = 0; k < n; k++) {
            sumX += valA[k];
            sumY += valB[k];
            sumXY += valA[k] * valB[k];
            sumXX += valA[k] * valA[k];
            sumYY += valB[k] * valB[k];
          }
          const num = n * sumXY - sumX * sumY;
          const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
          const r = den === 0 ? 0 : num / den;
          cells.push({ colA, colB, r, n });
        } else {
          // Spearman
          const rankX = getRanks(valA);
          const rankY = getRanks(valB);

          let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
          for (let k = 0; k < n; k++) {
            sumX += rankX[k];
            sumY += rankY[k];
            sumXY += rankX[k] * rankY[k];
            sumXX += rankX[k] * rankX[k];
            sumYY += rankY[k] * rankY[k];
          }
          const num = n * sumXY - sumX * sumY;
          const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
          const r = den === 0 ? 0 : num / den;
          cells.push({ colA, colB, r, n });
        }
      }
    }

    return cells;
  }, [activeData, selectedVars, method]);

  // Filter vars by search
  const filteredVars = selectedVars.filter(v => 
    v.toLowerCase().includes(searchVar.toLowerCase())
  );

  // Group top correlations sorted by absolute strength
  const topCorrelations = useMemo(() => {
    const list: { colA: string; colB: string; r: number; absR: number; n: number }[] = [];
    const seen = new Set<string>();

    for (const cell of matrixCells) {
      if (cell.colA === cell.colB) continue;
      
      const key1 = `${cell.colA}_##_${cell.colB}`;
      const key2 = `${cell.colB}_##_${cell.colA}`;

      if (seen.has(key1) || seen.has(key2)) continue;
      seen.add(key1);

      const absR = Math.abs(cell.r);
      if (absR >= minStrength) {
        list.push({
          colA: cell.colA,
          colB: cell.colB,
          r: cell.r,
          absR,
          n: cell.n
        });
      }
    }

    return list.sort((a, b) => b.absR - a.absR);
  }, [matrixCells, minStrength]);

  // Color mapper helper for matrix cells
  const getCellBg = (r: number) => {
    if (isNaN(r)) return 'rgba(241, 245, 249, 1)'; // slate-100
    if (r === 1) return 'rgb(249, 115, 22)'; // Absolute peak
    if (r > 0) {
      // Warm Red/Orange
      return `rgba(249, 115, 22, ${r.toFixed(3)})`;
    } else {
      // Cool Blue/Indigo
      return `rgba(59, 130, 246, ${Math.abs(r).toFixed(3)})`;
    }
  };

  // Helper for text color contrast inside heatmap
  const getCellTextColor = (r: number) => {
    if (isNaN(r)) return 'text-slate-400';
    if (Math.abs(r) > 0.45) return 'text-white font-bold';
    return 'text-slate-900 dark:text-slate-100 font-semibold';
  };

  const getStrengthLabel = (r: number) => {
    const absVal = Math.abs(r);
    let str = "";
    if (absVal >= 0.8) str = "Très forte";
    else if (absVal >= 0.6) str = "Forte";
    else if (absVal >= 0.4) str = "Modérée";
    else if (absVal >= 0.2) str = "Faible";
    else str = "Nulle ou négligeable";

    const dir = r >= 0 ? "positive" : "négative";
    return `${str} (${dir})`;
  };

  // Scatter plot SVG rendering helper
  const scatterPlotDetails = useMemo(() => {
    if (!selectedColA || !selectedColB || activeData.length === 0) return null;

    const xVals: number[] = [];
    const yVals: number[] = [];
    const originalPoints: { x: number; y: number }[] = [];

    for (const row of activeData) {
      const rawX = row[selectedColA];
      const rawY = row[selectedColB];

      if (rawX !== null && rawX !== undefined && rawY !== null && rawY !== undefined) {
        const numX = Number(rawX);
        const numY = Number(rawY);
        if (!isNaN(numX) && !isNaN(numY)) {
          xVals.push(numX);
          yVals.push(numY);
          originalPoints.push({ x: numX, y: numY });
        }
      }
    }

    if (xVals.length < 2) return null;

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    // Padding sizes
    const rangeX = maxX - minX || 1.0;
    const rangeY = maxY - minY || 1.0;

    const paddingX = rangeX * 0.08;
    const paddingY = rangeY * 0.08;

    const limitMinX = minX - paddingX;
    const limitMaxX = maxX + paddingX;
    const limitMinY = minY - paddingY;
    const limitMaxY = maxY + paddingY;

    // Standard linear regression computation
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = xVals.length;
    for (let i = 0; i < n; i++) {
      sumX += xVals[i];
      sumY += yVals[i];
      sumXY += xVals[i] * yVals[i];
      sumXX += xVals[i] * xVals[i];
    }

    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const predY = slope * xVals[i] + intercept;
      ssTot += Math.pow(yVals[i] - meanY, 2);
      ssRes += Math.pow(yVals[i] - predY, 2);
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return {
      points: originalPoints,
      limitMinX,
      limitMaxX,
      limitMinY,
      limitMaxY,
      slope,
      intercept,
      r2,
      n
    };
  }, [selectedColA, selectedColB, activeData]);

  // Toggle checklist utilities
  const handleToggleVar = (name: string) => {
    if (selectedVars.includes(name)) {
      setSelectedVars(prev => prev.filter(v => v !== name));
    } else {
      setSelectedVars(prev => [...prev, name]);
    }
  };

  const handleSelectAll = () => {
    setSelectedVars(numericColumns.map(c => c.name));
  };

  const handleSelectNone = () => {
    setSelectedVars([]);
  };

  // SVG Scalers
  const getSvgCoords = (x: number, y: number, width: number, height: number, details: any) => {
    const rx = (x - details.limitMinX) / (details.limitMaxX - details.limitMinX);
    const ry = (y - details.limitMinY) / (details.limitMaxY - details.limitMinY);

    // SVG coordinates (0,0 is top-left, we want standard Cartesian bottom-left)
    const margin = 40;
    const svgX = margin + rx * (width - margin * 2);
    const svgY = height - margin - ry * (height - margin * 2);

    return { x: svgX, y: svgY };
  };

  const handleSaveToHistory = () => {
    if (matrixCells.length === 0) {
      toast.error("Aucune corrélation à sauvegarder.");
      return;
    }

    // Build highly professional interpretation string
    let reportText = `# Rapport d'Analyse Exploratoire des Corrélations\n\n`;
    reportText += `**Méthode de calcul :** Coefficient de corrélation de **${method === 'pearson' ? 'Pearson (linéaire)' : 'Spearman (rangs)'}**.\n`;
    reportText += `**Date de l'analyse :** ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}\n`;
    reportText += `**Taille globale de l'échantillon :** N = **${activeData.length}** observations.\n\n`;

    reportText += `### 📈 Synthèse des Relations Significatives\n\n`;
    reportText += `Le filtre d'association configuré à $r \\ge ${minStrength}$ a détecté **${topCorrelations.length}** liaisons d'intérêt :\n\n`;

    if (topCorrelations.length === 0) {
      reportText += `*Aucune corrélation supérieure au seuil minimal spécifié d'intensité.*\n`;
    } else {
      topCorrelations.slice(0, 10).forEach((tc, idx) => {
        const sign = tc.r >= 0 ? '↗️ positive' : '↘️ négative';
        reportText += `${idx + 1}. **${tc.colA}** × **${tc.colB}** : $r = ${tc.r.toFixed(4)}$ (${getStrengthLabel(tc.r)}, liaison ${sign}, $N = ${tc.n}$)\n`;
      });
    }

    reportText += `\n### 📝 Grille de la Matrice Réduite (Top-5 variables)\n\n`;
    const topVariables = selectedVars.slice(0, 5);
    if (topVariables.length > 0) {
      reportText += `| Variable | ${topVariables.join(' | ')} |\n`;
      reportText += `| :--- | ${topVariables.map(() => ':---:').join(' | ')} |\n`;
      for (const vA of topVariables) {
        const rowVals = topVariables.map(vB => {
          const match = matrixCells.find(c => c.colA === vA && c.colB === vB);
          return match ? match.r.toFixed(3) : '-';
        });
        reportText += `| **${vA}** | ${rowVals.join(' | ')} |\n`;
      }
    }

    reportText += `\n### 💡 Recommandation pour la modélisation\n`;
    const strongRelations = topCorrelations.filter(tc => Math.abs(tc.r) >= 0.7);
    if (strongRelations.length > 0) {
      reportText += `⚠️ **Attention au risque de multi-colinéarité** ! Une ou plusieurs paires de variables présentent une corrélation extrêmement élevée (ex. ${strongRelations.slice(0, 2).map(sr => `${sr.colA}/${sr.colB} (r=${sr.r.toFixed(2)})`).join(', ')}). Si vous envisagez de lancer une régression linéaire multiple, veillez à ne pas inclure ces variables simultanément sans vérifier l'indicateur VIF (Variance Inflation Factor).\n`;
    } else {
      reportText += `✅ Les corrélations entre predictors potentiels sont modérées ou faibles. Le risque de colinéarité pour vos futures régressions semble maîtrisé sur ce set de variables actives.\n`;
    }

    addAnalysisResult({
      id: `exploratory_${Date.now()}`,
      title: `Matrice de Corrélation (${method === 'pearson' ? 'Pearson' : 'Spearman'})`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: 'bivariate', // Store under bivariate structure so it fits exactly in ResultsDashboard
      variables: selectedVars,
      metrics: {
        pearson_r: method === 'pearson' ? 1.0 : undefined,
        spearman_rho: method === 'spearman' ? 1.0 : undefined,
        is_exploratory_correlation: true,
        correlation_matrix: matrixCells,
        method_used: method,
        variables_selected: selectedVars,
        top_correlations: topCorrelations.slice(0, 15)
      },
      interpretation: reportText
    });

    toast.success("Rapport d'exploration de corrélations sauvegardé dans l'Historique !");
  };

  const selectedPairCell = useMemo(() => {
    if (!selectedColA || !selectedColB) return null;
    return matrixCells.find(c => 
      (c.colA === selectedColA && c.colB === selectedColB) || 
      (c.colA === selectedColB && c.colB === selectedColA)
    );
  }, [matrixCells, selectedColA, selectedColB]);

  // Handle excel/csv markdown export
  const getMatrixMarkdown = () => {
    let md = `### Matrice de Corrélation d'Exploration (${method.toUpperCase()})\n\n`;
    md += `| Variable | ` + selectedVars.join(' | ') + ` |\n`;
    md += `| :--- | ` + selectedVars.map(() => ':---:').join(' | ') + ` |\n`;
    
    selectedVars.forEach(vA => {
      const cells = selectedVars.map(vB => {
        const item = matrixCells.find(c => c.colA === vA && c.colB === vB);
        return item ? item.r.toFixed(3) : '1.000';
      });
      md += `| **${vA}** | ` + cells.join(' | ') + ` |\n`;
    });
    
    return md;
  };

  const handleExportMarkdown = () => {
    const markdown = getMatrixMarkdown();
    navigator.clipboard.writeText(markdown);
    toast.success("Le tableau Markdown de la matrice a été copié dans le presse-papiers !");
  };

  if (numericColumns.length === 0) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
          Aucune Variable Quantitative Détectée
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Cette fonctionnalité requiert au moins deux colonnes quantitatives (continues ou discrètes) pour calculer des corrélations. Modifiez le format de vos colonnes dans <b>Préparation des données</b> si nécessaire.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      
      {/* View Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 shadow-sm">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-600 font-mono text-[9px] font-black uppercase tracking-widest">
                Pré-analyse
              </span>
              {isLoading && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Synchronisation complète...
                </span>
              )}
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-0.5">
              Analyse Exploratoire des Relations
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Détectez automatiquement les corrélations linéaires et non linéaires pour orienter vos futures hypothèses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Method Selector */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setMethod('pearson')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                ${method === 'pearson' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="Corrélation linéaire classique"
            >
              Pearson
            </button>
            <button
              onClick={() => setMethod('spearman')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                ${method === 'spearman' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="Corrélation d'ordre pour variables ordinales et non-linéaires"
            >
              Spearman
            </button>
          </div>

          <button
            onClick={handleExportMarkdown}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
            title="Copier le format Markdown de la table"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Copier Markdown</span>
          </button>

          <button
            onClick={handleSaveToHistory}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>Sauvegarder Rapport</span>
          </button>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-track]:bg-transparent">
        
        {/* Info panel */}
        <div className="p-4 bg-gradient-to-r from-orange-500/5 to-indigo-500/5 border border-orange-500/10 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Analyse des liaisons pairwise (par paire)
            </h4>
            <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              La matrice calcule dynamiquement les coefficients d'association pour chaque croisement. Cliquez sur une cellule de couleur pour inspecter graphiquement sa dispersion et tracer un modèle prédictif simple. Nous filtrons automatiquement les valeurs manquantes pour chaque couple afin de préserver la représentativité du calcul. Seuil de signalement configuré à <span className="font-black">|r| ≥ {minStrength}</span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* Left panel: Variable Selection & Filter */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col h-full max-h-[600px] overflow-hidden">
            <div className="shrink-0 mb-4">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-400" /> variables actives ({selectedVars.length})
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Cochez ou décochez les variables à inclure dans le calcul matriciel.
              </p>
            </div>

            {/* Variable search */}
            <div className="relative shrink-0 mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Chercher une colonne..."
                value={searchVar}
                onChange={(e) => setSearchVar(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none transition-all focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Selection actions */}
            <div className="flex gap-2 shrink-0 mb-4">
              <button 
                onClick={handleSelectAll}
                className="flex-1 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold text-[10px] uppercase hover:bg-slate-200 cursor-pointer"
              >
                Tous
              </button>
              <button 
                onClick={handleSelectNone}
                className="flex-1 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold text-[10px] uppercase hover:bg-slate-200 cursor-pointer"
              >
                Aucun
              </button>
            </div>

            {/* Checkbox columns list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-track]:bg-transparent">
              {numericColumns.map(col => {
                const isChecked = selectedVars.includes(col.name);
                return (
                  <label
                    key={col.name}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-all group
                      ${isChecked ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-500/10' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleVar(col.name)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer focus:ring-offset-0"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
                        {col.name}
                      </p>
                      <p className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                        {col.type === 'continuous' ? 'Continu' : 'Discret'} ({col.raw_dtype})
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Strength threshold filter */}
            <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <span>Signal d'intérêt r ≥</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{minStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.9"
                step="0.05"
                value={minStrength}
                onChange={(e) => setMinStrength(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          {/* Center/Main Panel: Heatmap matrix */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            
            {/* The Heatmap Grid Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    Matrice de corrélation ({method.toUpperCase()})
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Couleurs positives en <span className="text-amber-600 font-bold">Orange</span>, négatives en <span className="text-blue-500 font-bold">Bleu</span>. Cliquez sur un croisement pour afficher sa dispersion.
                  </p>
                </div>
              </div>

              {/* Grid drawing area */}
              {selectedVars.length < 2 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40">
                  <Activity className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sélectionnez au moins 2 variables</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Gérez le panneau latéral gauche de configuration pour générer la grille.</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-hidden border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-slate-50/30 p-2">
                  <div className="min-w-[450px]">
                    {/* Render table header with rotated labels or clean columns */}
                    <table className="w-full table-fixed border-collapse">
                      <thead>
                        <tr>
                          <th className="w-24 p-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Variable</th>
                          {selectedVars.map(v => (
                            <th 
                              key={v} 
                              className="p-2 text-center text-[9px] font-black font-sans text-slate-600 dark:text-slate-350 truncate hover:text-slate-900 dark:hover:text-white cursor-help transition-colors"
                              title={v}
                            >
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedVars.map(vA => (
                          <tr key={vA} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/10 transition-colors">
                            {/* Row signature */}
                            <td 
                              className="p-2 text-left text-[9px] font-black text-slate-700 dark:text-slate-300 truncate tracking-wide border-r border-slate-200 dark:border-slate-850"
                              title={vA}
                            >
                              {vA}
                            </td>
                            {/* Correlations */}
                            {selectedVars.map(vB => {
                              const cell = matrixCells.find(c => c.colA === vA && c.colB === vB);
                              const isSelf = vA === vB;
                              const isSelected = (selectedColA === vA && selectedColB === vB) || (selectedColA === vB && selectedColB === vA);

                              const rValue = cell ? cell.r : NaN;
                              const nValue = cell ? cell.n : 0;

                              return (
                                <td
                                  key={vB}
                                  onClick={() => {
                                    if (!isSelf) {
                                      setSelectedColA(vA);
                                      setSelectedColB(vB);
                                    }
                                  }}
                                  className={`p-1.5 text-center transition-all relative group cursor-pointer
                                    ${isSelf ? 'cursor-not-allowed' : 'hover:scale-[1.04]'}
                                    ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 z-10' : ''}
                                  `}
                                  style={{
                                    backgroundColor: isSelf ? 'transparent' : getCellBg(rValue)
                                  }}
                                >
                                  {isSelf ? (
                                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-700 font-mono">1.0</span>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-1">
                                      <span className={`text-[11px] leading-none ${getCellTextColor(rValue)} font-mono`}>
                                        {isNaN(rValue) ? '-' : rValue.toFixed(2)}
                                      </span>
                                      
                                      {/* Small mini-N helper */}
                                      <span className="text-[8px] scale-75 opacity-0 group-hover:opacity-100 absolute -bottom-1 bg-slate-900 border border-slate-800 text-slate-200 px-1 rounded transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                        N = {nValue}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Top relationships discovery card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex-1 flex flex-col max-h-[290px] overflow-hidden">
              <div className="shrink-0 mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                    🚀 découvertes significatives ({topCorrelations.length})
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Couples classés selon la force absolue de leur liaison.
                  </p>
                </div>
              </div>

              {topCorrelations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-slate-50/25">
                  <p className="text-xs text-slate-400 font-semibold italic">Aucune liaison supérieure au filtre d'intérêt.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-track]:bg-transparent">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                      <tr>
                        <th className="px-3 py-2">Variable A</th>
                        <th className="px-3 py-2">Variable B</th>
                        <th className="px-3 py-2">Direction / Force</th>
                        <th className="px-3 py-2 text-right">r ({method})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                      {topCorrelations.slice(0, 10).map((tc, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => {
                            setSelectedColA(tc.colA);
                            setSelectedColB(tc.colB);
                          }}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-950/25 cursor-pointer transition-colors
                            ${(selectedColA === tc.colA && selectedColB === tc.colB) ? 'bg-indigo-50/10' : ''}
                          `}
                        >
                          <td className="px-3 py-2 font-bold text-slate-850 dark:text-slate-200 truncate max-w-[120px]">{tc.colA}</td>
                          <td className="px-3 py-2 font-bold text-slate-850 dark:text-slate-200 truncate max-w-[120px]">{tc.colB}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 font-bold text-[10px] py-0.5 px-2 rounded-full
                              ${tc.r >= 0 
                                ? 'bg-amber-500/10 border border-amber-500/10 text-amber-600' 
                                : 'bg-blue-500/10 border border-blue-500/10 text-blue-500'
                              }
                            `}>
                              {tc.r >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                              <span>{getStrengthLabel(tc.r).split(' ')[0]}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                            {tc.r.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Interactive Scatter Plot */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col h-full h-min">
              <div className="mb-3">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-mono text-[9px] font-black uppercase tracking-widest">
                  Visualisation interactive
                </span>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                  🔍 Nuage de dispersion
                </h3>
              </div>

              {/* No pair selected */}
              {(!selectedColA || !selectedColB || !scatterPlotDetails) ? (
                <div className="py-24 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/40">
                  <Activity className="w-8 h-8 text-indigo-400/40 mb-2 animate-pulse" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Aucune variable sélectionnée</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Cliquez sur un croisement de la matrice pour générer le graphique.</p>
                </div>
              ) : (
                <div className="space-y-4 flex flex-col">
                  {/* Pair labels */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs">
                    <div className="flex items-center justify-between text-slate-500 gap-1 overflow-hidden">
                      <span className="font-extrabold text-slate-400">Axe X (A) :</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[120px]" title={selectedColA}>{selectedColA}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 gap-1 mt-1.5 overflow-hidden">
                      <span className="font-extrabold text-slate-400">Axe Y (B) :</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[120px]" title={selectedColB}>{selectedColB}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800/80 my-2 pt-2 flex justify-between font-mono font-bold text-[10px]">
                      <span className="text-slate-500">Coeff (r) :</span>
                      <span className="text-indigo-600 dark:text-indigo-450">{selectedPairCell ? selectedPairCell.r.toFixed(4) : '-'}</span>
                    </div>
                    <div className="flex justify-between font-mono font-bold text-[10px]">
                      <span className="text-slate-500">N apparié :</span>
                      <span className="text-slate-800 dark:text-slate-300">{scatterPlotDetails.n} paires</span>
                    </div>
                    <div className="flex justify-between font-mono font-bold text-[10px] mt-0.5">
                      <span className="text-slate-500">Coef Dét. (R²) :</span>
                      <span className="text-slate-800 dark:text-slate-300">{scatterPlotDetails.r2.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Render the custom SVG Scatterplot */}
                  <div className="relative aspect-square w-full rounded-2xl border border-slate-200 dark:border-slate-850 bg-slate-950/80 flex items-center justify-center overflow-hidden">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 300">
                      {/* Grid Lines */}
                      <line x1="40" y1="40" x2="40" y2="260" stroke="#1e293b" strokeWidth="1" />
                      <line x1="40" y1="260" x2="260" y2="260" stroke="#1e293b" strokeWidth="1" />
                      <line x1="40" y1="150" x2="260" y2="150" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                      <line x1="150" y1="40" x2="150" y2="260" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />

                      {/* Diagnostic Regression Trendline */}
                      {(() => {
                        const startX = scatterPlotDetails.limitMinX;
                        const endX = scatterPlotDetails.limitMaxX;
                        const startY = scatterPlotDetails.slope * startX + scatterPlotDetails.intercept;
                        const endY = scatterPlotDetails.slope * endX + scatterPlotDetails.intercept;

                        const startCoords = getSvgCoords(startX, startY, 300, 300, scatterPlotDetails);
                        const endCoords = getSvgCoords(endX, endY, 300, 300, scatterPlotDetails);

                        return (
                          <line
                            x1={startCoords.x}
                            y1={startCoords.y}
                            x2={endCoords.x}
                            y2={endCoords.y}
                            className="stroke-orange-500"
                            strokeWidth="1.5"
                            strokeDasharray="1"
                          />
                        );
                      })()}

                      {/* Points plotting */}
                      {scatterPlotDetails.points.map((p, idx) => {
                        const coords = getSvgCoords(p.x, p.y, 300, 300, scatterPlotDetails);
                        return (
                          <circle
                            key={idx}
                            cx={coords.x}
                            cy={coords.y}
                            r="3"
                            className="fill-indigo-500 stroke-indigo-950/60 hover:fill-orange-400 hover:r-5 cursor-crosshair transition-all"
                          >
                            <title>{`X: ${p.x.toFixed(decimals)}, Y: ${p.y.toFixed(decimals)}`}</title>
                          </circle>
                        );
                      })}

                      {/* Axis indicators */}
                      <text x="150" y="290" textAnchor="middle" className="fill-slate-500 font-bold text-[8px] uppercase tracking-wider">
                        {selectedColA.substring(0, 15)}
                      </text>
                      <text x="12" y="150" textAnchor="middle" transform="rotate(-90, 12, 150)" className="fill-slate-500 font-bold text-[8px] uppercase tracking-wider">
                        {selectedColB.substring(0, 15)}
                      </text>
                    </svg>
                  </div>

                  {/* Scientific interpretation details of the pair */}
                  <div className="p-3 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-500/10 rounded-2xl text-[11px] leading-relaxed">
                    <p className="text-slate-700 dark:text-slate-350 font-medium">
                      La liaison mesurée entre <b>{selectedColA}</b> et <b>{selectedColB}</b> est considérée comme <b>{getStrengthLabel(selectedPairCell?.r || 0)}</b>.
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Le coefficient de détermination indique que <b>{(scatterPlotDetails.r2 * 100).toFixed(1)}%</b> de la variance observée est explicable directement par cette relation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
