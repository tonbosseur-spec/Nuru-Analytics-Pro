import fs from 'fs';
let text = fs.readFileSync('src/store.ts', 'utf8');

text = text.replace(
  "previewData: Record<string, any>[];",
  `previewData: Record<string, any>[];
  
  // Datasets session management
  datasets: { id: string; name: string; rowCount: number; colCount: number; columns: any[]; preview: any[] }[];
  activeDatasetId: string | null;
  switchDataset: (id: string) => Promise<void>;`
);

text = text.replace(
  "previewData: [],\n  pipeline",
  `previewData: [],
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
  pipeline`
);

fs.writeFileSync('src/store.ts', text);
console.log("updated");
