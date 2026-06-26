import { create } from 'zustand';
import { toast } from 'sonner';
import { ColumnMetadata, DatasetInfo, StatType, TransformationStep, ImputationStrategy, FilterCondition, MathOperation, DuplicateKeep, StringCleanOperation, BinningMethod, EncodingMethod, ManualColumnDefinition, AnalysisResult, RecentProject, PendingImport } from './types';
import { getApi } from './pywebview';
import { evaluateFormulaForRow } from './utils/formulaEvaluator';

interface WorkspaceState {
  // Recent Projects
  recentProjects: RecentProject[];
  addRecentProject: (projectData: any, filename: string) => void;
  removeRecentProject: (index: number) => void;

  // Pending Import Preview State
  pendingImport: PendingImport | null;
  setPendingImport: (pending: PendingImport | null) => void;
  confirmPendingImport: (selectedColumns?: string[]) => Promise<void>;

  // App State
  isReady: boolean;
  isLoggedIn: boolean;
  userName: string | null;
  licenseDaysRemaining: number | null;
  licenseExpiryDate: string | null;
  workspaceMode: 'dashboard' | 'manual_setup' | 'manual_data_entry' | 'results';
  isLoading: boolean;
  loadingMessage: string;
  
  // Dataset Data
  filePath: string | null;
  datasetName: string | null;
  rowCount: number;
  colCount: number;
  columns: ColumnMetadata[];
  previewData: Record<string, any>[];
  
  // Datasets session management
  datasets: { id: string; name: string; rowCount: number; colCount: number; columns: any[]; preview: any[] }[];
  activeDatasetId: string | null;
  switchDataset: (id: string) => Promise<void>;
  removeDataset: (id: string) => Promise<void>;
  pipeline: TransformationStep[];
  
  // Manual Setup State
  manualColumns: ManualColumnDefinition[];
  manualRows: Record<string, any>[];
  
  // Analysis History
  history: AnalysisResult[];
  activeAnalysisId: string | null;

  // Mira Assistant
  miraChats: Record<string, { role: 'model' | 'user'; text: string }[]>;
  miraWidgetOpen: boolean;
  miraActiveAnalysisId: string | null;
  openMira: (analysisId?: string) => void;
  closeMira: () => void;
  setMiraChat: (analysisId: string, history: { role: 'model' | 'user'; text: string }[]) => void;
  clearMiraChat: (analysisId: string) => void;

  // Settings
  decimals: number;
  alpha: number;
  darkMode: boolean;
  geminiApiKey: string;
  miraApiProvider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom';
  miraApiKey: string;
  miraApiModel: string;
  miraApiBaseUrl: string;
  setSettings: (settings: Partial<{ 
    decimals: number; 
    alpha: number; 
    darkMode: boolean; 
    geminiApiKey: string;
    miraApiProvider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom';
    miraApiKey: string;
    miraApiModel: string;
    miraApiBaseUrl: string;
  }>) => void;
  
  // Excel Specific State
  isSheetModalOpen: boolean;
  excelSheets: string[];
  pendingFilePath: string | null;

  // Smart Excel Preprocessor State
  isSmartExcelModalOpen: boolean;
  smartExcelFilePath: string | null;
  smartExcelSheetName: string | null;
  smartExcelPreview: {
    detected_header_row: number;
    data_start_row: number;
    nb_rows_detected: number;
    nb_columns: number;
    columns: any[];
    sample_data: any[];
    titles: string[];
    blocks: any[];
    selected_block: number;
  } | null;
  setSmartExcelModalOpen: (isOpen: boolean) => void;
  loadSmartExcelPreview: (filePath: string, sheetName: string | number | null, manualHeader?: number | null, selectedBlock?: number, excludeCols?: string[]) => Promise<void>;
  finalizeSmartExcelImport: (manualHeader: number | null, selectedBlock: number, excludeCols: string[]) => Promise<void>;

  // Filter & Duplicates State
  isFilterModalOpen: boolean;
  isDuplicatesModalOpen: boolean;
  isFullDataModalOpen: boolean;
  isSettingsModalOpen: boolean;
  
  // Crosstab Import
  isCrosstabModalOpen: boolean;
  setCrosstabModalOpen: (isOpen: boolean) => void;
  isGeneratorOpen: boolean;
  setIsGeneratorOpen: (isOpen: boolean) => void;
  rawCrosstabData: any[][] | null;
  isImportingCrosstab: boolean;
  triggerImportCrosstab: () => Promise<void>;
  
  // Actions
  setFullDataModalOpen: (isOpen: boolean) => void;
  triggerImport: () => Promise<void>;
  selectExcelSheet: (sheetName: string) => Promise<void>;
  closeExcelModal: () => void;
  resetWorkspace: () => void;
  updateColumn: (oldName: string, newName: string, newType: StatType) => Promise<void>;
  editCell: (rowIdx: number, colName: string, newValue: string) => Promise<void>;
  deleteRow: (rowIdx: number) => Promise<void>;
  deleteColumn: (colName: string) => Promise<void>;
  handleMissingValues: (columnName: string, strategy: ImputationStrategy) => Promise<void>;
  detectOutliers: (columnName: string, method: 'iqr' | 'zscore') => Promise<any>;
  treatOutliers: (columnName: string, detectMethod: 'iqr' | 'zscore', treatMethod: 'winsorize' | 'exclude' | 'median') => Promise<void>;
  isCalculatorModalOpen: boolean;
  setFilterModalOpen: (isOpen: boolean) => void;
  setDuplicatesModalOpen: (isOpen: boolean) => void;
  setSettingsModalOpen: (isOpen: boolean) => void;
  setCalculatorModalOpen: (isOpen: boolean) => void;
  addFormulaPipelineStep: (newColName: string, formulaStr: string) => Promise<void>;
  applyFilter: (conditions: FilterCondition[]) => Promise<void>;
  getUniqueValues: (columnName: string) => Promise<any[]>;
  applyMathTransform: (sourceCol: string, operation: MathOperation, newColName: string, targetCol?: string, constant?: number) => Promise<void>;
  extractDatePart: (sourceCol: string, part: 'day' | 'week' | 'month' | 'year' | 'quarter', newColName: string) => Promise<void>;
  appendDataframeColumns: (newColumnsDict: Record<string, any[]>) => Promise<void>;
  removeDuplicates: (keep: DuplicateKeep) => Promise<void>;
  cleanStringColumn: (columnName: string, operation: StringCleanOperation) => Promise<void>;
  convertColumnToDate: (columnName: string, newColName?: string) => Promise<void>;
  splitQualitativeColumn: (columnName: string, method: 'separator' | 'length', targetCol1: string, targetCol2: string, separatorValue?: string, splitLength?: number) => Promise<void>;
  discretizeColumn: (columnName: string, method: BinningMethod, newColName: string, numBins?: number, thresholds?: number[], labels?: string[]) => Promise<void>;
  groupCategories: (columnName: string, mapping: Record<string, string>, newColName?: string) => Promise<void>;
  encodeColumn: (columnName: string, method: EncodingMethod, newColName?: string, dropFirst?: boolean) => Promise<void>;
  togglePipelineStep: (id: string, enabled: boolean) => Promise<void>;
  removePipelineStep: (id: string) => Promise<void>;
  setWorkspaceMode: (mode: 'dashboard' | 'manual_setup' | 'manual_data_entry' | 'results') => void;
  setManualColumns: (columns: ManualColumnDefinition[]) => void;
  setManualRows: (rows: Record<string, any>[]) => void;
  initializeManualDataset: (datasetName: string) => Promise<void>;
  openCurrentDatasetInManualEditor: () => Promise<void>;
  
  // History Actions
  addAnalysisResult: (result: AnalysisResult) => void;
  setActiveAnalysisId: (id: string | null) => void;
  addAnnotation: (analysisId: string, annotation: { text: string; x: number; y: number; showArrow: boolean }) => void;
  removeAnnotation: (analysisId: string, index: number) => void;
  renameAnalysisResult: (id: string, newTitle: string) => void;
  setAnalysisResultGroup: (id: string, groupName: string | null) => void;
  deleteAnalysisResult: (id: string) => void;
  
  // Dashboard Navigation
  activeDashboardTab: 'home' | 'data_prep' | 'data_dashboard' | 'exploratory' | 'results' | 'desc_stats' | 'stat_tests' | 'stat_tests_param' | 'stat_tests_nonparam' | 'stat_tests_normality' | 'stat_tests_association' | 'regs' | 'multivar' | 'chart_designer' | 'custom_dashboard' | 'interactive_lab';
  setActiveDashboardTab: (tab: 'home' | 'data_prep' | 'data_dashboard' | 'exploratory' | 'results' | 'desc_stats' | 'stat_tests' | 'stat_tests_param' | 'stat_tests_nonparam' | 'stat_tests_normality' | 'stat_tests_association' | 'regs' | 'multivar' | 'chart_designer' | 'custom_dashboard' | 'interactive_lab') => void;
  suggestedTestId?: string;
  suggestedRegressionType?: string;
  logIn: (firstName: string, lastName: string, daysRemaining?: number | null, expiryDate?: string | null) => void;
  saveProject: (customFilename?: string) => Promise<void>;
  loadProject: (projectData: any, filename?: string) => Promise<void>;
  restoreAutosavedSession: () => Promise<boolean>;
}

