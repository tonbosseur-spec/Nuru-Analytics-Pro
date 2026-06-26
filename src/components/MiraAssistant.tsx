import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store';
import { Sparkles, X, Send, Bot, User, Presentation, Target, Activity, FileText, FileSearch, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { convertMarkdownToStyledHtml } from '../utils/markdownToHtml';
import MiraAvatar from './MiraAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Plot from 'react-plotly.js';
import { motion } from 'motion/react';

export default function MiraAssistant({ onClose }: { onClose: () => void }) {
  const history = useWorkspaceStore(state => state.history);
  const datasetName = useWorkspaceStore(state => state.datasetName);
  const columns = useWorkspaceStore(state => state.columns);
  const geminiApiKey = useWorkspaceStore(state => state.geminiApiKey);
  const miraApiProvider = useWorkspaceStore(state => state.miraApiProvider);
  const miraApiKey = useWorkspaceStore(state => state.miraApiKey);
  const miraApiModel = useWorkspaceStore(state => state.miraApiModel);
  const miraApiBaseUrl = useWorkspaceStore(state => state.miraApiBaseUrl);
  
  const miraChats = useWorkspaceStore(state => state.miraChats);
  const setMiraChat = useWorkspaceStore(state => state.setMiraChat);
  const clearMiraChat = useWorkspaceStore(state => state.clearMiraChat);
  const miraActiveAnalysisId = useWorkspaceStore(state => state.miraActiveAnalysisId);
  const openMira = useWorkspaceStore(state => state.openMira);

  const chatId = miraActiveAnalysisId || 'general';

  const initialWelcome: {role: 'model'|'user', text: string}[] = [
    {
      role: 'model',
      text: "Bonjour ! Je suis **Mira**, l'assistante IA de Nuru Lab experte en statistiques. Je vois vos données et les analyses que vous avez déjà effectuées. Comment puis-je vous aider aujourd'hui ? Si vous souhaitez que j'interprète un résultat spécifique, vous pouvez le sélectionner dans la barre latérale !"
    }
  ];

  const [chatHistory, setChatHistory] = useState<{role: 'model' | 'user', text: string}[]>(
    miraChats[chatId] || initialWelcome
  );

  useEffect(() => {
    setChatHistory(miraChats[chatId] || initialWelcome);
  }, [chatId, miraChats]);

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [copiedIndex, setCopiedIndex] = useState<{index: number, type: 'rich' | 'raw'} | null>(null);

  const handleCopyFormatted = async (text: string, index: number) => {
    try {
      const htmlContent = convertMarkdownToStyledHtml(text);
      const cleanPlaintext = text.replace(/```plotly[\s\S]*?```/g, "[Graphique Plotly - Disponible dans l'application]");

      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([cleanPlaintext], { type: 'text/plain' });
        
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          })
        ]);
        toast.success("Copié avec toute la mise en forme (prêt pour Word/Docs/Mail) !");
      } else {
        await navigator.clipboard.writeText(cleanPlaintext);
        toast.success("Texte brut copié !");
      }

      setCopiedIndex({ index, type: 'rich' });
      setTimeout(() => setCopiedIndex(null), 3000);
    } catch (err: any) {
      console.error("Rich copy failed, falling back to text", err);
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Texte brut copié !");
        setCopiedIndex({ index, type: 'rich' });
        setTimeout(() => setCopiedIndex(null), 3000);
      } catch (innerErr) {
        toast.error("Échec de la copie.");
      }
    }
  };

  const handleCopyMarkdown = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texte brut (Markdown) copié !");
      setCopiedIndex({ index, type: 'raw' });
      setTimeout(() => setCopiedIndex(null), 3000);
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de la copie.");
    }
  };

  const activeResults = history;

  const activeTargetAnalysis = history.find(h => h.id === miraActiveAnalysisId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const newHistory = [...chatHistory, { role: 'user' as const, text: userMessage }];
    setChatHistory(newHistory);
    setMiraChat(chatId, newHistory);
    setMessage('');
    setIsLoading(true);

    try {
      // Build context
      const workspaceStore = useWorkspaceStore.getState();
      const activeAnalysisDetails = activeResults.find(r => r.id === miraActiveAnalysisId);

      const context = {
        dataset: {
          name: datasetName,
          rowCount: workspaceStore.rowCount || 0,
          colCount: workspaceStore.colCount || 0,
          columns: columns.map(c => ({ 
            name: c.name, 
            type: c.type,
            missingValuesCount: c.missing_values || 0,
            rawDataType: c.raw_dtype || ''
          })),
          sampleData: workspaceStore.previewData?.slice(0, 15) || []
        },
        analysesRealisees: activeResults.map(r => ({
          id: r.id,
          title: r.title,
          type: r.type,
          variables: r.variables,
          metrics: r.metrics,
          interpretation: r.interpretation || '',
          timestamp: r.timestamp || '',
          isActiveSelection: r.id === miraActiveAnalysisId
        })),
        activeAnalysisId: miraActiveAnalysisId,
        activeAnalysis: activeAnalysisDetails ? {
          title: activeAnalysisDetails.title,
          type: activeAnalysisDetails.type,
          variables: activeAnalysisDetails.variables,
          metrics: activeAnalysisDetails.metrics,
          interpretation: activeAnalysisDetails.interpretation || ''
        } : null
      };

      const API_KEY = geminiApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      
      let responseText = "";
      let serverResponseOk = false;

      // 1. Try to fetch from the server backend first
      try {
        const res = await fetch('/api/mira/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: API_KEY,
            miraApiProvider,
            miraApiKey,
            miraApiModel,
            miraApiBaseUrl,
            context: context,
            chatHistory: newHistory.slice(1, -1),
            message: userMessage
          })
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data && data.text) {
              responseText = data.text;
              serverResponseOk = true;
            }
          }
        } else {
          console.warn(`Server returned status ${res.status}. Attempting direct client-side fallback...`);
        }
      } catch (serverErr) {
        console.warn("Server API call failed, will try direct browser fallback:", serverErr);
      }

      // 2. Direct browser fallback if server call is not successful
      if (!serverResponseOk) {
        const provider = miraApiProvider || 'gemini';
        const key = miraApiKey || geminiApiKey || API_KEY;

        const systemInstruction = `Tu es Mira, l'assistante IA de Nuru Lab dédiée à l'aide et à l'analyse statistique de pointe et haute précision.
        Tu es une experte de niveau international en biostatistiques, économétrie, science des données, méthodologie de recherche et rédaction scientifique.

        CAPACITÉS MULTI-ANALYSES ET INTERPRÉTATIONS TRANSVERSALES :
        1. Ton objectif suprême est d'analyser l'intégralité du projet de recherche. Tu ne dois pas te limiter à l'examen d'une seule analyse isolée.
        2. Tu dois croiser dynamiquement tous les résultats et conclusions de la liste "analysesRealisees" (fournie ci-dessous) pour en extraire des interprétations unifiées, complexes et transversales.
        3. Tu es capable de guider, expliquer et simuler tous les traitements et analyses statistiques disponibles dans le logiciel Nuru Lab.

        UTILISATION DU CONTEXTE :
        Voici l'état complet du projet de recherche actuel de l'utilisateur :
        ${JSON.stringify(context, null, 2)}

        CONSIGNE DE VISUALISATION :
        Tu as la possibilité d'utiliser la bibliothèque de visualisation Plotly pour générer des graphiques (via un bloc \`\`\`plotly ... \`\`\`), mais CE N'EST PAS OBLIGATOIRE.
        Fais-le UNIQUEMENT si l'utilisateur te le demande explicitement, afin de garantir des réponses très rapides.

        FORMATAGE DU TEXTE ET MATHEMATIQUES :
        Tu dois formater tes réponses en Markdown. Utilise les puces, l'italique, le texte en gras et les blocs de citation de manière structurée.
        Pour les formules mathématiques et statistiques, utilise absolument la syntaxe LaTeX entre les symboles $ pour l'inline (ex: $\\alpha = 0.05$) et $$ pour les blocs centrés.

        Réponds toujours de manière claire, structurée (avec des puces, du gras, etc.) et en français.`;

        if (provider === 'gemini') {
          if (!key) {
            throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé dans les Paramètres (icône en haut à droite).");
          }
          const modelName = miraApiModel || "gemini-3.5-flash";
          const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
          
          const contents = newHistory.slice(1, -1).map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text }]
          }));
          contents.push({ role: 'user', parts: [{ text: userMessage }] });

          const directRes = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              contents
            })
          });

          if (!directRes.ok) {
            const errData = await directRes.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Erreur directe Google Gemini (HTTP ${directRes.status})`);
          }

          const resData = await directRes.json();
          const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error("L'API Gemini directe n'a renvoyé aucun contenu.");
          }
          responseText = text;
        } else if (provider === 'openai' || provider === 'deepseek' || provider === 'custom') {
          if (!key && provider !== 'custom') {
            throw new Error(`La clé API pour ${provider} est requise dans les Paramètres.`);
          }

          let baseUrl = "https://api.openai.com/v1";
          if (provider === 'deepseek') {
            baseUrl = "https://api.deepseek.com/v1";
          } else if (provider === 'custom' && miraApiBaseUrl) {
            baseUrl = miraApiBaseUrl;
          }

          const model = miraApiModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
          const messages = [
            { role: "system", content: systemInstruction },
            ...newHistory.slice(1, -1).map((msg: any) => ({
              role: msg.role === 'model' ? 'assistant' : 'user',
              content: msg.text
            })),
            { role: "user", content: userMessage }
          ];

          const directUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (key) {
            headers["Authorization"] = `Bearer ${key}`;
          }

          const directRes = await fetch(directUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7
            })
          });

          if (!directRes.ok) {
            const errData = await directRes.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Erreur directe ${provider} (HTTP ${directRes.status})`);
          }

          const resData = await directRes.json();
          responseText = resData?.choices?.[0]?.message?.content || "";
        } else if (provider === 'anthropic') {
          if (!key) {
            throw new Error("La clé API Anthropic (Claude) est requise dans les Paramètres.");
          }

          const model = miraApiModel || 'claude-3-5-sonnet-latest';
          const messages = newHistory.slice(1, -1).map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.text
          }));
          messages.push({ role: "user", content: userMessage });

          const directRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json"
            },
            body: JSON.stringify({
              model,
              system: systemInstruction,
              messages,
              max_tokens: 4096,
              temperature: 0.7
            })
          });

          if (!directRes.ok) {
            const errData = await directRes.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Erreur directe Anthropic (HTTP ${directRes.status})`);
          }

          const resData = await directRes.json();
          responseText = resData?.content?.[0]?.text || "";
        } else {
          throw new Error(`Fournisseur non supporté : ${provider}`);
        }
      }

      if (!responseText) {
        throw new Error("L'assistant n me renvoie aucun contenu.");
      }

      const finalHistory = [...newHistory, { role: 'model' as const, text: responseText }];
      setChatHistory(finalHistory);
      setMiraChat(chatId, finalHistory);
    } catch (err: any) {
      console.error(err);
      let errorFriendly = "Une erreur est survenue lors de la communication de Mira avec l'API.";
      const errMsg = err.message || "";
      
      if (errMsg.includes("API key") || errMsg.includes("ApiKey") || errMsg.includes("introuvable") || errMsg.includes("403") || errMsg.includes("400") || errMsg.includes("Key not found")) {
        errorFriendly = "🔑 **Clé API manquante ou invalide :** La clé de l'API est introuvable ou incorrecte.\n\n👉 **Solution :** Allez dans l'icône **Engrenage (Paramètres)** en haut à droite de l'application et renseignez votre propre clé API (Google Gemini, OpenAI, Claude ou DeepSeek) pour rétablir la connexion.";
      } else if (errMsg.toLowerCase().includes("balance") || errMsg.toLowerCase().includes("credit") || errMsg.toLowerCase().includes("solde") || errMsg.toLowerCase().includes("insufficient")) {
        errorFriendly = "💳 **Solde de l'API insuffisant (Insufficient Balance) :** Les crédits gratuits ou payants de l'API par défaut du projet ont expiré ou sont épuisés.\n\n👉 **Solution immédiate :** Allez dans les **Paramètres (icône d'engrenage)** en haut à droite et renseignez **votre propre clé API personnelle** (Google Gemini, OpenAI, Claude ou DeepSeek). La configuration est stockée localement de manière sécurisée et vous offre un accès illimité !";
      } else if (errMsg.includes("Quota") || errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("exhausted")) {
        errorFriendly = "⏳ **Quota dépassé (Erreur 429) :** Le service a dépassé la limite gratuite de requêtes autorisée par minute ou par jour.\n\n👉 **Solution :** Veuillez patienter environ une minute avant de renvoyer votre message, ou configurez votre propre clé API payante/personnelle dans les **Paramètres** de l'app.";
      } else if (errMsg.includes("hors ligne") || errMsg.includes("connecté") || errMsg.includes("fetch") || errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("server")) {
        errorFriendly = "🌐 **Problème de connexion ou mode hors ligne :** L'assistant statistique n'arrive pas à joindre le serveur API.\n\n👉 **Note :** Vous pouvez toujours **consulter toutes vos interprétations et vos discussions passées hors-ligne** grâce au système de cache local ! Pour générer de nouvelles analyses scientifiques, assurez-vous d'avoir une connexion internet active.";
      } else {
        errorFriendly = `⚠️ **Erreur de communication :** ${errMsg}\n\nN'hésitez pas à vérifier votre clé API dans les Paramètres ou votre connexion réseau. Vos échanges passés restent entièrement consultables hors connexion.`;
      }
      
      const errorHistory = [...newHistory, { role: 'model' as const, text: errorFriendly }];
      setChatHistory(errorHistory);
      setMiraChat(chatId, errorHistory);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message);
    }
  };

  const askForInterpretation = (analysis: any) => {
    sendMessage(`Peux-tu interpréter de manière détaillée l'analyse nommée "${analysis.title}" (sujet : ${analysis.variables.join(', ')}) ?`);
  };

  const switchContext = (analysisId: string) => {
    openMira(analysisId);
  };

  const currentChatsTitle = activeTargetAnalysis 
    ? `Analyse: ${activeTargetAnalysis.title}` 
    : 'Conversation Générale';

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:p-8 animate-fade-in"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-slate-50 dark:bg-slate-950 rounded-3xl w-full h-[88vh] max-w-7xl flex overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800/80 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar - Analysis Results Context */}
      <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => switchContext('')}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!miraActiveAnalysisId ? 'bg-indigo-600 shadow-md' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200'}`}>
              <MiraAvatar size={24} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Général</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Toutes les données</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
          {activeResults.length === 0 ? (
            <div className="p-4 text-center">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Aucune analyse réalisée pour le moment.</p>
            </div>
          ) : (
            activeResults.map(res => {
              const isActive = miraActiveAnalysisId === res.id;
              return (
              <div 
                key={res.id} 
                className={`border rounded-xl p-3 transition-colors group cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-500/50 shadow-sm' 
                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => switchContext(res.id)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`p-1.5 rounded-md shadow-sm border ${isActive ? 'bg-indigo-100 border-indigo-200 dark:bg-indigo-800 dark:border-indigo-600' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700'}`}>
                      <Target className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-indigo-500'}`} />
                    </div>
                    <h3 className={`text-xs font-bold truncate ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>
                      {res.title}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {res.variables.map(v => (
                    <span key={v} className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono ${isActive ? 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/30' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                      {v}
                    </span>
                  ))}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    switchContext(res.id);
                    // use timeout to ensure context switches before sending message
                    setTimeout(() => {
                      sendMessage(`Peux-tu interpréter de manière détaillée l'analyse nommée "${res.title}" (sujet : ${res.variables.join(', ')}) ?`);
                    }, 50);
                  }}
                  className={`w-full py-1 text-[10px] font-bold tracking-wide rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 ${isActive ? 'bg-indigo-600 text-white' : 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30'}`}
                >
                  <Sparkles className="w-3 h-3" />
                  Interpréter
                </button>
              </div>
            )})
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 flex items-center justify-center">
              <MiraAvatar size={34} isThinking={isLoading} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">Mira Assistant</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-slate-500 font-medium max-w-[200px] sm:max-w-md truncate">{currentChatsTitle}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 pt-20 pb-4 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'model' ? (
                  <MiraAvatar size={34} isThinking={false} className="shrink-0" />
                ) : (
                  <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center shadow-sm bg-slate-200 dark:bg-slate-700">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'model' ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300' : 'bg-indigo-600 text-white'}`}>
                  <div className={`prose prose-sm max-w-none ${msg.role === 'model' ? 'dark:prose-invert prose-indigo' : 'prose-invert prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-indigo-200'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code(props) {
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || '');
                          const isPlotly = match && match[1] === 'plotly';

                          if (isPlotly) {
                            try {
                              const jsonStr = String(children).trim();
                              const chartData = JSON.parse(jsonStr);
                              return (
                                <div className="w-full my-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-inner not-prose">
                                  <div className="h-72">
                                    <Plot
                                      data={chartData.data || []}
                                      layout={{
                                        autosize: true,
                                        paper_bgcolor: 'transparent',
                                        plot_bgcolor: 'transparent',
                                        margin: { t: 40, r: 25, l: 50, b: 45 },
                                        legend: { orientation: 'h', y: -0.25 },
                                        font: { color: '#64748b' },
                                        ...chartData.layout
                                      }}
                                      useResizeHandler={true}
                                      style={{ width: '100%', height: '100%' }}
                                      config={{ displayModeBar: false, responsive: true }}
                                    />
                                  </div>
                                </div>
                              );
                            } catch (err: any) {
                              return (
                                <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs font-mono my-3">
                                  <div className="font-bold mb-1">⚠️ Erreur de rendu Plotly de Mira :</div>
                                  <p>{err.message}</p>
                                  <pre className="mt-2 text-[10px] opacity-70 p-2 bg-slate-100 dark:bg-slate-800 rounded overflow-auto max-h-36">{String(children)}</pre>
                                </div>
                              );
                            }
                          }

                          return (
                            <code className={className} {...rest}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  {msg.role === 'model' && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider font-mono uppercase">Mira Assistant IA</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyFormatted(msg.text, idx)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all active:scale-95 font-medium cursor-pointer text-[11px]"
                          title="Copier le texte avec le formatage original (titres, tableaux, gras, listes) pour Word, Google Docs, etc."
                        >
                          {copiedIndex?.index === idx && copiedIndex?.type === 'rich' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Formaté copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copier formaté (Word/Docs)</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCopyMarkdown(msg.text, idx)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 font-medium cursor-pointer text-[11px]"
                          title="Copier au format texte brut Markdown"
                        >
                          {copiedIndex?.index === idx && copiedIndex?.type === 'raw' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Brut copié !</span>
                            </>
                          ) : (
                            <>
                              <span>Copier brut</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 flex-row">
                <MiraAvatar size={34} isThinking={true} className="shrink-0" />
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0">
          <div className="max-w-4xl mx-auto flex gap-3 items-end">
            <button 
              onClick={() => {
                setChatHistory(initialWelcome);
                clearMiraChat(chatId);
              }}
              className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Effacer la conversation"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Posez une question sur vos données ou sélectionnez une analyse à gauche..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none p-3 max-h-32 min-h-[44px] text-sm text-slate-800 dark:text-slate-200 outline-none"
                rows={1}
              />
            </div>
            <button 
              onClick={() => sendMessage(message)}
              disabled={isLoading || !message.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all cursor-pointer shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  </div>
);
}
