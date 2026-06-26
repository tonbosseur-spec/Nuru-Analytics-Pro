import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import { Activity, Loader2, Beaker, HelpCircle, CheckCircle2, ChevronDown, FlaskConical, Info } from 'lucide-react';
import FolderSelector from './FolderSelector';

const ALL_TESTS = [
  // Normality
  { id: 'shapiro', name: 'Shapiro-Wilk', desc: 'Test de normalité (n ≤ 5000)', type: 'param', needsY: false, expectedX: 'quant', category: '1samp', tooltip: 'Vérifie si une variable quantitative suit une loi normale. Recommandé pour des échantillons de petite et moyenne taille (< 5000).' },
  { id: 'dagostino', name: "D'Agostino-Pearson", desc: 'Test omnibus de normalité (n ≥ 8)', type: 'param', needsY: false, expectedX: 'quant', category: '1samp', tooltip: "Test basé sur l'asymétrie (skewness) et l'aplatissement (kurtosis). Nécessite au moins 8 observations." },
  { id: 'jarque_bera', name: 'Jarque-Bera', desc: 'Test de normalité (grands échantillons)', type: 'param', needsY: false, expectedX: 'quant', category: '1samp', tooltip: 'Test basé sur l\'asymétrie et l\'aplatissement, idéal pour les grands échantillons (> 2000).' },
  { id: 'kolmogorov', name: 'Lilliefors / K-S', desc: 'Test de normalité continu', type: 'param', needsY: false, expectedX: 'quant', category: '1samp', tooltip: 'Test de Kolmogorov-Smirnov avec correction de Lilliefors pour tester la normalité.' },
  
  // 1 Sample
  { id: 'ttest_1samp', name: 'Test t (1 échantillon)', desc: 'Comparaison de moyenne avec valeur', type: 'param', needsY: false, expectedX: 'quant', category: '1samp', tooltip: 'Prérequis: Données quantitatives, distribution approximativement normale ou grand échantillon (n > 30).' },
  { id: 'wilcoxon_1samp', name: 'Wilcoxon signé', desc: 'Comparaison de médiane avec valeur', type: 'nonparam', needsY: false, expectedX: 'quant', category: '1samp', tooltip: 'Alternative non paramétrique au Test t sur un échantillon. Ne suppose pas de distribution normale.' },
  { id: 'chi2_1samp', name: "Chi-Deux (1 échantillon)", desc: 'Adéquation / Proportions', type: 'nonparam', needsY: false, expectedX: 'qual', category: '1samp', tooltip: 'Vérifie si les fréquences observées d\'une variable qualitative correspondent aux fréquences théoriques attendues.' },
  { id: 'binomial', name: 'Test Binomial', desc: 'Pour variable binaire (proportion)', type: 'param', needsY: false, expectedX: 'qual', category: '1samp', tooltip: 'Test exact pour vérifier si la proportion observée d\'une variable dichotomique est égale à une proportion théorique.' },
  
  // 2 Samples Independants
  { id: 'ttest_ind', name: 'Test t indépendant', desc: 'Comparaison de 2 moyennes (variances égales)', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: '2samp_ind', tooltip: 'Prérequis: Variable Y binaire (2 groupes), données normales, variances égales (homoscédasticité).' },
  { id: 'welch', name: 'Test de Welch', desc: 'Comparaison de 2 moyennes (variances inégales)', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: '2samp_ind', tooltip: 'Variante du test t indépendant à privilégier lorsque les variances des deux groupes sont très différentes.' },
  { id: 'mannwhitney', name: 'Mann-Whitney (U)', desc: 'Comparaison de 2 médianes', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: '2samp_ind', tooltip: 'Alternative au test t indépendant, utilisé quand les conditions de normalité ne sont pas remplies.' },
  { id: 'levene', name: 'Test de Levene', desc: 'Égalité des variances (Homoscédasticité)', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: '2samp_ind', tooltip: 'Teste si les variances de plusieurs groupes sont statistiquement égales. Important avant l\'ANOVA.' },

  // > 2 Samples Independants
  { id: 'anova', name: 'ANOVA (1 facteur)', desc: 'Comparaison de 3 moyennes ou plus', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'nsamp_ind', tooltip: 'Compare les moyennes de 3 groupes ou plus. Prérequis: Normalité des résidus et égalité des variances.' },
  { id: 'anova_2way', name: 'ANOVA (2 facteurs)', desc: 'Analyse de 2 variables qualitatives sur une quantitative', type: 'param', needsY: true, expectedX: 'qual', expectedY: 'quant', category: 'nsamp_ind', tooltip: 'Compare simultanément l\'effet de deux variables de classe et leur interaction. Utilisez "Covariable" dans les options pour désigner le facteur secondaire.' },
  { id: 'kruskal', name: 'Kruskal-Wallis', desc: 'Comparaison de 3 médianes ou plus', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'nsamp_ind', tooltip: 'Alternative non paramétrique à l\'ANOVA. S\'utilise quand la normalité n\'est pas respectée.' },

  // Paired Samples
  { id: 'ttest_paired', name: 'Test t apparié', desc: 'Moyennes sur des sujets identiques', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'quant', category: 'paired', tooltip: 'Compare les moyennes de deux séries de données liées (ex: pré-test / post-test sur les mêmes sujets).' },
  { id: 'wilcoxon_paired', name: 'Wilcoxon apparié', desc: 'Médianes appariées', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'quant', category: 'paired', tooltip: 'Alternative non paramétrique au Test t apparié. Basé sur le rang des différences.' },
  { id: 'anova_rm', name: 'ANOVA à mesures répétées', desc: 'Sujets au fil du temps (paramétrique)', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'paired', tooltip: 'Extension du test t apparié pour 3 temps de mesure ou plus sur les mêmes sujets (sphéricité requise).' },
  { id: 'anova_mixed', name: 'ANOVA mixte', desc: 'Facteurs inter et intra-sujets combinés', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'paired', tooltip: 'Plan mixte : mesure l\'effet du temps (intra), de groupe (inter) et leur interaction sur une variable quantitative.' },
  { id: 'friedman', name: 'Test de Friedman', desc: 'Alternative non paramétrique à l\'ANOVA RM', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'paired', tooltip: 'Compare 3 mesures liées ou plus quand les conditions de l\'ANOVA à mesures répétées ne sont pas remplies.' },

  // Correlation / Association
  { id: 'pearson', name: 'Corrélation de Pearson', desc: 'Relation linéaire', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'quant', category: 'corr', tooltip: 'Mesure la force d\'une relation linéaire entre deux variables quantitatives normales. Sensible aux valeurs extrêmes.' },
  { id: 'spearman', name: 'Corrélation de Spearman', desc: 'Relation de rangs', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'quant', category: 'corr', tooltip: 'Alternative au Pearson. Mesure la corrélation monotone. Moins sensible aux valeurs extrêmes car basée sur les rangs.' },
  { id: 'kendall', name: 'Corrélation de Kendall', desc: 'Relation sur petits échantillons', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'quant', category: 'corr', tooltip: 'Similar au Spearman, mais plus robuste et souvent préféré quand il y a de nombreuses valeurs ex-aequo (ex: petits échantillons).' },
  { id: 'chi2', name: 'Chi-Deux d\'indépendance', desc: 'Entre variables catégorielles (> 2x2)', type: 'nonparam', needsY: true, expectedX: 'qual', expectedY: 'qual', category: 'corr', tooltip: 'Teste s\'il existe une liaison ou dépendance entre deux variables qualitatives. Prérequis: Effectifs attendus > 5.' },
  { id: 'fisher', name: 'Test exact de Fisher', desc: 'Indépendance pour petits effectifs (2x2)', type: 'nonparam', needsY: true, expectedX: 'qual', expectedY: 'qual', category: 'corr', tooltip: 'Alternative au Chi-Deux, indispensable quand les effectifs attendus dans une table 2x2 sont faibles (< 5).' },
  { id: 'mcnemar', name: 'Test de McNemar', desc: 'Données catégorielles appariées (2x2)', type: 'nonparam', needsY: true, expectedX: 'qual', expectedY: 'qual', category: 'corr', tooltip: 'S\'applique à une table de contingence 2x2 pour des données échantillonnées deux fois (mesures appariées/avant-après).' },
  { id: 'cramer', name: 'V de Cramer', desc: "Force d'association catégorielle", type: 'nonparam', needsY: true, expectedX: 'qual', expectedY: 'qual', category: 'corr', tooltip: 'Indice allant de 0 à 1 mesurant l\'intensité de la liaison entre deux variables qualitatives (dérivé du Chi-Deux).' },
  
  // Avancé
  { id: 'ancova', name: 'ANCOVA', desc: 'ANOVA ajustée sur une covariable continue', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Compare les moyennes de groupes tout en contrôlant ou neutralisant les effets d\'une variable quantitative tiers (covariable).' },
  { id: 'ancova_rank', name: 'ANCOVA sur Rangs (Quade)', desc: "Alternative non paramétrique robuste de l'ANCOVA", type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Permet de réaliser une analyse de covariance quand les hypothèses de normalité ne sont pas respectées.' },
  { id: 'manova', name: 'MANOVA', desc: 'Comparaison multi-groupe sur plusieurs vd', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Similaire à l\'ANOVA mais teste simultanément les différences de groupe sur de multiples variables dépendantes quantitatives (nécessite normalité multivariée).' },
  { id: 'permanova', name: 'PERMANOVA', desc: 'Alternative non param. à la MANOVA par permutation', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Approche non paramétrique à la MANOVA basée sur les dissemblances et ne nécessitant pas de normalité multivariée.' },
  { id: 'mancova', name: 'MANCOVA', desc: 'MANOVA ajustée sur une covariable continue', type: 'param', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Fusionne la MANOVA et l\'ANCOVA: gère plusieurs variables dépendantes tout en contrôlant l\'effet de multi-covariables.' },
  { id: 'permancova', name: 'PERMANCOVA', desc: 'Alternative non param. à la MANCOVA par permutation', type: 'nonparam', needsY: true, expectedX: 'quant', expectedY: 'qual', category: 'advanced', tooltip: 'Version non-paramétrique par permutation de la MANCOVA.' }
];

const CATEGORIES = [
  { id: '1samp', label: '1 Échantillon (Distribution & Conformité)' },
  { id: '2samp_ind', label: '2 Échantillons Indépendants' },
  { id: 'nsamp_ind', label: '> 2 Échantillons Indépendants' },
  { id: 'paired', label: 'Échantillons Appariés / Mesures Répétées' },
  { id: 'corr', label: 'Corrélation & Association' },
  { id: 'advanced', label: 'Modèles Linéaires Avancés' }
];

export default function StatTestsView({ filterTag }: { filterTag?: 'param' | 'nonparam' | 'normality' | 'association' }) {
  const decimals = useWorkspaceStore(s => s.decimals);
  const alpha = useWorkspaceStore(s => s.alpha);
  const columns = useWorkspaceStore(s => s.columns) || [];
  const addAnalysisResult = useWorkspaceStore(s => s.addAnalysisResult);
  const suggestedTestId = useWorkspaceStore(s => s.suggestedTestId);
  
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedColX, setSelectedColX] = useState<string>('');
  const [selectedColY, setSelectedColY] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>('');
  
  // Handlers for consuming recommendations
  useEffect(() => {
    if (suggestedTestId) {
      setActiveSuggestionId(suggestedTestId);
      setSelectedTest(suggestedTestId);
      // Reset the suggestion on the store so we don't re-trigger it
      useWorkspaceStore.setState({ suggestedTestId: '' });
    }
  }, [suggestedTestId]);

  const activeTestObj = ALL_TESTS.find(t => t.id === selectedTest);

  // Clear selections when changing test constraints
  useEffect(() => {
    setSelectedColX('');
    setSelectedColY('');
  }, [selectedTest]);

  // Test Options
  const [mu, setMu] = useState<string>('0');
  const [alternative, setAlternative] = useState<string>('two-sided');
  const [group1, setGroup1] = useState<string>('');
  const [group2, setGroup2] = useState<string>('');
  const [postHoc, setPostHoc] = useState<string>('none');
  const [postHocCorrection, setPostHocCorrection] = useState<string>('bonferroni');
  const [leveneCenter, setLeveneCenter] = useState<string>('median');
  const [yModalities, setYModalities] = useState<string[]>([]);
  const [xModalities, setXModalities] = useState<string[]>([]);
  const [useCustomProportions, setUseCustomProportions] = useState<boolean>(false);
  const [customProportions, setCustomProportions] = useState<Record<string, string>>({});

  // Advanced tests options
  const [subjectCol, setSubjectCol] = useState<string>('');
  const [covariateCol, setCovariateCol] = useState<string>('');
  const [extraDepCol, setExtraDepCol] = useState<string>('');
  const [withinFactorCol, setWithinFactorCol] = useState<string>('');

  const getType = (colName: string) => columns.find(c => c.name === colName)?.type;
  
  const typeX = selectedColX ? getType(selectedColX) : null;
  const isXQuant = typeX === 'continuous' || typeX === 'discrete';

  const typeY = selectedColY ? getType(selectedColY) : null;
  const isYQuant = typeY === 'continuous' || typeY === 'discrete';

  // Fetch modalities when X changes and is qualitative
  useEffect(() => {
    if (selectedColX && !isXQuant) {
      getApi().get_unique_values(selectedColX).then(res => {
        if (res && res.success && res.unique_values) {
          setXModalities(res.unique_values);
          const initialProps: Record<string, string> = {};
          res.unique_values.forEach((v: string) => {
            initialProps[v] = '';
          });
          setCustomProportions(initialProps);
        }
      });
    } else {
      setXModalities([]);
      setCustomProportions({});
    }
  }, [selectedColX, isXQuant]);

  // Fetch modalities when Y changes and is qualitative
  useEffect(() => {
    if (selectedColY && !isYQuant) {
      getApi().get_unique_values(selectedColY).then(res => {
        if (res && res.success && res.unique_values) {
          setYModalities(res.unique_values);
          if (res.unique_values.length >= 2) {
            setGroup1(res.unique_values[0]);
            setGroup2(res.unique_values[1]);
          }
        }
      });
    } else {
      setYModalities([]);
    }
  }, [selectedColY, isYQuant]);

  const displayedTests = ALL_TESTS.filter(t => {
    if (!filterTag) return true;
    const isNormality = ['shapiro', 'dagostino', 'jarque_bera', 'kolmogorov'].includes(t.id);
    const isAssoc = t.category === 'corr';
    
    if (filterTag === 'normality') return isNormality;
    if (filterTag === 'association') return isAssoc;
    
    if (filterTag === 'param') return t.type === 'param' && !isNormality && !isAssoc;
    if (filterTag === 'nonparam') return t.type === 'nonparam' && !isNormality && !isAssoc;
    
    return true;
  });
  
  const getColsForType = (expectedType: string, avoidCol?: string) => {
    return (columns || []).filter(c => {
      if (!c || !c.name) return false;
      if (avoidCol && c.name === avoidCol) return false;
      if (expectedType === 'quant') return c.type === 'continuous' || c.type === 'discrete';
      if (expectedType === 'qual') return c.type === 'nominal' || c.type === 'ordinal';
      return true;
    });
  };

  const xCols = activeTestObj ? getColsForType(activeTestObj.expectedX) : [];
  const yCols = activeTestObj && activeTestObj.needsY ? getColsForType(activeTestObj.expectedY, selectedColX) : [];

  const renderTestOptions = () => {
    if (!selectedTest) return null;
    
    return (
      <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-top-2">
        <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Options supplémentaires
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {(selectedTest === 'ttest_1samp' || selectedTest === 'wilcoxon_1samp' || selectedTest === 'binomial') && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                {selectedTest === 'binomial' ? 'Proportion théorique (p₀, entre 0 et 1)' : 'Valeur théorique (μ)'}
              </label>
              <input type="number" step="any" value={mu} onChange={e => setMu(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}

          {(selectedTest === 'pearson' || selectedTest === 'spearman' || selectedTest === 'kendall' || 
            selectedTest === 'ttest_1samp' || selectedTest === 'wilcoxon_1samp' || selectedTest === 'binomial' ||
            selectedTest === 'ttest_ind' || selectedTest === 'welch' || selectedTest === 'mannwhitney' || 
            selectedTest === 'ttest_paired' || selectedTest === 'wilcoxon_paired') && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Hypothèse alternative</label>
              <select value={alternative} onChange={e => setAlternative(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="two-sided">Bilatérale (≠)</option>
                <option value="greater">Unilatérale ({">"} Supérieur)</option>
                <option value="less">Unilatérale ({"<"} Inférieur)</option>
              </select>
            </div>
          )}

          {(selectedTest === 'ttest_ind' || selectedTest === 'welch' || selectedTest === 'mannwhitney') && !isYQuant && yModalities.length > 0 && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Groupe 1</label>
                <select value={group1} onChange={e => setGroup1(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {yModalities.map(m => <option key={String(m)} value={String(m)}>{String(m)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Groupe 2</label>
                <select value={group2} onChange={e => setGroup2(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {yModalities.map(m => <option key={String(m)} value={String(m)}>{String(m)}</option>)}
                </select>
              </div>
            </>
          )}

          {(selectedTest === 'anova' || selectedTest === 'anova_rm' || selectedTest === 'anova_mixed') && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Test Post-Hoc</label>
                <select value={postHoc} onChange={e => setPostHoc(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="none">Aucun</option>
                  <option value="tukey">Tukey HSD</option>
                  <option value="pairwise_t">T-tests par paires</option>
                </select>
              </div>
              {postHoc === 'pairwise_t' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Correction (Comparaisons Multiples)</label>
                  <select value={postHocCorrection} onChange={e => setPostHocCorrection(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="bonferroni">Bonferroni</option>
                    <option value="holm">Holm</option>
                    <option value="fdr_bh">Benjamini-Hochberg (FDR)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {(selectedTest === 'kruskal' || selectedTest === 'friedman') && (
             <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Test Post-Hoc</label>
                <select value={postHoc} onChange={e => setPostHoc(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="none">Aucun</option>
                  <option value="dunn">Dunn / Mann-Whitney (Kruskal) / Wilcoxon (Friedman)</option>
                </select>
              </div>
              {postHoc === 'dunn' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Correction (Comparaisons Multiples)</label>
                  <select value={postHocCorrection} onChange={e => setPostHocCorrection(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="bonferroni">Bonferroni</option>
                    <option value="holm">Holm</option>
                    <option value="fdr_bh">Benjamini-Hochberg (FDR)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {(selectedTest === 'levene') && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Centre</label>
              <select value={leveneCenter} onChange={e => setLeveneCenter(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="median">Médiane (Robuste)</option>
                <option value="mean">Moyenne</option>
              </select>
            </div>
          )}

          {(selectedTest === 'anova_rm' || selectedTest === 'friedman' || selectedTest === 'anova_mixed') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Identifiant du Sujet (ID)</label>
              <select 
                value={subjectCol} 
                onChange={e => setSubjectCol(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Sélectionnez une colonne Sujet --</option>
                {(columns || []).filter(c => c && c.name).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>
          )}

          {(selectedTest === 'anova_mixed') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Facteur intra-sujet (Mesure/Temps)</label>
              <select 
                value={withinFactorCol} 
                onChange={e => setWithinFactorCol(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Sélectionnez le facteur Intra --</option>
                {(columns || []).filter(c => c && c.name && c.name !== selectedColY).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>
          )}

          {(selectedTest === 'ancova' || selectedTest === 'ancova_rank' || selectedTest === 'mancova' || selectedTest === 'permancova' || selectedTest === 'anova_2way') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {selectedTest === 'anova_2way' ? 'Second Facteur (Variable Qualitative)' : 'Covariable continue à contrôler'}
              </label>
              <select 
                value={covariateCol} 
                onChange={e => setCovariateCol(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Sélectionnez une {selectedTest === 'anova_2way' ? 'variable' : 'covariable'} --</option>
                {(columns || [])
                  .filter(c => c && c.name && c.name !== selectedColX && c.name !== selectedColY)
                  .filter(c => selectedTest === 'anova_2way' ? (c.type === 'nominal' || c.type === 'ordinal') : true)
                  .map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>
          )}

          {(selectedTest === 'manova' || selectedTest === 'permanova' || selectedTest === 'mancova' || selectedTest === 'permancova') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Autre variable dépendante quantitative</label>
              <select 
                value={extraDepCol} 
                onChange={e => setExtraDepCol(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Sélectionnez une variable --</option>
                {(columns || []).filter(c => c && c.name && c.name !== selectedColX && c.name !== selectedColY && c.name !== covariateCol).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>
          )}

          {selectedTest === 'chi2_1samp' && (
            <div className="col-span-1 md:col-span-2 space-y-4">
              <div className="space-y-2 bg-white p-4 border border-slate-200 rounded-2xl">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Distribution théorique attendue</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="chi2_1samp_type" 
                      checked={!useCustomProportions} 
                      onChange={() => setUseCustomProportions(false)} 
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800">Équiprobabilité uniforme</span> (1/k pour chaque)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="chi2_1samp_type" 
                      checked={useCustomProportions} 
                      onChange={() => setUseCustomProportions(true)} 
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800">Proportions personnalisées</span>
                  </label>
                </div>
              </div>

              {useCustomProportions && xModalities.length > 0 && (
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Poids / Proportions attendus</h5>
                    <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">
                      Saisissez les poids théoriques. Normalisation automatique.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {xModalities.map((m) => {
                      const modStr = String(m);
                      const percentPlaceholder = (xModalities.length > 0 && isFinite(100 / xModalities.length))
                        ? (100 / xModalities.length).toFixed(decimals || 2) + "%"
                        : "0%";
                      return (
                        <div key={modStr} className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-700 truncate" title={modStr}>
                            {modStr}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder={percentPlaceholder}
                            value={customProportions[modStr] || ''}
                            onChange={(e) => {
                              setCustomProportions(prev => ({
                                ...prev,
                                [modStr]: e.target.value
                              }));
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-semibold focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleGenerate = async () => {
    if (!selectedTest || !selectedColX) return;
    if (activeTestObj?.needsY && !selectedColY) return;
    
    // Validation: Missing values
    const colXDef = columns.find(c => c.name === selectedColX);
    const colYDef = columns.find(c => c.name === selectedColY);
    
    if (colXDef && colXDef.missing_values > 0) {
      toast.warning(`Attention : La variable X (${selectedColX}) contient ${colXDef.missing_values} valeurs manquantes.`);
    }
    if (activeTestObj?.needsY && colYDef && colYDef.missing_values > 0) {
      toast.warning(`Attention : La variable Y (${selectedColY}) contient ${colYDef.missing_values} valeurs manquantes.`);
    }
    
    const api = getApi();
    setIsGenerating(true);
    
    try {
      const res = await api.run_statistical_test(selectedTest, {
        col_x: selectedColX,
        col_y: selectedColY || null,
        mu: isNaN(parseFloat(mu)) ? 0 : parseFloat(mu),
        alpha: alpha,
        alternative,
        group1,
        group2,
        post_hoc: postHoc,
        post_hoc_correction: postHocCorrection,
        center: leveneCenter,
        use_custom_proportions: useCustomProportions,
        custom_proportions: customProportions,
        subject: subjectCol || null,
        within_factor: withinFactorCol || null,
        covariate: covariateCol || null,
        extra_dep: extraDepCol || null
      });

      if (res.success) {
        addAnalysisResult({
          id: Math.random().toString(36).substr(2, 9),
          title: `Test: ${activeTestObj?.name} (${selectedColX}${selectedColY ? ' × ' + selectedColY : ''})`,
          timestamp: new Date().toISOString(),
          type: selectedColY ? 'bivariate' : 'univariate',
          variables: selectedColY ? [selectedColX, selectedColY] : [selectedColX],
          metrics: { 
            test_result: res.result, 
            test_id: selectedTest,
            test_params: {
              col_x: selectedColX,
              col_y: selectedColY || null,
              mu: isNaN(parseFloat(mu)) ? 0 : parseFloat(mu),
              alternative,
              group1,
              group2,
              post_hoc: postHoc,
              post_hoc_correction: postHocCorrection,
              center: leveneCenter,
              use_custom_proportions: useCustomProportions,
              custom_proportions: customProportions,
              subject: subjectCol || null,
              within_factor: withinFactorCol || null,
              covariate: covariateCol || null,
              extra_dep: extraDepCol || null
            },
            qq_plot: res.qq_plot || null,
            pp_plot: res.pp_plot || null,
            residuals_hist: res.residuals_hist || null,
            residuals_plot: res.residuals_plot || null
          },
          interpretation: res.interpretation || "",
          chart: res.chart || null,
          group: selectedFolder || undefined
        });
        toast.success("Test statistique généré avec succès !");
      } else {
        toast.error("Échec: " + res.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Une erreur s'est produite lors du test.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full">
        
        {activeSuggestionId && activeTestObj && (
          <div className="mb-6 p-5 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 border border-indigo-100 rounded-3xl flex items-start gap-4 text-xs text-indigo-950 animate-in fade-in slide-in-from-top-2 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-200/20 rounded-full blur-xl pointer-events-none" />
            <div className="w-9 h-9 bg-indigo-100 border border-indigo-200 rounded-xl flex items-center justify-center text-indigo-600 font-bold shrink-0 text-base shadow-sm">
              ✨
            </div>
            <div className="space-y-1.5 flex-1 select-none">
              <p className="font-bold text-sm text-indigo-950">Suggestion d’Analyse Active</p>
              <p className="text-indigo-800 leading-relaxed font-normal">
                Vous avez été orienté vers : <strong className="font-extrabold text-indigo-900 bg-indigo-100/60 px-1.5 py-0.5 rounded-md border border-indigo-200/40">{activeTestObj.name}</strong>.
                Le test a été sélectionné automatiquement. Sélectionnez ci-dessous les variables requises.
              </p>
            </div>
            <button 
              onClick={() => setActiveSuggestionId('')} 
              className="text-[10px] font-black tracking-wider text-indigo-600 hover:text-indigo-950 transition-colors uppercase cursor-pointer hover:bg-slate-200 border border-transparent rounded-lg px-2.5 py-1.5 shrink-0"
            >
              Masquer
            </button>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-600" />
            {filterTag === 'param' ? 'Tests Paramétriques' : 
             filterTag === 'nonparam' ? 'Tests Non Paramétriques' : 
             filterTag === 'normality' ? 'Tests de Normalité' :
             filterTag === 'association' ? "Tests d'Association" :
             'Bibliothèque de Tests Statistiques'}
          </h2>
          <p className="text-slate-500">
            {filterTag === 'param' ? 'Comparaisons de moyennes et tests basés sur des distributions normales.' :
             filterTag === 'nonparam' ? 'Comparaisons de rangs et tests robustes pour données non normales.' :
             filterTag === 'normality' ? 'Vérifier si les données suivent une distribution normale.' :
             filterTag === 'association' ? 'Évaluer les corrélations ou dépendances entre variables.' :
             "Sélectionnez d'abord le test statistique à effectuer, puis choisissez les variables correspondantes à évaluer."}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Etape 1 : Choix du Test */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Choisir le test</h3>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
              <div className="overflow-y-auto p-4 space-y-6">
                {CATEGORIES.map(cat => {
                  const testsInCat = displayedTests.filter(t => t.category === cat.id);
                  if (testsInCat.length === 0) return null;
                  
                  return (
                    <div key={cat.id} className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{cat.label}</h4>
                      <div className="space-y-2">
                        {testsInCat.map(t => (
                          <div key={t.id} className="relative group/test">
                            <button
                              onClick={() => setSelectedTest(t.id)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all overflow-hidden ${
                                selectedTest === t.id 
                                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100' 
                                  : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="pr-6">
                                  <h4 className={`font-bold text-sm mb-0.5 flex items-center gap-2 ${selectedTest === t.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {t.name}
                                    <Info className={`w-3.5 h-3.5 transition-opacity ${selectedTest === t.id ? 'text-indigo-400' : 'text-slate-300 group-hover/test:text-indigo-400'}`} />
                                  </h4>
                                  <p className={`text-[10px] ${selectedTest === t.id ? 'text-indigo-700' : 'text-slate-500'}`}>
                                    {t.desc}
                                  </p>
                                  {/* Inline Tooltip Detail */}
                                  <div className="mt-2 text-[10px] bg-slate-800 text-slate-200 p-2.5 rounded-lg hidden group-hover/test:block animate-in fade-in slide-in-from-top-1">
                                    <span className="font-bold text-white mb-0.5 block">Conditions : </span>
                                    {t.tooltip}
                                  </div>
                                </div>
                                <span className={`w-2 h-2 mt-1.5 shrink-0 rounded-full ${t.type === 'param' ? 'bg-emerald-400' : 'bg-amber-400'}`} title={t.type === 'param' ? 'Paramétrique' : 'Non Paramétrique'} />
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Etape 2 : Variables et Exécution */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Configurer et Lancer</h3>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8 space-y-8 flex-1">
              {!selectedTest ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <FlaskConical className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium max-w-xs">
                    Sélectionnez un test statistique dans la liste pour voir les variables compatibles.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl mb-6">
                    <h4 className="text-indigo-950 font-bold mb-1">{activeTestObj?.name}</h4>
                    <p className="text-xs text-indigo-700">{activeTestObj?.desc}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        {activeTestObj?.needsY ? 'Première variable (X)' : 'Variable à tester (X)'}
                      </label>
                      <select
                        value={selectedColX}
                        onChange={(e) => setSelectedColX(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      >
                        <option value="">Sélectionnez ({activeTestObj?.expectedX === 'quant' ? 'Quantitative' : 'Qualitative'})</option>
                        {xCols.map(col => (
                          <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                        ))}
                      </select>
                      {xCols.length === 0 && (
                        <p className="text-[10px] text-rose-500 font-medium">Aucune variable compatible trouvée dans le dataset.</p>
                      )}
                    </div>

                    {activeTestObj?.needsY && (
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-slate-700">Deuxième variable (Y)</label>
                        <select
                          value={selectedColY}
                          onChange={(e) => setSelectedColY(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        >
                          <option value="">Sélectionnez ({activeTestObj?.expectedY === 'quant' ? 'Quantitative' : 'Qualitative'})</option>
                          {yCols.map(col => (
                            <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                          ))}
                        </select>
                        {yCols.length === 0 && (
                          <p className="text-[10px] text-rose-500 font-medium">Aucune variable compatible trouvée dans le dataset.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {renderTestOptions()}
                  
                  <div className="pt-4 border-t border-slate-100">
                    <FolderSelector value={selectedFolder} onChange={setSelectedFolder} />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleGenerate}
                      disabled={!selectedTest || !selectedColX || (activeTestObj?.needsY ? !selectedColY : false) || isGenerating}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:shadow-none"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                      {isGenerating ? 'Calcul...' : 'Lancer le test'}
                    </button>
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