const parseCsvText = (text: string) => {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) {
    throw new Error("Le fichier CSV est vide.");
  }
  
  // Auto-detect delimiter: comma vs semicolon vs tab in first line
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }
  
  // Custom CSV parser line helper
  const parseLine = (line: string) => {
    const result: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result;
  };
  
  const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
  if (headers.length === 0 || headers.every(h => h === '')) {
    throw new Error("Impossible de détecter les en-têtes de colonnes du CSV.");
  }
  
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    const values = parseLine(rawLine);
    const rowObj: Record<string, any> = {};
    headers.forEach((header, idx) => {
      let val: any = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '') : '';
      
      // Auto-parse numeric values. Also handle European fractional commas like "3,14" which converts to 3.14 if the delimiter is semicolon!
      if (val !== '') {
        const cleanedVal = delimiter === ';' ? val.replace(',', '.') : val;
        if (!isNaN(Number(cleanedVal)) && cleanedVal.trim() !== '') {
          val = Number(cleanedVal);
        }
      }
      rowObj[header] = val;
    });
    rows.push(rowObj);
  }
  
  // Build columns metadata
  const columns = headers.map(name => {
    let isNum = true;
    let hasVal = false;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const v = rows[i][name];
      if (v !== undefined && v !== null && v !== '') {
        hasVal = true;
        if (typeof v !== 'number') {
          isNum = false;
          break;
        }
      }
    }
    const type: StatType = isNum && hasVal ? 'continuous' : 'nominal';
    return {
      name,
      type,
      missing_values: rows.filter(r => r[name] === undefined || r[name] === null || r[name] === '').length,
      raw_dtype: isNum ? 'float64' : 'object'
    } as ColumnMetadata;
  });
  
  return { columns, rows };
};

export const parseJsonToDataset = (jsonData: any[]) => {
  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }
  
  const keysSet = new Set<string>();
  jsonData.forEach(row => {
    Object.keys(row).forEach(k => keysSet.add(k));
  });
  const headers = Array.from(keysSet);
  
  const rows = jsonData.map(row => {
    const rowObj: Record<string, any> = {};
    headers.forEach(h => {
      let val = row[h];
      
      if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'string') {
        const cleanedVal = val.trim();
        if (cleanedVal !== '' && !isNaN(Number(cleanedVal))) {
          val = Number(cleanedVal);
        } else {
          val = cleanedVal;
        }
      }
      rowObj[h] = val;
    });
    return rowObj;
  });
  
  const columns = headers.map(name => {
    let isNum = true;
    let hasVal = false;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const v = rows[i][name];
      if (v !== undefined && v !== null && v !== '') {
        hasVal = true;
        if (typeof v !== 'number') {
          isNum = false;
          break;
        }
      }
    }
    const type: StatType = isNum && hasVal ? 'continuous' : 'nominal';
    return {
      name,
      type,
      missing_values: rows.filter(r => r[name] === undefined || r[name] === null || r[name] === '').length,
      raw_dtype: isNum ? 'float64' : 'object'
    } as ColumnMetadata;
  });
  
  return { columns, rows };
};

class RecentProjectsDB {
  private dbName = 'nura_projects_db';
  private storeName = 'project_data';
  private version = 1;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error("IndexedDB is not supported"));
        return;
      }
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, val: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(val, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("Could not save to IndexedDB", e);
    }
  }

  async get(key: string): Promise<any> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("Could not read from IndexedDB", e);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("Could not delete from IndexedDB", e);
    }
  }
}

const projectsDB = new RecentProjectsDB();

const getInitialRecentProjects = (): RecentProject[] => {
  if (typeof window === 'undefined') return [];
  try {
    const rawV2 = localStorage.getItem('nura_recent_projects_v2');
    if (rawV2) {
      return JSON.parse(rawV2);
    }
    const rawV1 = localStorage.getItem('nura_recent_projects_v1');
    if (rawV1) {
      try {
        return JSON.parse(rawV1);
      } catch (e) {
        return [];
      }
    }
    return [];
  } catch (e) {
    console.warn("Could not load recent projects from localStorage", e);
    return [];
  }
};

