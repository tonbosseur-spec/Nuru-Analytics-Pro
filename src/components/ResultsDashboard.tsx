import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { Search, LineChart, Calendar, ChevronRight, Activity, PieChart, Layers, Type, Hash, MessageSquare, Trash2, Plus, X, Sparkles, Loader2, Folder, FolderOpen, ChevronDown, Edit, FileText, Info } from 'lucide-react';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import Plot from 'react-plotly.js';
import WordExportModal from './WordExportModal';
import CopyButton from './CopyButton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const alternativeTestsMap: Record<string, { id: string; name: string }> = {
  anova: { id: 'kruskal', name: 'Kruskal-Wallis' },
  ttest_ind: { id: 'mannwhitney', name: 'Mann-Whitney (U)' },
  ttest_paired: { id: 'wilcoxon_paired', name: 'Wilcoxon apparié' },
  pearson: { id: 'spearman', name: 'Corrélation de Spearman' },
  ttest_1samp: { id: 'wilcoxon_1samp', name: 'Wilcoxon signé' }
};

// Helper text formatter for markdown reports
const parseBoldText = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong 
          key={index} 
          className="font-extrabold text-indigo-950 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-400/10 font-sans"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const formatMathTeX = (text: string): string => {
  if (!text) return text;
  
  let formatted = text;
  
  // Replace direct LaTeX commands with unicode
  const replacements: { [key: string]: string } = {
    '\\ge': '≥',
    '\\le': '≤',
    '\\ne': '≠',
    '\\approx': '≈',
    '\\pm': '±',
    '\\times': '×',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\chi': 'χ',
    '\\mu': 'μ',
    '\\sigma': 'σ',
    '\\rho': 'ρ',
    '\\theta': 'θ',
    '\\lambda': 'λ',
    '\\pi': 'π',
    '\\delta': 'δ',
    '\\Delta': 'Δ',
    '\\chi^2': 'χ²',
    '\\chi²': 'χ²',
    '^2': '²',
    '_0': '₀',
    '_1': '₁',
    '_2': '₂',
    '_a': 'ₐ',
    '_t': 'ₜ',
  };

  Object.entries(replacements).forEach(([raw, replacement]) => {
    formatted = formatted.replaceAll(raw, replacement);
  });

  // Convert inline math $...$ into formatted bold/italic markdown
  // e.g. $r = 0.1761$ -> *r* = 0.1761
  formatted = formatted.replace(/\$([^$]+)\$/g, (match, p1) => {
    const trimmed = p1.trim();
    if (trimmed.length === 1 || (trimmed.length === 2 && trimmed.match(/^[a-zA-Z]/))) {
      return `*${trimmed}*`;
    }
    return trimmed.replace(/^([a-zA-Z])(\s*[=><≥≤].*)/, '*$1*$2');
  });

  return formatted;
};

