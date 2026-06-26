import fs from 'fs';

let text = fs.readFileSync('src/components/DataPreparationView.tsx', 'utf8');

text = text.replace(
  "import * as XLSX from 'xlsx';",
  `import * as XLSX from 'xlsx';
import DatasetGeneratorModal from './DatasetGeneratorModal';
import { Upload, Plus, ChevronDown, Database as DBIcon, CheckCircle2 } from 'lucide-react';`
);

const stateCode = `  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isDatasetSelectorOpen, setIsDatasetSelectorOpen] = useState(false);
  const datasets = useWorkspaceStore((state) => state.datasets);
  const activeDatasetId = useWorkspaceStore((state) => state.activeDatasetId);
  const switchDataset = useWorkspaceStore((state) => state.switchDataset);
  const triggerImport = useWorkspaceStore((state) => state.triggerImport);
`;

text = text.replace(
  `  const [isExportModalOpen, setIsExportModalOpen] = useState(false);`, stateCode
);

const headerCode = `        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setIsDatasetSelectorOpen(!isDatasetSelectorOpen)}
              className="flex items-center gap-3 hover:bg-slate-50 px-2 py-1.5 -ml-2 rounded-lg transition-colors group text-left"
            >
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-md">
                <Table2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-semibold text-zinc-900 leading-tight flex items-center gap-1">
                    {datasetName}
                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </h1>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium">
                  {rowCount.toLocaleString()} Lignes • {colCount.toLocaleString()} Colonnes
                </p>
              </div>
            </button>
            
            {isDatasetSelectorOpen && (
               <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden text-sm">
                 <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-1">
                   <button onClick={() => { setIsDatasetSelectorOpen(false); triggerImport(); }} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-sm rounded-lg w-full text-left font-medium transition-all">
                     <Upload className="w-4 h-4 text-indigo-600" /> Importer un fichier
                   </button>
                   <button onClick={() => { setIsDatasetSelectorOpen(false); setIsGeneratorOpen(true); }} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-sm rounded-lg w-full text-left font-medium transition-all">
                     <DBIcon className="w-4 h-4 text-emerald-600" /> Générateur aléatoire
                   </button>
                 </div>
                 <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                   <div className="px-3 py-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">En mémoire</div>
                   {datasets.map(ds => (
                     <button
                       key={ds.id}
                       onClick={() => { setIsDatasetSelectorOpen(false); switchDataset(ds.id); }}
                       className={\`flex items-center justify-between px-3 py-2 w-full text-left rounded-lg transition-colors \${activeDatasetId === ds.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}\`}
                     >
                        <div className="truncate pr-2 font-medium">{ds.name}</div>
                        {activeDatasetId === ds.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />}
                     </button>
                   ))}
                   {datasets.length === 0 && <div className="px-3 py-2 text-slate-500 text-xs italic">Aucun autre jeu de données.</div>}
                 </div>
               </div>
            )}
          </div>
        </div>`;

text = text.replace(
`        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <Table2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-900 leading-tight">{datasetName}</h1>
            <p className="text-[11px] text-zinc-500 font-medium">
              {rowCount.toLocaleString()} Lignes • {colCount.toLocaleString()} Colonnes
            </p>
          </div>
        </div>`, headerCode);

const genModalCode = `      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
`;

text = text.replace(
`      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
`,
`      {isGeneratorOpen && <DatasetGeneratorModal onClose={() => setIsGeneratorOpen(false)} />}
      
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
`);

fs.writeFileSync('src/components/DataPreparationView.tsx', text);
console.log("Prep updated!");