const applyCustomFormulas = (columns: ColumnMetadata[], previewData: any[], pipeline: TransformationStep[]) => {
  let currentPreview = [...previewData];
  let currentCols = [...columns];

  const formulaSteps = pipeline.filter(step => step.type === 'formula_calculator' && step.enabled);
  for (const step of formulaSteps) {
    const newColName = step.newColumnName || 'Var_calculee';
    const formula = step.formula || '';

    if (!currentCols.some(c => c.name === newColName)) {
      currentCols.push({
        name: newColName,
        type: 'continuous',
        missing_values: 0,
        raw_dtype: 'float64'
      });
    }

    currentPreview = currentPreview.map(row => {
      const availableCols = currentCols.map(c => c.name).filter(n => n !== newColName);
      const val = evaluateFormulaForRow(formula, row, availableCols);
      return {
        ...row,
        [newColName]: val
      };
    });
  }

  return { columns: currentCols, previewData: currentPreview, colCount: currentCols.length };
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  recentProjects: getInitialRecentProjects(),

  addRecentProject: (projectData: any, filename: string) => {
    try {
      // 1. Save the actual project data in IndexedDB
      projectsDB.set("project_" + filename, projectData);

      const currentList = get().recentProjects;
      const filtered = currentList.filter(p => p.filename !== filename);
      
      const newProject: RecentProject = {
        filename,
        datasetName: projectData.datasetName || filename.replace(/\.nra$/, ''),
        rowCount: projectData.rowCount ?? 0,
        colCount: projectData.colCount ?? 0,
        updatedAt: new Date().toISOString(),
        data: undefined
      };
      
      const updated = [newProject, ...filtered].slice(0, 5);
      
      set({ recentProjects: updated });
      if (typeof window !== 'undefined') {
        localStorage.setItem('nura_recent_projects_v2', JSON.stringify(updated));
        localStorage.removeItem('nura_recent_projects_v1');
        const api = getApi();
        if (api.set_store_item) {
          api.set_store_item('nura_recent_projects_v2', updated);
        }
      }
    } catch (e: any) {
      console.warn("Could not save to localStorage/IndexedDB:", e);
    }
  },

  removeRecentProject: (index: number) => {
    const currentList = get().recentProjects;
    const itemToRemove = currentList[index];
    if (itemToRemove && itemToRemove.filename) {
      projectsDB.delete("project_" + itemToRemove.filename);
    }
    const updated = currentList.filter((_, i) => i !== index);
    set({ recentProjects: updated });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nura_recent_projects_v2', JSON.stringify(updated));
        const api = getApi();
        if (api.set_store_item) {
          api.set_store_item('nura_recent_projects_v2', updated);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  },

  isReady: false,
  isLoggedIn: false,
  userName: null,
  licenseDaysRemaining: null,
  licenseExpiryDate: null,
  workspaceMode: 'dashboard',
  isLoading: false,
  loadingMessage: '',
  logIn: (firstName, lastName, daysRemaining = null, expiryDate = null) => set({ 
    isLoggedIn: true, 
    userName: `${firstName} ${lastName}`.trim(),
    licenseDaysRemaining: daysRemaining,
    licenseExpiryDate: expiryDate
  }),
  suggestedTestId: '',
  suggestedRegressionType: '',

  // Settings
  decimals: 2,
  alpha: 0.05,
  darkMode: false,
  geminiApiKey: '',
  miraApiProvider: 'gemini',
  miraApiKey: '',
  miraApiModel: 'gemini-3.5-flash',
  miraApiBaseUrl: '',
  setSettings: (settings) => set((state) => ({ ...state, ...settings })),

  // Mira Assistant
  miraChats: {},
  miraWidgetOpen: false,
  miraActiveAnalysisId: null,
  openMira: (analysisId) => set({ miraWidgetOpen: true, miraActiveAnalysisId: analysisId || null }),
  closeMira: () => set({ miraWidgetOpen: false, miraActiveAnalysisId: null }),
  setMiraChat: (analysisId, chatHistory) => set((state) => ({
    miraChats: { ...state.miraChats, [analysisId]: chatHistory }
  })),
  clearMiraChat: (analysisId) => set((state) => {
    const nextChats = { ...state.miraChats };
    delete nextChats[analysisId];
    return { miraChats: nextChats };
  }),

  pendingImport: null,
  setPendingImport: (pending) => set({ pendingImport: pending }),

  confirmPendingImport: async (selectedColumns?: string[]) => {
    const { pendingImport, datasets } = get();
    if (!pendingImport) return;
    
    let finalImport = { ...pendingImport };

    if (selectedColumns && selectedColumns.length > 0 && selectedColumns.length < pendingImport.columns.length) {
      set({ isLoading: true, loadingMessage: 'Filtrage des colonnes...' });
      const api = getApi();
      const res = await api.keep_columns(selectedColumns);
      set({ isLoading: false });
      if (!res.success) {
        toast.error(res.error || "Erreur lors du filtrage des colonnes.");
        return;
      }
      finalImport = {
        ...finalImport,
        columns: res.columns || finalImport.columns.filter(c => selectedColumns.includes(c.name)),
        previewData: res.preview || finalImport.previewData.map(row => {
          const newRow: Record<string, any> = {};
          selectedColumns.forEach(col => {
            newRow[col] = row[col];
          });
          return newRow;
        }),
        colCount: res.col_count || selectedColumns.length
      };
    }
    
    // Add to datasets store
    const newDs = {
      id: finalImport.dataset_id || String(Date.now()),
      name: finalImport.datasetName,
      rowCount: finalImport.rowCount,
      colCount: finalImport.colCount,
      columns: finalImport.columns,
      preview: finalImport.previewData
    };
    
    set({
      datasets: [newDs, ...datasets],
      activeDatasetId: newDs.id,
      isReady: true,
      filePath: finalImport.filePath,
      datasetName: finalImport.datasetName,
      rowCount: finalImport.rowCount,
      colCount: finalImport.colCount,
      columns: finalImport.columns,
      previewData: finalImport.previewData,
      pendingImport: null,
      activeDashboardTab: 'data_prep'
    });
    toast.success('Le jeu de données a été importé avec succès.');
  },
  
  filePath: null,
  datasetName: null,
  rowCount: 0,
  colCount: 0,
  columns: [],
  previewData: [],
  datasets: [],
  activeDatasetId: null,
  switchDataset: async (id: string) => {
    const api = getApi();
    if(api.switch_dataset) {
      set({ isLoading: true, loadingMessage: 'Changement de jeu de données...' });
      try {
        const res = await api.switch_dataset(id);
        if(res.success && res.dataset_id) {
          const ds = get().datasets.find(d => d.id === res.dataset_id);
          set({
            activeDatasetId: res.dataset_id,
            rowCount: res.row_count || 0,
            colCount: res.col_count || 0,
            columns: res.columns || [],
            previewData: res.preview || [],
            datasetName: ds ? ds.name : 'Dataset Inconnu',
            history: [],
            pipeline: [],
            isLoading: false
          });
        } else {
          set({ isLoading: false });
        }
      } catch (e) {
        set({ isLoading: false });
      }
    }
  },
  removeDataset: async (id: string) => {
    const { datasets, activeDatasetId, switchDataset } = get();
    const newDatasets = datasets.filter((ds) => ds.id !== id);
    set({ datasets: newDatasets });
    
    if (activeDatasetId === id) {
      if (newDatasets.length > 0) {
        await switchDataset(newDatasets[newDatasets.length - 1].id);
      } else {
        set({
           activeDatasetId: null,
           rowCount: 0,
           colCount: 0,
           columns: [],
           previewData: [],
           datasetName: 'Aucun jeu de données',
           history: [],
           pipeline: [],
           isReady: false
        });
      }
    }
  },
  pipeline: [],
  
  manualColumns: [],
  manualRows: [],
  
  history: [],
  activeAnalysisId: null,
  activeDashboardTab: 'home',
  setActiveDashboardTab: (tab) => set({ activeDashboardTab: tab }),
  
  isSheetModalOpen: false,
  excelSheets: [],
  pendingFilePath: null,

  isSmartExcelModalOpen: false,
  smartExcelFilePath: null,
  smartExcelSheetName: null,
  smartExcelPreview: null,
  setSmartExcelModalOpen: (isOpen) => set({ isSmartExcelModalOpen: isOpen }),

  isFilterModalOpen: false,
  isDuplicatesModalOpen: false,
  isFullDataModalOpen: false,
  isSettingsModalOpen: false,
  isCalculatorModalOpen: false,
  isCrosstabModalOpen: false,
  isGeneratorOpen: false,
  rawCrosstabData: null,
  isImportingCrosstab: false,
  setCrosstabModalOpen: (isOpen) => set({ isCrosstabModalOpen: isOpen }),
  setIsGeneratorOpen: (isOpen) => set({ isGeneratorOpen: isOpen }),

  setFilterModalOpen: (isOpen: boolean) => set({ isFilterModalOpen: isOpen }),
  setDuplicatesModalOpen: (isOpen: boolean) => set({ isDuplicatesModalOpen: isOpen }),
  setFullDataModalOpen: (isOpen: boolean) => set({ isFullDataModalOpen: isOpen }),
  setSettingsModalOpen: (isOpen: boolean) => set({ isSettingsModalOpen: isOpen }),
  setCalculatorModalOpen: (isOpen: boolean) => set({ isCalculatorModalOpen: isOpen }),

  resetWorkspace: () => {
    set({
      isReady: false,
      filePath: null,
      datasetName: null,
      rowCount: 0,
      colCount: 0,
      columns: [],
      previewData: [],
      pipeline: [],
      pendingImport: null,
      isSheetModalOpen: false,
      excelSheets: [],
      pendingFilePath: null,
      isSmartExcelModalOpen: false,
      smartExcelFilePath: null,
      smartExcelSheetName: null,
      smartExcelPreview: null,
      isLoading: false,
    });
  },

  triggerImportCrosstab: async () => {
    try {
      const isDesktop = typeof window !== 'undefined' && 
                        window.pywebview && 
                        window.pywebview.api && 
                        !!(window.pywebview.api as any).open_file_dialog;
      
      set({ isImportingCrosstab: true });

      if (isDesktop) {
        const api = getApi();
        const path = await api.open_file_dialog();
        if (!path) {
          set({ isImportingCrosstab: false });
          return;
        }
        
        set({ isLoading: true, loadingMessage: 'Analyse du fichier...' });

        // Check if multiple sheets (Excel)
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext === 'xls' || ext === 'xlsx') {
          const sheetCheck = await api.check_excel_sheets(path);
          if (!sheetCheck.success) {
            throw new Error(sheetCheck.error || "Erreur de lecture du fichier Excel");
          }
          
          if (sheetCheck.multiple && sheetCheck.sheets) {
            // Open Modal for sheet selection
            set({ 
              isLoading: false, 
              isSheetModalOpen: true, 
              excelSheets: sheetCheck.sheets, 
              pendingFilePath: path 
            });
            return;
          }
        }
        
        const res = await api.load_raw_data(path);
        set({ isLoading: false, isImportingCrosstab: false });
        
        if (!res.success) {
          throw new Error(res.error || "Erreur lors du chargement des données.");
        }
        
        set({ rawCrosstabData: res.data, isCrosstabModalOpen: true });
      } else {
        // Browser Route
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) {
            document.body.removeChild(input);
            set({ isImportingCrosstab: false });
            return;
          }
          document.body.removeChild(input);
          
          set({ isLoading: true, loadingMessage: `Chargement de "${file.name}"...` });
          
          try {
            const ext = file.name.split('.').pop()?.toLowerCase();
            const processFile = async (data: any[][]) => {
              set({ isLoading: false, rawCrosstabData: data, isCrosstabModalOpen: true, isImportingCrosstab: false });
            };

            if (ext === 'xlsx' || ext === 'xls') {
              const XLSX = await import('xlsx');
              const reader = new FileReader();
              reader.onload = async (evt) => {
                try {
                  const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  if (workbook.SheetNames.length === 0) throw new Error("Classeur vide");

                  if (workbook.SheetNames.length > 1) {
                    set({
                      isLoading: false,
                      isSheetModalOpen: true,
                      excelSheets: workbook.SheetNames,
                      pendingFilePath: file.name
                    });
                    (window as any).__pendingExcelFile = file;
                    return;
                  }

                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                  await processFile(json);
                } catch(error: any) {
                  set({ isLoading: false, isImportingCrosstab: false });
                  throw error;
                }
              };
              reader.readAsArrayBuffer(file);
            } else if (ext === 'csv') {
              const text = await file.text();
              const Papa = await import('papaparse');
              Papa.parse(text, {
                complete: (results) => {
                  processFile(results.data as any[][]);
                },
                error: (error) => {
                  set({ isLoading: false, isImportingCrosstab: false });
                  throw new Error(error.message);
                }
              });
            } else {
              set({ isLoading: false, isImportingCrosstab: false });
              throw new Error("Format non supporté.");
            }
          } catch(err: any) {
             set({ isLoading: false, isImportingCrosstab: false });
             console.error(err);
             toast.error(err.message || 'Erreur lors de l\'importation');
          }
        };
        
        // Handle cancel file dialog
        input.oncancel = () => {
           set({ isImportingCrosstab: false });
           document.body.removeChild(input);
        };

        input.click();
      }
    } catch (err: any) {
      set({ isLoading: false, isImportingCrosstab: false });
      console.error(err);
      toast.error(err.message || 'Erreur lors de l\'importation');
    }
  },

  triggerImport: async () => {
    try {
      set({ isImportingCrosstab: false });
      const isDesktop = typeof window !== 'undefined' && 
                        window.pywebview && 
                        window.pywebview.api && 
                        !!(window.pywebview.api as any).open_file_dialog;
      
      if (isDesktop) {
        const api = getApi();
        const path = await api.open_file_dialog();
        
        if (!path) return; // User cancelled dialog
        
        set({ isLoading: true, loadingMessage: 'Analyse du fichier...' });

        // Check if multiple sheets (Excel)
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext === 'xls' || ext === 'xlsx') {
          const sheetCheck = await api.check_excel_sheets(path);
          if (!sheetCheck.success) {
            throw new Error(sheetCheck.error || "Erreur de lecture du fichier Excel");
          }
          
          if (sheetCheck.multiple && sheetCheck.sheets) {
            // Open Modal for sheet selection
            set({ 
              isLoading: false, 
              isSheetModalOpen: true, 
              excelSheets: sheetCheck.sheets, 
              pendingFilePath: path 
            });
            return;
          }
        }

        // Standard load (CSV, SAV, or Single-sheet Excel)
        const dataset = await api.load_dataset(path);
        if (!dataset.success) {
           throw new Error(dataset.error || "Erreur lors du chargement des données.");
        }

        const fileName = path.split('\\').pop()?.split('/').pop() || 'Dataset';
        

        set({
          isLoading: false,
          pendingImport: {
            filePath: path,
            datasetName: fileName,
            rowCount: dataset.row_count || 0,
            colCount: dataset.col_count || 0,
            columns: dataset.columns || [],
            previewData: dataset.preview || [],
            dataset_id: dataset.dataset_id
          }
        });

      } else {
        // Browser Mode - Create dynamic file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls,.sav';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) {
            document.body.removeChild(input);
            return;
          }
          document.body.removeChild(input);
          
          set({ isLoading: true, loadingMessage: `Chargement de "${file.name}"...` });
          
          try {
            const ext = file.name.split('.').pop()?.toLowerCase();
            
            if (ext === 'sav') {
              throw new Error("L'importation de fichiers SPSS (.sav) n'est disponible que dans l'application Bureau. Veuillez enregistrer au format CSV ou Excel pour l'analyse en ligne.");
            }
            
            if (ext === 'xlsx' || ext === 'xls') {
              const XLSX = await import('xlsx');
              const reader = new FileReader();
              
              reader.onload = async (evt) => {
                try {
                  const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  
                  if (workbook.SheetNames.length === 0) {
                    throw new Error("Le classeur Excel ne contient aucune feuille de calcul.");
                  }
                  
                  if (workbook.SheetNames.length > 1) {
                    set({
                      isLoading: false,
                      isSheetModalOpen: true,
                      excelSheets: workbook.SheetNames,
                      pendingFilePath: file.name
                    });
                    (window as any).__pendingExcelFile = file;
                    return;
                  }
                  
                  set({ isLoading: false });
                  (window as any).__pendingExcelFile = file;
                  await get().loadSmartExcelPreview(file.name, workbook.SheetNames[0]);
                  return;
                } catch (err: any) {
                  set({ isLoading: false });
                  toast.error(`Erreur d'analyse Excel : ${err.message || err}`);
                }
              };
              reader.readAsArrayBuffer(file);
              
            } else if (ext === 'csv') {
              const reader = new FileReader();
              reader.onload = (evt) => {
                try {
                  const text = evt.target?.result as string;
                  const parsed = parseCsvText(text);
                  
                  set({
                    isLoading: false,
                    pendingImport: {
                      filePath: file.name,
                      datasetName: file.name,
                      rowCount: parsed.rows.length,
                      colCount: parsed.columns.length,
                      columns: parsed.columns,
                      previewData: parsed.rows
                    }
                  });
                } catch (err: any) {
                  set({ isLoading: false });
                  toast.error(`Erreur d'analyse CSV : ${err.message || err}`);
                }
              };
              reader.readAsText(file, 'UTF-8');
            } else {
              throw new Error("Format de fichier non configuré. Veuillez utiliser un fichier CSV (.csv) ou Excel (.xlsx, .xls).");
            }
          } catch (err: any) {
            set({ isLoading: false });
            toast.error(err.message || String(err));
          }
        };
        
        input.click();
      }
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
      toast.error(`Erreur d'importation : ${error}`);
    }
  },

  selectExcelSheet: async (sheetName: string) => {
    const { isImportingCrosstab } = get();
    const isDesktop = typeof window !== 'undefined' && 
                      window.pywebview && 
                      window.pywebview.api && 
                      !!(window.pywebview.api as any).open_file_dialog;
    
    if (isDesktop) {
      const { pendingFilePath } = get();
      if (!pendingFilePath) return;

      set({ isSheetModalOpen: false, isLoading: true, loadingMessage: `Chargement de la feuille ${sheetName}...` });
      
      try {
        const api = getApi();
        if (isImportingCrosstab) {
           const res = await api.load_raw_data(pendingFilePath, sheetName);
           set({ isLoading: false, isImportingCrosstab: false, pendingFilePath: null, excelSheets: [] });
           if (!res.success) throw new Error(res.error || "Erreur lors du chargement des données.");
           set({ rawCrosstabData: res.data, isCrosstabModalOpen: true });
        } else {
           set({ isSheetModalOpen: false });
           await get().loadSmartExcelPreview(pendingFilePath, sheetName);
        }
      } catch (error) {
         console.error(error);
         set({ isLoading: false, isImportingCrosstab: false });
         toast.error(`Erreur de chargement : ${error}`);
      }
    } else {
      const file = (window as any).__pendingExcelFile;
      if (!file) {
        toast.error("Fichier temporaire perdu.");
        set({ isSheetModalOpen: false, isImportingCrosstab: false });
        return;
      }
      
      set({ isSheetModalOpen: false, isLoading: true, loadingMessage: `Chargement de la feuille ${sheetName}...` });
      
      try {
        const XLSX = await import('xlsx');
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[sheetName];
            
            if (isImportingCrosstab) {
               const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
               set({ isLoading: false, rawCrosstabData: json, isCrosstabModalOpen: true, isImportingCrosstab: false });
               delete (window as any).__pendingExcelFile;
            } else {
               set({ isSheetModalOpen: false });
               await get().loadSmartExcelPreview(file.name, sheetName);
            }
            set({ pendingFilePath: null, excelSheets: [] });
          } catch (err: any) {
            set({ isLoading: false, isImportingCrosstab: false });
            toast.error(`Erreur de feuille Excel : ${err.message || err}`);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err: any) {
        set({ isLoading: false, isImportingCrosstab: false });
        toast.error(`Erreur lors du traitement final Excel : ${err.message || err}`);
      }
    }
  },

  closeExcelModal: () => {
    delete (window as any).__pendingExcelFile;
    set({ isSheetModalOpen: false, pendingFilePath: null, excelSheets: [] });
  },

  loadSmartExcelPreview: async (filePath, sheetName, manualHeader = null, selectedBlock = 0, excludeCols = []) => {
    set({ isLoading: true, loadingMessage: "Analyse statistique de la feuille Excel..." });
    try {
      const api = getApi();
      if (!api.preprocess_excel_preview) {
        throw new Error("L'API de pré-traitement de la plateforme n'est pas disponible.");
      }
      const res = await api.preprocess_excel_preview(filePath, sheetName || 0, manualHeader, selectedBlock, excludeCols);
      if (res.success) {
        set({
          isSmartExcelModalOpen: true,
          smartExcelFilePath: filePath,
          smartExcelSheetName: sheetName ? String(sheetName) : null,
          smartExcelPreview: {
            detected_header_row: res.detected_header_row ?? 0,
            data_start_row: res.data_start_row ?? 1,
            nb_rows_detected: res.nb_rows_detected ?? 0,
            nb_columns: res.nb_columns ?? 0,
            columns: res.columns ?? [],
            sample_data: res.sample_data ?? [],
            titles: res.titles ?? [],
            blocks: res.blocks ?? [],
            selected_block: res.selected_block ?? 0
          },
          isLoading: false
        });
      } else {
        set({ isLoading: false });
        toast.error(res.error || "Erreur d'analyse structurelle de la feuille Excel");
      }
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || String(err));
    }
  },

  finalizeSmartExcelImport: async (manualHeader, selectedBlock, excludeCols) => {
    const { smartExcelFilePath, smartExcelSheetName } = get();
    if (!smartExcelFilePath) return;

    set({ isLoading: true, loadingMessage: "Nettoyage et importation statistique finale..." });
    try {
      const api = getApi();
      if (!api.import_preprocessed_excel) {
        throw new Error("L'importateur intelligent n'est pas disponible.");
      }
      const res = await api.import_preprocessed_excel(smartExcelFilePath, smartExcelSheetName || 0, manualHeader, selectedBlock, excludeCols);
      if (res.success && res.dataset_id) {
        const newDs = {
          id: res.dataset_id,
          name: `${smartExcelFilePath.split('\\').pop()?.split('/').pop() || 'Classeur'}${smartExcelSheetName ? ` - [${smartExcelSheetName}]` : ''} [Cleaned]`,
          rowCount: res.row_count || 0,
          colCount: res.col_count || 0,
          columns: res.columns || [],
          preview: res.preview || []
        };
        
        set((state) => ({
          datasets: [newDs, ...state.datasets],
          activeDatasetId: newDs.id,
          isReady: true,
          filePath: smartExcelFilePath,
          datasetName: newDs.name,
          rowCount: newDs.rowCount,
          colCount: newDs.colCount,
          columns: newDs.columns,
          previewData: newDs.preview,
          isSmartExcelModalOpen: false,
          smartExcelFilePath: null,
          smartExcelSheetName: null,
          smartExcelPreview: null,
          isLoading: false,
          activeDashboardTab: 'data_prep'
        }));
        delete (window as any).__pendingExcelFile;
        toast.success("Le fichier Excel sale a été parfaitement nettoyé et importé avec succès !");
      } else {
        set({ isLoading: false });
        toast.error(res.error || "Erreur d'importation finale du classeur.");
      }
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || String(err));
    }
  },

  updateColumn: async (oldName: string, newName: string, newType: StatType) => {
    try {
      const api = getApi();
      const result = await api.update_column(oldName, newName, newType);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur de mise à jour de la colonne");
      }
      
      set((state) => {
        const newColumns = state.columns.map((col) => 
          col.name === oldName 
            ? { ...col, name: newName, type: newType, raw_dtype: result.raw_dtype || col.raw_dtype }
            : col
        );
        return {
          columns: newColumns,
          previewData: result.preview || state.previewData 
        };
      });
      toast.success(`Le type ou le nom de la colonne '${oldName}' a été mis à jour.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur de modification : ${error}`);
    }
  },

  editCell: async (rowIdx: number, colName: string, newValue: string) => {
    try {
      const api = getApi();
      const result = await api.edit_cell(rowIdx, colName, newValue);
      if (!result.success) {
        throw new Error(result.error);
      }
      set({
        rowCount: result.row_count ?? get().rowCount,
        colCount: result.col_count ?? get().colCount,
        columns: result.columns ?? get().columns,
        previewData: result.preview ?? get().previewData
      });
      toast.success("Cellule modifiée avec succès.");
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur de modification de cellule : ${error.message || error}`);
    }
  },

  deleteRow: async (rowIdx: number) => {
    try {
      const api = getApi();
      const result = await api.delete_row(rowIdx);
      if (!result.success) {
        throw new Error(result.error);
      }
      set({
        rowCount: result.row_count ?? get().rowCount,
        colCount: result.col_count ?? get().colCount,
        columns: result.columns ?? get().columns,
        previewData: result.preview ?? get().previewData
      });
      toast.success("Ligne supprimée avec succès.");
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur lors de la suppression de la ligne : ${error.message || error}`);
    }
  },

  deleteColumn: async (colName: string) => {
    try {
      const api = getApi();
      const result = await api.delete_column(colName);
      if (!result.success) {
        throw new Error(result.error);
      }
      set({
        rowCount: result.row_count ?? get().rowCount,
        colCount: result.col_count ?? get().colCount,
        columns: result.columns ?? get().columns,
        previewData: result.preview ?? get().previewData
      });
      toast.success(`Colonne '${colName}' supprimée avec succès.`);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erreur lors de la suppression de la colonne : ${error.message || error}`);
    }
  },

  handleMissingValues: async (columnName: string, strategy: ImputationStrategy) => {
    try {
      const api = getApi();
      const result = await api.handle_missing_values(columnName, strategy);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur de traitement des valeurs manquantes");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'imputation',
        columnName,
        strategy,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        const newColumns = state.columns.map((col) => 
          col.name === columnName 
            ? { ...col, missing_values: result.missing_values ?? col.missing_values }
            : col
        );
        return {
          columns: newColumns,
          rowCount: result.row_count ?? state.rowCount,
          previewData: result.preview || state.previewData,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`Imputation appliquée sur la colonne '${columnName}'.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur d'imputation : ${error}`);
    }
  },

  detectOutliers: async (columnName: string, method: 'iqr' | 'zscore') => {
    try {
      const api = getApi();
      const result = await api.detect_outliers(columnName, method);
      return result;
    } catch (error) {
      console.error(error);
      return { success: false, error: String(error) };
    }
  },

  treatOutliers: async (columnName: string, detectMethod: 'iqr' | 'zscore', treatMethod: 'winsorize' | 'exclude' | 'median') => {
    try {
      const api = getApi();
      const result = await api.treat_outliers(columnName, detectMethod, treatMethod);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur de traitement des anomalies");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'outliers',
        columnName,
        detectMethod,
        treatMethod,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        return {
          columns: result.columns || state.columns,
          rowCount: result.row_count ?? state.rowCount,
          previewData: result.preview || state.previewData,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`Traitement des anomalies appliqué sur la colonne '${columnName}'.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur de traitement des anomalies : ${error}`);
    }
  },

  appendDataframeColumns: async (newColumnsDict: Record<string, any[]>) => {
    try {
      const api = getApi();
      const result = await api.append_dataframe_columns(newColumnsDict);
      if (!result.success) {
        throw new Error(result.error || "Erreur lors de l'ajout des variables");
      }
      set((state) => ({
         columns: result.columns || state.columns,
         colCount: result.col_count || state.colCount,
         rowCount: result.row_count || state.rowCount,
         previewData: result.preview || state.previewData
      }));
    } catch (error) {
      console.error("Append cols error:", error);
      throw error;
    }
  },

  getUniqueValues: async (columnName: string) => {
    try {
      const api = getApi();
      const result = await api.get_unique_values(columnName);
      if (!result.success) return [];
      return result.unique_values || [];
    } catch(e) {
      console.error(e);
      return [];
    }
  },

  applyFilter: async (conditions: FilterCondition[]) => {
    try {
      if (conditions.length === 0) return;
      const api = getApi();
      const result = await api.apply_filter(conditions);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur lors du filtrage");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'filter',
        conditions,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => ({
        rowCount: result.row_count ?? state.rowCount,
        previewData: result.preview || state.previewData,
        pipeline: [...state.pipeline, newStep],
        isFilterModalOpen: false
      }));
      toast.success('Le filtre a été appliqué.');
    } catch (error) {
      console.error(error);
      toast.error(`Erreur de filtrage : ${error}`);
    }
  },

  extractDatePart: async (sourceCol: string, part: 'day' | 'week' | 'month' | 'year' | 'quarter', newColName: string) => {
    try {
      const api = getApi();
      const result = await api.extract_date_part(sourceCol, part, newColName);
      
      if (!result.success || !result.new_column) {
        throw new Error(result.error || "Erreur lors de l'extraction de la date");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'date_extract',
        columnName: sourceCol,
        datePart: part,
        newColumnName: newColName,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        const existingIdx = state.columns.findIndex(c => c.name === result.new_column!.name);
        const newColumns = [...state.columns];
        if (existingIdx >= 0) {
          newColumns[existingIdx] = result.new_column!;
        } else {
          newColumns.push(result.new_column!);
        }

        return {
          columns: newColumns,
          previewData: result.preview || state.previewData,
          pipeline: [...state.pipeline, newStep],
          colCount: result.col_count || state.colCount,
          lastEditTimestamp: Date.now()
        };
      });
      toast.success(`La variable de type date a bien été extraite dans ${newColName}.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur : ${error}`);
    }
  },

  applyMathTransform: async (sourceCol: string, operation: MathOperation, newColName: string, targetCol?: string, constant?: number) => {
    try {
      const api = getApi();
      const result = await api.apply_math_transform(sourceCol, operation, newColName, targetCol || null, constant !== undefined ? constant : null);
      
      if (!result.success || !result.new_column) {
        throw new Error(result.error || "Erreur de transformation mathématique");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'math_transform',
        columnName: sourceCol,
        operation,
        newColumnName: newColName,
        targetColumn: targetCol,
        constant,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        const existingIdx = state.columns.findIndex(c => c.name === result.new_column!.name);
        const newColumns = [...state.columns];
        if (existingIdx >= 0) {
          newColumns[existingIdx] = result.new_column!;
        } else {
          newColumns.push(result.new_column!);
        }

        let finalPreview = result.preview;
        // Mock fallback for browser preview environment
        if (!finalPreview) {
          finalPreview = state.previewData.map(row => {
             const v1 = parseFloat(String(row[sourceCol] || '').replace(',', '.'));
             const v2Str = targetCol ? String(row[targetCol] || '').replace(',', '.') : '';
             const v2 = targetCol ? parseFloat(v2Str) : (constant || 0);
             let res = NaN;
             if (!isNaN(v1)) {
               if (operation === 'add') res = v1 + v2;
               else if (operation === 'subtract') res = v1 - v2;
               else if (operation === 'multiply') res = v1 * v2;
               else if (operation === 'divide' && v2 !== 0) res = v1 / v2;
               else if (operation === 'log' && v1 > 0) res = Math.log(v1);
               else if (operation === 'sqrt' && v1 >= 0) res = Math.sqrt(v1);
               else if (operation === 'standardize') res = v1; 
             }
             return { ...row, [newColName]: isNaN(res) ? null : res };
          });
        }

        return {
          columns: newColumns,
          colCount: result.col_count ?? state.colCount,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep],
        };
      });
      toast.success(`Transformation mathématique appliquée (nouvelle colonne: ${newColName}).`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur de calcul : ${error}`);
    }
  },

  removeDuplicates: async (keep: DuplicateKeep) => {
    try {
      const api = getApi();
      const result = await api.remove_duplicates(keep);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la suppression des doublons");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'remove_duplicates',
        duplicateKeep: keep,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        let finalPreview = result.preview;
        if (!finalPreview && result.duplicates_removed) {
            // Mock preview fallback
            finalPreview = state.previewData.slice(0, state.previewData.length - result.duplicates_removed);
        } else if (!finalPreview) {
            finalPreview = state.previewData;
        }

        return {
            rowCount: result.row_count ?? state.rowCount,
            previewData: finalPreview,
            pipeline: [...state.pipeline, newStep],
            isDuplicatesModalOpen: false
        };
      });
      toast.success('Les doublons ont été supprimés.');
      return Promise.resolve();
    } catch (error) {
      console.error(error);
      toast.error(`Erreur doublons : ${error}`);
    }
  },

  cleanStringColumn: async (columnName: string, operation: StringCleanOperation) => {
    try {
      const api = getApi();
      const result = await api.clean_string_column(columnName, operation);
      
      if (!result.success) {
        throw new Error(result.error || "Erreur de nettoyage textuel");
      }
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'string_clean',
        columnName,
        operation,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        let finalPreview = result.preview;
        if (!finalPreview) {
            finalPreview = state.previewData.map(row => {
                let val = String(row[columnName] || '');
                if (operation === 'trim') val = val.trim();
                else if (operation === 'lower') val = val.toLowerCase();
                else if (operation === 'upper') val = val.toUpperCase();
                else if (operation === 'title') val = val.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                return { ...row, [columnName]: val };
            });
        }
        return {
            previewData: finalPreview,
            pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`Le nettoyage de texte a été appliqué sur '${columnName}'.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur nettoyage texte : ${error}`);
    }
  },

  convertColumnToDate: async (columnName: string, newColName?: string) => {
    try {
      const api = getApi();
      const result = await api.convert_column_to_date(columnName, newColName || null);
      if (!result.success) throw new Error(result.error || "Erreur de conversion de date");
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'convert_date',
        columnName,
        enabled: true,
        timestamp: new Date().toISOString(),
        ...({
          newColumnName: newColName
        } as any)
      };
      
      set((state) => {
        let finalColumns = result.columns;
        let finalPreview = result.preview;
        
        if (!finalColumns) {
          finalColumns = [...state.columns];
          const target = newColName || columnName;
          const found = finalColumns.find(c => c.name === target);
          if (found) {
            found.type = 'datetime';
            found.raw_dtype = 'datetime64[ns]';
          } else {
            finalColumns.push({
              name: target,
              type: 'datetime',
              missing_values: 0,
              raw_dtype: 'datetime64[ns]'
            });
          }
        }
        
        if (!finalPreview) {
          finalPreview = state.previewData.map(row => {
            const val = row[columnName];
            let dateStr = null;
            if (val !== null && val !== undefined && val !== '') {
              const val_num = Number(val);
              if (!isNaN(val_num) && val_num >= 1 && val_num <= 100000) {
                const epoch = new Date(1899, 11, 30);
                epoch.setDate(epoch.getDate() + val_num);
                dateStr = epoch.toISOString();
              } else {
                try {
                  dateStr = new Date(val).toISOString();
                } catch {
                  dateStr = null;
                }
              }
            }
            return {
              ...row,
              [newColName || columnName]: dateStr
            };
          });
        }
        
        return {
          columns: finalColumns,
          colCount: finalColumns.length,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(newColName 
        ? `La variable '${columnName}' a été convertie en date dans '${newColName}'.`
        : `La variable '${columnName}' a été convertie en date en place.`
      );
    } catch (error) {
      console.error(error);
      toast.error(`Erreur conversion date : ${error}`);
    }
  },

  splitQualitativeColumn: async (columnName: string, method: 'separator' | 'length', targetCol1: string, targetCol2: string, separatorValue?: string, splitLength?: number) => {
    try {
      const api = getApi();
      const result = await api.split_qualitative_column(columnName, method, targetCol1, targetCol2, separatorValue, splitLength);
      if (!result.success) throw new Error(result.error || "Erreur lors de la scission de la variable");
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'split_column',
        columnName,
        enabled: true,
        timestamp: new Date().toISOString(),
        ...({
          splitMethod: method,
          targetCol1,
          targetCol2,
          separatorValue,
          splitLength
        } as any)
      };
      
      set((state) => {
        let finalColumns = result.columns;
        let finalPreview = result.preview;
        
        if (!finalColumns) {
          finalColumns = [...state.columns];
          if (!finalColumns.find(c => c.name === targetCol1)) {
            finalColumns.push({ name: targetCol1, type: 'nominal', missing_values: 0, raw_dtype: 'object' });
          }
          if (!finalColumns.find(c => c.name === targetCol2)) {
            finalColumns.push({ name: targetCol2, type: 'nominal', missing_values: 0, raw_dtype: 'object' });
          }
        }
        
        if (!finalPreview) {
          finalPreview = state.previewData.map(row => {
            const val = String(row[columnName] || '');
            let v1 = '';
            let v2 = '';
            if (method === 'separator') {
              const sep = separatorValue === 'space' || !separatorValue ? ' ' : separatorValue;
              const idx = val.indexOf(sep);
              if (idx !== -1) {
                v1 = val.substring(0, idx);
                v2 = val.substring(idx + sep.length);
              } else {
                v1 = val;
              }
            } else {
              const len = splitLength || 0;
              v1 = val.substring(0, len);
              v2 = val.substring(len);
            }
            return {
              ...row,
              [targetCol1]: v1,
              [targetCol2]: v2
            };
          });
        }
        
        return {
          columns: finalColumns,
          colCount: finalColumns.length,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`La variable '${columnName}' a été scindée en '${targetCol1}' et '${targetCol2}'.`);
    } catch (error) {
      console.error(error);
      toast.error(`Erreur scission de variable : ${error}`);
    }
  },

  discretizeColumn: async (columnName: string, method: BinningMethod, newColName: string, numBins?: number, thresholds?: number[], labels?: string[]) => {
    try {
      const api = getApi();
      const result = await api.discretize_column(columnName, method, newColName, numBins, thresholds, labels);
      if (!result.success) throw new Error(result.error || "Erreur de discrétisation");
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'binning',
        columnName,
        binningMethod: method,
        newColumnName: newColName,
        numBins,
        thresholds,
        labels,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        let finalColumns = result.columns;
        let finalPreview = result.preview;
        
        // Mock fallback
        if (!finalColumns) {
           finalColumns = [...state.columns];
           if (!finalColumns.find(c => c.name === newColName)) {
               finalColumns.push({ name: newColName, type: 'nominal', missing_values: 0, raw_dtype: 'category' });
           }
        }
        if (!finalPreview) {
            finalPreview = state.previewData.map(row => ({...row, [newColName]: 'Classe_1'}));
        }

        return {
          columns: finalColumns,
          colCount: finalColumns.length,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`La variable '${columnName}' a été discrétisée.`);
    } catch (error) {
       console.error(error);
       toast.error(`Erreur de discrétisation : ${error}`);
    }
  },

  groupCategories: async (columnName: string, mapping: Record<string, string>, newColName?: string) => {
    try {
      const api = getApi();
      const result = await api.group_categories(columnName, mapping, newColName);
      if (!result.success) throw new Error(result.error || "Erreur de regroupement");
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'grouping',
        columnName,
        mapping,
        newColumnName: newColName,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        let finalColumns = result.columns;
        let finalPreview = result.preview;
        
        // Mock fallback
        if (!finalColumns) {
           finalColumns = [...state.columns];
           const targetCol = newColName || columnName;
           if (!finalColumns.find(c => c.name === targetCol)) {
               finalColumns.push({ name: targetCol, type: 'nominal', missing_values: 0, raw_dtype: 'object' });
           }
        }
        if (!finalPreview) {
            finalPreview = state.previewData;
        }

        return {
          columns: finalColumns,
          colCount: finalColumns.length,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`Les modalités de '${columnName}' ont été regroupées.`);
    } catch (error) {
       console.error(error);
       toast.error(`Erreur de regroupement : ${error}`);
    }
  },

  encodeColumn: async (columnName: string, method: EncodingMethod, newColName?: string, dropFirst?: boolean) => {
    try {
      const api = getApi();
      const result = await api.encode_column(columnName, method, newColName, dropFirst);
      if (!result.success) throw new Error(result.error || "Erreur d'encodage");
      
      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'encoding',
        columnName,
        encodingMethod: method,
        newColumnName: newColName,
        dropFirst,
        enabled: true,
        timestamp: new Date().toISOString()
      };
      
      set((state) => {
        let finalColumns = result.columns;
        let finalPreview = result.preview;
        
        // Mock fallback
        if (!finalColumns) {
           finalColumns = [...state.columns];
           const targetCol = newColName || `${columnName}_encoded`;
           if (!finalColumns.find(c => c.name === targetCol)) {
               finalColumns.push({ name: targetCol, type: 'continuous', missing_values: 0, raw_dtype: 'int64' });
           }
        }
        if (!finalPreview) {
            finalPreview = state.previewData;
        }

        return {
          columns: finalColumns,
          colCount: finalColumns.length,
          previewData: finalPreview,
          pipeline: [...state.pipeline, newStep]
        };
      });
      toast.success(`La variable '${columnName}' a été encodée.`);
    } catch (error) {
       console.error(error);
       toast.error(`Erreur d'encodage : ${error}`);
    }
  },

  togglePipelineStep: async (id: string, enabled: boolean) => {
    const { pipeline } = get();
    const newPipeline = pipeline.map(step => step.id === id ? { ...step, enabled } : step);
    set({ pipeline: newPipeline });
    
    try {
      const api = getApi();
      const result = await api.run_pipeline(newPipeline);
      if (!result.success) throw new Error(result.error);
      
      const { columns, previewData } = get();
      const baseCols = result.columns || columns;
      const basePreview = result.preview || previewData;

      const { columns: finalCols, previewData: finalPreview, colCount } = applyCustomFormulas(baseCols, basePreview, newPipeline);

      set((state) => ({
         columns: finalCols,
         colCount: colCount || state.colCount,
         rowCount: result.row_count || state.rowCount,
         previewData: finalPreview
      }));
      toast.success(enabled ? 'Étape activée avec succès.' : 'Étape désactivée avec succès.');
    } catch (e) {
      console.error(e);
      toast.error(`Erreur lors du recalcul : ${e}`);
    }
  },

  removePipelineStep: async (id: string) => {
    const { pipeline } = get();
    const newPipeline = pipeline.filter(step => step.id !== id);
    set({ pipeline: newPipeline });
    
    try {
      const api = getApi();
      const result = await api.run_pipeline(newPipeline);
      if (!result.success) throw new Error(result.error);
      
      const { columns, previewData } = get();
      const baseCols = result.columns || columns;
      const basePreview = result.preview || previewData;

      const { columns: finalCols, previewData: finalPreview, colCount } = applyCustomFormulas(baseCols, basePreview, newPipeline);

      set((state) => ({
         columns: finalCols,
         colCount: colCount || state.colCount,
         rowCount: result.row_count || state.rowCount,
         previewData: finalPreview
      }));
      toast.success('Étape supprimée avec succès.');
    } catch (e) {
      console.error(e);
      toast.error(`Erreur lors du recalcul : ${e}`);
    }
  },

  addFormulaPipelineStep: async (newColName: string, formulaStr: string) => {
    set({ isLoading: true, loadingMessage: 'Calcul de la formule...' });
    try {
      const { pipeline, columns, previewData } = get();

      if (columns.some(c => c.name === newColName && !pipeline.some(p => p.newColumnName === newColName))) {
        throw new Error(`La variable '${newColName}' existe déjà dans le jeu d'origine.`);
      }

      const newStep: TransformationStep = {
        id: crypto.randomUUID(),
        type: 'formula_calculator',
        newColumnName: newColName,
        formula: formulaStr,
        enabled: true,
        timestamp: new Date().toISOString()
      };

      const updatedPipeline = [...pipeline, newStep];
      const { columns: finalCols, previewData: finalPreview, colCount } = applyCustomFormulas(columns, previewData, updatedPipeline);

      set({
        pipeline: updatedPipeline,
        columns: finalCols,
        previewData: finalPreview,
        colCount: colCount,
        isLoading: false
      });
      toast.success(`Variable calculée créée : ${newColName}`);
    } catch (error: any) {
      set({ isLoading: false });
      console.error(error);
      toast.error(`Erreur : ${error.message || error}`);
      throw error;
    }
  },

  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setManualColumns: (columns) => set({ manualColumns: columns }),
  setManualRows: (rows) => set({ manualRows: rows }),

  openCurrentDatasetInManualEditor: async () => {
    const { columns, datasetName } = get();
    set({ isLoading: true, loadingMessage: 'Chargement des données dans l\'éditeur de saisie...' });
    try {
      const api = getApi();
      const res = await api.get_full_dataset();
      if (!res.success) {
        throw new Error(res.error || "Impossible de récupérer l'ensemble des données.");
      }
      
      const cleanedRows = (res.data || []).map((row: any) => {
        const copy = { ...row };
        delete copy.__index__;
        return copy;
      });

      const mappedCols: ManualColumnDefinition[] = columns.map((c) => {
        const labels: Record<string, string> = {};
        if (c.type === 'nominal' || c.type === 'ordinal') {
          const uniqueVals = Array.from(
            new Set(
              cleanedRows
                .map((row: any) => row[c.name])
                .filter((v: any) => v !== undefined && v !== null && v !== '')
            )
          );
          uniqueVals.sort((a: any, b: any) => {
            const aStr = String(a);
            const bStr = String(b);
            return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
          });
          uniqueVals.forEach((val: any) => {
            const valStr = String(val);
            labels[valStr] = valStr;
          });
        }
        return {
          id: Math.random().toString(36).substring(2, 9),
          name: c.name,
          type: c.type,
          labels
        };
      });
      
      set({
        manualColumns: mappedCols,
        manualRows: cleanedRows,
        workspaceMode: 'manual_data_entry',
        isLoading: false
      });
      toast.success("Données chargées dans l'outil de saisie manuelle. Vous pouvez à présent modifier ou ajouter de nouvelles observations ou colonnes.");
    } catch (err: any) {
      set({ isLoading: false });
      console.error(err);
      toast.error(`Erreur lors du transfert : ${err.message || err}`);
    }
  },

  addAnalysisResult: (result) => set((state) => ({ 
    history: [result, ...state.history],
    activeAnalysisId: result.id,
    workspaceMode: 'dashboard',
    activeDashboardTab: 'results'
  })),
  setActiveAnalysisId: (id) => set({ activeAnalysisId: id }),
  addAnnotation: (analysisId, annotation) => set((state) => {
    const newHistory = state.history.map((item) => {
      if (item.id === analysisId) {
        const currentAnnotations = item.annotations || [];
        return {
          ...item,
          annotations: [...currentAnnotations, annotation]
        };
      }
      return item;
    });
    return { history: newHistory };
  }),
  removeAnnotation: (analysisId, index) => set((state) => {
    const newHistory = state.history.map((item) => {
      if (item.id === analysisId) {
        const currentAnnotations = item.annotations || [];
        return {
          ...item,
          annotations: currentAnnotations.filter((_, idx) => idx !== index)
        };
      }
      return item;
    });
    return { history: newHistory };
  }),

  renameAnalysisResult: (id, newTitle) => set((state) => ({
    history: state.history.map((item) => item.id === id ? { ...item, title: newTitle } : item)
  })),

  setAnalysisResultGroup: (id, groupName) => set((state) => ({
    history: state.history.map((item) => item.id === id ? { ...item, group: groupName || undefined } : item)
  })),

  deleteAnalysisResult: (id) => set((state) => {
    const updated = state.history.filter((item) => item.id !== id);
    const active = state.activeAnalysisId === id ? (updated[0]?.id || null) : state.activeAnalysisId;
    return { history: updated, activeAnalysisId: active };
  }),

  initializeManualDataset: async (datasetName: string) => {
    const { manualColumns, manualRows } = get();
    set({ isLoading: true, loadingMessage: 'Initialisation du jeu de données...' });
    try {
      const api = getApi();
      const result = await api.initialize_manual_dataframe(manualColumns, manualRows);
      if (!result.success) {
        throw new Error(result.error);
      }
      set({ 
        isLoading: false, 
        isReady: true,
        workspaceMode: 'dashboard',
        activeDashboardTab: 'data_prep',
        datasetName,
        rowCount: result.row_count || manualRows.length,
        colCount: result.col_count || manualColumns.length,
        columns: result.columns || [],
        previewData: result.preview || [],
        pipeline: []
      });
      toast.success('Le jeu de données a été créé avec succès.');
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
      toast.error(`Erreur d'initialisation : ${error}`);
    }
  },

  saveProject: async (customFilename?: string) => {
    const {
      isReady,
      workspaceMode,
      filePath,
      datasetName,
      rowCount,
      colCount,
      columns,
      previewData,
      pipeline,
      manualColumns,
      manualRows,
      history,
      activeAnalysisId,
      activeDashboardTab
    } = get();

    const projectData = {
      version: '1.0.0',
      isReady,
      workspaceMode,
      filePath,
      datasetName: customFilename ? (customFilename.endsWith('.nra') ? customFilename.replace(/\.nra$/, '') : customFilename) : datasetName,
      rowCount,
      colCount,
      columns,
      previewData,
      pipeline,
      manualColumns,
      manualRows,
      history,
      activeAnalysisId,
      activeDashboardTab,
      miraChats: get().miraChats
    };

    try {
      let finalFilename = customFilename || (datasetName ? `${datasetName}.nra` : 'projet_stat_nura.nra');
      if (!finalFilename.endsWith('.nra')) {
        finalFilename += '.nra';
      }

      const jsonString = JSON.stringify(projectData, null, 2);

      // Check if modern File System Access API is supported and active
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: finalFilename,
            types: [{
              description: 'Fichier de projet Nura App (.nra)',
              accept: {
                'application/json': ['.nra']
              }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          toast.success('Le fichier projet .nra a été sauvegardé avec succès à l’emplacement de votre choix !');
          get().addRecentProject(projectData, finalFilename);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            toast.info('Sauvegarde annulée.');
            return;
          }
          console.warn("showSaveFilePicker unsupported or access denied, falling back to download action:", err);
        }
      }

      // Classic download fallback
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Le projet a été sauvegardé sur votre ordinateur (téléchargement standard).');
      get().addRecentProject(projectData, finalFilename);
    } catch (err: any) {
      toast.error(`Erreur lors de la sauvegarde : ${err.message || err}`);
    }
  },

  loadProject: async (projectData: any, filename?: string) => {
    try {
      let actualData = projectData;
      if ((!actualData || Object.keys(actualData).length === 0 || !actualData.version) && filename) {
        set({ isLoading: true, loadingMessage: 'Récupération du projet depuis le cache...' });
        const cached = await projectsDB.get("project_" + filename);
        if (cached) {
          actualData = cached;
        }
      }

      if (!actualData || typeof actualData !== 'object') {
        throw new Error("Format de données invalide ou fichier introuvable dans le cache.");
      }
      if (actualData.version === undefined) {
        throw new Error("Le fichier importé n'est pas un fichier de projet .nra valide.");
      }

      set({ isLoading: true, loadingMessage: 'Restauration de la session statistique...' });

      // Restore simple values & arrays
      set({
        isReady: actualData.isReady ?? false,
        workspaceMode: actualData.workspaceMode ?? 'dashboard',
        filePath: actualData.filePath ?? null,
        datasetName: actualData.datasetName ?? null,
        rowCount: actualData.rowCount ?? 0,
        colCount: actualData.colCount ?? 0,
        columns: actualData.columns ?? [],
        previewData: actualData.previewData ?? [],
        pipeline: actualData.pipeline ?? [],
        manualColumns: actualData.manualColumns ?? [],
        manualRows: actualData.manualRows ?? [],
        history: actualData.history ?? [],
        activeAnalysisId: actualData.activeAnalysisId ?? null,
        activeDashboardTab: actualData.activeDashboardTab ?? 'home',
        miraChats: actualData.miraChats ?? {},
        isLoading: false
      });

      // Synchronize python back-end DataFrame
      if (actualData.previewData && actualData.previewData.length > 0) {
        const api = getApi();
        const schema = (actualData.columns || []).map((c: any) => ({
          id: c.name,
          name: c.name,
          type: c.type
        }));
        
        await api.initialize_manual_dataframe(schema, actualData.previewData);
      }

      const finalFilename = filename || (actualData.datasetName ? `${actualData.datasetName}.nra` : 'projet_sans_titre.nra');
      get().addRecentProject(actualData, finalFilename);

      toast.success('Session de travail .nra restaurée avec succès.');
    } catch (e: any) {
      set({ isLoading: false });
      toast.error(`Erreur d'ouverture du projet .nra : ${e.message || String(e)}`);
      throw e;
    }
  },

  restoreAutosavedSession: async () => {
    try {
      if (typeof window === 'undefined') return false;
      const api = getApi();
      
      // Load recent projects from python store if available
      if (api.get_store_item) {
        const recentRes = await api.get_store_item('nura_recent_projects_v2');
        if (recentRes.success && recentRes.value) {
          set({ recentProjects: recentRes.value });
        }
      }

      let raw = localStorage.getItem('nura_workspace_autosave');
      let actualData = null;

      if (api.get_store_item) {
        const res = await api.get_store_item('nura_workspace_autosave');
        if (res.success && res.value) {
          actualData = res.value;
        }
      }

      if (!actualData) {
        if (!raw) return false;
        actualData = JSON.parse(raw);
      }

      if (actualData._storedInIndexedDB) {
        const storedLarge = await projectsDB.get('nura_workspace_autosave_large');
        if (storedLarge) {
          actualData = storedLarge;
        }
      }

      if (typeof (window as any).__setRestoring === 'function') {
        (window as any).__setRestoring(true);
      }

      set({
        isReady: actualData.isReady ?? false,
        isLoggedIn: actualData.isLoggedIn ?? false,
        userName: actualData.userName ?? null,
        workspaceMode: actualData.workspaceMode ?? 'dashboard',
        filePath: actualData.filePath ?? null,
        datasetName: actualData.datasetName ?? null,
        rowCount: actualData.rowCount ?? 0,
        colCount: actualData.colCount ?? 0,
        columns: actualData.columns ?? [],
        previewData: actualData.previewData ?? [],
        datasets: actualData.datasets ?? [],
        activeDatasetId: actualData.activeDatasetId ?? null,
        pipeline: actualData.pipeline ?? [],
        manualColumns: actualData.manualColumns ?? [],
        manualRows: actualData.manualRows ?? [],
        history: actualData.history ?? [],
        miraChats: actualData.miraChats ?? {},
        activeAnalysisId: actualData.activeAnalysisId ?? null,
        decimals: actualData.decimals ?? 2,
        alpha: actualData.alpha ?? 0.05,
        darkMode: actualData.darkMode ?? false,
        geminiApiKey: actualData.geminiApiKey ?? '',
        miraApiProvider: actualData.miraApiProvider ?? 'gemini',
        miraApiKey: actualData.miraApiKey ?? '',
        miraApiModel: actualData.miraApiModel ?? 'gemini-3.5-flash',
        miraApiBaseUrl: actualData.miraApiBaseUrl ?? '',
        licenseDaysRemaining: actualData.licenseDaysRemaining ?? null,
        licenseExpiryDate: actualData.licenseExpiryDate ?? null
      });

      // Synchronize python back-end DataFrame
      if (actualData.previewData && actualData.previewData.length > 0) {
        set({ isLoading: true, loadingMessage: 'Restauration de la session statistique...' });
        const api = getApi();
        const schema = (actualData.columns || []).map((c: any) => ({
          id: c.name,
          name: c.name,
          type: c.type
        }));
        await api.initialize_manual_dataframe(schema, actualData.previewData);
        set({ isLoading: false });
      }

      setTimeout(() => {
        if (typeof (window as any).__setRestoring === 'function') {
          (window as any).__setRestoring(false);
        }
      }, 100);

      return true;
    } catch (e) {
      console.warn("Could not restore autosaved session", e);
      if (typeof (window as any).__setRestoring === 'function') {
        (window as any).__setRestoring(false);
      }
      return false;
    }
  }
}));

