import React from 'react';
import { useWorkspaceStore } from '../store';
import { FileSpreadsheet, X } from 'lucide-react';

export default function ExcelSheetModal() {
  const isOpen = useWorkspaceStore((state) => state.isSheetModalOpen);
  const sheets = useWorkspaceStore((state) => state.excelSheets);
  const selectExcelSheet = useWorkspaceStore((state) => state.selectExcelSheet);
  const closeExcelModal = useWorkspaceStore((state) => state.closeExcelModal);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900">Sélectionner la feuille</h3>
          </div>
          <button 
            onClick={closeExcelModal}
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-md hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {sheets.map((sheet) => (
              <button
                key={sheet}
                onClick={() => selectExcelSheet(sheet)}
                className="w-full flex items-center text-left p-3 rounded-xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 transition-all font-medium text-sm text-zinc-700"
              >
                {sheet}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
