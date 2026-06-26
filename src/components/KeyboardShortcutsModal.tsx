import React, { useState } from 'react';
import { X, Keyboard, Search, ArrowRightLeft, Database, BarChart2, TrendingUp, Target, FileText, LayoutDashboard, PieChart, Settings, Maximize2, Save, Sparkles, Activity } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'navigation' | 'data' | 'tests' | 'system';
  icon?: React.ComponentType<any>;
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { keys: ['Alt', '1'], description: 'Aller à l\'Accueil / Tableau de bord', category: 'navigation', icon: LayoutDashboard },
  { keys: ['Alt', '2'], description: 'Aller à la Préparation des données', category: 'navigation', icon: Database },
  { keys: ['Alt', '3'], description: 'Aller aux Statistiques Descriptives', category: 'navigation', icon: BarChart2 },
  { keys: ['Alt', '4'], description: 'Aller aux Tests Paramétriques', category: 'navigation', icon: Activity },
  { keys: ['Alt', '5'], description: 'Aller aux Tests Non Paramétriques', category: 'navigation', icon: Target },
  { keys: ['Alt', '6'], description: 'Aller aux Régressions', category: 'navigation', icon: TrendingUp },
  { keys: ['Alt', '7'], description: 'Aller à l\'Analyse Multivariée', category: 'navigation', icon: Target },
  { keys: ['Alt', '8'], description: 'Aller à l\'Historique & Résultats', category: 'navigation', icon: FileText },
  { keys: ['Alt', '9'], description: 'Aller au Concepteur Graphique', category: 'navigation', icon: PieChart },

  // Data management
  { keys: ['Ctrl', 'I'], description: 'Importer un fichier (CSV, Excel, SPSS)', category: 'data', icon: Database },
  { keys: ['Ctrl', 'G'], description: 'Simuler un jeu de données', category: 'data', icon: Sparkles },
  { keys: ['Ctrl', 'S'], description: 'Sauvegarder le Projet actif (.nra)', category: 'data', icon: Save },

  // Tests
  { keys: ['Ctrl', 'Shift', 'N'], description: 'Lancer un Test de Normalité', category: 'tests', icon: Activity },
  { keys: ['Ctrl', 'Shift', 'A'], description: 'Lancer un Test d\'Association', category: 'tests', icon: ArrowRightLeft },

  // System
  { keys: ['Ctrl', 'M'], description: 'Ouvrir / Fermer l\'Assistante IA Mira', category: 'system', icon: Sparkles },
  { keys: ['F'], description: 'Basculer le mode Plein écran', category: 'system', icon: Maximize2 },
  { keys: ['?'], description: 'Afficher / Masquer ce guide', category: 'system', icon: Keyboard },
];

export default function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'navigation' | 'data' | 'tests' | 'system'>('all');

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  const formatKey = (key: string) => {
    if (key === 'Ctrl') return isMac ? '⌘' : 'Ctrl';
    if (key === 'Alt') return isMac ? '⌥' : 'Alt';
    if (key === 'Shift') return isMac ? '⇧' : 'Shift';
    return key;
  };

  const filteredShortcuts = SHORTCUTS.filter(s => {
    const matchesSearch = s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'Tous' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'data', label: 'Données' },
    { id: 'tests', label: 'Analyses' },
    { id: 'system', label: 'Système' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-widest uppercase">Raccourcis Clavier</h3>
              <p className="text-[10px] font-bold text-slate-500 font-mono">OPTIMISEZ VOTRE FLUX DE TRAVAIL</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters and Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer
                  ${activeCategory === cat.id 
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }
                `}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un raccourci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-all"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 min-h-[250px] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-track]:bg-transparent">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-semibold text-slate-500 italic">Aucun raccourci ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredShortcuts.map((shortcut, index) => {
                const Icon = shortcut.icon;
                return (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-800 hover:bg-slate-950/80 transition-all group"
                  >
                    <div className="flex items-center gap-3 max-w-[65%]">
                      {Icon && (
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="text-[11px] font-semibold text-slate-300 leading-tight">
                        {shortcut.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="px-2 py-1 text-[10px] font-black font-mono text-slate-200 bg-slate-800 border border-slate-700 rounded-md shadow-md min-w-[20px] text-center">
                            {formatKey(key)}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-slate-600 text-[10px] font-bold font-mono">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center shrink-0">
          <p className="text-[9px] font-bold text-slate-500 font-mono tracking-widest uppercase">
            ASTUCE : APPUYEZ SUR LA TOUCHE <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 mx-1">?</kbd> À TOUT MOMENT POUR OUVRIR OU FERMER CE GUIDE
          </p>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  );
}