if (typeof window !== 'undefined') {
  let saveTimeout: any = null;
  let isRestoring = false;

  (window as any).__setRestoring = (val: boolean) => {
    isRestoring = val;
  };

  useWorkspaceStore.subscribe((state) => {
    (window as any).__previewData = state.previewData;
    (window as any).__columns = state.columns;
    
    if (isRestoring) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      // Re-check inside timeout
      if (isRestoring) return;

      const autosaveState = {
        isReady: state.isReady,
        workspaceMode: state.workspaceMode,
        filePath: state.filePath,
        datasetName: state.datasetName,
        rowCount: state.rowCount,
        colCount: state.colCount,
        columns: state.columns,
        previewData: state.previewData,
        datasets: state.datasets,
        activeDatasetId: state.activeDatasetId,
        pipeline: state.pipeline,
        manualColumns: state.manualColumns,
        manualRows: state.manualRows,
        history: state.history,
        miraChats: state.miraChats,
        activeAnalysisId: state.activeAnalysisId,
        decimals: state.decimals,
        alpha: state.alpha,
        darkMode: state.darkMode,
        geminiApiKey: state.geminiApiKey,
        miraApiProvider: state.miraApiProvider,
        miraApiKey: state.miraApiKey,
        miraApiModel: state.miraApiModel,
        miraApiBaseUrl: state.miraApiBaseUrl,
        isLoggedIn: state.isLoggedIn,
        userName: state.userName,
        licenseDaysRemaining: state.licenseDaysRemaining,
        licenseExpiryDate: state.licenseExpiryDate
      };
      
      try {
        localStorage.setItem('nura_workspace_autosave', JSON.stringify(autosaveState));
        const api = getApi();
        if (api.set_store_item) {
          api.set_store_item('nura_workspace_autosave', autosaveState);
        }
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.code === 22) {
          // Fallback to IndexedDB
          projectsDB.set('nura_workspace_autosave_large', autosaveState);
          // Save a marker indicating large state is in IndexedDB
          const fallbackState = {
            ...autosaveState,
            _storedInIndexedDB: true,
            previewData: [], // Clear large arrays to fit in localStorage
            datasets: [],
            manualRows: []
          };
          localStorage.setItem('nura_workspace_autosave', JSON.stringify(fallbackState));
          const api = getApi();
          if (api.set_store_item) {
             // In desktop mode we don't have quota issues usually, but save it anyway
             api.set_store_item('nura_workspace_autosave', fallbackState);
          }
        } else {
          console.warn("Autosave error:", err);
        }
      }
    }, 1000); // 1s second debounce
  });
}

