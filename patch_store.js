import fs from 'fs';

let text = fs.readFileSync('src/store.ts', 'utf8');

const tImport = `
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
`;
text = text.replace(
`        set({
          isLoading: false,
          pendingImport: {
            filePath: path,
            datasetName: fileName,
            rowCount: dataset.row_count || 0,
            colCount: dataset.col_count || 0,
            columns: dataset.columns || [],
            previewData: dataset.preview || []
          }
        });`, tImport);

const tExcel = `
        set({
          isLoading: false,
          pendingImport: {
            filePath: pendingFilePath,
            datasetName: \`\${fileName} - [\${sheetName}]\`,
            rowCount: dataset.row_count || 0,
            colCount: dataset.col_count || 0,
            columns: dataset.columns || [],
            previewData: dataset.preview || [],
            dataset_id: dataset.dataset_id
          },
          pendingFilePath: null,
          excelSheets: []
        });`;
text = text.replace(
`        set({
          isLoading: false,
          pendingImport: {
            filePath: pendingFilePath,
            datasetName: \`\${fileName} - [\${sheetName}]\`,
            rowCount: dataset.row_count || 0,
            colCount: dataset.col_count || 0,
            columns: dataset.columns || [],
            previewData: dataset.preview || []
          },
          pendingFilePath: null,
          excelSheets: []
        });`, tExcel);

const tConfirm = `
  confirmPendingImport: () => {
    const { pendingImport, datasets } = get();
    if (!pendingImport) return;
    
    // Add to datasets store
    const newDs = {
      id: pendingImport.dataset_id || String(Date.now()),
      name: pendingImport.datasetName,
      rowCount: pendingImport.rowCount,
      colCount: pendingImport.colCount,
      columns: pendingImport.columns,
      preview: pendingImport.previewData
    };
    
    set({
      datasets: [newDs, ...datasets],
      activeDatasetId: newDs.id,
      isReady: true,
      filePath: pendingImport.filePath,
      datasetName: pendingImport.datasetName,
      rowCount: pendingImport.rowCount,
      colCount: pendingImport.colCount,
      columns: pendingImport.columns,
      previewData: pendingImport.previewData,
      pendingImport: null,
      activeDashboardTab: 'data_prep'
    });
    toast.success('Le jeu de données a été importé avec succès.');
  },`;

text = text.replace(
/  confirmPendingImport: \(\) => {([\s\S]*?)  },/, tConfirm);

fs.writeFileSync('src/store.ts', text);
console.log("updated");
