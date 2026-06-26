/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import MainLayout from './components/MainLayout';
import VariableDesigner from './components/VariableDesigner';
import ManualDataEntry from './components/ManualDataEntry';
import ExcelSheetModal from './components/ExcelSheetModal';
import SmartExcelPreprocessModal from './components/SmartExcelPreprocessModal';
import ImportPreviewModal from './components/ImportPreviewModal';
import ImportCrosstabModal from './components/ImportCrosstabModal';
import LoginScreen from './components/LoginScreen';
import { useWorkspaceStore } from './store';
import { Toaster } from 'sonner';

export default function App() {
  const isReady = useWorkspaceStore((state) => state.isReady);
  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);
  const isLoggedIn = useWorkspaceStore((state) => state.isLoggedIn);
  const restoreAutosavedSession = useWorkspaceStore((state) => state.restoreAutosavedSession);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    restoreAutosavedSession().then(() => {
      setRestored(true);
    });
  }, [restoreAutosavedSession]);

  if (!restored) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center animate-pulse">
          <div className="w-3 h-3 bg-white rounded-full animate-ping" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" style={{ width: '40%' }} />
          </div>
          <p className="text-[10px] font-black tracking-widest text-slate-500 font-mono text-center uppercase">
            Restauration de la session...
          </p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <>
      <MainLayout />
      <ExcelSheetModal />
      <SmartExcelPreprocessModal />
      <ImportPreviewModal />
      <ImportCrosstabModal />
      <Toaster position="bottom-right" richColors />
    </>
  );
}

