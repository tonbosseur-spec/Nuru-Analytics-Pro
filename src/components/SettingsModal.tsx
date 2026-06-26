import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { X, Settings, Moon, Sun, Monitor, Key } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { 
    decimals, 
    alpha, 
    darkMode, 
    geminiApiKey,
    miraApiProvider,
    miraApiKey,
    miraApiModel,
    miraApiBaseUrl,
    setSettings 
  } = useWorkspaceStore();
  const [showKey, setShowKey] = useState(false);
  const [showMiraKey, setShowMiraKey] = useState(false);

  const getModelPlaceholder = () => {
    switch (miraApiProvider) {
      case 'gemini': return 'gemini-3.5-flash ou gemini-1.5-pro';
      case 'openai': return 'gpt-4o-mini ou gpt-4o';
      case 'anthropic': return 'claude-3-5-sonnet-latest';
      case 'deepseek': return 'deepseek-chat';
      case 'custom': return 'nom-de-votre-modele';
      default: return 'gemini-3.5-flash';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 relative my-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Paramètres généraux</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 max-h-[68vh] overflow-y-auto pr-1">
          {/* Decimals & Alpha layout */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                Décimales (analyses)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={decimals}
                onChange={(e) => setSettings({ decimals: parseInt(e.target.value) || 0 })}
                className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                Signification (Alpha)
              </label>
              <input
                type="number"
                min="0.001"
                max="0.5"
                step="0.01"
                value={alpha}
                onChange={(e) => setSettings({ alpha: parseFloat(e.target.value) || 0.05 })}
                className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dark Mode */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              Mode sombre
            </label>
            <button
              onClick={() => setSettings({ darkMode: !darkMode })}
              className={`p-2 px-3 rounded-xl flex items-center gap-2 transition-all duration-300 border ${
                darkMode 
                  ? 'bg-slate-900 border-slate-800' 
                  : 'bg-slate-100 border-slate-200'
              }`}
            >
              {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {darkMode ? 'Activé' : 'Désactivé'}
              </span>
            </button>
          </div>

          {/* Mira AI Custom Configuration SECTION */}
          <div className="pt-4 border-t border-slate-150">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <h4 className="text-xs font-extrabold uppercase text-indigo-600 tracking-widest">
                Configuration de l'IA (Mira Assistant)
              </h4>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                  Fournisseur d'IA
                </label>
                <select
                  value={miraApiProvider || 'gemini'}
                  onChange={(e) => {
                    const prov = e.target.value as any;
                    let defModel = 'gemini-3.5-flash';
                    if (prov === 'openai') defModel = 'gpt-4o-mini';
                    if (prov === 'anthropic') defModel = 'claude-3-5-sonnet-latest';
                    if (prov === 'deepseek') defModel = 'deepseek-chat';
                    if (prov === 'custom') defModel = '';
                    setSettings({ 
                      miraApiProvider: prov,
                      miraApiModel: defModel
                    });
                  }}
                  className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="gemini">Google Gemini (Par défaut)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="deepseek">DeepSeek (V3 / R1)</option>
                  <option value="custom">Compatible OpenAI (Local / OpenRouter / Ollama)</option>
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Clé API Personnelle</span>
                  <span className="text-[9px] text-slate-400 lowercase italic">Requis si hors Gemini standard</span>
                </label>
                <div className="relative">
                  <input
                    type={showMiraKey ? "text" : "password"}
                    value={miraApiKey || ''}
                    onChange={(e) => setSettings({ miraApiKey: e.target.value })}
                    placeholder={
                      miraApiProvider === 'gemini' ? 'AIzaSy... (Optionnelle si clé globale)' :
                      miraApiProvider === 'openai' ? 'sk-proj-...' :
                      miraApiProvider === 'anthropic' ? 'sk-ant-...' :
                      miraApiProvider === 'deepseek' ? 'sk-...' : 'Votre clé d\'accès...'
                    }
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 pr-12"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMiraKey(!showMiraKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold hover:text-slate-600 cursor-pointer"
                  >
                    {showMiraKey ? 'Cacher' : 'Voir'}
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                  Nom du Modèle
                </label>
                <input
                  type="text"
                  value={miraApiModel || ''}
                  onChange={(e) => setSettings({ miraApiModel: e.target.value })}
                  placeholder={getModelPlaceholder()}
                  className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Custom Base URL (Conditional) */}
              {(miraApiProvider === 'custom') && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                    Adresse Base API (Endpoint Base URL)
                  </label>
                  <input
                    type="text"
                    value={miraApiBaseUrl || ''}
                    onChange={(e) => setSettings({ miraApiBaseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1 ou http://localhost:11434/v1"
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">Sert à rediriger les requêtes vers OpenRouter, LM Studio ou Ollama localement.</p>
                </div>
              )}
            </div>
          </div>

          {/* Gemini Legacy API key wrapper if any component relies on global geminiApiKey */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400">
              * La configuration utilisateur est sauvegardée localement de manière sécurisée dans votre navigateur.
            </span>
          </div>

        </div>

        <div className="mt-6 pt-3 border-t border-slate-100">
          <button 
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition duration-200 cursor-pointer shadow-lg active:scale-95"
          >
            Enregistrer les configurations
          </button>
        </div>
      </div>
    </div>
  );
}
