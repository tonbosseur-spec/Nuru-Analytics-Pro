import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, LockOpen, HardDrive, User, Check, Server, FileLock2, Upload, Key, X } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';

export default function LicenseScreen() {
  const logIn = useWorkspaceStore((state) => state.logIn);
  const [hardwareId, setHardwareId] = useState<string>('CHARGEMENT...');
  const [checking, setChecking] = useState(true);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);



  useEffect(() => {
    const init = async () => {
      try {
        const api = getApi();
        if (api.get_hardware_info) {
          const res = await api.get_hardware_info();
          if (res.success) {
            if (res.is_licensed) {
              toast.success("Licence validée avec succès.");
              logIn(res.first_name || '', res.last_name || '', res.days_remaining, res.expiry_date);
            } else {
              setHardwareId(res.hardware_id || 'INCONNU');
            }
          } else {
            console.error("Erreur HW:", res.error);
            setHardwareId('NON_DISPONIBLE');
          }
        }
      } catch (e) {
        console.error("Bridge non disponible:", e);
      } finally {
        setChecking(false);
      }
    };
    init();
  }, [logIn]);

  const handleImportLicense = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Veuillez saisir votre prénom et nom avant d'importer la licence.");
      return;
    }

    const isDesktop = typeof window !== 'undefined' && 
                      window.pywebview && 
                      window.pywebview.api;
                      
    if (isDesktop) {
      try {
        setIsVerifying(true);
        const api = getApi();
        const path = api.open_license_dialog ? await api.open_license_dialog() : await api.open_file_dialog();
        if (!path) {
          setIsVerifying(false);
          return;
        }

        if (api.verify_and_save_license) {
          const result = await api.verify_and_save_license(path);
          if (result.success) {
            toast.success(result.message || "Licence activée !");
            let days = null;
            let expiry = null;
            if (api.get_hardware_info) {
              const hwInfo = await api.get_hardware_info();
              if (hwInfo.success && hwInfo.is_licensed) {
                days = hwInfo.days_remaining;
                expiry = hwInfo.expiry_date;
              }
            }
            logIn(firstName, lastName, days, expiry);
          } else {
            toast.error(result.error || "Fichier de licence invalide.");
          }
        }
      } catch (e: any) {
        toast.error(`Erreur système: ${e.message}`);
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Browser Mock
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        toast.success("Simulation : Licence validée via le navigateur.");
        logIn(firstName, lastName, 24, "2026-07-06");
      }, 1500);
    }
  };



  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Server className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }



  // ----------- STANDARD ACTIVATION VIEW -----------
  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden select-none">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 relative z-10 shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
            <LockOpen className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Activation Requise</h2>
            <p className="text-sm text-slate-400">Nuru Analytics - Sécurité & Licence</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Hardware ID Section */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="relative z-10">
              <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2 uppercase tracking-widest">
                <HardDrive className="w-4 h-4" /> Code Machine Unique
              </label>
              <div className="flex items-center justify-between">
                <code className="text-xl md:text-2xl font-mono font-bold text-indigo-400 tracking-wider">
                  {hardwareId}
                </code>
              </div>
              <p className="text-xs text-slate-500 mt-3 max-w-sm">
                Veuillez transmettre ce code exact à l'équipe Nuru pour obtenir votre fichier de licence .lic certifié.
              </p>
            </div>
          </div>

          {/* User ID Section */}
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prénom</label>
                   <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                         type="text" 
                         value={firstName}
                         onChange={(e) => setFirstName(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
                         placeholder="Jane"
                      />
                   </div>
                </div>
                <div>
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nom</label>
                   <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
                      placeholder="Doe"
                   />
                </div>
             </div>

             <button
                onClick={handleImportLicense}
                disabled={isVerifying}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold tracking-wide rounded-xl py-3.5 px-4 shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm mt-4"
             >
                {isVerifying ? (
                  <Server className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <FileLock2 className="w-5 h-5" />
                    Importer le fichier de licence (.lic)
                  </>
                )}
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