const renderMarkdownDef = (text: string) => {
  if (!text) return null;
  
  const processedText = formatMathTeX(text);
  
  return (
    <div className="markdown-body select-text text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-black mt-6 mb-4 border-b-2 border-indigo-200 pb-2 uppercase tracking-wide text-slate-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-extrabold mt-6 mb-3 uppercase tracking-wider text-slate-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-black mt-6 mb-3 border-b border-indigo-100/60 pb-1.5 uppercase tracking-widest text-indigo-950 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[11px] font-black uppercase tracking-widest mt-5 mb-2.5 text-indigo-600 flex items-center gap-1.5">
              {children}
            </h4>
          ),
          strong: ({ children }) => {
            const childStr = String(children || '');
            if (childStr.startsWith('Type de Modèle :')) {
              return (
                <span className="inline-flex items-center gap-2 font-extrabold text-indigo-950 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 my-2 text-xs w-full">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  {children}
                </span>
              );
            }
            return (
              <strong className="font-extrabold text-indigo-950 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-400/10 font-sans">
                {children}
              </strong>
            );
          },
          p: ({ children }) => (
            <p className="text-[13px] leading-relaxed my-2 font-semibold text-slate-700">
              {children}
            </p>
          ),
          ul: ({ children }) => <ul className="my-3 space-y-1 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 space-y-1 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => (
            <li className="text-[13px] leading-relaxed font-semibold text-slate-700 my-1">
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border border-indigo-100 rounded-2xl bg-white shadow-sm max-w-full">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-indigo-50/70 border-b border-indigo-100 text-[10px] font-black text-indigo-950 uppercase tracking-wider">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-indigo-50/55">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-indigo-50/10 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-3 font-extrabold">{children}</th>,
          td: ({ children }) => (
            <td className="px-4 py-3 font-semibold text-slate-700 font-mono text-[11px] break-words">
              {children}
            </td>
          ),
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

const CrosstabViewer = ({ contingencyTable, topAssociations }: { contingencyTable: any[][]; topAssociations?: any[] }) => {
  const [activeTab, setActiveTab] = useState<'effectifs' | 'pourcentages' | 'cumules'>('effectifs');

  if (!contingencyTable || contingencyTable.length < 2 || !Array.isArray(contingencyTable[0])) {
    return <div className="text-slate-400 p-4 border border-slate-200 rounded-xl bg-slate-50">Structure de données croisées indisponible.</div>;
  }

  const matrix = contingencyTable as any[][];
  const rMax = matrix.length - 1;
  const cMax = matrix[0].length - 1;
  const grandTotal = parseFloat(matrix[rMax][cMax]) || 1;

  // 1. Pourcentages globaux Matrix
  const pourcentagesMatrix = matrix.map((row, i) => {
    if (i === 0) return row;
    return row.map((cell, j) => {
      if (j === 0) return cell;
      const count = parseFloat(cell);
      if (isNaN(count)) return cell;
      const pct = (count / grandTotal) * 100;
      return `${pct.toFixed(useWorkspaceStore.getState().decimals)}%`;
    });
  });

  // 2. Row Profile Cumulative Matrix
  // Accumulates cell-by-cell row-wise percentages
  const cumulesMatrix = matrix.map((row, i) => {
    if (i === 0) return row;
    if (i === rMax) {
      // For total row, compute cumulative columns
      let runningColTotal = 0;
      return row.map((cell, j) => {
        if (j === 0) return cell;
        if (j === cMax) return "100.00%";
        const count = parseFloat(cell) || 0;
        runningColTotal += count;
        return `${((runningColTotal / grandTotal) * 100).toFixed(useWorkspaceStore.getState().decimals)}%`;
      });
    }
    const rowTotal = parseFloat(matrix[i][cMax]) || 1;
    let runningRowTotal = 0;
    return row.map((cell, j) => {
      if (j === 0) return cell;
      if (j === cMax) return "100.00%";
      const count = parseFloat(cell) || 0;
      runningRowTotal += count;
      return `${((runningRowTotal / rowTotal) * 100).toFixed(useWorkspaceStore.getState().decimals)}%`;
    });
  });

  // 3. Flat Combinations list (for cumulative percentages)
  const combinations: { x: string; y: string; count: number; percentage: number }[] = [];
  for (let i = 1; i < rMax; i++) {
    const xVal = String(matrix[i][0]);
    for (let j = 1; j < cMax; j++) {
      const yVal = String(matrix[0][j]);
      const count = parseFloat(matrix[i][j]) || 0;
      const pct = (count / grandTotal) * 100;
      combinations.push({ x: xVal, y: yVal, count, percentage: pct });
    }
  }
  const sortedCombinations = [...combinations].sort((a, b) => b.count - a.count);
  let runningSum = 0;
  const cumulativeCombinations = sortedCombinations.map(c => {
    runningSum += c.percentage;
    return {
      ...c,
      cumulative: Math.min(runningSum, 100.0)
    };
  });

  return (
    <div className="space-y-4">
      {/* Tab Selectors */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('effectifs')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'effectifs'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-650 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Effectifs
        </button>
        <button
          onClick={() => setActiveTab('pourcentages')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'pourcentages'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-650 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Pourcentages
        </button>
        <button
          onClick={() => setActiveTab('cumules')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'cumules'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-650 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Cumulés
        </button>
      </div>

      {/* Render tables based on selection */}
      {activeTab === 'effectifs' && (
        <div className="animate-in fade-in duration-200">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <span>✨ Effectifs Observés (Table de contingence brute)</span>
            <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px] uppercase font-mono">Nombre de cas</span>
          </div>
          <div className="w-full overflow-auto bg-white rounded-xl border border-slate-200">
            <table className="w-full text-sm text-left border-collapse">
               <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i === 0 ? 'bg-slate-50 font-bold text-slate-700' : ''} ${i === rMax ? 'bg-slate-50 font-black border-t-2 border-slate-200' : ''}`}>
                      {row.map((cell, j) => (
                        <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-bold bg-slate-50 border-r border-slate-100 text-slate-700' : 'text-slate-600'} ${j === cMax ? 'font-bold bg-slate-50/50' : ''}`}>
                           {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pourcentages' && (
        <div className="animate-in fade-in duration-200">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <span>📊 Pourcentages Globaux (% par rapport au Total Général N={grandTotal})</span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-mono">% du total</span>
          </div>
          <div className="w-full overflow-auto bg-white rounded-xl border border-slate-200">
            <table className="w-full text-sm text-left border-collapse">
               <tbody>
                  {pourcentagesMatrix.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i === 0 ? 'bg-slate-50 font-bold text-slate-700' : ''} ${i === rMax ? 'bg-slate-50 font-black border-t-2 border-slate-200' : ''}`}>
                      {row.map((cell, j) => (
                        <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-bold bg-slate-50 border-r border-slate-100 text-slate-700' : 'text-slate-600'} ${j === cMax ? 'font-bold bg-slate-50/50' : ''}`}>
                           {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cumules' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Matrix Row cumulative percentages */}
          <div>
            <div className="text-xs font-semibold text-slate-550 mb-2 flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200/60">
              <span>📈 Pourcentages Cumulés en Ligne (Contribution cumulée de gauche à droite)</span>
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-mono">% cum. ligne</span>
            </div>
            <div className="w-full overflow-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left border-collapse">
                 <tbody>
                    {cumulesMatrix.map((row, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${i === 0 ? 'bg-slate-50 font-bold text-slate-700' : ''} ${i === rMax ? 'bg-slate-50 font-black border-t-2 border-slate-200' : ''}`}>
                        {row.map((cell, j) => (
                          <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-bold bg-slate-50 border-r border-slate-100 text-slate-700' : 'text-slate-600'} ${j === cMax ? 'font-bold bg-slate-50/50' : ''}`}>
                             {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                 </tbody>
              </table>
            </div>
          </div>

          {/* Flat sorted associations */}
          <div>
            <div className="text-xs font-semibold text-slate-550 mb-2 flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
              <span>📋 Distribution et Cumul global (Combinaisons triées par fréquence décroissante)</span>
              <span className="bg-indigo-50 text-indigo-755 px-2 py-0.5 rounded text-[10px] uppercase font-mono">% cum. global</span>
            </div>
            <div className="w-full overflow-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="px-4 py-2.5">Association (X × Y)</th>
                    <th className="px-4 py-2.5 text-right">Effectif</th>
                    <th className="px-4 py-2.5 text-right">Pourcentage</th>
                    <th className="px-4 py-2.5 text-right">Pourcentage Cumulé</th>
                  </tr>
                </thead>
                <tbody>
                  {cumulativeCombinations.map((c, i) => (
                    <tr key={i} className="border-b last:border-0 border-slate-100 hover:bg-slate-50/30">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{c.x} <span className="text-indigo-400">×</span> {c.y}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{c.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-650">{c.percentage.toFixed(useWorkspaceStore.getState().decimals)}%</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900 font-semibold">{c.cumulative.toFixed(useWorkspaceStore.getState().decimals)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {topAssociations && topAssociations.length > 0 && (
         <div className="grid gap-2 mt-4 pt-2 border-t border-slate-100">
            <h5 className="text-[11px] font-black text-slate-450 uppercase tracking-wider">Cumul des principales associations</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topAssociations.slice(0, 4).map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-slate-50/40 border border-slate-200 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 text-xs">{item.x_val}</span>
                    <span className="text-slate-400 text-xs">×</span>
                    <span className="font-bold text-slate-800 text-xs">{item.y_val}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono">{item.count} observations</span>
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">{item.total_percentage?.toFixed(useWorkspaceStore.getState().decimals) ?? '0.0'}%</span>
                  </div>
                </div>
              ))}
            </div>
         </div>
      )}
    </div>
  );
};

export default function ResultsDashboard() {
  const history = useWorkspaceStore((state) => state.history);
  const activeAnalysisId = useWorkspaceStore((state) => state.activeAnalysisId);
  const decimals = useWorkspaceStore((state) => state.decimals);
  const setActiveAnalysisId = useWorkspaceStore((state) => state.setActiveAnalysisId);
  const addAnnotation = useWorkspaceStore((state) => state.addAnnotation);
  const removeAnnotation = useWorkspaceStore((state) => state.removeAnnotation);
  const renameAnalysisResult = useWorkspaceStore((state) => state.renameAnalysisResult);
  const setAnalysisResultGroup = useWorkspaceStore((state) => state.setAnalysisResultGroup);
  const deleteAnalysisResult = useWorkspaceStore((state) => state.deleteAnalysisResult);

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editGroup, setEditGroup] = useState('');

  const [annotationText, setAnnotationText] = useState('');
  const [annotationX, setAnnotationX] = useState(0.5);
  const [annotationY, setAnnotationY] = useState(0.5);
  const [annotationArrow, setAnnotationArrow] = useState(true);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [isRunningAlternative, setIsRunningAlternative] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const addAnalysisResult = useWorkspaceStore((state) => state.addAnalysisResult);

  const handleRunAlternativeTest = async (altTestId: string, colX: string, colY: string | undefined, originalArgs: any) => {
    setIsRunningAlternative(true);
    try {
      const api = getApi();
      const testNames: Record<string, string> = {
        'kruskal': 'Kruskal-Wallis',
        'mannwhitney': 'Mann-Whitney (U)',
        'wilcoxon_paired': 'Wilcoxon apparié',
        'spearman': 'Corrélation de Spearman',
        'wilcoxon_1samp': 'Wilcoxon signé'
      };
      const testName = testNames[altTestId] || altTestId;
      
      const res = await api.run_statistical_test(altTestId, {
        col_x: colX,
        col_y: colY || null,
        mu: originalArgs?.mu || 0,
        alternative: originalArgs?.alternative || 'two-sided',
        group1: originalArgs?.group1 || '',
        group2: originalArgs?.group2 || '',
        post_hoc: originalArgs?.post_hoc || 'none',
        center: originalArgs?.center || 'median'
      });

      if (res.success) {
        addAnalysisResult({
          id: Math.random().toString(36).substr(2, 9),
          title: `Alternative : ${testName} (${colX}${colY ? ' × ' + colY : ''})`,
          timestamp: new Date().toISOString(),
          type: colY ? 'bivariate' : 'univariate',
          variables: colY ? [colX, colY] : [colX],
          metrics: { 
            test_result: res.result, 
            test_id: altTestId,
            test_params: {
              col_x: colX,
              col_y: colY || null,
              mu: originalArgs?.mu || 0,
              alternative: originalArgs?.alternative || 'two-sided',
              group1: originalArgs?.group1 || '',
              group2: originalArgs?.group2 || '',
              post_hoc: originalArgs?.post_hoc || 'none',
              center: originalArgs?.center || 'median'
            },
            qq_plot: res.qq_plot || null,
            pp_plot: res.pp_plot || null,
            residuals_hist: res.residuals_hist || null,
            residuals_plot: res.residuals_plot || null
          },
          interpretation: res.interpretation || "",
          chart: res.chart || null,
          group: activeAnalysis?.group || undefined
        });
        toast.success(`Le test alternatif ${testName} a été exécuté avec succès !`);
      } else {
        toast.error("Échec du calcul alternatif : " + res.error);
      }
    } catch (err: any) {
      toast.error("Une erreur s'est produite lors de l'exécution : " + err.message);
    } finally {
      setIsRunningAlternative(false);
    }
  };

  const PRESET_POSITIONS = [
    { label: 'Haut Gauche', x: 0.15, y: 0.85 },
    { label: 'Haut Milieu', x: 0.5, y: 0.85 },
    { label: 'Haut Droite', x: 0.85, y: 0.85 },
    { label: 'Milieu', x: 0.5, y: 0.5 },
    { label: 'Bas Gauche', x: 0.15, y: 0.15 },
    { label: 'Bas Milieu', x: 0.5, y: 0.15 },
    { label: 'Bas Droite', x: 0.85, y: 0.15 },
  ];

  const handleSimulate = () => {
    const addResult = useWorkspaceStore.getState().addAnalysisResult;
    
    // Simulate Quantitative Univariate
    addResult({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Profil univarié: Âge (Simulé)',
      timestamp: new Date().toISOString(),
      type: 'univariate',
      variables: ['Âge'],
      metrics: {
        mean: 35.4,
        median: 34,
        std_dev: 12.3,
        cv_percent: 34.7,
        min: 18,
        max: 65,
        q1: 26,
        q3: 42
      },
      interpretation: "L'âge moyen de l'échantillon est de 35.4 ans avec un écart-type de 12.3 ans, indiquant une dispersion modérée. 50% de la population a entre 26 et 42 ans.",
      chart: {
        data: [{
          x: [18, 26, 34, 42, 65, 30, 25, 40, 35, 29, 31, 33, 44, 28, 55, 60, 22, 24, 38, 48],
          type: "histogram",
          marker: { color: "#4f46e5" } // Indigo 600
        }],
        layout: { 
          title: "Distribution de l'Âge", 
          xaxis: { title: "Âge" }, 
          yaxis: { title: "Fréquence" },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        }
      }
    });

    // Simulate Qualitative Univariate
    addResult({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Profil univarié: Sexe (Simulé)',
      timestamp: new Date().toISOString(),
      type: 'univariate',
      variables: ['Sexe'],
      metrics: {
        num_unique: 2,
        mode: 'Femme',
        frequency_table: [
          { category: 'Femme', count: 120, percentage: 60.0, cumulative_percentage: 60.0 },
          { category: 'Homme', count: 80, percentage: 40.0, cumulative_percentage: 100.0 }
        ]
      },
      interpretation: "La modalité la plus fréquente est 'Femme' représentant 60% de l'échantillon.",
      chart: {
        data: [{
          labels: ['Femme', 'Homme'],
          values: [120, 80],
          type: "pie",
          marker: { colors: ["#4f46e5", "#818cf8"] } // Indigo
        }],
        layout: { 
          title: "Répartition par Sexe",
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        }
      }
    });

    // Simulate Bivariate Quant x Quant
    addResult({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Croisement: Âge x Revenu (Simulé)',
      timestamp: new Date().toISOString(),
      type: 'bivariate',
      variables: ['Âge', 'Revenu'],
      metrics: {
        pearson_r: 0.78,
        spearman_rho: 0.75,
        covariance: 145000.5
      },
      interpretation: "Il existe une forte corrélation positive (r = 0.78) entre l'âge et le revenu. Les individus plus âgés ont tendance à avoir des revenus plus élevés.",
      chart: {
        data: [{
          x: [25, 30, 35, 40, 45, 50, 55, 60],
          y: [30000, 35000, 45000, 52000, 58000, 65000, 70000, 75000],
          mode: 'markers',
          type: 'scatter',
          marker: { color: "#4f46e5", size: 10 }
        }],
        layout: { 
          title: "Relation Âge et Revenu", 
          xaxis: { title: "Âge" }, 
          yaxis: { title: "Revenu (€)" },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        }
      }
    });

    // Simulate Bivariate Qual x Qual
    addResult({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Croisement: Statut x Niveau Etude (Simulé)',
      timestamp: new Date().toISOString(),
      type: 'bivariate',
      variables: ['Statut', 'Niveau Etude'],
      metrics: {
        contingency_table: [
          ['', 'Bac', 'Licence', 'Master', 'Doctorat', 'Total'],
          ['Ouvrier', 25, 5, 0, 0, 30],
          ['Employé', 15, 30, 5, 0, 50],
          ['Cadre', 0, 10, 45, 10, 65],
          ['Total', 40, 45, 50, 10, 145]
        ],
        top_associations_percentages: [
          { x_val: "Cadre", y_val: "Master", count: 45, total_percentage: 31.0 },
          { x_val: "Employé", y_val: "Licence", count: 30, total_percentage: 20.7 },
          { x_val: "Ouvrier", y_val: "Bac", count: 25, total_percentage: 17.2 }
        ]
      },
      interpretation: "La combinaison la plus fréquente est 'Cadre' avec un 'Master'. Les profils sont globalement liés au niveau de diplôme."
    });
  };

  const filteredHistory = history.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.variables.some(v => v.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.group && item.group.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedAnalyses = React.useMemo(() => {
    const groups: Record<string, typeof filteredHistory> = {};
    filteredHistory.forEach(item => {
      const g = item.group || 'Analyses Générales (Non classées)';
      if (!groups[g]) {
        groups[g] = [];
      }
      groups[g].push(item);
    });
    return groups;
  }, [filteredHistory]);

  const existingGroups = React.useMemo(() => {
    return Array.from(new Set(history.map(h => h.group).filter(Boolean))) as string[];
  }, [history]);

  const activeAnalysis = history.find(h => h.id === activeAnalysisId);

  const renderRegressionMetrics = (metrics: any) => {
    if (!metrics) return null;

    const isLinear = metrics.regression_type?.startsWith('linear');
    const isMultinomial = metrics.regression_type === 'logistic_multinomial';
    const isBinary = metrics.regression_type === 'logistic_binary';

    return (
      <div className="space-y-6 w-full mb-6">
        {/* 1. Global Model Performance Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLinear ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">R-Deux (R²)</span>
                <span className="text-xl font-extrabold text-indigo-600 tracking-tight">
                  {metrics.r_squared !== undefined ? `${(metrics.r_squared * 100).toFixed(decimals)}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">Variance expliquée</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">R² Ajusté</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {metrics.r_squared_adj !== undefined ? `${(metrics.r_squared_adj * 100).toFixed(decimals)}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">Ajusté selon les prédicteurs</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Erreur Type Résiduelle</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {metrics.residual_std_error !== undefined ? metrics.residual_std_error.toFixed(decimals) : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">RSE (Ecart-type des résidus)</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Test de Fisher (F)</span>
                <span className="text-xl font-extrabold text-emerald-600 tracking-tight">
                  {metrics.f_statistic !== undefined ? metrics.f_statistic.toFixed(decimals) : 'N/A'}
                </span>
                <span className="text-[9px] text-emerald-700/80 font-bold mt-1 block truncate">
                  p = {metrics.f_p_value < 0.001 ? '<0.001' : metrics.f_p_value?.toFixed(decimals)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Exactitude (Accuracy)</span>
                <span className="text-xl font-extrabold text-emerald-600 tracking-tight">
                  {metrics.accuracy !== undefined ? `${metrics.accuracy}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">Prédictions correctes</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Pseudo R² (McFadden)</span>
                <span className="text-xl font-extrabold text-indigo-600 tracking-tight font-mono font-mono">
                  {metrics.pseudo_r2 !== undefined ? `${(metrics.pseudo_r2 * 100).toFixed(decimals)}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">Ajustement log-vraisemblance</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Critère d'AIC</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight font-mono font-mono">
                  {metrics.aic !== undefined ? metrics.aic : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">Plus bas = Meilleur compromis</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                  {isBinary ? 'Aire (AUC ROC)' : 'Taille Échantillon'}
                </span>
                <span className="text-xl font-extrabold text-slate-950 tracking-tight font-mono font-mono font-bold">
                  {isBinary ? (metrics.auc !== undefined ? metrics.auc.toFixed(decimals) : 'N/A') : (metrics.n || 'N/A')}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">
                  {isBinary ? 'Pouvoir discriminant' : 'Observations valides'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 2. Coefficients Table */}
        {metrics.coefficients && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                Coefficients Estimés du Modèle
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">N = {metrics.n ?? 'N/A'} observations</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Variable</th>
                    {isMultinomial && (
                      <th className="py-2.5 px-3">Catégorie cible</th>
                    )}
                    <th className="py-2.5 px-3 text-right">Coefficient (β)</th>
                    <th className="py-2.5 px-3 text-right">Erreur Type</th>
                    {!isLinear && (
                      <th className="py-2.5 px-3 text-right">Odds Ratio (OR)</th>
                    )}
                    <th className="py-2.5 px-3 text-right">z/t-stat</th>
                    <th className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1 group relative cursor-help">
                        p-value
                        <Info className="w-3 h-3 text-slate-400" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none normal-case tracking-normal shadow-lg text-left">
                          Indique la probabilité que le coefficient soit obtenu par hasard. &lt; 0.05 signifie que la variable a un effet significatif.
                          <div className="absolute w-2 h-2 bg-slate-800 rotate-45 -bottom-1 right-4 border-r border-b border-transparent"></div>
                        </div>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">Intervalle Conf. (95%)</th>
                    <th className="py-2.5 px-3 text-center">Sig.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {metrics.coefficients.map((coeff: any, idx: number) => {
                    const pVal = coeff.p_value;
                    const isSig = pVal < 0.05;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{coeff.variable}</td>
                        {isMultinomial && (
                          <td className="py-3 px-3 text-indigo-600 font-bold bg-indigo-50/30">{coeff.class} (vs {coeff.reference})</td>
                        )}
                        <td className="py-3 px-3 text-right font-mono">{coeff.coefficient !== undefined && coeff.coefficient !== null ? coeff.coefficient.toFixed(decimals) : '-'}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">{coeff.std_error !== undefined && coeff.std_error !== null ? coeff.std_error.toFixed(decimals) : '-'}</td>
                        {!isLinear && (
                          <td className="py-3 px-3 text-right font-bold text-indigo-900 font-mono bg-emerald-50/30 font-bold">
                            {coeff.odds_ratio !== undefined ? coeff.odds_ratio.toFixed(decimals) : '-'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right font-mono text-slate-500">{coeff.statistic !== undefined && coeff.statistic !== null ? coeff.statistic.toFixed(decimals) : '-'}</td>
                        <td className={`py-3 px-3 text-right font-bold font-mono ${isSig ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {pVal < 0.001 ? '<0.001' : pVal !== undefined && pVal !== null ? pVal.toFixed(decimals) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400 text-[10px]">
                          {coeff.ci_lower !== undefined && coeff.ci_lower !== null ? `[${coeff.ci_lower.toFixed(decimals)} ; ${coeff.ci_upper.toFixed(decimals)}]` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-indigo-500 tracking-tighter text-xs">
                          {coeff.significance || (pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[9px] text-slate-400 font-bold flex gap-4">
              <span>*** p &lt; 0.001 | ** p &lt; 0.01 | * p &lt; 0.05</span>
            </div>
          </div>
        )}

        {/* 3. Regression Visual Charts Display */}
        {(metrics.chart || metrics.roc_chart || metrics.actual_vs_predicted || metrics.qq_plot) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metrics.chart && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-2 font-black">
                  📉 {isLinear ? "Droite d'Ajustement Linéaire" : "Courbe Logistique Ajustée"}
                </span>
                <div className="h-72">
                  <Plot
                    data={metrics.chart.data}
                    layout={{
                      ...metrics.chart.layout,
                      autosize: true,
                      margin: { t: 30, r: 20, l: 50, b: 40 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                </div>
              </div>
            )}

            {isBinary && metrics.roc_chart && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-2 font-black">
                  🎭 Courbe ROC Discriminante (AUC = {metrics.auc})
                </span>
                <div className="h-72">
                  <Plot
                    data={metrics.roc_chart.data}
                    layout={{
                      ...metrics.roc_chart.layout,
                      autosize: true,
                      margin: { t: 30, r: 20, l: 50, b: 40 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                </div>
              </div>
            )}

            {isLinear && metrics.actual_vs_predicted && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-2 font-black">
                  🧬 Valeurs Observées vs Prédites
                </span>
                <div className="h-72">
                  <Plot
                    data={metrics.actual_vs_predicted.data}
                    layout={{
                      ...metrics.actual_vs_predicted.layout,
                      autosize: true,
                      margin: { t: 30, r: 20, l: 50, b: 40 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                </div>
              </div>
            )}

            {metrics.qq_plot && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-2 font-black">
                  📊 Normalité des erreurs : Q-Q Plot
                </span>
                <div className="h-72">
                  <Plot
                    data={metrics.qq_plot.data}
                    layout={{
                      ...metrics.qq_plot.layout,
                      autosize: true,
                      margin: { t: 30, r: 20, l: 50, b: 40 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Diagnostics & Assomptions */}
        {metrics.diagnostics && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-3 bg-teal-500 rounded-full" />
              Vérification des conditions de validité (Prémisses)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {metrics.diagnostics.shapiro_p !== undefined && (
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-all">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 leading-tight block">Normalité des Résidus (Shapiro-Wilk)</span>
                    <span className="text-[10px] text-slate-500 block">p = {metrics.diagnostics.shapiro_p < 0.001 ? '<0.001' : metrics.diagnostics.shapiro_p.toFixed(decimals)}</span>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border shrink-0 ${
                    metrics.diagnostics.shapiro_p >= 0.05 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                      : 'bg-rose-50 text-rose-800 border-rose-200/60'
                  }`}>
                    {metrics.diagnostics.shapiro_p >= 0.05 ? '🟢 Validé' : '🔴 Écart de normalité'}
                  </span>
                </div>
              )}

              {metrics.diagnostics.bp_p !== undefined && (
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-all">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 leading-tight block">Homoscédasticité (Breusch-Pagan)</span>
                    <span className="text-[10px] text-slate-500 block">p = {metrics.diagnostics.bp_p < 0.001 ? '<0.001' : metrics.diagnostics.bp_p.toFixed(decimals)}</span>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border shrink-0 ${
                    metrics.diagnostics.bp_p >= 0.05 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                      : 'bg-rose-50 text-rose-800 border-rose-200/60'
                  }`}>
                    {metrics.diagnostics.bp_p >= 0.05 ? '🟢 Homogène (H0)' : '🔴 Non homogène (H1)'}
                  </span>
                </div>
              )}

              {metrics.diagnostics.dw_stat !== undefined && (
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-all">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 leading-tight block">Indépendance des erreurs (Durbin-Watson)</span>
                    <span className="text-[10px] text-slate-500 block">DW = {metrics.diagnostics.dw_stat.toFixed(decimals)} (cible ~ 2.0)</span>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border shrink-0 ${
                    metrics.diagnostics.dw_stat >= 1.5 && metrics.diagnostics.dw_stat <= 2.5
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                      : 'bg-rose-50 text-rose-800 border-rose-200/60'
                  }`}>
                    {metrics.diagnostics.dw_stat >= 1.5 && metrics.diagnostics.dw_stat <= 2.5 ? '🟢 Validé' : '🔴 Autocorrélation suspectée'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMetrics = (metrics: any, type: string, variables: string[]) => {
    if (!metrics) return null;

    if (metrics.isRegression) {
      return renderRegressionMetrics(metrics);
    }

    if (metrics.test_result !== undefined) {
      // Statistical Test Result (univariate and bivariate)
      const res = metrics.test_result;
      const isSig = res.p_value < useWorkspaceStore.getState().alpha;

      return (
        <div className="space-y-6 w-full mb-6 text-slate-700">
          {/* Hypotheses and Verdict Card */}
          <div className={`border rounded-2xl p-5 shadow-sm transition-all duration-300 relative overflow-hidden bg-white ${
            isSig ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 bg-white'
          }`}>
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Décision Statistique (Seuil α = 5%)</span>
                {isSig ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    H₀ Rejetée (Différence/Relation significative)
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    H₀ Non Rejetée (Pas de différence/relation significative)
                  </div>
                )}
                <div className="text-xs text-slate-500 pt-1">
                  {res.decision || 'Décision basée sur la p-value.'}
                </div>
              </div>
              
              {/* Significance badge */}
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                isSig 
                  ? 'bg-emerald-55 border-emerald-200 text-emerald-700' 
                  : 'bg-slate-55 border-slate-200 text-slate-500'
              }`}>
                {isSig ? 'p < 0.05 (H1)' : 'p ≥ 0.05 (H0)'}
              </span>
            </div>

            {/* Hypotheses text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-100 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Hypothèse Nulle (H₀)
                </div>
                <p className="text-slate-700 text-xs italic font-medium leading-relaxed">
                  {res.h0 || 'Il n’y a aucun effet de différence ou d’association.'}
                </p>
              </div>
              
              <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-50/50">
                <div className="font-semibold text-indigo-500 text-xs uppercase tracking-wider mb-1">
                  Hypothèse Alternative (H₁)
                </div>
                <p className="text-indigo-950 text-xs italic font-medium leading-relaxed">
                  {res.h1 || 'Il existe un effet de différence ou d’association significatif.'}
                </p>
              </div>
            </div>
          </div>

          {/* Core Statistics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1 group relative cursor-help w-max">
                P-Value
                <Info className="w-3 h-3 text-slate-400" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none normal-case tracking-normal shadow-lg">
                  La p-value (ou valeur p) indique la probabilité d'obtenir ces résultats sous l'hypothèse nulle (hasard). Une valeur p &lt; {res.test_params?.alpha || '0.05'} suggère que vos résultats sont statistiquement significatifs.
                  <div className="absolute w-2 h-2 bg-slate-800 rotate-45 -bottom-1 left-4 border-r border-b border-transparent"></div>
                </div>
              </span>
              <span className={`text-lg font-extrabold tracking-tight ${isSig ? 'text-emerald-600' : 'text-slate-900'}`}>
                {res.p_value === 0 ? '0.00000' : res.p_value < 0.0001 ? res.p_value.toExponential(4) : res.p_value.toFixed(decimals)}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 block">Risque critique α d'erreur</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Statistique du Test</span>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                {res.statistic?.toFixed(decimals) ?? 'N/A'}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 block">Valeur théorique critique</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">D.D.L (df)</span>
              <span className="text-lg font-extrabold text-slate-950 tracking-tight">
                {res.df !== undefined && res.df !== null ? (typeof res.df === 'number' ? res.df.toFixed(0) : String(res.df)) : 'N/A'}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 block">Degrés de liberté libres</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Taille de l'effet</span>
              <span className="text-lg font-extrabold text-indigo-600 tracking-tight truncate" title={res.effect_size_name || 'Effect Size'}>
                {res.effect_size !== undefined && res.effect_size !== null ? res.effect_size.toFixed(decimals) : 'N/A'}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 block truncate">
                {res.effect_size_name || "Indicateur d'amplitude"}
              </span>
            </div>
          </div>

          {/* Assumptions & Hypothesis Checks */}
          {res.assumptions && res.assumptions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                Vérification des Hypothèses d'Application
              </h4>
              <div className="space-y-2">
                {res.assumptions.map((check: any, idx: number) => {
                  let statusColor = 'bg-slate-100 text-slate-800 border-slate-200';
                  let statusText = 'Note';
                  if (check.status === 'validated') {
                    statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
                    statusText = '🟢 Validé';
                  } else if (check.status === 'violated') {
                    statusColor = 'bg-rose-50 text-rose-800 border-rose-200/60';
                    statusText = '🔴 Non conforme';
                  } else if (check.status === 'warning') {
                    statusColor = 'bg-amber-50 text-amber-800 border-amber-200/60';
                    statusText = '⚠️ Risqué';
                  }
                  
                  return (
                    <div key={idx} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 leading-tight block">{check.name}</span>
                        <span className="text-xs text-slate-500 leading-normal block">{check.details}</span>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border shrink-0 ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Direct 1-Click Alternate Nonparametric Suggestion */}
              {metrics.test_id && alternativeTestsMap[metrics.test_id] && res.assumptions.some((check: any) => check.status === 'violated' || check.status === 'warning') && (
                <div className="mt-4 p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl flex items-start gap-3.5 shadow-sm shadow-amber-500/5 animate-in fade-in slide-in-from-top-1">
                  <div className="text-amber-500 text-lg leading-none shrink-0 select-none">⚠️</div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                      Condition Théorique Violée
                    </h5>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                      Les conditions de validité théoriques de ce test paramétrique (normalité ou égalité des variances) ne sont pas satisfaites. 
                      Nous vous suggérons d'exécuter l'équivalent non paramétrique robuste.
                    </p>
                    <button
                      onClick={() => handleRunAlternativeTest(
                        alternativeTestsMap[metrics.test_id].id,
                        activeAnalysis.variables[0],
                        activeAnalysis.variables[1],
                        metrics.test_params || {}
                      )}
                      disabled={isRunningAlternative}
                      className="mt-2 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl transition-all shadow-md shadow-amber-600/15 disabled:opacity-50 text-left"
                    >
                      {isRunningAlternative ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Calcul alternatif en cours...
                        </>
                      ) : (
                        <>
                          🔄 Lancer le test alternatif de {alternativeTestsMap[metrics.test_id].name} en 1 clic
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chi-Deux Goodness of Fit detailed distribution */}
          {res.case_details && res.case_details.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden text-slate-700">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                Distribution détaillée des effectifs (Observés vs Attendus)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 rounded-l-lg">Catégorie (Modalité)</th>
                      <th className="px-3 py-2 text-right">Eff. Observé (O)</th>
                      <th className="px-3 py-2 text-right">Prop. Observée (%)</th>
                      <th className="px-3 py-2 text-right">Eff. Attendue (E)</th>
                      <th className="px-3 py-2 text-right">Prop. Attendue (%)</th>
                      <th className="px-3 py-2 text-right rounded-r-lg">Efficacité / Résidu (O - E)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {res.case_details.map((c: any, index: number) => {
                      const resVal = parseFloat(c.residual);
                      return (
                        <tr key={index} className="hover:bg-slate-50/50 transition-all font-semibold">
                          <td className="px-3 py-2.5 text-slate-800 font-sans font-bold">{c.category}</td>
                          <td className="px-3 py-2.5 text-right text-slate-750 font-sans">{c.observed}</td>
                          <td className="px-3 py-2.5 text-right text-indigo-600 font-sans">{c.observed_pct}</td>
                          <td className="px-3 py-2.5 text-right text-slate-750 font-sans">{c.expected}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500 font-sans">{c.expected_pct}</td>
                          <td className={`px-3 py-2.5 text-right font-sans font-bold ${resVal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {resVal >= 0 ? `+${c.residual}` : c.residual}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Additional calculations (Group Summaries) */}
          {res.extra_info && Object.keys(res.extra_info).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-slate-700">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                Statistiques Descriptives & Paramètres Estimés ({res.n ? `N = ${res.n}` : 'Échantillon'})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(res.extra_info).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all text-xs">
                    <span className="font-medium text-slate-500">{key}</span>
                    <span className="font-bold text-slate-800">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Q-Q Plot and P-P Plot rendering for normality tests or other metrics */}
          {(metrics.qq_plot || metrics.pp_plot) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {metrics.qq_plot && (
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm h-80 flex flex-col justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2 font-black">Q-Q Plot</h4>
                  <div className="h-64">
                    <Plot
                      data={metrics.qq_plot.data}
                      layout={{
                        ...metrics.qq_plot.layout,
                        autosize: true,
                        margin: { t: 10, r: 10, l: 40, b: 40 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        showlegend: false
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false, responsive: true }}
                    />
                  </div>
                </div>
              )}
              {metrics.pp_plot && (
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm h-80 flex flex-col justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2 font-black">P-P Plot</h4>
                  <div className="h-64">
                    <Plot
                      data={metrics.pp_plot.data}
                      layout={{
                        ...metrics.pp_plot.layout,
                        autosize: true,
                        margin: { t: 10, r: 10, l: 40, b: 40 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        showlegend: false
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false, responsive: true }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Plots Rendering for ANOVA models */}
          {(metrics.residuals_plot || metrics.residuals_hist) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {metrics.residuals_hist && (
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm h-80 flex flex-col justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2 font-black">Histogramme des Résidus</h4>
                  <div className="h-64">
                    <Plot
                      data={metrics.residuals_hist.data}
                      layout={{
                        ...metrics.residuals_hist.layout,
                        autosize: true,
                        margin: { t: 10, r: 10, l: 40, b: 40 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        showlegend: false
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false, responsive: true }}
                    />
                  </div>
                </div>
              )}
              {metrics.residuals_plot && (
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm h-80 flex flex-col justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2 font-black">Résidus vs Prédits</h4>
                  <div className="h-64">
                    <Plot
                      data={metrics.residuals_plot.data}
                      layout={{
                        ...metrics.residuals_plot.layout,
                        autosize: true,
                        margin: { t: 10, r: 10, l: 40, b: 40 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        showlegend: false
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false, responsive: true }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post Hoc Pairwise analysis tables */}
          {res.post_hoc_letters && Object.keys(res.post_hoc_letters).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-slate-700 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-teal-500 rounded-full" />
                  Groupements homogènes (Lettres d'équivalence)
                </h4>
                <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold border border-teal-100">
                  Seuil α = 5%
                </span>
              </div>
              <p className="text-xs text-slate-500 italic leading-relaxed">
                Les groupes qui partagent au moins une lettre commune ne présentent pas de différence statistiquement significative.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(res.post_hoc_letters).map(([group, letters]) => (
                  <div key={group} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                    <span className="text-xs font-bold text-slate-800 truncate pr-2" title={group}>
                      {group}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {String(letters).split('').map((char, index) => (
                        <span key={index} className="w-5 h-5 flex items-center justify-center rounded-md bg-indigo-50 border border-indigo-200/50 text-[10px] font-extrabold uppercase text-indigo-700 select-none shadow-xs">
                          {char}
                        </span>
                      ))}
                      {!letters && (
                        <span className="text-xs italic text-slate-400">sans groupe</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.post_hoc && res.post_hoc.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden text-slate-700">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                Comparaisons Multiples (Post-Hoc Pairwise Analyst)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-1.5 rounded-l-lg">Groupe A</th>
                      <th className="px-3 py-1.5">Groupe B</th>
                      <th className="px-3 py-1.5">Écart observé</th>
                      <th className="px-3 py-1.5">P-Value Adj</th>
                      <th className="px-3 py-1.5 rounded-r-lg text-right">Significatif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {res.post_hoc.map((pw: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {pw.g1 || 'G1'}
                          {res.post_hoc_letters?.[pw.g1] && (
                            <span className="ml-2 inline-flex gap-0.5 align-middle select-none">
                              {String(res.post_hoc_letters[pw.g1]).split('').map((char, cidx) => (
                                <span key={cidx} className="px-1 bg-indigo-55/60 text-slate-600 rounded text-[8px] font-extrabold uppercase border border-slate-200">
                                  {char}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {pw.g2 || 'G2'}
                          {res.post_hoc_letters?.[pw.g2] && (
                            <span className="ml-2 inline-flex gap-0.5 align-middle select-none">
                              {String(res.post_hoc_letters[pw.g2]).split('').map((char, cidx) => (
                                <span key={cidx} className="px-1 bg-indigo-55/60 text-slate-600 rounded text-[8px] font-extrabold uppercase border border-slate-200">
                                  {char}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{pw.difference !== undefined ? pw.difference.toFixed(decimals) : '-'}</td>
                        <td className="px-3 py-2 font-semibold text-sky-700">{pw.p_value < 0.0001 ? pw.p_value.toExponential(3) : pw.p_value.toFixed(decimals)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            pw.significant 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {pw.significant ? 'Oui' : 'Non'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'univariate') {
      const isQuant = 'mean' in metrics || 'median' in metrics || 'std_dev' in metrics || 'cv_percent' in metrics || 'min' in metrics || 'max' in metrics || 'q1' in metrics || 'q3' in metrics;
      const isQual = 'num_unique' in metrics || 'mode' in metrics || 'frequency_table' in metrics;

      if (isQuant) {
        // Quantitative
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Moyenne" value={metrics.mean?.toFixed(decimals)} />
            <MetricCard label="Médiane" value={metrics.median?.toFixed(decimals)} />
            <MetricCard label="Écart-type" value={metrics.std_dev?.toFixed(decimals)} />
            <MetricCard label="CV (%)" value={metrics.cv_percent ? `${metrics.cv_percent.toFixed(decimals)}%` : '-'} />
            <MetricCard label="Min" value={metrics.min?.toFixed(decimals)} />
            <MetricCard label="Max" value={metrics.max?.toFixed(decimals)} />
            <MetricCard label="Q1" value={metrics.q1?.toFixed(decimals)} />
            <MetricCard label="Q3" value={metrics.q3?.toFixed(decimals)} />
          </div>
        );
      } else if (isQual) {
        // Qualitative
        return (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <MetricCard label="Catégories Uniques" value={metrics.num_unique} />
            <MetricCard label="Mode (Le plus fréquent)" value={metrics.mode} />
            {metrics.frequency_table && (
              <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2">Catégorie</th>
                      <th className="px-4 py-2">Effectif</th>
                      <th className="px-4 py-2">%</th>
                      <th className="px-4 py-2">% Cumulé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.frequency_table.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-900">{row.category}</td>
                        <td className="px-4 py-2">{row.count}</td>
                        <td className="px-4 py-2">{row.percentage.toFixed(decimals)}%</td>
                        <td className="px-4 py-2">{row.cumulative_percentage.toFixed(decimals)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
    }
    } else {
      // Bivariate
      const isQuantQuant = 'pearson_r' in metrics || 'spearman_rho' in metrics || 'covariance' in metrics;
      const isQualQual = 'contingency_table' in metrics;
      const isQuantQual = 'group_stats' in metrics;

      if (isQuantQuant) {
        // Quant x Quant
        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Corrélation (Pearson)" value={metrics.pearson_r?.toFixed(decimals)} />
            <MetricCard label="Corrélation (Spearman)" value={metrics.spearman_rho?.toFixed(decimals)} />
            <MetricCard label="Covariance" value={metrics.covariance?.toFixed(decimals)} />
          </div>
        );
      } else if (isQualQual) {
        // Qual x Qual
        return (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
               Analyse Croisée & Associations
            </h4>
            <CrosstabViewer 
              contingencyTable={metrics.contingency_table} 
              topAssociations={metrics.top_associations_percentages} 
            />
          </div>
        );
      } else if (isQuantQual) {
        // Quant x Qual
        return (
          <div className="mb-6 overflow-x-auto">
             <table className="w-full text-sm text-left bg-white border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Groupe ({metrics.qual_col})</th>
                    <th className="px-4 py-3">Moyenne</th>
                    <th className="px-4 py-3">Médiane</th>
                    <th className="px-4 py-3">Écart-type</th>
                    <th className="px-4 py-3">Min</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">N</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.group_stats.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-900">{row.category}</td>
                      <td className="px-4 py-2">{row.mean !== null ? row.mean.toFixed(decimals) : '-'}</td>
                      <td className="px-4 py-2">{row.median !== null ? row.median.toFixed(decimals) : '-'}</td>
                      <td className="px-4 py-2">{row.std !== null ? row.std.toFixed(decimals) : '-'}</td>
                      <td className="px-4 py-2">{row.min !== null ? row.min.toFixed(decimals) : '-'}</td>
                      <td className="px-4 py-2">{row.max !== null ? row.max.toFixed(decimals) : '-'}</td>
                      <td className="px-4 py-2">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Left Panel - Navigation / History */}
      <div className="w-[300px] shrink-0 border-r border-slate-200 bg-white flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 mb-3">Historique d'analyses</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 flex flex-col items-center gap-4">
              <p>Aucune analyse trouvée.</p>
              {history.length === 0 && (
                <button
                  onClick={handleSimulate}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-lg transition-colors border border-indigo-200"
                >
                  Simuler des résultats
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedAnalyses).map(([groupName, items]) => {
              const isCollapsed = collapsedGroups[groupName];
              return (
                <div key={groupName} className="border border-slate-100 rounded-xl bg-slate-50/50 overflow-hidden">
                  <button
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-100/75 hover:bg-slate-200/40 text-slate-700 transition-colors border-b border-slate-100"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-1">
                      {isCollapsed ? (
                        <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-700 truncate text-left" title={groupName}>
                        {groupName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                        {items.length}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="p-1.5 space-y-1 bg-white">
                      {items.map((item) => {
                        const isActive = activeAnalysisId === item.id;
                        return (
                          <div key={item.id} className="relative group/item">
                            <button
                              onClick={() => {
                                setActiveAnalysisId(item.id);
                                setIsEditingMeta(false);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 border ${
                                isActive 
                                  ? 'bg-indigo-50/50 border-indigo-200 shadow-xs' 
                                  : 'bg-white border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-0.5">
                                <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 shrink-0">
                                  {item.type === 'univariate' ? <PieChart className="w-3 h-3 text-emerald-500" /> : <Layers className="w-3 h-3 text-sky-500" />}
                                  {item.type === 'univariate' ? 'Univariée' : 'Bivariée'}
                                </span>
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h3 className={`text-xs font-bold truncate pr-6 ${isActive ? 'text-indigo-900 font-extrabold' : 'text-slate-700'}`}>
                                {item.title}
                              </h3>
                              <div className="mt-1.5 flex flex-wrap gap-0.5">
                                {item.variables.map(v => (
                                  <span key={v} className="px-1 py-0.1 rounded bg-slate-100 border border-slate-200/55 text-[8px] text-slate-600 font-medium font-mono">
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </button>
                            {/* Actions on hover */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/item:flex items-center gap-1 bg-white/95 p-1 rounded-md shadow-sm border border-slate-100">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAnalysisId(item.id);
                                  setEditTitle(item.title);
                                  setEditGroup(item.group || '');
                                  setIsEditingMeta(true);
                                }}
                                className="p-1 hover:text-indigo-600 hover:bg-slate-100 rounded text-slate-400 transition-all cursor-pointer"
                                title="Modifier / Classer"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast("Confirmer la suppression", {
                                    description: "Voulez-vous vraiment supprimer ce résultat de l'historique ?",
                                    action: {
                                      label: "Supprimer",
                                      onClick: () => deleteAnalysisResult(item.id)
                                    },
                                    cancel: {
                                      label: "Annuler",
                                      onClick: () => {}
                                    },
                                    duration: 5000
                                  });
                                }}
                                className="p-1 hover:text-red-600 hover:bg-slate-100 rounded text-slate-400 transition-all cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Active Detail View */}
      <div className="flex-1 overflow-y-auto bg-slate-50 relative">
        {!activeAnalysis ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
              <LineChart className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-600">Aucune analyse sélectionnée</p>
            <p className="text-sm mt-2">Sélectionnez une analyse dans l'historique pour afficher les détails.</p>
          </div>
        ) : (
          <div className="p-8 max-w-5xl mx-auto transition-opacity duration-300" key={activeAnalysis.id}>
            {/* Header */}
            <header className="mb-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  {new Date(activeAnalysis.timestamp).toLocaleString()}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold font-mono">
                    {activeAnalysis.type === 'univariate' ? 'Analyse Univariée' : 'Analyse Bivariée'}
                  </span>
                  {activeAnalysis.group && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-teal-100">
                        <Folder className="w-3 h-3 shrink-0" />
                        {activeAnalysis.group}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditTitle(activeAnalysis.title);
                      setEditGroup(activeAnalysis.group || '');
                      setIsEditingMeta(!isEditingMeta);
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      isEditingMeta 
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-700' 
                        : 'bg-white border-indigo-200 hover:bg-indigo-50 text-indigo-700 hover:border-indigo-300'
                    }`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {isEditingMeta ? 'Annuler' : 'Renommer / Classer'}
                  </button>
                  <button
                    onClick={() => {
                      useWorkspaceStore.getState().openMira(activeAnalysis.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-900 border border-indigo-500/50 hover:bg-indigo-800 text-indigo-100 rounded-lg transition-all cursor-pointer"
                    title="Approfondir avec l'IA Mira"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                    Demander à Mira
                  </button>
                  <button
                    onClick={() => setIsWordModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Rapport Word
                  </button>
                  <button
                    onClick={() => {
                      toast("Confirmer la suppression", {
                        description: "Voulez-vous vraiment supprimer définitivement ce résultat de l'historique ?",
                        action: {
                          label: "Supprimer",
                          onClick: () => {
                            deleteAnalysisResult(activeAnalysis.id);
                            setIsEditingMeta(false);
                          }
                        },
                        cancel: {
                          label: "Annuler",
                          onClick: () => {}
                        },
                        duration: 5000
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>

              {isEditingMeta ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row gap-4 items-end animate-in fade-in duration-200">
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Titre de l'analyse</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-slate-800 focus:outline-none"
                      placeholder="Ex: Distribution des âges numérique"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">Dossier / Groupe</label>
                    <input
                      type="text"
                      value={editGroup}
                      onChange={(e) => setEditGroup(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-slate-800 focus:outline-none"
                      placeholder="Ex: Échantillon principal (vide pour aucun)"
                      list="headerGroupSuggestions"
                    />
                    <datalist id="headerGroupSuggestions">
                      {existingGroups.map(g => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                  <button
                    onClick={() => {
                      if (!editTitle.trim()) {
                        toast.error("Le titre ne peut pas être vide.");
                        return;
                      }
                      renameAnalysisResult(activeAnalysis.id, editTitle.trim());
                      setAnalysisResultGroup(activeAnalysis.id, editGroup.trim() || null);
                      setIsEditingMeta(false);
                      toast.success("Informations mises à jour !");
                    }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 h-[38px] cursor-pointer"
                  >
                    Sauvegarder
                  </button>
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight md:text-3xl">
                    {activeAnalysis.title}
                  </h1>
                </div>
              )}
            </header>

            {/* Direct Dataset Variable Injector Integration */}
            {(activeAnalysis.metrics?.isRegression || activeAnalysis.metrics?.test_result !== undefined) && (
              <div className="mb-8 p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm shadow-emerald-500/5 select-none hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl flex items-center justify-center text-sm shadow-sm shrink-0">
                    📥
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">
                      Intégration de variables calculées
                    </h4>
                    <p className="text-[11px] text-slate-500 font-semibold font-sans leading-relaxed">
                      {activeAnalysis.metrics.isRegression ? (
                        "Générez instantanément les valeurs prédites et les résidus de ce modèle de régression, puis ajoutez-les comme colonnes dans votre jeu de données."
                      ) : (
                        "Enregistrez les résultats calculés de ce test statistique (ex : classification post-hoc par groupe ou Z-scores standardisés) comme colonne dans votre jeu de données."
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      if (activeAnalysis.metrics.isRegression) {
                        const target = activeAnalysis.variables[0]; // target
                        if (!activeAnalysis.metrics?.coefficients) {
                          toast.error("Coefficients de régression indisponibles.");
                          return;
                        }
                        
                        const coeffs = activeAnalysis.metrics.coefficients;
                        const interceptItem = coeffs.find((c: any) => c.factor === 'Constante' || c.factor === 'Intercept');
                        const intercept = interceptItem ? interceptItem.coefficient : 0;
                        
                        const dict: Record<string, number[]> = {};
                        const predictions: number[] = [];
                        const residuals: number[] = [];
                        
                        const previewData = useWorkspaceStore.getState().previewData;
                        if (!previewData || previewData.length === 0) {
                          toast.error("Le jeu de données est vide ou manquant.");
                          return;
                        }

                        for (const row of previewData) {
                          let pred = intercept;
                          let hasMissing = false;
                          for (const item of coeffs) {
                            if (item.factor !== 'Constante' && item.factor !== 'Intercept') {
                              const val = parseFloat(row[item.factor]);
                              if (isNaN(val)) {
                                hasMissing = true;
                                break;
                              }
                              pred += val * item.coefficient;
                            }
                          }
                          if (hasMissing) {
                            predictions.push(NaN);
                            residuals.push(NaN);
                          } else {
                            predictions.push(pred);
                            const yVal = parseFloat(row[target]);
                            if (!isNaN(yVal)) {
                              residuals.push(yVal - pred);
                            } else {
                              residuals.push(NaN);
                            }
                          }
                        }
                        
                        const targetClean = target.replace(/[^a-zA-Z0-9]/g, '_');
                        dict[`Reg_Pred_${targetClean}`] = predictions;
                        dict[`Reg_Resid_${targetClean}`] = residuals;
                        
                        await useWorkspaceStore.getState().appendDataframeColumns(dict);
                        toast.success("Valeurs prédites et résidus ajoutés au jeu de données !");
                      } else {
                        // For statistical tests: post-hoc grouping factor or group scores!
                        const res = activeAnalysis.metrics.test_result;
                        const colX = activeAnalysis.metrics.test_params?.col_x || activeAnalysis.variables[0];
                        const colY = activeAnalysis.metrics.test_params?.col_y || activeAnalysis.variables[1];
                        
                        const previewData = useWorkspaceStore.getState().previewData;
                        const dict: Record<string, any[]> = {};

                        // Check if we have Tukey HSD letter classifications!
                        if (res.post_hoc_letters && Object.keys(res.post_hoc_letters).length > 0) {
                          const lettersMap = res.post_hoc_letters; // { "GroupA": "a", "GroupB": "b"... }
                          const groupCol = colY || colX; // categorical var
                          const finalLettersCol = previewData.map(row => {
                            const val = String(row[groupCol] ?? '');
                            return lettersMap[val] ?? 'Non classé';
                          });
                          dict[`Tukey_Group_${groupCol.replace(/[^a-zA-Z0-9]/g, '_')}`] = finalLettersCol;
                          await useWorkspaceStore.getState().appendDataframeColumns(dict);
                          toast.success("Classification post-hoc Tukey (Groupes d'homogénéité) ajoutée au jeu de données !");
                        } else {
                          // Default action: standardize colX (Z-score) or create a categorical indicator variable of significance
                          const meanVal = parseFloat(res.extra_info?.["Moyenne globale"] ?? res.extra_info?.["Moyenne"] ?? NaN);
                          const stdVal = parseFloat(res.extra_info?.["Écart-type"] ?? NaN);
                          
                          if (!isNaN(meanVal) && !isNaN(stdVal) && stdVal > 0) {
                            const colXClean = colX.replace(/[^a-zA-Z0-9]/g, '_');
                            dict[`Zscore_${colXClean}`] = previewData.map(row => {
                              const val = parseFloat(row[colX]);
                              return !isNaN(val) ? (val - meanVal) / stdVal : NaN;
                            });
                            await useWorkspaceStore.getState().appendDataframeColumns(dict);
                            toast.success(`Z-scores standardisés de la variable ${colX} ajoutés au jeu de données !`);
                          } else {
                            // Let's create an indicator column based on column directly
                            const colXClean = colX.replace(/[^a-zA-Z0-9]/g, '_');
                            const vals = previewData.map(row => parseFloat(row[colX])).filter(v => !isNaN(v));
                            if (vals.length > 0) {
                              const m = vals.reduce((sum, v) => sum + v, 0) / vals.length;
                              const s = Math.sqrt(vals.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (vals.length - 1)) || 1;
                              dict[`Zscore_${colXClean}`] = previewData.map(row => {
                                const val = parseFloat(row[colX]);
                                return !isNaN(val) ? (val - m) / s : NaN;
                              });
                              await useWorkspaceStore.getState().appendDataframeColumns(dict);
                              toast.success(`Z-scores standardisés de la variable ${colX} ajoutés au jeu de données !`);
                            } else {
                              toast.warning("Aucune variable numérique exploitable pour injecter les calculs.");
                            }
                          }
                        }
                      }
                    } catch (err: any) {
                      toast.error("Erreur lors de l'intégration : " + err.message);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-5 py-3 rounded-xl transition-all shadow-md shadow-emerald-600/15 uppercase shrink-0 cursor-pointer text-center"
                >
                  📥 Ajouter au Jeu de Données
                </button>
              </div>
            )}

            {/* Metrics */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Hash className="w-5 h-5 text-indigo-500" />
                  Métriques Descriptives
                </h3>
                <CopyButton targetId={`metrics-${activeAnalysis.id}`} format="html" label="Copier les métriques" />
              </div>
              <div id={`metrics-${activeAnalysis.id}`} className="p-1 -m-1">
                {renderMetrics(activeAnalysis.metrics, activeAnalysis.type, activeAnalysis.variables)}
              </div>
            </section>

            {/* Chart Container */}
            {activeAnalysis.chart && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    Visualisation
                  </h3>
                  <CopyButton targetId={`chart-${activeAnalysis.id}`} format="image" label="Copier le graphique" />
                </div>
                <div id={`chart-${activeAnalysis.id}`} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm w-full overflow-hidden flex justify-center">
                  {(() => {
                    const customAnnotations = (activeAnalysis.annotations || []).map((ann: any) => ({
                      x: ann.x,
                      y: ann.y,
                      xref: 'paper',
                      yref: 'paper',
                      text: ann.text,
                      showarrow: ann.showArrow,
                      arrowhead: 2,
                      ax: 0,
                      ay: -30,
                      bgcolor: 'rgba(255, 255, 255, 0.95)',
                      bordercolor: '#6366f1',
                      borderwidth: 1.5,
                      borderpad: 4,
                      font: {
                        size: 11,
                        color: '#1e1b4b',
                        family: 'Inter, sans-serif'
                      }
                    }));

                    const previewAnnotation = isAddingAnnotation && annotationText.trim() ? [{
                      x: annotationX,
                      y: annotationY,
                      xref: 'paper',
                      yref: 'paper',
                      text: `${annotationText} (Aperçu)`,
                      showarrow: annotationArrow,
                      arrowhead: 2,
                      ax: 0,
                      ay: -30,
                      bgcolor: 'rgba(238, 242, 255, 0.95)',
                      bordercolor: '#f59e0b',
                      borderwidth: 1.5,
                      borderpad: 4,
                      font: {
                        size: 11,
                        color: '#b45309',
                        family: 'Inter, sans-serif'
                      }
                    }] : [];

                    const allPlotAnnotations = [
                      ...(activeAnalysis.chart.layout?.annotations || []),
                      ...customAnnotations,
                      ...previewAnnotation
                    ];

                    return (
                      <Plot
                        data={activeAnalysis.chart.data}
                        layout={{
                          ...activeAnalysis.chart.layout,
                          annotations: allPlotAnnotations,
                          autosize: true,
                          margin: { t: 40, r: 20, l: 40, b: 40 },
                          paper_bgcolor: 'transparent',
                          plot_bgcolor: 'transparent',
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%', minHeight: '400px' }}
                        config={{ displayModeBar: false, responsive: true }}
                      />
                    );
                  })()}
                </div>

                {/* Annotations Section */}
                <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-indigo-500" />
                        Annotations de l'utilisateur
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ajoutez des repères ou commentaires directement sur le graphique.
                      </p>
                    </div>

                    {!isAddingAnnotation ? (
                      <button
                        onClick={() => {
                          setIsAddingAnnotation(true);
                          setAnnotationText('');
                          setAnnotationX(0.5);
                          setAnnotationY(0.5);
                          setAnnotationArrow(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-slate-700 hover:scale-[1.02] active:scale-[0.98] transition rounded-lg shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une annotation
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsAddingAnnotation(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                    )}
                  </div>

                  {/* Add Annotation Form */}
                  {isAddingAnnotation && (
                    <div className="mb-5 bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Text input */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Texte de l'annotation
                            </label>
                            <input
                              type="text"
                              value={annotationText}
                              onChange={(e) => setAnnotationText(e.target.value)}
                              placeholder="Ex: Pic de ventes ou anomalie..."
                              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="annArrow"
                              checked={annotationArrow}
                              onChange={(e) => setAnnotationArrow(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="annArrow" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                              Afficher une flèche d'ancrage
                            </label>
                          </div>
                        </div>

                        {/* Position controls */}
                        <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                          <label className="block text-xs font-semibold text-slate-800">
                            Positionnement temporel / spatial
                          </label>

                          {/* Quick Placement Presets */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {PRESET_POSITIONS.map((pos) => (
                              <button
                                key={pos.label}
                                onClick={() => {
                                  setAnnotationX(pos.x);
                                  setAnnotationY(pos.y);
                                }}
                                className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>

                          {/* Manual sliders */}
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                                <span>Horizontal (Est - Ouest)</span>
                                <span className="font-mono font-medium">{Math.round(annotationX * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={annotationX}
                                onChange={(e) => setAnnotationX(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                                <span>Vertical (Nord - Sud)</span>
                                <span className="font-mono font-medium">{Math.round(annotationY * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={annotationY}
                                onChange={(e) => setAnnotationY(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => {
                            if (!annotationText.trim()) return;
                            addAnnotation(activeAnalysis.id, {
                              text: annotationText.trim(),
                              x: annotationX,
                              y: annotationY,
                              showArrow: annotationArrow
                            });
                            setIsAddingAnnotation(false);
                            setAnnotationText('');
                          }}
                          disabled={!annotationText.trim()}
                          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition rounded-lg"
                        >
                          Valider et enregistrer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of active manual annotations */}
                  {(!activeAnalysis.annotations || activeAnalysis.annotations.length === 0) ? (
                    <div className="text-center py-4 text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
                      Aucune annotation personnalisée sur ce graphique.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {activeAnalysis.annotations.map((ann: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs hover:border-indigo-100 transition animate-fade-in"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate" title={ann.text}>
                              {ann.text}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Position : H={Math.round(ann.x * 100)}% | V={Math.round(ann.y * 100)}%
                              {ann.showArrow && " • avec flèche"}
                            </p>
                          </div>
                          <button
                            onClick={() => removeAnnotation(activeAnalysis.id, idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-slate-50 transition"
                            title="Supprimer cette annotation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Interpretation */}
            {activeAnalysis.interpretation && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Type className="w-5 h-5 text-indigo-500" />
                    Interprétation Automatique
                  </h3>
                  <CopyButton targetId={`interpretation-${activeAnalysis.id}`} format="text" label="Copier l'interprétation" />
                </div>
                <div id={`interpretation-${activeAnalysis.id}`} className="bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100/60 rounded-2xl p-6 shadow-sm">
                  <div className="text-indigo-950 leading-relaxed select-text">
                    {renderMarkdownDef(activeAnalysis.interpretation)}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {isWordModalOpen && (
        <WordExportModal onClose={() => setIsWordModalOpen(false)} />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string, value: string | number | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-xl font-bold text-slate-900">{value}</span>
    </div>
  );
}
