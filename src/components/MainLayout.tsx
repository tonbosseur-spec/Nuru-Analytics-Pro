import React, { useState, useRef, useEffect } from 'react';
import DataPreparationView from './DataPreparationView';
import ResultsDashboard from './ResultsDashboard';
import WelcomeScreen from './WelcomeScreen';
import { useWorkspaceStore } from '../store';
import { Database, BarChart2, BarChart3, Activity, TrendingUp, Target, PieChart, Lock, ChevronRight, FileText, ChevronLeft, Home, Sparkles, LogOut, LayoutDashboard, Save, FolderOpen, X, Download, Shield, Key, FlaskConical, Search, ArrowRightLeft, Settings, Maximize2, Minimize2, Plus, Keyboard, Compass, Trash2, Table2 } from 'lucide-react';
import DescriptiveStatsView from './DescriptiveStatsView';
import StatTestsView from './StatTestsView';
import RegressionsView from './RegressionsView';
import ChartDesigner from './ChartDesigner';
import InteractiveLab from './InteractiveLab';
import DashboardBuilder from './DashboardBuilder';
import MultivariateAnalysisView from './MultivariateAnalysisView';
import VariableDesigner from './VariableDesigner';
import ManualDataEntry from './ManualDataEntry';
import SettingsModal from './SettingsModal';
import DatasetGeneratorModal from './DatasetGeneratorModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import ExploratoryView from './ExploratoryView';
import MiraAssistant from './MiraAssistant';
import DataDashboardView from './DataDashboardView';
import { getApi } from '../pywebview';
import { toast } from 'sonner';

type Tab = 'home' | 'data_prep' | 'data_dashboard' | 'exploratory' | 'results' | 'desc_stats' | 'stat_tests_param' | 'stat_tests_nonparam' | 'stat_tests_normality' | 'stat_tests_association' | 'regs' | 'multivar' | 'chart_designer' | 'custom_dashboard' | 'interactive_lab' | 'stat_tests';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
  locked: boolean;
  lockedMessage?: string;
  requireData?: boolean;
  subItems?: NavItem[];
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: 'DONNÉES',
    items: [
      { id: 'data_prep', label: 'Préparation des données', icon: Database, locked: false, requireData: true },
      { id: 'data_dashboard', label: 'Aperçu Global & Filtres', icon: LayoutDashboard, locked: false, requireData: true },
      { id: 'exploratory', label: 'Exploration des relations', icon: Compass, locked: false, requireData: true },
    ]
  },
  {
    id: 'analysis_stats',
    label: 'TESTS STATISTIQUES',
    items: [
      { id: 'desc_stats', label: 'Statistiques Descriptives', icon: BarChart2, locked: false, requireData: true },
      { id: 'stat_tests_normality', label: 'Tests de Normalité', icon: Activity, locked: false, requireData: true },
      { 
        id: 'stat_tests', 
        label: 'Tests de Comparaison', 
        icon: ArrowRightLeft, 
        locked: false, 
        requireData: true,
        subItems: [
          { id: 'stat_tests_param', label: 'Paramétriques', icon: Activity, locked: false, requireData: true },
          { id: 'stat_tests_nonparam', label: 'Non Paramétriques', icon: Target, locked: false, requireData: true }
        ]
      },
      { id: 'stat_tests_association', label: "Tests d'Association", icon: Target, locked: false, requireData: true },
    ]
  },
  {
    id: 'analysis_advanced',
    label: 'MODÈLES AVANCÉS',
    items: [
      { id: 'regs', label: 'Régressions', icon: TrendingUp, locked: false, requireData: true },
      { id: 'multivar', label: 'Analyse Multivariée', icon: Target, locked: false, requireData: true },
    ]
  },
  {
    id: 'results',
    label: 'RÉSULTATS & GRAPHIQUES',
    items: [
      { id: 'results', label: 'Historique & Résultats', icon: FileText, locked: false },
      { id: 'custom_dashboard', label: 'Tableau de bord', icon: LayoutDashboard, locked: false },
      { id: 'chart_designer', label: 'Concepteur Graphique', icon: PieChart, locked: false, requireData: true },
    ]
  }
];

