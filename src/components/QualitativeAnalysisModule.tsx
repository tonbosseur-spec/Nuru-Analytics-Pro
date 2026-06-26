import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Upload, MessageSquare, List, Play, CheckCircle2, FileText, ChevronRight, Download, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';

interface QualitativeAnalysisModuleProps {
  onBack: () => void;
}

interface ProjectData {
  name: string;
  description: string;
  language: string;
  identificationVariables: string[];
}

interface Respondent {
  id: string;
  variables: Record<string, string>;
  responses: string[];
}

export default function QualitativeAnalysisModule({ onBack }: QualitativeAnalysisModuleProps) {
  const { geminiApiKey } = useWorkspaceStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 states
  const [project, setProject] = useState<ProjectData>({
    name: '',
    description: '',
    language: 'Français',
    identificationVariables: []
  });
  const [newProjectVar, setNewProjectVar] = useState('');

  // Step 2 states
  const [questions, setQuestions] = useState<string[]>(['']);

  // Step 3 states
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [newRespondentId, setNewRespondentId] = useState('');
  const [newRespondentPropKey, setNewRespondentPropKey] = useState('');
  const [newRespondentPropValue, setNewRespondentPropValue] = useState('');
  const [newRespondentProps, setNewRespondentProps] = useState<Record<string, string>>({});
  const [newRespondentResponses, setNewRespondentResponses] = useState<string[]>([]);
  
  // Save / Load state
  const [savedProjects, setSavedProjects] = useState<{id: string, name: string, date: string, project: ProjectData, questions: string[], respondents: Respondent[], analysisResult?: any}[]>(() => {
    try {
      const saved = localStorage.getItem('astral_qa_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const fetchProjects = async () => {
      const api = getApi();
      if (api.get_store_item) {
        const res = await api.get_store_item('astral_qa_projects');
        if (res.success && res.value) {
          setSavedProjects(res.value);
        }
      }
    };
    fetchProjects();
  }, []);

  const handleSaveProject = async () => {
    if (!project.name.trim()) {
      toast.error("Veuillez donner un nom au projet avant de sauvegarder.");
      return;
    }
    const newSaved = {
      id: Date.now().toString(),
      name: project.name,
      date: new Date().toLocaleDateString(),
      project,
      questions,
      respondents,
      analysisResult
    };
    
    // Update if same name
    const existingIndex = savedProjects.findIndex(p => p.name === project.name);
    let updated;
    if (existingIndex >= 0) {
       updated = [...savedProjects];
       updated[existingIndex] = { ...newSaved, id: updated[existingIndex].id };
    } else {
       updated = [newSaved, ...savedProjects];
    }
    
    setSavedProjects(updated);
    localStorage.setItem('astral_qa_projects', JSON.stringify(updated));
    const api = getApi();
    if (api.set_store_item) {
      await api.set_store_item('astral_qa_projects', updated);
    }
    toast.success("Projet sauvegardé avec succès !");
  };

  const handleLoadProject = (p: any) => {
    setProject(p.project);
    setQuestions(p.questions);
    setRespondents(p.respondents);
    setAnalysisResult(p.analysisResult || null);
    if (p.analysisResult) setStep(4);
    else if (p.respondents && p.respondents.length > 0) setStep(3);
    else if (p.questions && p.questions.length > 0) setStep(2);
    else setStep(1);
    toast.success(`Le projet "${p.name}" a été chargé.`);
  };

  const handleNewProject = () => {
    if (window.confirm("Créer un nouveau projet ? Les données actuelles non sauvegardées seront perdues.")) {
      setProject({ name: '', description: '', language: 'Automatique', identificationVariables: [] });
      setQuestions(['']);
      setRespondents([]);
      setAnalysisResult(null);
      setStep(1);
    }
  };
  
  // Step 4 states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisTab, setAnalysisTab] = useState<1 | 2 | 3 | 4 | 5>(1);

  const exportToWord = () => {
    if (!analysisResult) return;
    
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Export</title></head><body>
      <h1>Rapport d'Analyse Qualitative : ${project.name}</h1>
      <p><strong>Description :</strong> ${project.description}</p>
      <p><strong>Langue :</strong> ${project.language}</p>
      <hr />
      
      <h2>1. Synthèse globale</h2>
      <p><strong>Objectif :</strong> ${analysisResult.overview?.researchObjective || ''}</p>
      <p><strong>Méthodologie :</strong> ${analysisResult.overview?.methodologyNote || ''}</p>
      <p><strong>Aperçu :</strong> ${analysisResult.overview?.generalSummary || ''}</p>
      
      <h2>2. Analyse par question</h2>
      ${analysisResult.questionAnalysis?.map((q: any) => `
        <h3>Question : ${q.question}</h3>
        <p><strong>Résumé :</strong> ${q.summary}</p>
        <p><strong>Points clés :</strong></p>
        <ul>${q.keyPoints?.map((p: string) => `<li>${p}</li>`).join('')}</ul>
      `).join('') || ''}
      
      <h2>3. Thèmes émergents</h2>
      ${analysisResult.themes?.map((th: any) => `
        <h3>Thème : ${th.name} (Importance : ${th.importance})</h3>
        <p>${th.description}</p>
        ${th.subthemes?.length ? `<p><strong>Sous-thèmes :</strong> ${th.subthemes.map((st: any) => st.name).join(', ')}</p>` : ''}
        ${th.quotes?.length ? `
          <p><strong>Citations :</strong></p>
          <ul>${th.quotes.map((q: any) => `<li>"${q.quote}" - <em>${q.respondentId}</em></li>`).join('')}</ul>
        ` : ''}
      `).join('') || ''}
      
      ${analysisResult.groupComparisons?.length ? `
        <h2>4. Comparaisons groupes</h2>
        ${analysisResult.groupComparisons.map((gc: any) => `
          <h3>Variable : ${gc.variable}</h3>
          <p><strong>Constats :</strong> ${gc.findings}</p>
          <ul>${gc.groupDifferences?.map((diff: string) => `<li>${diff}</li>`).join('')}</ul>
        `).join('')}
      ` : ''}
      
      <h2>5. Conclusion & Recommandations</h2>
      <p><strong>Enseignements principaux :</strong> ${analysisResult.conclusion?.mainLessons || ''}</p>
      <p><strong>Tendances majeures :</strong> ${analysisResult.conclusion?.majorTrends || ''}</p>
      <h3>Recommandations :</h3>
      <ul>${analysisResult.recommendations?.map((r: string) => `<li>${r}</li>`).join('') || ''}</ul>
      
      </body></html>
    `;
    
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qualitative_analysis_${new Date().getTime()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNextStep1 = () => {
    if (!project.name.trim()) {
      toast.error("Le nom du projet est obligatoire.");
      return;
    }
    setStep(2);
    setNewRespondentResponses(Array(questions.length).fill(''));
  };

  const handleAddQuestion = () => setQuestions([...questions, '']);
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };
  const handleNextStep2 = () => {
    const validQuestions = questions.filter(q => q.trim() !== '');
    if (validQuestions.length === 0) {
      toast.error("Veuillez saisir au moins une question.");
      return;
    }
    setQuestions(validQuestions);
    setNewRespondentResponses(Array(validQuestions.length).fill(''));
    setStep(3);
  };

  const handleAddProp = () => {
    const key = newRespondentPropKey.trim();
    const value = newRespondentPropValue.trim();
    if (!key || !value) return;
    
    setNewRespondentProps({ ...newRespondentProps, [key]: value });
    
    // Auto-add to project variables if it doesn't exist
    if (!project.identificationVariables.includes(key)) {
      setProject({ ...project, identificationVariables: [...project.identificationVariables, key] });
    }

    setNewRespondentPropKey('');
    setNewRespondentPropValue('');
  };

  const handleAddRespondent = () => {
    if (!newRespondentId.trim()) {
      toast.error("L'identifiant est obligatoire.");
      return;
    }
    if (newRespondentResponses.every(r => !r.trim())) {
      toast.error("Veuillez saisir au moins une réponse.");
      return;
    }
    setRespondents([...respondents, {
      id: newRespondentId,
      variables: newRespondentProps,
      responses: [...newRespondentResponses]
    }]);
    setNewRespondentId('');
    setNewRespondentProps({});
    setNewRespondentResponses(Array(questions.length).fill(''));
    toast.success("Répondant ajouté !");
  };

  const processTxtImport = async (file: File) => {
    const text = await file.text();
    const respondentsData = text.split(/\n\n---+\n\n|\r\n\r\n---+\r\n\r\n/); // split logic for TXT files based on separator
    
    // Simple basic parsing demo, assuming structured txt:
    // ID: respondent_name
    // VariableName: Value
    // Q1: response
    // Q2: response
    const newRespondents: Respondent[] = [];
    
    for (const block of respondentsData) {
       const lines = block.split('\n').map(l => l.trim()).filter(l => l);
       if (lines.length === 0) continue;
       
       const r: Respondent = { id: `Import_${Math.random().toString(36).substring(2,7)}`, variables: {}, responses: Array(questions.length).fill('') };
       
       let currentQIndex = -1;
       let currentResponseStr = "";

       for (const line of lines) {
         if (line.toLowerCase().startsWith('id:')) {
           r.id = line.substring(3).trim();
         } else if (line.match(/^q\d+:/i)) {
           if (currentQIndex !== -1) {
             r.responses[currentQIndex] = currentResponseStr.trim();
           }
           const qNumMatch = line.match(/^q(\d+):/i);
           if (qNumMatch) {
             currentQIndex = parseInt(qNumMatch[1], 10) - 1;
             currentResponseStr = line.substring(qNumMatch[0].length).trim();
           }
         } else if (currentQIndex === -1 && line.includes(':')) {
            const [k, v] = line.split(':');
            if (k && v) r.variables[k.trim()] = v.trim();
         } else if (currentQIndex !== -1) {
            currentResponseStr += "\n" + line;
         }
       }
       if (currentQIndex !== -1) {
         r.responses[currentQIndex] = currentResponseStr.trim();
       }
       newRespondents.push(r);
    }
    
    if (newRespondents.length > 0) {
       setRespondents([...respondents, ...newRespondents]);
       toast.success(`${newRespondents.length} répondants importés.`);
    } else {
       toast.error("Impossible de parser le fichier. Format non reconnu.");
    }
  };

  const handleLaunchAnalysis = async () => {
    if (respondents.length === 0) {
       toast.error("Vous devez ajouter au moins un répondant.");
       return;
    }
    
    setStep(4);
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/qualitative/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey,
          project,
          questions,
          respondents
        })
      });
      
      if (!response.ok) {
        throw new Error("Erreur de l'API");
      }
      
      const data = await response.json();
      setAnalysisResult(data);
    } catch (err: any) {
      toast.error(`Erreur d'analyse: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-fuchsia-600" />
              Analyse Qualitative
            </h1>
            <p className="text-sm text-slate-500">Comprenez vos entretiens grâce à l'IA</p>
          </div>
        </div>
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1,2,3,4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${step === s ? 'bg-fuchsia-600 text-white' : step > s ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-200 text-slate-400'}`}>
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`w-6 h-0.5 ${step > s ? 'bg-fuchsia-200' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {/* STEP 1: PROJECT */}
          {step === 1 && (
            <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -20}} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  1. Paramétrer le projet
                </h2>
                
                <div className="flex items-center gap-3">
                  {savedProjects.length > 0 && (
                    <select 
                       className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-fuchsia-500 cursor-pointer shadow-sm"
                       onChange={(e) => {
                         if (e.target.value) {
                           const proj = savedProjects.find(p => p.id === e.target.value);
                           if (proj) handleLoadProject(proj);
                           e.target.value = "";
                         }
                       }}
                       defaultValue=""
                    >
                      <option value="" disabled>Charger un projet...</option>
                      {savedProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.date})</option>
                      ))}
                    </select>
                  )}
                  
                  <button onClick={handleSaveProject} className="text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                    Sauvegarder
                  </button>
                  <button onClick={handleNewProject} className="text-sm font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                    Nouveau
                  </button>
                </div>
              </div>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nom du projet *</label>
                  <input type="text" className="w-full border-slate-200 outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 rounded-xl shadow-md p-5 leading-relaxed text-sm font-medium text-slate-700 transition-all bg-white" value={project.name} onChange={e => setProject({...project, name: e.target.value})} placeholder="Ex: Étude sur le télétravail" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description (facultative)</label>
                  <textarea className="w-full border-slate-200 outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 rounded-xl shadow-md p-5 leading-relaxed text-sm font-medium text-slate-700 transition-all bg-white min-h-[120px] resize-y" value={project.description} onChange={e => setProject({...project, description: e.target.value})} placeholder="Objectif de l'étude..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Langue principale</label>
                    <select className="w-full border-slate-200 outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 rounded-2xl p-4 text-sm font-medium text-slate-700 transition-all bg-slate-50 focus:bg-white appearance-none cursor-pointer" value={project.language} onChange={e => setProject({...project, language: e.target.value})}>
                      <option>Automatique</option>
                      <option>Français</option>
                      <option>Anglais</option>
                      <option>Espagnol</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 mt-8 border-t border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-3">Questions d'identification (Variables descriptives facultatives)</label>
                  <p className="text-xs text-slate-500 mb-4">Définissez les critères qui permettront de comparer les répondants (Sexe, Âge, Profession, etc.).</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.identificationVariables.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-sm font-semibold border border-indigo-100">
                        {v}
                        <button onClick={() => setProject({...project, identificationVariables: project.identificationVariables.filter((_, idx) => idx !== i)})} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 border-slate-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl shadow-md p-4 leading-relaxed text-sm font-medium text-slate-700 transition-all bg-white" 
                      placeholder="Nouvelle variable (Ex: Région)"
                      value={newProjectVar}
                      onChange={e => setNewProjectVar(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newProjectVar.trim() && !project.identificationVariables.includes(newProjectVar.trim())) {
                            setProject({...project, identificationVariables: [...project.identificationVariables, newProjectVar.trim()]});
                            setNewProjectVar('');
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (newProjectVar.trim() && !project.identificationVariables.includes(newProjectVar.trim())) {
                          setProject({...project, identificationVariables: [...project.identificationVariables, newProjectVar.trim()]});
                          setNewProjectVar('');
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-3 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button onClick={handleNextStep1} className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                    Suivant : Les questions <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: QUESTIONS */}
          {step === 2 && (
            <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -20}} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10">
               <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  2. Définir les questions du guide
                </h2>
                <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Retour</button>
               </div>
               
               <div className="space-y-6 max-w-3xl">
                 {questions.map((q, i) => (
                   <div key={i} className="flex gap-4 items-start group">
                     <span className="w-12 h-12 shrink-0 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-400">Q{i+1}</span>
                     <textarea className="flex-1 border-slate-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl shadow-md p-5 leading-relaxed text-sm font-medium text-slate-700 transition-all bg-white min-h-[90px] resize-y" value={q} onChange={(e) => {
                       const newQs = [...questions];
                       newQs[i] = e.target.value;
                       setQuestions(newQs);
                     }} placeholder="Saisissez la question posée (Ex: Quelles sont les principales difficultés rencontrées ?)" />
                     <button onClick={() => handleRemoveQuestion(i)} className="w-12 h-12 shrink-0 border border-transparent hover:border-rose-200 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-2xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                       <Trash2 className="w-5 h-5" />
                     </button>
                   </div>
                 ))}
                 
                 <div className="pt-2 pl-16">
                   <button onClick={handleAddQuestion} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-5 py-3 rounded-xl transition-colors border border-transparent hover:border-indigo-100">
                     <Plus className="w-5 h-5" /> Ajouter une question
                   </button>
                 </div>
                 
                 <div className="pt-8 mt-8 border-t border-slate-100 flex justify-end">
                  <button onClick={handleNextStep2} className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                    Suivant : Les répondants <ChevronRight className="w-5 h-5" />
                  </button>
                 </div>
               </div>
            </motion.div>
          )}

          {/* STEP 3: RESPONDENTS */}
          {step === 3 && (
            <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -20}} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col overflow-hidden h-[800px] max-h-[85vh]">
               <div className="flex justify-between items-center p-6 md:px-10 border-b border-slate-100 shrink-0 bg-white z-10">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <List className="w-5 h-5" />
                    </div>
                    3. Ajouter les répondants 
                    <span className="bg-slate-100 text-slate-600 text-sm py-1 px-3 rounded-full">{respondents.length}</span>
                  </h2>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setStep(2)} className="text-sm font-bold text-slate-500 hover:text-slate-800 px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors">Retour</button>
                    <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 px-5 rounded-xl flex items-center gap-2 transition-colors text-sm shadow-sm">
                      <Upload className="w-4 h-4" /> Importer TXT
                      <input type="file" accept=".txt" className="hidden" onChange={e => { if(e.target.files?.[0]) processTxtImport(e.target.files[0]); }} />
                    </label>
                    <button onClick={handleLaunchAnalysis} className="bg-slate-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ml-2">
                      <Play className="w-4 h-4 fill-current" /> Lancer l'analyse IA
                    </button>
                  </div>
               </div>
               
               <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                 {/* Saisie Manuelle */}
                 <div className="w-1/2 p-6 md:p-10 border-r border-slate-100 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-3 mb-8">
                      <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">Saisie Manuelle</h3>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-white p-6 justify-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div>
                          <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wider">Identifiant (Pseudonyme) *</label>
                          <input type="text" className="w-full border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl shadow-md p-4 leading-relaxed text-sm font-bold text-slate-800 transition-all bg-white" value={newRespondentId} onChange={e => setNewRespondentId(e.target.value)} placeholder="Ex: Répondant 1" />
                        </div>
                        
                        {(project.identificationVariables.length > 0 || Object.keys(newRespondentProps).length > 0 || true) && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-wider">Variables d'identification</label>
                            
                            {project.identificationVariables.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {project.identificationVariables.map((v) => (
                                  <div key={v}>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">{v}</label>
                                    <input type="text" className="w-full border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl shadow-sm p-3 text-sm text-slate-700 transition-all bg-white" value={newRespondentProps[v] || ''} onChange={e => setNewRespondentProps({...newRespondentProps, [v]: e.target.value})} placeholder={`Saisir ${v.toLowerCase()}`} />
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {Object.entries(newRespondentProps).filter(([k]) => !project.identificationVariables.includes(k)).map(([k,v]) => (
                               <div key={k} className="flex gap-2 items-center text-xs bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl mb-2">
                                 <span className="font-bold text-slate-700">{k}:</span> <span className="text-slate-600">{v}</span>
                                 <button onClick={()=> {const n={...newRespondentProps}; delete n[k]; setNewRespondentProps(n);}} className="ml-auto text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                               </div>
                            ))}

                            <div className="flex gap-2 mt-3">
                              <input type="text" className="flex-1 border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl shadow-sm p-3 text-sm text-slate-700 transition-all bg-white" placeholder="Autre variable (Ex: Âge)" value={newRespondentPropKey} onChange={e=>setNewRespondentPropKey(e.target.value)} />
                              <input type="text" className="flex-1 border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl shadow-sm p-3 text-sm text-slate-700 transition-all bg-white" placeholder="Valeur" value={newRespondentPropValue} onChange={e=>setNewRespondentPropValue(e.target.value)} />
                              <button onClick={handleAddProp} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-6 mt-8">
                        <div className="flex items-center gap-3 mb-6">
                          <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">Réponses</h3>
                          <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        {questions.map((q, i) => (
                          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-xs text-slate-800 font-semibold mb-3 leading-relaxed flex gap-2">
                              <span className="text-slate-400 font-black">Q{i+1}.</span> {q}
                            </div>
                            <textarea className="w-full border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl shadow-md p-5 leading-relaxed text-sm text-slate-700 transition-all bg-white min-h-[100px] resize-y" value={newRespondentResponses[i]} onChange={e => {
                              const newResp = [...newRespondentResponses];
                              newResp[i] = e.target.value;
                              setNewRespondentResponses(newResp);
                            }} placeholder="Transcription de la réponse..." />
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-4 pb-10">
                        <button onClick={handleAddRespondent} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5">
                          <Plus className="w-5 h-5" /> Ajouter ce répondant au corpus
                        </button>
                      </div>
                    </div>
                 </div>
                 
                 {/* Liste des répondants */}
                 <div className="w-1/2 p-6 md:p-10 overflow-y-auto custom-scrollbar bg-slate-100/50">
                    <div className="flex items-center gap-3 mb-8">
                      <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">Base de corpus</h3>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    {respondents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-20 px-8 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-slate-300">
                          <List className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-700 mb-2">Aucun répondant</h4>
                        <p className="text-slate-500 text-sm max-w-sm">Ajoutez votre premier répondant manuellement ou importez un fichier texte structuré.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {respondents.map((r, i) => (
                          <div key={i} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-bold text-slate-800 flex items-center gap-3 text-lg">
                                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-sm font-black border border-emerald-100">{i+1}</div>
                                {r.id}
                              </h4>
                              <button onClick={() => setRespondents(respondents.filter((_, idx)=> idx !== i))} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {Object.entries(r.variables).filter(([_,v]) => v.trim() !== '').map(([k,v]) => (
                                <span key={k} className="text-xs bg-slate-50 px-2 py-1 rounded-lg font-semibold text-slate-600 border border-slate-200">{k}: {v}</span>
                              ))}
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-sm text-slate-500 line-clamp-3 italic font-serif leading-relaxed">
                                "{r.responses[0]?.substring(0, 150)}..."
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
               </div>
            </motion.div>
          )}

          {/* STEP 4: ANALYSIS RESULT */}
          {step === 4 && (
            <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[600px] flex flex-col">
               {isAnalyzing ? (
                 <div className="flex-1 flex flex-col flex-center justify-center items-center h-[500px]">
                   <div className="w-16 h-16 relative mb-6">
                     <div className="absolute inset-0 border-4 border-fuchsia-200 rounded-full animate-ping opacity-75"></div>
                     <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-600 to-indigo-600 rounded-full flex items-center justify-center">
                        <BrainCircuit className="w-8 h-8 text-white animate-pulse" />
                     </div>
                   </div>
                   <h2 className="text-xl font-bold text-slate-800 mb-2">Gemini analyse votre corpus...</h2>
                   <p className="text-slate-500 text-sm max-w-md text-center">Extraction des concepts, identification des thèmes majeurs et structuration des citations en cours. Cette opération peut prendre quelques minutes.</p>
                 </div>
               ) : analysisResult ? (
                 <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Rapport d'Analyse Qualitative</h2>
                        <div className="flex gap-4 text-sm font-medium text-slate-500">
                          <span className="flex items-center gap-1.5"><FileText className="w-4 h-4"/> {analysisResult.overview?.totalRespondents || respondents.length} Entretiens</span>
                          <span className="flex items-center gap-1.5"><List className="w-4 h-4"/> {questions.length} Questions</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={handleSaveProject} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-sm">Sauvegarder le Projet</button>
                         <button onClick={() => setStep(3)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Retour aux données</button>
                         <button onClick={exportToWord} className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors flex items-center gap-2 shadow-sm">
                           <Download className="w-4 h-4" /> Exporter (Word)
                         </button>
                      </div>
                    </div>

                    {/* Vues de l'analyse */}
                    <div className="grid grid-cols-12 gap-8">
                       {/* Sidebar Navigation */}
                       <div className="col-span-3 space-y-1">
                          <div onClick={() => setAnalysisTab(1)} className={`py-2 px-3 font-bold text-sm rounded-lg cursor-pointer transition-colors ${analysisTab === 1 ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>1. Synthèse globale</div>
                          <div onClick={() => setAnalysisTab(2)} className={`py-2 px-3 font-bold text-sm rounded-lg cursor-pointer transition-colors ${analysisTab === 2 ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>2. Analyse par question</div>
                          <div onClick={() => setAnalysisTab(3)} className={`py-2 px-3 font-bold text-sm rounded-lg cursor-pointer transition-colors ${analysisTab === 3 ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>3. Thèmes émergents</div>
                          {analysisResult.groupComparisons?.length > 0 && (
                            <div onClick={() => setAnalysisTab(4)} className={`py-2 px-3 font-bold text-sm rounded-lg cursor-pointer transition-colors ${analysisTab === 4 ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>4. Comparaisons groupes</div>
                          )}
                          <div onClick={() => setAnalysisTab(5)} className={`py-2 px-3 font-bold text-sm rounded-lg cursor-pointer transition-colors ${analysisTab === 5 ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>5. Conclusion & Recommandations</div>
                       </div>

                       {/* Contenu */}
                       <div className="col-span-9 space-y-6 min-h-[400px]">
                           {analysisTab === 1 && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                               <h3 className="text-lg font-bold text-slate-800 bg-slate-100 px-4 py-2 rounded-lg inline-block mb-2">Synthèse globale</h3>
                               <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                                 <p className="text-sm text-slate-700 leading-relaxed"><strong className="text-slate-900 block mb-1">Résumé Général :</strong> {analysisResult.overview?.generalSummary || 'Non disponible'}</p>
                                 <p className="text-sm text-slate-700 leading-relaxed"><strong className="text-slate-900 block mb-1">Objectif de la recherche :</strong> {analysisResult.overview?.researchObjective || 'Non disponible'}</p>
                                 <p className="text-sm text-slate-700 leading-relaxed"><strong className="text-slate-900 block mb-1">Note méthodologique :</strong> {analysisResult.overview?.methodologyNote || 'Non disponible'}</p>
                               </div>
                             </div>
                           )}

                           {analysisTab === 2 && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                               <h3 className="text-lg font-bold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 inline-block mb-2">Analyse par question</h3>
                               {analysisResult.questionAnalysis?.map((q: any, idx: number) => (
                                 <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                   <h4 className="text-md font-extrabold text-slate-800 flex gap-2"><span className="text-blue-500">Q{idx+1}.</span> {q.question}</h4>
                                   <p className="text-sm text-slate-600 leading-relaxed"><strong className="text-slate-800">Résumé :</strong> {q.summary}</p>
                                   <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                                     <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Points clés</span>
                                     <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                       {q.keyPoints?.map((p: string, pIdx: number) => (
                                         <li key={pIdx}>{p}</li>
                                       ))}
                                     </ul>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}

                           {analysisTab === 3 && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                               <h3 className="text-lg font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 inline-block mb-2">Cartographie Thématique</h3>
                               {analysisResult.themes?.map((th: any, idx: number) => (
                                 <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                      <h4 className="text-md font-extrabold text-slate-800">{th.name}</h4>
                                      <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide ${th.importance === 'Haute' || th.importance === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>Importance : {th.importance}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{th.description}</p>
                                    
                                    {th.subthemes && th.subthemes.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                         {th.subthemes.map((st: any, sid: number) => (
                                           <span key={sid} className="text-[11px] bg-sky-50 text-sky-800 border border-sky-100 px-2 py-1 rounded font-medium">{st.name}</span>
                                         ))}
                                      </div>
                                    )}
                                    
                                    {th.quotes && th.quotes.length > 0 && (
                                      <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-slate-300 space-y-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Citations représentatives</span>
                                        {th.quotes.map((q: any, qid: number) => (
                                          <div key={qid} className="text-sm text-slate-700 font-serif italic">
                                            "{q.quote}" <span className="text-xs text-slate-400 not-italic font-sans font-medium mix-blend-multiply">— {q.respondentId}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                 </div>
                               ))}
                             </div>
                           )}

                           {analysisTab === 4 && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                               <h3 className="text-lg font-bold text-fuchsia-700 bg-fuchsia-50 px-4 py-2 rounded-lg border border-fuchsia-100 inline-block mb-2">Comparaisons de Groupes</h3>
                               {analysisResult.groupComparisons?.map((gc: any, idx: number) => (
                                 <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                   <h4 className="text-md font-extrabold text-slate-800 flex gap-2"><span className="text-fuchsia-500">Variable :</span> {gc.variable}</h4>
                                   <p className="text-sm text-slate-600 leading-relaxed"><strong className="text-slate-800">Constat :</strong> {gc.findings}</p>
                                   <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                                     <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Différences Principales</span>
                                     <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                       {gc.groupDifferences?.map((diff: string, dIdx: number) => (
                                         <li key={dIdx}>{diff}</li>
                                       ))}
                                     </ul>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}

                           {analysisTab === 5 && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                               <h3 className="text-lg font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 inline-block mb-2">Conclusion & Recommandations</h3>
                               <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-sm text-slate-700">
                                 <p><strong className="text-slate-900 block mb-1 text-base">Enseignements principaux :</strong> <span className="leading-relaxed">{analysisResult.conclusion?.mainLessons}</span></p>
                                 <p className="mt-4"><strong className="text-slate-900 block mb-1 text-base">Tendances majeures :</strong> <span className="leading-relaxed">{analysisResult.conclusion?.majorTrends}</span></p>
                               </div>
                               
                               <h4 className="text-md font-bold text-amber-700 px-1 mt-6">Actions Recommandées</h4>
                               <div className="bg-white border border-slate-200 rounded-2xl p-0 overflow-hidden shadow-sm">
                                  {analysisResult.recommendations?.map((r: string, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                       <div className="w-6 h-6 shrink-0 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">{i+1}</div>
                                       <p className="text-sm text-slate-800 leading-relaxed font-medium">{r}</p>
                                    </div>
                                  ))}
                               </div>
                             </div>
                           )}
                        </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex justify-center items-center">
                    <p className="text-rose-500">Erreur inattendue.</p>
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
