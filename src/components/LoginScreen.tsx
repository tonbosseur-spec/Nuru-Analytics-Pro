import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, LineChart, Shield, MessageSquare, ChevronRight, Sparkles, Database } from 'lucide-react';

interface FeatureBubble {
  id: number;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  delay: number;
}

const PREMIUM_FEATURES: FeatureBubble[] = [
  {
    id: 1,
    icon: LineChart,
    title: "Intelligence Statistique",
    desc: "Analysez vos séries de données, variables et prédictions avec des modèles calibrés pour la recherche professionnelle.",
    color: "from-emerald-500 to-teal-600",
    delay: 0.6
  },
  {
    id: 2,
    icon: BarChart3,
    title: "Moteur Statistique Avancé",
    desc: "Bénéficiez d'une suite exhaustive : tests d'indépendance de Fisher, Kendall, McNemar et analyses descriptives.",
    color: "from-blue-500 to-indigo-600",
    delay: 1.8
  },
  {
    id: 3,
    icon: Shield,
    title: "Souveraineté des Données",
    desc: "Une exécution 100% locale ultra-sécurisée. Vos travaux d'enquêtes professionnels restent confidentiels, hors du cloud.",
    color: "from-purple-500 to-pink-600",
    delay: 3.0
  },
  {
    id: 4,
    icon: MessageSquare,
    title: "Annotations d'Expertise",
    desc: "Commentez et dessinez des repères temporels directement sur vos livrables de façon dynamique.",
    color: "from-amber-500 to-orange-600",
    delay: 4.2
  }
];

import LicenseScreen from './LicenseScreen';

export default function LoginScreen() {
  const [bubblesShown, setBubblesShown] = useState<number[]>([]);
  const [showButton, setShowButton] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  useEffect(() => {
    // Sequentially trigger bubbles based on their delays
    PREMIUM_FEATURES.forEach((feature) => {
      const timer = setTimeout(() => {
        setBubblesShown((prev) => [...prev, feature.id]);
      }, feature.delay * 1000);
      return () => clearTimeout(timer);
    });

    // Make button appear at the end
    const btnTimer = setTimeout(() => {
      setShowButton(true);
    }, 5.5 * 1000);

    return () => {
      clearTimeout(btnTimer);
    };
  }, []);

  if (showLicense) {
    return <LicenseScreen />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 relative overflow-hidden select-none">
      
      {/* Decorative background grid and glowing orbs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-35" />
        
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[130px] animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-emerald-500/5 blur-[120px] animate-pulse duration-[8000ms]" />
      </div>

      {/* Top Bar */}
      <header className="w-full flex items-center justify-between max-w-7xl mx-auto z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-emerald-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-slate-200">NURU ANALYTICS</span>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-[11px] font-bold text-slate-300 tracking-widest">PREMIUM EDITION</span>
        </div>
      </header>

      {/* Main interactive area */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col justify-center items-center py-10 z-10 relative">
        
        {/* Hero Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Précision Statistique & Scientifique
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent mt-4 mb-3"
          >
            Nuru Analytics
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed"
          >
            Découvrez une suite d'ingénierie statistique universelle pensée pour simplifier l'aide à la décision et l'analyse de données complexes.
          </motion.p>
        </div>

        {/* Floating staggered feature bubbles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl mb-12">
          {PREMIUM_FEATURES.map((feature) => {
            const isVisible = bubblesShown.includes(feature.id);
            const IconComponent = feature.icon;

            return (
              <div key={feature.id} className="min-h-[105px]">
                <AnimatePresence>
                  {isVisible && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                      className="bg-slate-900/45 border border-slate-800/80 rounded-2xl p-4 flex gap-3.5 shadow-sm hover:border-slate-700/60 transition-colors h-full"
                    >
                      <div className={`w-11 h-11 bg-gradient-to-tr ${feature.color} text-white rounded-xl flex items-center justify-center shrink-0 shadow-md`}>
                        <IconComponent className="w-5.5 h-5.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold text-slate-200 tracking-wide uppercase mb-1 flex items-center gap-1.5">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-normal">
                          {feature.desc}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Enter Button Placement */}
        <div className="h-20 flex items-center justify-center w-full">
          <AnimatePresence>
            {showButton && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 120, damping: 12 }}
                onClick={() => setShowLicense(true)}
                className="group relative inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-sm tracking-widest uppercase rounded-2xl shadow-xl shadow-indigo-900/40 hover:shadow-indigo-800/40 cursor-pointer active:scale-95 transition-all duration-300"
              >
                {/* Glowing ring animation */}
                <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-400 to-indigo-500 opacity-20 blur-sm group-hover:opacity-40 transition-opacity" />
                
                <span className="relative flex items-center gap-2">
                  Se connecter
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Footer footer */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-900 pt-4 z-10 relative">
        <p className="text-[10px] text-slate-500 font-mono">
          NURU ANALYTICS LABS • SYSTÈME SÉCURISÉ LOCAL
        </p>
        <p className="text-[10px] text-slate-500 font-mono">
          © 2026 Tous droits réservés.
        </p>
      </footer>

    </div>
  );
}