export default function MainLayout() {
  const activeTab = useWorkspaceStore((state) => state.activeDashboardTab);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveDashboardTab);
  const isReady = useWorkspaceStore((state) => state.isReady);
  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);
  const saveProject = useWorkspaceStore((state) => state.saveProject);
  const datasetName = useWorkspaceStore((state) => state.datasetName);
  const isSettingsModalOpen = useWorkspaceStore((state) => state.isSettingsModalOpen);
  const setSettingsModalOpen = useWorkspaceStore((state) => state.setSettingsModalOpen);
  const darkMode = useWorkspaceStore((state) => state.darkMode);

  const datasets = useWorkspaceStore((state) => state.datasets) || [];
  const activeDatasetId = useWorkspaceStore((state) => state.activeDatasetId);
  const switchDataset = useWorkspaceStore((state) => state.switchDataset);
  const triggerImport = useWorkspaceStore((state) => state.triggerImport);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveFilename, setSaveFilename] = useState('');

  const openMira = useWorkspaceStore((state) => state.openMira);
  const miraWidgetOpen = useWorkspaceStore((state) => state.miraWidgetOpen);
  const closeMira = useWorkspaceStore((state) => state.closeMira);

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratorOpen = useWorkspaceStore((state) => state.isGeneratorOpen);
  const setIsGeneratorOpen = useWorkspaceStore((state) => state.setIsGeneratorOpen);
  const [isShortcutOverlayOpen, setIsShortcutOverlayOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const triggerSaveModal = () => {
    const rawName = datasetName || 'projet_stat_nura';
    const sanitized = rawName.replace(/[^a-z0-9_-]/gi, '_');
    setSaveFilename(sanitized);
    setIsSaveModalOpen(true);
  };

  const handleSaveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveFilename.trim()) return;
    setIsSaveModalOpen(false);
    await saveProject(saveFilename.trim());
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    // If running in PC Webview (Python backend)
    if ((window as any).pywebview) {
      try {
        const api = getApi();
        if (api.toggle_fullscreen) {
          await api.toggle_fullscreen();
          setIsFullscreen(!isFullscreen);
          return;
        }
      } catch (err) {
        console.error("Erreur de plein écran via pywebview:", err);
      }
    }
    
    // Web environment fallback
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Erreur d'activation du plein écran: ${err.message}`);
        toast.error("Plein écran non supporté ou bloqué par le navigateur.");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();

      // Ctrl/Cmd + M: Toggle Mira Assistant (works even when typing inside fields for instant toggle)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && keyLower === 'm') {
        e.preventDefault();
        const state = useWorkspaceStore.getState();
        if (state.miraWidgetOpen) {
          state.closeMira();
          toast.info("Assistant Mira fermé.");
        } else {
          state.openMira();
          toast.success("Assistant Mira ouvert !");
        }
        return;
      }

      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.hasAttribute('contenteditable') ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (isTyping) return;

      // Toggle help overlay with `?` key
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutOverlayOpen((prev) => !prev);
        return;
      }

      // Navigation: Alt + 1 to Alt + 9
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const keyNum = parseInt(e.key, 10);
        if (keyNum >= 1 && keyNum <= 9) {
          e.preventDefault();
          const targetTabs: { [key: number]: { tab: Tab; label: string; requireData: boolean } } = {
            1: { tab: 'home', label: 'Accueil / Tableau de bord', requireData: false },
            2: { tab: 'data_prep', label: 'Préparation des données', requireData: true },
            3: { tab: 'desc_stats', label: 'Statistiques Descriptives', requireData: true },
            4: { tab: 'stat_tests_param', label: 'Tests Paramétriques', requireData: true },
            5: { tab: 'stat_tests_nonparam', label: 'Tests Non Paramétriques', requireData: true },
            6: { tab: 'regs', label: 'Régressions', requireData: true },
            7: { tab: 'multivar', label: 'Analyse Multivariée', requireData: true },
            8: { tab: 'results', label: 'Historique & Résultats', requireData: false },
            9: { tab: 'chart_designer', label: 'Concepteur Graphique', requireData: true },
          };
          const target = targetTabs[keyNum];
          if (target) {
            if (target.requireData && !isReady) {
              toast.error(`"${target.label}" requiert un jeu de données chargé.`);
            } else {
              useWorkspaceStore.setState({ workspaceMode: 'dashboard' });
              setActiveTab(target.tab as any);
              toast.success(`Navigation : ${target.label}`);
            }
          }
          return;
        }
      }

      // Ctrl/Cmd + I: Import dataset
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && keyLower === 'i') {
        e.preventDefault();
        triggerImport();
        toast.info("Importation de fichier demandée...");
        return;
      }

      // Ctrl/Cmd + G: Simulate dataset
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && keyLower === 'g') {
        e.preventDefault();
        setIsGeneratorOpen(true);
        toast.info("Générateur de données simulées ouvert.");
        return;
      }

      // Ctrl/Cmd + S: Save project
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && keyLower === 's') {
        e.preventDefault();
        if (!isReady) {
          toast.error("Aucune donnée active à sauvegarder.");
        } else {
          triggerSaveModal();
        }
        return;
      }

      // Ctrl + Shift + N: Normality test
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && keyLower === 'n') {
        e.preventDefault();
        if (!isReady) {
          toast.error("Le test de normalité requiert un jeu de données chargé.");
        } else {
          useWorkspaceStore.setState({ workspaceMode: 'dashboard' });
          setActiveTab('stat_tests_normality');
          toast.success("Lancement : Tests de Normalité");
        }
        return;
      }

      // Ctrl + Shift + A: Association test
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && keyLower === 'a') {
        e.preventDefault();
        if (!isReady) {
          toast.error("Le test d'association requiert un jeu de données chargé.");
        } else {
          useWorkspaceStore.setState({ workspaceMode: 'dashboard' });
          setActiveTab('stat_tests_association');
          toast.success("Lancement : Tests d'Association");
        }
        return;
      }

      if (
        (keyLower === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (keyLower === 'f' && e.ctrlKey && e.shiftKey) ||
        (e.key === 'F11')
      ) {
        e.preventDefault();
        toggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isReady, triggerImport, setActiveTab, triggerSaveModal, setIsGeneratorOpen, setIsShortcutOverlayOpen, isFullscreen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // All actionable tests for search discovery
  const ALL_TEST_SHORTCUTS = [
    { id: 'stat_tests_param', label: 'Test t de Student', keywords: ['t-test', 'student', 'moyenne', 'paramétrique'] },
    { id: 'stat_tests_param', label: 'ANOVA', keywords: ['anova', 'variance', 'f-test', 'moyenne'] },
    { id: 'stat_tests_nonparam', label: 'Mann-Whitney U', keywords: ['u-test', 'wilcoxon', 'rangs', 'non-paramétrique'] },
    { id: 'stat_tests_nonparam', label: 'Kruskal-Wallis', keywords: ['kruskal', 'variance', 'rangs'] },
    { id: 'stat_tests_nonparam', label: 'Chi-Deux', keywords: ['chi2', 'dépendance', 'indépendance', 'nominale'] },
    { id: 'regs', label: 'Régression Linéaire', keywords: ['linéaire', 'ols', 'prédiction'] },
    { id: 'regs', label: 'Régression Logistique', keywords: ['logistique', 'binaire', 'odds'] },
    { id: 'multivar', label: 'ACP / PCA', keywords: ['acp', 'pca', 'composantes', 'dimensions'] },
    { id: 'multivar', label: 'Analyse Factorielle', keywords: ['facteur', 'exploratoire'] },
  ];

  const filteredNavGroups = NAV_GROUPS.map(group => {
    const filteredItems = group.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  // If searching, also look into specific tests
  const searchResults = searchQuery.length > 1 
    ? ALL_TEST_SHORTCUTS.filter(test => 
        test.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
      ).filter(test => !filteredNavGroups.some(g => g.items.some(i => i.label === test.label)))
    : [];

  const allNavItems = NAV_GROUPS.flatMap(g => g.items);
  const activeItem = allNavItems.find(item => item.id === activeTab);





  // Save functions defined earlier

  const handleTabClick = (item: NavItem) => {
    if (item.requireData && !isReady) {
      return;
    }
    setActiveTab(item.id as any);
    setOpenDropdown(null);
  };

  const userName = useWorkspaceStore((state) => state.userName) || 'Utilisateur';

  const userInitials = userName !== 'Utilisateur' && userName.length > 0 
    ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US';

  const nameParts = userName.trim().split(' ');
  const firstName = nameParts[0] || 'Utilisateur';
  const lastName = nameParts.slice(1).join(' ');

  const handleLogout = () => {
    useWorkspaceStore.setState({ isLoggedIn: false });
  };

  return (
    <div className={`flex flex-col h-screen bg-slate-50 overflow-hidden font-sans ${darkMode ? 'dark' : ''}`}>
      {/* Top Header Navigation */}
      <div className="pt-3 px-3 shrink-0 relative z-50">
        <header className="h-16 bg-slate-950 border border-slate-900 rounded-2xl flex items-center justify-between px-4 shadow-xl">
          
          {/* Left: Brand and Search */}
        <div className="flex items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('home')}
              className="w-9 h-9 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              title="Accueil"
            >
              <Home className="w-5 h-5 text-slate-400 hover:text-slate-200" />
            </button>
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col">
              <h1 className="text-xs font-black text-white tracking-widest uppercase leading-tight">NURU ANALYTICS</h1>
              <span className="text-[9px] text-emerald-400 font-bold tracking-widest uppercase">PREMIUM EDITION</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative hidden md:block w-64">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Rechercher un test..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Search Dropdown Results */}
            {searchQuery && (searchResults.length > 0 || filteredNavGroups.length > 0) && (
              <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700">
                {searchResults.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 pb-1 text-[9px] font-black tracking-widest text-emerald-500 uppercase">RÉSULTATS DE TESTS</div>
                    {searchResults.map((test, idx) => (
                      <button
                        key={`search-test-${idx}`}
                        onClick={() => {
                          setActiveTab(test.id as any);
                          setSearchQuery('');
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-3 hover:bg-slate-800 text-left transition-colors cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-slate-200">{test.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {filteredNavGroups.map(group => (
                  <div key={group.id} className="mb-2 last:mb-0">
                    <div className="px-3 pb-1 text-[9px] font-black tracking-widest text-slate-500 uppercase">{group.label}</div>
                    {group.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          disabled={item.requireData && !isReady}
                          onClick={() => { handleTabClick(item); setSearchQuery(''); }}
                          className={`w-full px-3 py-1.5 flex items-center gap-3 text-left transition-colors cursor-pointer
                            ${item.requireData && !isReady ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800'}
                          `}
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Navigation Menus */}
        <nav className="flex items-center justify-center flex-1 mx-2 gap-0.5 sm:gap-1 overflow-visible whitespace-nowrap">
          {NAV_GROUPS.map((group) => (
            <div 
              key={group.id}
              className="relative shrink-0"
              onMouseEnter={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setOpenDropdown(group.id);
              }}
              onMouseLeave={() => {
                timeoutRef.current = setTimeout(() => setOpenDropdown(null), 300);
              }}
            >
              <button 
                onClick={() => setOpenDropdown(openDropdown === group.id ? null : group.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors border ${openDropdown === group.id ? 'bg-slate-900 border-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent'}`}
                aria-haspopup="true"
              >
                {group.label}
              </button>
              
              {/* Dropdown Menu */}
              {openDropdown === group.id && (
                group.id === 'core' ? (
                  <div className="absolute top-full left-0 mt-2.5 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-slate-100 flex flex-col gap-4">
                    {/* Header of core section */}
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Gestion des Données</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-2 py-0.5 rounded-full font-mono">
                        {datasets.length} jeu{datasets.length > 1 ? 'x' : ''}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setOpenDropdown(null);
                          triggerImport();
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-950/60 hover:bg-slate-950 transition-all font-semibold gap-1.5 group cursor-pointer text-center"
                      >
                        <span className="p-1 px-1.5 rounded-lg bg-emerald-950/50 text-emerald-400 group-hover:bg-emerald-900/40 transition-colors">
                          <Plus className="w-3.5 h-3.5 inline" />
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-300 tracking-wide">Fichier</span>
                      </button>

                      <button
                        onClick={() => {
                          setOpenDropdown(null);
                          useWorkspaceStore.getState().triggerImportCrosstab();
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 hover:border-purple-500/30 bg-slate-950/60 hover:bg-slate-950 transition-all font-semibold gap-1.5 group cursor-pointer text-center"
                      >
                        <span className="p-1 px-1.5 rounded-lg bg-purple-950/50 text-purple-400 group-hover:bg-purple-900/40 transition-colors">
                          <Table2 className="w-3.5 h-3.5 inline" />
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-300 tracking-wide">Tableau Croisé</span>
                      </button>

                      <button
                        onClick={() => {
                          setOpenDropdown(null);
                          setIsGeneratorOpen(true);
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 hover:border-indigo-500/30 bg-slate-950/60 hover:bg-slate-950 transition-all font-semibold gap-1.5 group cursor-pointer text-center"
                      >
                        <span className="p-1 px-1.5 rounded-lg bg-indigo-950/50 text-indigo-400 group-hover:bg-indigo-900/40 transition-colors">
                          <Sparkles className="w-3.5 h-3.5 inline animate-pulse" />
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-300 tracking-wide">Simuler</span>
                      </button>
                    </div>

                    {/* Dataset list / Selector */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Jeux de données chargés</div>
                      
                      {datasets.length === 0 ? (
                        <div className="p-3 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
                          <p className="text-[10px] font-semibold text-slate-500 italic">Aucun jeu de données chargé</p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-36 overflow-y-auto overflow-x-hidden pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-800 w-full">
                          {datasets.map((ds) => {
                            const isCurrent = ds.id === activeDatasetId;
                            return (
                              <div key={ds.id} className="relative group w-full flex items-center min-w-0">
                                <button
                                  onClick={() => {
                                    switchDataset(ds.id);
                                    setOpenDropdown(null);
                                  }}
                                  className={`flex-1 flex items-center justify-between p-2 pr-8 rounded-lg text-left border transition-all cursor-pointer min-w-0
                                    ${isCurrent 
                                      ? 'bg-emerald-950/30 border-emerald-500/30 text-white font-semibold' 
                                      : 'bg-transparent hover:bg-slate-800/40 border-slate-900 hover:border-slate-800 text-slate-300'
                                    }
                                  `}
                                >
                                  <div className="flex items-center gap-2 max-w-[85%] min-w-0 flex-1">
                                    <div className={`p-1 rounded shrink-0 ${isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-505'}`}>
                                      <Database className="w-3 h-3" />
                                    </div>
                                    <div className="truncate min-w-0 flex-1">
                                      <p className="text-[10px] font-bold text-slate-200 leading-tight truncate" title={ds.name}>{ds.name}</p>
                                      <p className="text-[8px] text-slate-500 font-bold font-mono truncate">
                                        {ds.rowCount} lignes • {ds.colCount} vars
                                      </p>
                                    </div>
                                  </div>
                                  {isCurrent && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 shrink-0" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    useWorkspaceStore.getState().removeDataset(ds.id);
                                  }}
                                  className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-md shrink-0"
                                  title="Supprimer ce jeu de données"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Standard items like Préparation (if active) */}
                    <div className="border-t border-slate-800 pt-2">
                      {group.items.map(item => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        const isDisabled = item.requireData && !isReady;
                        return (
                          <button
                            key={item.id}
                            disabled={isDisabled}
                            onClick={() => {
                              setOpenDropdown(null);
                              handleTabClick(item);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] font-bold tracking-wide transition-colors cursor-pointer
                              ${isDisabled
                                ? 'text-slate-600 opacity-40 cursor-not-allowed'
                                : isActive 
                                  ? 'bg-emerald-950/40 text-emerald-400' 
                                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-emerald-400'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span>{item.label}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-505 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;
                      const isDisabled = item.requireData && !isReady;
                      
                      return (
                        <React.Fragment key={item.id}>
                          <button
                            onClick={() => !item.subItems && handleTabClick(item)}
                            disabled={isDisabled}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[11px] font-bold tracking-wide transition-colors cursor-pointer
                              ${isDisabled 
                                ? 'text-slate-400 opacity-50 cursor-not-allowed' 
                                : isActive 
                                  ? 'bg-emerald-50/50 text-emerald-700' 
                                  : 'text-slate-700 hover:bg-slate-50/80 hover:text-indigo-600'
                              }
                              ${item.subItems ? 'cursor-default opacity-80' : ''}
                            `}
                          >
                            <div className={`p-1.5 rounded-md ${isActive ? 'bg-emerald-100/50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                               <Icon className="w-3.5 h-3.5" />
                            </div>
                            {item.label}
                          </button>
                          {item.subItems && (
                            <div className="px-3 pb-1.5 space-y-0.5">
                              {item.subItems.map(subItem => {
                                const isSubActive = activeTab === subItem.id;
                                const SubIcon = subItem.icon;
                                return (
                                  <button
                                    key={subItem.id}
                                    onClick={() => handleTabClick(subItem)}
                                    disabled={subItem.requireData && !isReady}
                                    className={`w-full flex items-center gap-2 pl-9 pr-2 py-1.5 text-left text-[10px] font-bold tracking-wide rounded-md transition-colors cursor-pointer
                                      ${(subItem.requireData && !isReady) ? 'text-slate-400 opacity-50 cursor-not-allowed' : isSubActive ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}
                                    `}
                                  >
                                    <SubIcon className="w-3 h-3" />
                                    {subItem.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          ))}
        </nav>

        {/* Right: Actions and User */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => openMira()}
            className="flex items-center gap-1.5 p-1.5 px-3 bg-indigo-900 border border-indigo-500/50 hover:bg-indigo-800 text-indigo-100 font-bold rounded-lg transition-colors cursor-pointer mr-1"
            title="Mira, l'assistante IA de Nuru Lab"
          >
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span className="text-xs">Mira Analyste</span>
          </button>

          {isReady && (
            <button
              onClick={triggerSaveModal}
              className="flex items-center justify-center p-2.5 bg-indigo-900/40 hover:bg-indigo-900 border border-indigo-800/50 text-indigo-300 hover:text-indigo-100 rounded-lg transition-all cursor-pointer"
              title="Sauvegarder le Projet (.nra)"
            >
              <Save className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleFullScreen}
            className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-900 rounded-md transition-colors cursor-pointer mr-1"
            title={isFullscreen ? "Quitter le plein écran (Raccourci: F ou F11)" : "Activer le plein écran (Raccourci: F ou F11)"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsShortcutOverlayOpen(true)}
            className="p-1.5 text-slate-500 hover:text-orange-400 hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
            title="Raccourcis clavier (Raccourci: ?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
              onClick={() => setSettingsModalOpen(true)}
              className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
              title="Paramètres"
            >
              <Settings className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-extrabold text-[11px]">{userInitials}</span>
              </div>
              <div className="hidden md:flex flex-col text-left max-w-[90px]">
                <span className="text-slate-200 text-xs font-semibold leading-tight truncate" title={firstName}>{firstName}</span>
                {lastName && <span className="text-slate-400 text-[10px] font-medium leading-tight truncate" title={lastName}>{lastName}</span>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        </header>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50 dark:bg-slate-950 px-3 pt-2 pb-3">
        {activeItem?.locked ? (
          <div className="flex-1 m-2 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative flex items-center justify-center">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="relative z-10 flex flex-col items-center max-w-md text-center p-8 backdrop-blur-xl bg-white/40 dark:bg-slate-950/40 border border-white/60 dark:border-slate-800/60 rounded-3xl shadow-2xl">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-slate-200 dark:border-slate-800">
                <Lock className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">{activeItem.label}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{activeItem.lockedMessage}</p>
              
              <button 
                onClick={() => setActiveTab('data_prep')}
                className="mt-8 px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-slate-200 hover:scale-[1.02] active:scale-95 transition-all duration-300"
              >
                Retour à la préparation
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 m-2 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            {workspaceMode === 'manual_setup' ? (
              <VariableDesigner />
            ) : workspaceMode === 'manual_data_entry' ? (
              <ManualDataEntry />
            ) : (
              <>
                {activeTab === 'home' && <WelcomeScreen />}
                {activeTab === 'data_prep' && <DataPreparationView />}
                {activeTab === 'data_dashboard' && <DataDashboardView />}
                {activeTab === 'exploratory' && <ExploratoryView />}
                {activeTab === 'results' && <ResultsDashboard />}
                {activeTab === 'desc_stats' && <DescriptiveStatsView />}
                {['stat_tests', 'stat_tests_param', 'stat_tests_nonparam', 'stat_tests_normality', 'stat_tests_association'].includes(activeTab) && (
                  <StatTestsView 
                    filterTag={
                      activeTab === 'stat_tests_param' ? 'param' : 
                      activeTab === 'stat_tests_nonparam' ? 'nonparam' : 
                      activeTab === 'stat_tests_normality' ? 'normality' : 
                      activeTab === 'stat_tests_association' ? 'association' : undefined
                    } 
                  />
                )}
                {activeTab === 'interactive_lab' && <InteractiveLab />}
                {activeTab === 'regs' && <RegressionsView />}
                {activeTab === 'multivar' && <MultivariateAnalysisView />}
                {activeTab === 'chart_designer' && <ChartDesigner />}
                {activeTab === 'custom_dashboard' && <DashboardBuilder />}
              </>
            )}
          </div>
        )}
      </main>

      {/* Premium Save Project Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-6 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Save className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Enregistrer la séance</h3>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Séance de travail .nra</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSaveConfirm} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Nom du fichier de projet
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={saveFilename}
                    onChange={(e) => setSaveFilename(e.target.value)}
                    placeholder="mon_projet_stat"
                    required
                    className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-3 pr-14 py-3 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-mono"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-xs font-bold text-slate-400 font-mono">.nra</span>
                  </div>
                </div>
              </div>

              {/* Advanced info alert */}
              <div className="bg-indigo-50/60 border border-indigo-100/40 rounded-2xl p-4 text-xs text-indigo-950 flex gap-3 leading-relaxed">
                <FolderOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-indigo-900">Emplacement de sauvegarde :</p>
                  <p className="text-slate-500 text-[11px]">
                    Le navigateur ouvrira sa boîte de dialogue pour vous permettre de choisir l'emplacement d'enregistrement sur votre ordinateur.
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition duration-200 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  Enregistrer
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      
      {isSettingsModalOpen && <SettingsModal onClose={() => setSettingsModalOpen(false)} />}
      {isGeneratorOpen && <DatasetGeneratorModal onClose={() => setIsGeneratorOpen(false)} />}
      {isShortcutOverlayOpen && <KeyboardShortcutsModal onClose={() => setIsShortcutOverlayOpen(false)} />}
      {miraWidgetOpen && <MiraAssistant onClose={closeMira} />}
    </div>
  );
}
