import { PywebviewAPI, DatasetInfo, StatType, ImputationStrategy, FilterCondition, MathOperation, DuplicateKeep, StringCleanOperation, BinningMethod, EncodingMethod, TransformationStep, ManualColumnDefinition } from './types';

// Fallback mock API for development in browser / AI Studio
const mockSavedDatasets: Record<string, {
  id: string;
  name: string;
  row_count: number;
  col_count: number;
  columns: any[];
  preview: any[];
}> = {};

const _processExcelFileWithXlsxHelper = async (
  file: File,
  sheet_name: string | number | undefined | null,
  manual_header_row: number | null | undefined,
  selected_block_idx: number = 0,
  exclude_cols: string[] = []
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = evt.target.result;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("Le classeur Excel ne contient aucune feuille.");
        }
        
        let actualSheetName = sheet_name;
        if (sheet_name === undefined || sheet_name === null || sheet_name === '') {
          actualSheetName = workbook.SheetNames[0];
        } else if (typeof sheet_name === 'number') {
          actualSheetName = workbook.SheetNames[sheet_name] || workbook.SheetNames[0];
        }
        
        const worksheet = workbook.Sheets[actualSheetName as string];
        if (!worksheet) {
          throw new Error(`Feuille "${actualSheetName}" introuvable dans le classeur.`);
        }
        
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (rawRows.length === 0) {
          throw new Error("La feuille sélectionnée est vide.");
        }
        
        // 1. Analyze rows
        const numCols = Math.max(...rawRows.map(r => r.length), 0);
        const rowAnalysis: any[] = [];
        
        for (let idx = 0; idx < rawRows.length; idx++) {
          const row = rawRows[idx] || [];
          const nonNullVals = row.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
          const nbNonNull = nonNullVals.length;
          const fillRatio = numCols > 0 ? nbNonNull / numCols : 0;
          
          let nbNumeric = 0;
          let nbDate = 0;
          let nbShortText = 0;
          let nbLongText = 0;
          const cellLengths: number[] = [];
          
          for (const v of nonNullVals) {
            const vStr = String(v).trim();
            cellLengths.push(vStr.length);
            
            // Check numeric
            const vClean = vStr.replace(",", ".").replace(/\s/g, "");
            if (typeof v === 'number') {
              nbNumeric++;
            } else if (!isNaN(Number(vClean)) && vClean !== "") {
              nbNumeric++;
            } else if (v instanceof Date || /^\d{2,4}[-/]\d{2}[-/]\d{2,4}/.test(vStr)) {
              nbDate++;
            } else {
              if (vStr.length > 30) {
                nbLongText++;
              } else {
                nbShortText++;
              }
            }
          }
          
          const avgLength = cellLengths.length > 0 ? cellLengths.reduce((a, b) => a + b, 0) / cellLengths.length : 0;
          const maxLength = cellLengths.length > 0 ? Math.max(...cellLengths) : 0;
          
          const coherenceTypes = nbNonNull > 0 ? Math.max(nbNumeric, nbDate, nbShortText, nbLongText) / nbNonNull : 0;
          const penaliteTextLong = nbLongText > 1 ? 0.1 : (nbLongText > 0 ? 0.3 : 1.0);
          const dataLikenessScore = fillRatio * coherenceTypes * penaliteTextLong;
          
          const uniqueRatio = nbNonNull > 0 ? (new Set(nonNullVals.map(String)).size / nbNonNull) : 0;
          const textRatio = nbNonNull > 0 ? nbShortText / nbNonNull : 0;
          const headerScore = fillRatio * uniqueRatio * textRatio * (1.0 - (nbNonNull > 0 ? nbNumeric / nbNonNull : 0));
          
          rowAnalysis.push({
            index: idx,
            nb_non_null: nbNonNull,
            fill_ratio: fillRatio,
            avg_length: avgLength,
            max_length: maxLength,
            coherence_types: coherenceTypes,
            long_texts_count: nbLongText,
            numeric_ratio: nbNonNull > 0 ? nbNumeric / nbNonNull : 0,
            data_likeness_score: dataLikenessScore,
            header_score: headerScore
          });
        }
        
        // 2. Detect header row
        let detectedHeaderRow = 0;
        let maxHeaderScore = -1.0;
        const searchLimit = Math.min(30, rowAnalysis.length);
        for (let idx = 0; idx < searchLimit; idx++) {
          const row = rowAnalysis[idx];
          if (row.header_score > maxHeaderScore && row.nb_non_null >= 2) {
            maxHeaderScore = row.header_score;
            detectedHeaderRow = row.index;
          }
        }
        if (maxHeaderScore <= 0.05) {
          for (let idx = 0; idx < rowAnalysis.length; idx++) {
            if (rowAnalysis[idx].nb_non_null >= 2) {
              detectedHeaderRow = idx;
              break;
            }
          }
        }
        
        const finalHeaderRow = (manual_header_row !== null && manual_header_row !== undefined) ? manual_header_row : detectedHeaderRow;
        
        // 3. Detect data start row
        let dataStartRow = finalHeaderRow + 1;
        for (let idx = finalHeaderRow + 1; idx < rowAnalysis.length; idx++) {
          const row = rowAnalysis[idx];
          if (row.nb_non_null === 0) continue;
          
          const rowVals = rawRows[idx] || [];
          const joinedStr = rowVals.map(v => String(v).toLowerCase()).join(" ");
          let isNote = false;
          for (const pattern of ["source", "note", "copyright", "total général", "remarque", "téléchargé"]) {
            if (joinedStr.includes(pattern)) {
              isNote = true;
              break;
            }
          }
          if (isNote || (row.fill_ratio < 0.15 && row.long_texts_count > 0)) {
            continue;
          }
          dataStartRow = idx;
          break;
        }
        
        // 4. Detect blocks
        const blocks: number[][] = [];
        let currentBlockRows: number[] = [];
        
        for (let idx = dataStartRow; idx < rowAnalysis.length; idx++) {
          const row = rowAnalysis[idx];
          const rowVals = rawRows[idx] || [];
          const nonNullVals = rowVals.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
          const isNote = nonNullVals.length === 1 && (String(nonNullVals[0]).length > 15 || ["source", "note", "tableau", "chapitre", "section", "partie"].some(p => String(nonNullVals[0]).toLowerCase().includes(p)));
          const isEmpty = nonNullVals.length === 0;
          
          if (isEmpty || isNote) {
            if (currentBlockRows.length > 0) {
              blocks.push(currentBlockRows);
              currentBlockRows = [];
            }
          } else {
            currentBlockRows.push(idx);
          }
        }
        if (currentBlockRows.length > 0) {
          blocks.push(currentBlockRows);
        }
        
        let significantBlocks = blocks.filter(b => b.length >= 2);
        if (significantBlocks.length === 0) {
          const range = [];
          for (let idx = dataStartRow; idx < rawRows.length; idx++) {
            range.push(idx);
          }
          significantBlocks = [range];
        }
        
        // 5. Extract metadata titles
        const titles: string[] = [];
        for (let idx = 0; idx < finalHeaderRow; idx++) {
          const rowVals = rawRows[idx] || [];
          const nonNull = rowVals.map(v => String(v).trim()).filter(v => v !== "");
          if (nonNull.length > 0) {
            titles.push(nonNull.join(" | "));
          }
        }
        
        // 6. Clean & normalize block
        const activeBlockIdx = (selected_block_idx !== undefined && selected_block_idx < significantBlocks.length) ? selected_block_idx : 0;
        const activeRowIndices = significantBlocks[activeBlockIdx] || [];
        
        const headers: string[] = [];
        const headerVals = rawRows[finalHeaderRow] || [];
        
        for (let colIdx = 0; colIdx < numCols; colIdx++) {
          const colVal = headerVals[colIdx];
          if (colVal === null || colVal === undefined || String(colVal).trim() === "") {
            headers.push(`colonne_${colIdx + 1}`);
          } else {
            let hName = String(colVal).trim().replace(/\s+/g, "_").toLowerCase();
            const baseName = hName;
            let counter = 1;
            while (headers.includes(hName)) {
              hName = `${baseName}_${counter}`;
              counter++;
            }
            headers.push(hName);
          }
        }
        
        const colsToKeep = headers.filter(h => !exclude_cols.includes(h));
        
        const cleanedRowsObjs: any[] = [];
        for (const rowIdx of activeRowIndices) {
          const rowVals = rawRows[rowIdx] || [];
          const rowObj: any = {};
          let hasAnyNonNull = false;
          
          for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            const headerName = headers[colIdx];
            if (exclude_cols.includes(headerName)) continue;
            
            let cellVal = rowVals[colIdx];
            if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
              if (typeof cellVal === 'string') {
                cellVal = cellVal.trim();
              }
              rowObj[headerName] = cellVal;
              hasAnyNonNull = true;
            } else {
              rowObj[headerName] = null;
            }
          }
          
          if (!hasAnyNonNull) continue;
          
          // Note filtering
          const rowText = Object.values(rowObj).map(String).join(" ").toLowerCase();
          if (["source", "note", "total général", "remarque"].some(p => rowText.startsWith(p) || rowText === p)) {
            continue;
          }
          cleanedRowsObjs.push(rowObj);
        }
        
        // 7. Column stats metadata
        const columnsMetadata = colsToKeep.map(colName => {
          let numNumeric = 0;
          let numDate = 0;
          let numString = 0;
          let missingCount = 0;
          
          for (const row of cleanedRowsObjs) {
            const val = row[colName];
            if (val === null || val === undefined || val === "") {
              missingCount++;
              continue;
            }
            if (typeof val === 'number') {
              numNumeric++;
            } else if (!isNaN(Number(String(val).replace(",", ".").replace(/\s/g, "")))) {
              numNumeric++;
            } else if (val instanceof Date || /^\d{2,4}[-/]\d{2}[-/]\d{2,4}/.test(String(val))) {
              numDate++;
            } else {
              numString++;
            }
          }
          
          const totalCount = cleanedRowsObjs.length;
          const nonNullCount = totalCount - missingCount;
          
          let inferredType: 'nominal' | 'discrete' | 'continuous' | 'datetime' = 'nominal';
          let rawDtype = 'object';
          
          if (nonNullCount > 0) {
            if (numNumeric / nonNullCount > 0.75) {
              let allInt = true;
              for (const row of cleanedRowsObjs) {
                const val = row[colName];
                if (val !== null && val !== undefined && val !== "") {
                  const numVal = Number(String(val).replace(",", ".").replace(/\s/g, ""));
                  if (!isNaN(numVal) && !Number.isInteger(numVal)) {
                    allInt = false;
                    break;
                  }
                }
              }
              inferredType = allInt ? 'discrete' : 'continuous';
              rawDtype = allInt ? 'int64' : 'float64';
            } else if (numDate / nonNullCount > 0.75) {
              inferredType = 'datetime';
              rawDtype = 'datetime64[ns]';
            }
          }
          
          // Data normalization based on type
          for (const row of cleanedRowsObjs) {
            const val = row[colName];
            if (val !== null && val !== undefined && val !== "") {
              if (inferredType === 'discrete' || inferredType === 'continuous') {
                const cleanNum = Number(String(val).replace(",", ".").replace(/\s/g, ""));
                if (!isNaN(cleanNum)) {
                  row[colName] = cleanNum;
                }
              } else if (inferredType === 'datetime') {
                row[colName] = val instanceof Date ? val.toISOString().split('T')[0] : String(val);
              }
            }
          }
          
          return {
            name: colName,
            type: inferredType,
            missing_values: missingCount,
            raw_dtype: rawDtype
          };
        });
        
        const formattedBlocks = significantBlocks.map((bIndices, bIdx) => {
          const startIdx = bIndices[0];
          const endIdx = bIndices[bIndices.length - 1];
          const nbRows = bIndices.length;
          return {
            index: bIdx,
            name: `Bloc de données ${bIdx + 1} (${nbRows} lignes)`,
            nb_rows: nbRows,
            start_idx: startIdx,
            end_idx: endIdx
          };
        });
        
        resolve({
          detected_header_row: finalHeaderRow,
          data_start_row: dataStartRow,
          nb_rows_detected: cleanedRowsObjs.length,
          nb_columns: colsToKeep.length,
          columns: columnsMetadata,
          sample_data: cleanedRowsObjs,
          titles: titles,
          blocks: formattedBlocks,
          selected_block: activeBlockIdx
        });
        
      } catch (err: any) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier Excel."));
    reader.readAsArrayBuffer(file);
  });
};

export const mockPywebviewApi: PywebviewAPI = {
  generate_random_dataset: async (params: any) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const num_rows = Number(params?.num_rows || 100);
          const variables = params?.variables || [];
          const preview: any[] = [];
          
          // Generate data
          for (let r = 0; r < Math.min(num_rows, 100); r++) {
            const row: any = {};
            for (const v of variables) {
              if (v.type === 'qualitative') {
                const modes = v.modalities ? v.modalities.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
                const finalModes = modes.length > 0 ? modes : ['A', 'B', 'C'];
                row[v.name] = finalModes[Math.floor(Math.random() * finalModes.length)];
              } else if (v.type === 'quantitative_normal') {
                // Box-Muller transform
                let u = 0, vv = 0;
                while (u === 0) u = Math.random();
                while (vv === 0) vv = Math.random();
                const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * vv);
                const mean = v.mean !== undefined ? Number(v.mean) : 0;
                const std = v.std !== undefined ? Number(v.std) : 1;
                const score = normal * std + mean;
                row[v.name] = Number(score.toFixed(4));
              } else if (v.type === 'quantitative_uniform') {
                const minVal = v.min !== undefined ? Number(v.min) : 0;
                const maxVal = v.max !== undefined ? Number(v.max) : 100;
                const val = Math.random() * (maxVal - minVal) + minVal;
                row[v.name] = Number(val.toFixed(4));
              } else {
                row[v.name] = Math.random() > 0.5 ? 'Oui' : 'Non';
              }
            }
            preview.push(row);
          }
          
          // Columns metadata
          const columns = variables.map((v: any) => {
            let statType: 'nominal' | 'discrete' | 'continuous' = 'nominal';
            let rawDtype = 'object';
            if (v.type === 'quantitative_normal' || v.type === 'quantitative_uniform') {
              statType = 'continuous';
              rawDtype = 'float64';
            }
            return {
              name: v.name,
              type: statType,
              missing_values: 0,
              raw_dtype: rawDtype
            };
          });
          
          const newId = 'ds_' + Math.random().toString(36).substring(2, 9);
          const name = "Jeu de données simulé";
          
          // Save in mock store
          mockSavedDatasets[newId] = {
            id: newId,
            name,
            row_count: num_rows,
            col_count: columns.length,
            columns,
            preview
          };
          
          resolve({
            success: true,
            dataset_id: newId,
            name,
            row_count: num_rows,
            col_count: columns.length,
            columns,
            preview
          });
        } catch (e: any) {
          resolve({ success: false, error: e.message || String(e) });
        }
      }, 600);
    });
  },
  switch_dataset: async (dataset_id: string) => {
    return new Promise(async (resolve) => {
      try {
        const { useWorkspaceStore } = await import('./store');
        const storeDatasets = useWorkspaceStore.getState().datasets || [];
        const found = storeDatasets.find((d: any) => String(d.id) === String(dataset_id));
        if (found) {
          mockSavedDatasets[dataset_id] = {
            id: found.id,
            name: found.name,
            row_count: found.rowCount,
            col_count: found.colCount,
            columns: found.columns,
            preview: found.preview
          };
        }
      } catch (err) {
        console.error("Error looking up dataset in Zustand store:", err);
      }

      setTimeout(() => {
        const ds = mockSavedDatasets[dataset_id];
        if (ds) {
          resolve({
            success: true,
            dataset_id: ds.id,
            row_count: ds.row_count,
            col_count: ds.col_count,
            columns: ds.columns,
            preview: ds.preview
          });
        } else {
          resolve({
            success: true,
            dataset_id,
            row_count: 1420,
            col_count: 4,
            columns: [
              { name: 'ID', type: 'discrete', missing_values: 0, raw_dtype: 'int64' },
              { name: 'Age', type: 'continuous', missing_values: 12, raw_dtype: 'float64' },
              { name: 'Category', type: 'nominal', missing_values: 0, raw_dtype: 'object' },
              { name: 'JoinDate', type: 'datetime', missing_values: 0, raw_dtype: 'datetime64[ns]' }
            ],
            preview: Array.from({ length: 20 }).map((_, i) => ({
              ID: i + 1,
              Age: Number((20 + Math.random() * 40).toFixed(1)),
              Category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
              JoinDate: new Date().toISOString().split('T')[0]
            }))
          });
        }
      }, 400);
    });
  },
  toggle_fullscreen: async () => ({ success: false }),
  get_store_item: async (key: string) => {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return { success: true, value: null };
      return { success: true, value: JSON.parse(val) };
    } catch(e) {
      return { success: false, error: String(e) };
    }
  },
  set_store_item: async (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { success: true };
    } catch(e) {
      return { success: false, error: String(e) };
    }
  },
  remove_store_item: async (key: string) => {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch(e) {
      return { success: false, error: String(e) };
    }
  },
  get_hardware_info: async () => {
    return { success: true, hardware_id: "NURU-WEB-MOCK-1234", is_licensed: true, first_name: "Jean-Pierre", last_name: "Dupont", days_remaining: 24, expiry_date: "2026-07-06" };
  },
  verify_and_save_license: async (file_path) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: "Licence valide (Mock)." });
      }, 1000);
    });
  },
  open_license_dialog: async () => {
    return new Promise((resolve) => {
      resolve('/mock/path/to/license.lic');
    });
  },
  
  save_base64_file: async (content_base64: string, default_filename: string) => {
    return new Promise((resolve) => {
      try {
        const link = document.createElement('a');
        // We assume it's a docx if coming from WordExportModal, but we can be more general if needed.
        // For docx specifically: application/vnd.openxmlformats-officedocument.wordprocessingml.document
        link.href = `data:application/octet-stream;base64,${content_base64}`;
        link.download = default_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
          resolve({ success: true, message: `Fichier téléchargé : ${default_filename}` });
        }, 500);
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  },

  export_report_docx: async (report_data: any) => {
    return new Promise((resolve) => {
      console.log("Mock Word Export (python-docx requested):", report_data);
      setTimeout(() => {
        resolve({ success: true, message: "Export Word simulé (Backend Python)" });
      }, 1000);
    });
  },
  export_dataset: async (default_filename: string, file_format: 'xlsx' | 'csv') => {
    return new Promise((resolve) => {
      console.log(`Mock Dataset Export: ${default_filename}.${file_format}`);
      setTimeout(() => {
        resolve({ success: true, message: "Export Dataset simulé" });
      }, 500);
    });
  },

  open_file_dialog: async () => {
    // Simulate picking a file
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("C:\\Users\\User\\Documents\\dataset.csv");
      }, 500);
    });
  },
  
  check_excel_sheets: async (file_path: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (file_path.endsWith('.xlsx')) {
          resolve({ success: true, multiple: true, sheets: ['Sheet1', 'Sheet2', 'Data'] });
        } else {
          resolve({ success: true, multiple: false });
        }
      }, 300);
    });
  },

  preprocess_excel_preview: async (file_path, sheet_name, manual_header_row, selected_block_idx = 0, exclude_cols = []) => {
    const excelFile = (window as any).__pendingExcelFile;
    if (excelFile) {
      try {
        const res = await _processExcelFileWithXlsxHelper(excelFile, sheet_name, manual_header_row, selected_block_idx, exclude_cols);
        return {
          success: true,
          ...res,
          sample_data: res.sample_data.slice(0, 50) // limit sample preview size
        };
      } catch (err: any) {
        return { success: false, error: err.message || String(err) };
      }
    }

    // Fallback to mock data if no file is uploaded (helps local dev sandbox tests match)
    return new Promise((resolve) => {
      setTimeout(() => {
        const detected_header_row = manual_header_row !== null && manual_header_row !== undefined ? manual_header_row : 4;
        const data_start_row = detected_header_row + 1;
        
        const b1_cols = [
          { name: 'mois', type: 'nominal', missing_values: 0, raw_dtype: 'object' },
          { name: 'ventes_eur', type: 'continuous', missing_values: 0, raw_dtype: 'int64' }
        ];
        const b1_data = [
          { mois: 'Janvier', ventes_eur: 12000 },
          { mois: 'Février', ventes_eur: 15400 },
          { mois: 'Mars', ventes_eur: 19100 },
          { mois: 'Avril', ventes_eur: 17200 }
        ];

        const b2_cols = [
          { name: 'categorie', type: 'nominal', missing_values: 0, raw_dtype: 'object' },
          { name: 'cout_eur', type: 'continuous', missing_values: 0, raw_dtype: 'int64' }
        ];
        const b2_data = [
          { categorie: 'Marketing', cout_eur: 4300 },
          { categorie: 'R&D', cout_eur: 8200 },
          { categorie: 'Logistique', cout_eur: 3100 }
        ];

        const isB2 = selected_block_idx === 1;
        const cols = isB2 ? b2_cols : b1_cols;
        const sample_data = isB2 ? b2_data : b1_data;

        const filtered_cols = cols.filter(c => !exclude_cols.includes(c.name));
        const filtered_data = sample_data.map(row => {
          const newRow = { ...row };
          exclude_cols.forEach(colName => delete newRow[colName]);
          return newRow;
        });

        resolve({
          success: true,
          detected_header_row,
          data_start_row,
          nb_rows_detected: filtered_data.length,
          nb_columns: filtered_cols.length,
          columns: filtered_cols,
          sample_data: filtered_data,
          titles: ["Rapport Annuel de Performance", "Zone Europe - Section Financière"],
          blocks: [
            { index: 0, name: "Tableau A - Ventes (4 lignes)", nb_rows: 4, start_idx: 5, end_idx: 8 },
            { index: 1, name: "Tableau B - Dépenses (3 lignes)", nb_rows: 3, start_idx: 12, end_idx: 14 }
          ],
          selected_block: selected_block_idx
        });
      }, 500);
    });
  },

  import_preprocessed_excel: async (file_path, sheet_name, manual_header_row, selected_block_idx = 0, exclude_cols = []) => {
    const excelFile = (window as any).__pendingExcelFile;
    if (excelFile) {
      try {
        const res = await _processExcelFileWithXlsxHelper(excelFile, sheet_name, manual_header_row, selected_block_idx, exclude_cols);
        const dataset_id = 'ds_' + Math.random().toString(36).substring(2, 9);
        const name = `${file_path.split('\\').pop()?.split('/').pop() || "Classeur.xlsx"} - [Cleaned]`;

        mockSavedDatasets[dataset_id] = {
          id: dataset_id,
          name,
          row_count: res.nb_rows_detected,
          col_count: res.nb_columns,
          columns: res.columns,
          preview: res.sample_data
        };

        return {
          success: true,
          dataset_id,
          row_count: res.nb_rows_detected,
          col_count: res.nb_columns,
          columns: res.columns,
          preview: res.sample_data,
          titles: res.titles,
          selected_block: res.selected_block,
          blocks: res.blocks
        };
      } catch (err: any) {
        return { success: false, error: err.message || String(err) };
      }
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const detected_header_row = manual_header_row !== null && manual_header_row !== undefined ? manual_header_row : 4;
        const b1_cols = [
          { name: 'mois', type: 'nominal', missing_values: 0, raw_dtype: 'object' },
          { name: 'ventes_eur', type: 'continuous', missing_values: 0, raw_dtype: 'int64' }
        ];
        const b1_data = [
          { mois: 'Janvier', ventes_eur: 12000 },
          { mois: 'Février', ventes_eur: 15400 },
          { mois: 'Mars', ventes_eur: 19100 },
          { mois: 'Avril', ventes_eur: 17200 }
        ];

        const b2_cols = [
          { name: 'categorie', type: 'nominal', missing_values: 0, raw_dtype: 'object' },
          { name: 'cout_eur', type: 'continuous', missing_values: 0, raw_dtype: 'int64' }
        ];
        const b2_data = [
          { categorie: 'Marketing', cout_eur: 4300 },
          { categorie: 'R&D', cout_eur: 8200 },
          { categorie: 'Logistique', cout_eur: 3100 }
        ];

        const isB2 = selected_block_idx === 1;
        const cols = isB2 ? b2_cols : b1_cols;
        const sample_data = isB2 ? b2_data : b1_data;

        const filtered_cols = cols.filter(c => !exclude_cols.includes(c.name));
        const filtered_data = sample_data.map(row => {
          const newRow = { ...row };
          exclude_cols.forEach(colName => delete newRow[colName]);
          return newRow;
        });

        const dataset_id = 'ds_' + Math.random().toString(36).substring(2, 9);
        const name = `${file_path.split('\\').pop()?.split('/').pop() || "Performance.xlsx"} - [${isB2 ? 'Dépenses' : 'Ventes'}]`;

        mockSavedDatasets[dataset_id] = {
          id: dataset_id,
          name,
          row_count: filtered_data.length,
          col_count: filtered_cols.length,
          columns: filtered_cols,
          preview: filtered_data
        };

        resolve({
          success: true,
          dataset_id,
          row_count: filtered_data.length,
          col_count: filtered_cols.length,
          columns: filtered_cols,
          preview: filtered_data,
          titles: ["Rapport Annuel de Performance", "Zone Europe - Section Financière"]
        });
      }, 500);
    });
  },

  load_dataset: async (file_path: string, sheet_name?: string | null) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const columns = [
          { name: 'ID', type: 'discrete' as const, missing_values: 0, raw_dtype: 'int64' },
          { name: 'Age', type: 'continuous' as const, missing_values: 12, raw_dtype: 'float64' },
          { name: 'Category', type: 'nominal' as const, missing_values: 0, raw_dtype: 'object' },
          { name: 'JoinDate', type: 'datetime' as const, missing_values: 0, raw_dtype: 'datetime64[ns]' }
        ];
        const preview = Array.from({ length: 20 }).map((_, i) => ({
          ID: i + 1,
          Age: Number((20 + Math.random() * 40).toFixed(1)),
          Category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
          JoinDate: new Date().toISOString().split('T')[0]
        }));
        
        const name = file_path.split('\\').pop()?.split('/').pop() || "dataset.csv";
        const dataset_id = 'ds_' + Math.random().toString(36).substring(2, 9);
        
        mockSavedDatasets[dataset_id] = {
          id: dataset_id,
          name,
          row_count: 1420,
          col_count: 4,
          columns,
          preview
        };

        resolve({
          success: true,
          dataset_id,
          row_count: 1420,
          col_count: 4,
          columns,
          preview
        });
      }, 800);
    });
  },

edit_cell: async (row_idx: number, col_name: string, new_val_str: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
},

delete_row: async (row_idx: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
},

keep_columns: async (columns_to_keep: string[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
},

delete_column: async (col_name: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
},

update_column: async (old_name: string, new_name: string, new_type: StatType) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        raw_dtype: new_type === 'continuous' ? 'float64' : new_type === 'discrete' ? 'Int64' : 'object',
      });
    }, 300);
  });
},

handle_missing_values: async (column_name: string, strategy: ImputationStrategy) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        missing_values: 0,
      });
    }, 400);
  });
},

detect_outliers: async (column_name: string, method: 'iqr' | 'zscore') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const previewData = (window as any).__previewData || [];
      const values = previewData
        .map((row: any) => {
          const val = row[column_name];
          return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter((v: any) => v !== undefined && v !== null && !isNaN(v));

      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const min_val = sorted[0];
        const max_val = sorted[sorted.length - 1];
        const total_count = values.length;

        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

        let lower_bound = 0;
        let upper_bound = 0;
        let outlier_count = 0;

        if (method === 'zscore') {
          const mean = values.reduce((sum, v) => sum + v, 0) / total_count;
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / total_count;
          const std = Math.sqrt(variance) || 1e-9;
          lower_bound = mean - 3 * std;
          upper_bound = mean + 3 * std;
          outlier_count = values.filter((v) => v < lower_bound || v > upper_bound).length;

          resolve({
            success: true,
            outlier_count,
            total_count,
            lower_bound,
            upper_bound,
            min_val,
            max_val,
            median,
            mean,
            std
          });
        } else {
          const q1Idx = Math.floor(sorted.length * 0.25);
          const q3Idx = Math.floor(sorted.length * 0.75);
          const q1 = sorted[q1Idx];
          const q3 = sorted[q3Idx];
          const iqr = q3 - q1;
          lower_bound = q1 - 1.5 * iqr;
          upper_bound = q3 + 1.5 * iqr;
          outlier_count = values.filter((v) => v < lower_bound || v > upper_bound).length;

          resolve({
            success: true,
            outlier_count,
            total_count,
            lower_bound,
            upper_bound,
            min_val,
            max_val,
            median,
            q1,
            q3,
            iqr
          });
        }
      } else {
        resolve({
          success: true,
          outlier_count: 5,
          total_count: 100,
          lower_bound: 10.5,
          upper_bound: 95.2,
          min_val: 2.1,
          max_val: 120.5,
          median: 52.4,
          q1: 32.1,
          q3: 75.8,
          iqr: 43.7
        });
      }
    }, 400);
  });
},

treat_outliers: async (column_name: string, detect_method: 'iqr' | 'zscore', treat_method: 'winsorize' | 'exclude' | 'median') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        row_count: 95,
        outlier_count: 0
      });
    }, 500);
  });
},

get_unique_values: async (column_name: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        unique_values: ['A', 'B', 'C', 'Category X']
      });
    }, 200);
  });
},

apply_filter: async (conditions: any[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        row_count: 50,
      });
    }, 400);
  });
},

get_full_dataset: async () => {
  return new Promise(async (resolve) => {
    try {
      const { useWorkspaceStore } = await import('./store');
      const realPreview = useWorkspaceStore.getState().previewData;
      if (realPreview && realPreview.length > 0) {
        const mappedData = realPreview.map((row: any, i: number) => ({
          __index__: i,
          ...row
        }));
        setTimeout(() => resolve({ success: true, data: mappedData }), 200);
        return;
      }
    } catch (e) {
      console.error("Error fetching previewData in get_full_dataset:", e);
    }

    // Fallback if no real data
    const { useWorkspaceStore } = await import('./store');
    const cols = useWorkspaceStore.getState().columns;
    
    if (cols && cols.length > 0) {
      const mockData = Array.from({ length: 50 }).map((_, i) => {
        const rowData: Record<string, any> = { __index__: i };
        cols.forEach(c => {
          if (c.type === 'continuous' || c.type === 'discrete') {
            rowData[c.name] = (Math.random() * 100).toFixed(1);
          } else {
            rowData[c.name] = `Value ${i % 4}`;
          }
        });
        return rowData;
      });
      setTimeout(() => resolve({ success: true, data: mockData }), 200);
    } else {
      setTimeout(() => {
        resolve({
          success: true,
          data: Array.from({ length: 50 }).map((_, i) => ({
            __index__: i,
            ID: i + 1,
            Age: 20 + Math.floor(Math.random() * 40),
            Category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
            JoinDate: new Date().toISOString().split('T')[0]
          }))
        });
      }, 200);
    }
  });
},

apply_math_transform: async (source_col: string, operation: MathOperation, new_col_name: string, target_col?: string | null, constant?: number | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        new_column: {
          name: new_col_name,
          type: 'continuous',
          missing_values: 0,
          raw_dtype: 'float64'
        },
        col_count: 5
      });
    }, 400);
  });
},

extract_date_part: async (source_col: string, part: 'day' | 'week' | 'month' | 'year' | 'quarter', new_col_name: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        new_column: {
          name: new_col_name,
          type: 'discrete',
          missing_values: 0,
          raw_dtype: 'int64'
        },
        col_count: 5
      });
    }, 400);
  });
},

remove_duplicates: async (keep: DuplicateKeep) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        duplicates_removed: 2,
        row_count: 48
      });
    }, 400);
  });
},

clean_string_column: async (column_name: string, operation: StringCleanOperation) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 400);
  });
},

convert_column_to_date: async (column_name: string, new_col_name?: string | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 400);
  });
},

split_qualitative_column: async (column_name: string, method: string, target_col1: string, target_col2: string, separator?: string | null, length?: number | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 400);
  });
},

discretize_column: async (column_name: string, method: BinningMethod, new_col_name: string, num_bins?: number | null, thresholds?: number[] | null, labels?: string[] | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 400);
  });
},

group_categories: async (column_name: string, mapping: Record<string, string>, new_col_name?: string | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 400);
  });
},

encode_column: async (column_name: string, method: EncodingMethod, new_col_name?: string | null, drop_first?: boolean) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 400);
  });
},

append_dataframe_columns: async (new_columns_dict: Record<string, number[]>) => {
  if (window.pywebview) {
    return await window.pywebview.api.append_dataframe_columns(new_columns_dict);
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true }), 400);
  });
},

run_pipeline: async (pipeline_steps: TransformationStep[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 400);
  });
},
load_raw_data: async (path: string, sheet_name?: string) => {
  return { success: true, data: [["A", "B"], [1, 2]] };
},
initialize_manual_dataframe: async (schema: ManualColumnDefinition[], rows: Record<string, any>[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockColumns = schema.map(col => ({
        name: col.name,
        type: col.type,
        missing_values: 0,
        raw_dtype: 'object' // Mock dtype
      }));
      resolve({ success: true, columns: mockColumns, preview: rows.slice(0, 100), row_count: rows.length, col_count: schema.length });
    }, 400);
  });
},

run_statistical_test: async (test_id: string, params: any) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const colX = params.col_x || 'Variable X';
      const colY = params.col_y || 'Variable Y';
      const muStr = params.mu !== undefined ? params.mu : '0';
      const mu = typeof muStr === 'string' ? (parseFloat(muStr) || 0) : (muStr || 0);
      const g1 = params.group1 || 'Groupe A';
      const g2 = params.group2 || 'Groupe B';
      const alt = params.alternative || 'two-sided';
      const alt_sym = alt === 'greater' ? '>' : alt === 'less' ? '<' : '≠';

      let statistic = 0.0;
      let p_value = 0.05;
      let interpretation = "";
      let chart: any = null;
      let resultObj: any = {
        df: null,
        n: 100,
        effect_size: null,
        effect_size_name: null,
        h0: "",
        h1: "",
        decision: "",
        assumptions: [],
        post_hoc: [],
        extra_info: {}
      };

      switch (test_id) {
        case 'shapiro':
          statistic = 0.982;
          p_value = 0.124;
          resultObj.n = 120;
          resultObj.h0 = `La variable '${colX}' suit une distribution normale.`;
          resultObj.h1 = `La variable '${colX}' ne suit pas une distribution normale.`;
          resultObj.decision = "Non-rejet de l'hypothèse de normalité (H0)";
          resultObj.extra_info = {
            "Asymétrie (Skewness)": "0.145 (idéal ~ 0)",
            "Aplatissement (Kurtosis)": "-0.082 (idéal ~ 0)"
          };
          resultObj.assumptions = [
            { name: "Effectif suffisant", status: "validated", details: "N = 120 (recommandé entre 3 et 5000 observations)" }
          ];
          interpretation = `Le test de Shapiro-Wilk échoue à rejeter la normalité (p = 0.124). L'asymétrie de 0.145 et l'aplatissement de -0.082 confirment une distribution symétrique et très proche de la loi normale théorique.`;
          chart = {
            data: [
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [2, 5, 12, 18, 26, 24, 15, 9, 5, 3, 1],
                type: 'bar',
                name: 'Fréquences observées',
                marker: { color: 'rgba(99, 102, 241, 0.6)' }
              },
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [1, 4, 11, 20, 25, 25, 18, 10, 4, 1, 0],
                type: 'scatter',
                mode: 'lines',
                name: 'Densité normale idéale',
                line: { color: 'rgb(220, 38, 38)', width: 2.5, dash: 'dash' }
              }
            ],
            layout: { title: `Distribution & Courbe de Normalité de ${colX}` }
          };
          break;

        case 'ttest_1samp':
          statistic = 2.451;
          p_value = 0.016;
          resultObj.n = 100;
          resultObj.df = 99;
          resultObj.effect_size = 0.245;
          resultObj.effect_size_name = "d de Cohen";
          resultObj.h0 = `La moyenne de '${colX}' est égale à ${mu} (μ = ${mu}).`;
          resultObj.h1 = `La moyenne de '${colX}' est différente de ${mu} (μ ${alt_sym} ${mu}).`;
          resultObj.decision = "Rejet de H0 (Moyenne significativement différente)";
          resultObj.extra_info = {
            "Moyenne de l'échantillon": "35.4200",
            "Écart-type de l'échantillon": "12.3500",
            "Intervalle de confiance à 95%": `[33.02 ; 37.82]`
          };
          resultObj.assumptions = [
            { name: "Normalité de l'échantillon", status: "validated", details: "Validé par le Théorème Central Limite (N = 100 ≥ 30)." }
          ];
          interpretation = `Le test t à un échantillon révèle une différence statistiquement significative par rapport à la valeur théorique attendue de ${mu} (p = 0.016, t = 2.451). L'effet de taille d de Cohen (0.245) caractérise un écart faible à moyen.`;
          chart = {
            data: [
              {
                y: [20, 25, 28, 30, 32, 34, 35, 36, 38, 40, 42, 45, 50, 55],
                type: 'box',
                name: colX,
                marker: { color: '#4f46e5' }
              }
            ],
            layout: {
              title: `Dispersion de ${colX} vs Seuil Théorique (μ = ${mu})`,
              shapes: [
                {
                  type: 'line',
                  xref: 'paper',
                  x0: 0,
                  x1: 1,
                  y0: mu,
                  y1: mu,
                  line: { color: 'red', width: 2, dash: 'dash' }
                }
              ]
            }
          };
          break;

        case 'wilcoxon_1samp':
          statistic = 1840.5;
          p_value = 0.012;
          resultObj.n = 85;
          resultObj.effect_size = 0.28;
          resultObj.effect_size_name = "Corrélation de rangs-biserielle";
          resultObj.h0 = `La médiane de '${colX}' est égale à ${mu}.`;
          resultObj.h1 = `La médiane de '${colX}' est différente de ${mu}.`;
          resultObj.decision = "Rejet de H0";
          resultObj.extra_info = {
            "Médiane observée": "34.10",
            "Somme des rangs signés (W)": "1840.5"
          };
          resultObj.assumptions = [
            { name: "Échelle ordinale ou continue", status: "validated", details: "Données continues ou ordonnées." },
            { name: "Symétrie de la distribution", status: "info", details: "Supposée valide" }
          ];
          interpretation = `Le test de Wilcoxon signé indique une différence significative de la médiane par rapport à la valeur théorique ${mu} (p = 0.012, W = 1840.5).`;
          chart = {
            data: [
              {
                y: [15, 22, 27, 31, 33, 34, 35, 38, 41, 44, 48, 52],
                type: 'violin',
                box: { visible: true },
                name: colX,
                line: { color: '#818cf8' }
              }
            ],
            layout: {
              title: `Violon de ${colX} vs Médiane attendue (${mu})`,
              shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: mu, y1: mu, line: { color: 'red', width: 2, dash: 'dash' } }]
            }
          };
          break;

        case 'binomial':
          statistic = 0.58;
          p_value = 0.035;
          resultObj.n = 100;
          resultObj.effect_size = 0.08;
          resultObj.effect_size_name = "Écart de proportion absolue";
          resultObj.h0 = `La proportion de la principale catégorie est égale à ${mu ? mu : '0.50'}.`;
          resultObj.h1 = `La proportion est différente de ${mu ? mu : '0.50'}.`;
          resultObj.decision = "Rejet de H0";
          resultObj.extra_info = {
            "Nombre de succès (k)": "58",
            "Taille échantillon (N)": "100",
            "Proportion observée (p)": "0.5800 (58.0%)"
          };
          resultObj.assumptions = [
            { name: "Données de Bernoulli", status: "validated", details: "Chaque observation représente un succès ou un échec." }
          ];
          interpretation = `La proportion de succès (58.0%) est significativement déphasée par rapport à l'attente théorique de ${(mu ? mu * 100 : 50).toFixed(1)}% (p = 0.035).`;
          chart = {
            data: [
              {
                x: ['Succès', 'Échecs'],
                y: [58, 42],
                type: 'bar',
                marker: { color: ['#4f46e5', '#cbd5e1'] }
              }
            ],
            layout: { title: `Proportions de succès observées` }
          };
          break;

        case 'pearson':
          statistic = 0.645;
          p_value = 0.0001;
          resultObj.n = 150;
          resultObj.df = 148;
          resultObj.effect_size = 0.645;
          resultObj.effect_size_name = "Coefficient r de Pearson";
          resultObj.h0 = `Il n'y a pas de corrélation linéaire entre '${colX}' et '${colY}' (r = 0).`;
          resultObj.h1 = `Il existe une corrélation linéaire significative entre '${colX}' et '${colY}' (r ${alt_sym} 0).`;
          resultObj.decision = "Rejet de H0 (Forte association linéaire)";
          resultObj.extra_info = {
            "Coefficient de Pearson (r)": "0.6450",
            "Coefficient de détermination (R²)": "0.4160 (41.6% de variance partagée)"
          };
          resultObj.assumptions = [
            { name: "Normalité jointe", status: "validated", details: "Les distributions individuelles sont approximativement normales." }
          ];
          interpretation = `Le coefficient de corrélation r de Pearson est de 0.645, indiquant une liaison linéaire positive et modérément forte, hautement significative (p < 0.001). Les deux variables partagent 41.6% de leur variabilité réciproque.`;
          chart = {
            data: [
              {
                x: [10, 15, 17, 20, 24, 28, 30, 35, 40, 42, 45, 50, 52, 58, 60],
                y: [12, 18, 14, 25, 20, 31, 35, 30, 41, 48, 42, 55, 49, 58, 64],
                type: 'scatter',
                mode: 'markers',
                name: 'Points de données',
                marker: { color: '#4f46e5', size: 8 }
              },
              {
                x: [10, 60],
                y: [11.5, 62.5],
                type: 'scatter',
                mode: 'lines',
                name: 'Droite d\'ajustement (OLS)',
                line: { color: '#ef4444', width: 2 }
              }
            ],
            layout: { title: `Nuage de points et Droite de Régression (${colX} x ${colY})` }
          };
          break;

        case 'spearman':
          statistic = 0.612;
          p_value = 0.0003;
          resultObj.n = 150;
          resultObj.effect_size = 0.612;
          resultObj.effect_size_name = "Coefficient rho de Spearman";
          resultObj.h0 = `Il n'y a pas d'association monotone entre '${colX}' et '${colY}' (rho = 0).`;
          resultObj.h1 = `Il existe une liaison monotone significative entre '${colX}' et '${colY}'.`;
          resultObj.decision = "Rejet de H0 (Relation monotone significative)";
          resultObj.extra_info = {
            "Coefficient rho de Spearman": "0.6120"
          };
          resultObj.assumptions = [
            { name: "Variables continues ou ordinales", status: "validated", details: "L'échelle est ordinale ou continue." }
          ];
          interpretation = `La corrélation de rangs de Spearman est de rho = 0.612, confirmant une association monotone très significative (p = 0.0003). Utile car elle capture également les liens curvilignes non linéaires.`;
          chart = {
            data: [
              {
                x: [10, 15, 17, 20, 24, 28, 30, 35, 40, 42, 45, 50, 52, 58, 60],
                y: [8, 12, 13, 22, 28, 35, 38, 48, 55, 58, 61, 70, 72, 85, 90],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#3b82f6', size: 8 }
              }
            ],
            layout: { title: `Visualisation de la relation monotone (${colX} vs ${colY})` }
          };
          break;

        case 'ttest_ind':
          statistic = 2.872;
          p_value = 0.005;
          resultObj.n = 120;
          resultObj.df = 118;
          resultObj.effect_size = 0.524;
          resultObj.effect_size_name = "d de Cohen (groupes indépendants)";
          resultObj.h0 = `La moyenne de '${colX}' est identique entre le groupe '${g1}' et '${g2}' (μ₁ = μ₂).`;
          resultObj.h1 = `Les moyennes de la variable diffèrent de façon significative (μ₁ ${alt_sym} μ₂).`;
          resultObj.decision = "Rejet de H0. Les moyennes des deux groupes sont différentes.";
          resultObj.extra_info = {
            [`Effectif du groupe '${g1}'`]: "60",
            [`Effectif du groupe '${g2}'`]: "60",
            [`Moyenne du groupe '${g1}'`]: "38.25",
            [`Moyenne du groupe '${g2}'`]: "32.12",
            "Écart-type pooled": "11.64"
          };
          resultObj.assumptions = [
            { name: "Normalité par groupe", status: "validated", details: "Vérifiée pour g1 (p=0.18) et g2 (p=0.35)." },
            { name: "Homogénéité des variances", status: "validated", details: "Validée par le test de Levene (p = 0.154 > 0.05)." }
          ];
          interpretation = `Le test t de Student indique que le sous-groupe '${g1}' possède une moyenne de ${colX} significativement supérieure au sous-groupe '${g2}' (p = 0.005, t = 2.872). L'indice d de Cohen est de 0.524, soit un effet d'intensité modérée.`;
          chart = {
            data: [
              {
                y: [22, 28, 30, 35, 38, 40, 42, 45, 50, 55, 60],
                type: 'box',
                name: String(g1),
                marker: { color: '#4f46e5' }
              },
              {
                y: [18, 22, 25, 28, 30, 32, 34, 36, 40, 44, 48],
                type: 'box',
                name: String(g2),
                marker: { color: '#06b6d4' }
              }
            ],
            layout: { title: `Comparaison de groupes (Boîtes à moustaches)` }
          };
          break;

        case 'welch':
          statistic = 2.941;
          p_value = 0.004;
          resultObj.n = 100;
          resultObj.df = 98.4;
          resultObj.effect_size = 0.538;
          resultObj.effect_size_name = "d de Cohen (Welch)";
          resultObj.h0 = `La moyenne de '${colX}' est identique entre '${g1}' et '${g2}' (variances inégales tolérées).`;
          resultObj.h1 = `Les moyennes diffèrent significativement entre les deux groupes (μ₁ ${alt_sym} μ₂).`;
          resultObj.decision = "Rejet de H0 (p < 0.05)";
          resultObj.extra_info = {
            [`Moyenne du groupe '${g1}'`]: "39.52",
            [`Moyenne du groupe '${g2}'`]: "31.42",
            "D.d.l de Welch corrigé": "98.42"
          };
          resultObj.assumptions = [
            { name: "Variances hétérogènes admises", status: "validated", details: "Le calcul de Welch adapte les d.d.l. automatiquement." }
          ];
          interpretation = `La différence de moyennes entre les groupes est hautement significative (p = 0.004, Welch t = 2.941), confirmant la solidité de la divergence sans exiger l'égalité stricte des variances.`;
          chart = {
            data: [
              {
                y: [15, 20, 25, 38, 40, 42, 48, 50, 65, 70],
                type: 'box',
                name: String(g1),
                marker: { color: '#4f46e5' }
              },
              {
                y: [18, 22, 24, 28, 31, 33, 35, 38, 42, 45],
                type: 'box',
                name: String(g2),
                marker: { color: '#06b6d4' }
              }
            ],
            layout: { title: `Dispersion (Welch d.f. ajustés)` }
          };
          break;

        case 'mannwhitney':
          statistic = 1140.0;
          p_value = 0.007;
          resultObj.n = 110;
          resultObj.effect_size = 0.36;
          resultObj.effect_size_name = "Corrélation de rangs-biserielle";
          resultObj.h0 = `La distribution de '${colX}' est identique d'un groupe à l'autre.`;
          resultObj.h1 = `Les distributions présentent un décalage de rang significatif.`;
          resultObj.decision = "Rejet de H0. Les médianes divergent de façon significative.";
          resultObj.extra_info = {
            [`Médiane du groupe '${g1}'`]: "37.50",
            [`Médiane du groupe '${g2}'`]: "31.00",
            "Statistique U de Mann-Whitney": "1140.0"
          };
          resultObj.assumptions = [
            { name: "Données indépendantes", status: "validated", details: "Mesures issues de groupes disjoints." }
          ];
          interpretation = `Le test non paramétrique de Mann-Whitney U confirme que les rangs des mesures divergent très significativement (p = 0.007, U = 1140.0). On en déduit des profils significativement supérieurs chez '${g1}'.`;
          chart = {
            data: [
              {
                y: [22, 28, 30, 35, 38, 40, 42, 45, 50, 55, 60],
                type: 'violin',
                name: String(g1),
                line: { color: '#4f46e5' }
              },
              {
                y: [18, 22, 25, 28, 30, 32, 34, 36, 40, 44, 48],
                type: 'violin',
                name: String(g2),
                line: { color: '#06b6d4' }
              }
            ],
            layout: { title: `Comparaison non paramétrique (Violon)` }
          };
          break;

        case 'ttest_paired':
          statistic = -3.421;
          p_value = 0.001;
          resultObj.n = 50;
          resultObj.df = 49;
          resultObj.effect_size = 0.484;
          resultObj.effect_size_name = "d de Cohen (apparié)";
          resultObj.h0 = `La différence moyenne entre '${colX}' et '${colY}' est rigoureusement nulle (μ_diff = 0).`;
          resultObj.h1 = `La différence moyenne diffère significativement de zéro (μ_diff ≠ 0).`;
          resultObj.decision = "Rejet de H0 (Évolution statistiquement avérée)";
          resultObj.extra_info = {
            "Moyenne de la différence": "-4.1200",
            "Écart-type de la différence": "8.5100",
            [`Moyenne de '${colX}'`]: "34.12",
            [`Moyenne de '${colY}'`]: "38.24"
          };
          resultObj.assumptions = [
            { name: "Normalité des écarts", status: "validated", details: "Validée par le test de Shapiro-Wilk (p = 0.384)." }
          ];
          interpretation = `Le test t apparié met en évidence un décalage de moyenne significatif entre les mesures de ${colX} et de ${colY} (p = 0.001, t = -3.421). La différence moyenne observée est de -4.12.`;
          chart = {
            data: [
              {
                y: [-12, -9, -6, -5, -4, -3, -2, -1, 0, 1, 2, 4, 6],
                type: 'box',
                name: `Écarts (${colX} - ${colY})`,
                marker: { color: '#6366f1' }
              }
            ],
            layout: {
              title: `Distribution de l'Écart d'Appariement`,
              shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: 'red', width: 2, dash: 'dash' } }]
            }
          };
          break;

        case 'wilcoxon_paired':
          statistic = 212.0;
          p_value = 0.003;
          resultObj.n = 50;
          resultObj.effect_size = -3.8;
          resultObj.effect_size_name = "Médiane de la différence";
          resultObj.h0 = `La médiane des écarts de paires est nulle.`;
          resultObj.h1 = `La médiane des écarts de paires diffèrent significativement de zéro.`;
          resultObj.decision = "Rejet de H0 (Changement significatif)";
          resultObj.extra_info = {
            [`Médiane de '${colX}'`]: "33.50",
            [`Médiane de '${colY}'`]: "37.00",
            "Médiane des différences de paires": "-3.80"
          };
          resultObj.assumptions = [
            { name: "Liaison stricte", status: "validated", details: "Mesures répétées sur les mêmes sujets." }
          ];
          interpretation = `Le test de Wilcoxon apparié montre une tendance évolutive significative (p = 0.003, W = 212.0), avec une médiane des écarts de -3.80.`;
          chart = {
            data: [
              {
                y: [-15, -10, -8, -5, -4, -3, -1, 0, 1, 2, 3],
                type: 'box',
                name: "Différence",
                marker: { color: '#818cf8' }
              }
            ],
            layout: {
              title: `Médiane des Différences Appariées`,
              shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: 'red', width: 2, dash: 'dash' } }]
            }
          };
          break;

        case 'anova':
          statistic = 4.821;
          p_value = 0.009;
          resultObj.n = 150;
          resultObj.df = "(2, 147)";
          resultObj.effect_size = 0.061;
          resultObj.effect_size_name = "Eta-carré (η²)";
          resultObj.h0 = `Toutes les catégories de '${colY}' ont des moyennes de '${colX}' parfaitement égales.`;
          resultObj.h1 = `Au moins une catégorie de '${colY}' présente une moyenne significativement divergente.`;
          resultObj.decision = "Rejet de H0. Au moins une moyenne de groupe se détache.";
          resultObj.extra_info = {
            "Nombre de catégories de regroupement": "3",
            "Degrés de liberté (inter, intra)": "(2, 147)",
            "Somme des carrés inter (SS_between)": "1421.40",
            "Somme des carrés intra (SS_within)": "21650.10",
            "F-Value de Snedecor": "4.821"
          };
          resultObj.assumptions = [
            { name: "Homogénéité des variances (Levene)", status: "validated", details: "Test de Levene non significatif (p = 0.421)." },
            { name: "Indépendance", status: "validated", details: "Sujets distincts d'échantillons aléatoires." }
          ];
          resultObj.post_hoc = [
            { g1: "A", g2: "B", difference: 4.25, p_value: 0.038, significant: true },
            { g1: "A", g2: "C", difference: 6.81, p_value: 0.007, significant: true },
            { g1: "B", g2: "C", difference: 2.56, p_value: 0.185, significant: false }
          ];
          interpretation = `L'Analyse de Variance à 1 facteur confirme la présence de divergences hautement significatives entre les moyennes (p = 0.009, F = 4.821). Le test post-hoc de Tukey HSD montre des contrastes statistiquement prouvés de la catégorie C par rapport à A et B.`;
          chart = {
            data: [
              {
                y: [20, 25, 30, 32, 35, 38, 42],
                type: 'box',
                name: 'Classe A',
                marker: { color: '#4f46e5' }
              },
              {
                y: [24, 28, 32, 36, 40, 44, 46],
                type: 'box',
                name: 'Classe B',
                marker: { color: '#06b6d4' }
              },
              {
                y: [30, 34, 38, 42, 45, 50, 55],
                type: 'box',
                name: 'Classe C',
                marker: { color: '#a855f7' }
              }
            ],
            layout: { title: `Analyse de Variance : Boîtes d'échantillons` }
          };
          break;

        case 'kruskal':
          statistic = 9.154;
          p_value = 0.010;
          resultObj.n = 150;
          resultObj.df = 2;
          resultObj.effect_size = 0.052;
          resultObj.effect_size_name = "Epsilon-carré (ε²)";
          resultObj.h0 = `La distribution de '${colX}' est identique dans tous les groupes de '${colY}' (médianes égales).`;
          resultObj.h1 = `Au moins un groupe présente des observations de rang significativement décalées.`;
          resultObj.decision = "Rejet de H0 (Divergences non paramétriques significatives)";
          resultObj.extra_info = {
            "Statistique H de Kruskal-Wallis": "9.154"
          };
          resultObj.assumptions = [
            { name: "Indépendance", status: "validated", details: "L'échantillon respecte l'indépendance." }
          ];
          resultObj.post_hoc = [
            { g1: "A", g2: "B", difference: -3.6, p_value: 0.12, significant: false },
            { g1: "A", g2: "C", difference: -8.3, p_value: 0.008, significant: true },
            { g1: "B", g2: "C", difference: -4.7, p_value: 0.09, significant: false }
          ];
          interpretation = `Le test de Kruskal-Wallis montre un décalage de distribution statistiquement avéré entre les classes (p = 0.010, H = 9.154). Les contrastes désignent la modalité C comme décalée de manière significative.`;
          chart = {
            data: [
              {
                y: [18, 22, 25, 29, 32, 35, 38],
                type: 'violin',
                name: 'Classe A',
                line: { color: '#4f46e5' }
              },
              {
                y: [22, 26, 30, 34, 38, 42, 45],
                type: 'violin',
                name: 'Classe B',
                line: { color: '#06b6d4' }
              },
              {
                y: [28, 32, 36, 40, 44, 48, 52],
                type: 'violin',
                name: 'Classe C',
                line: { color: '#a855f7' }
              }
            ],
            layout: { title: `Kruskal-Wallis : Violons Comparatifs` }
          };
          break;

        case 'levene':
          statistic = 1.124;
          p_value = 0.328;
          resultObj.n = 150;
          resultObj.df = "(2, 147)";
          resultObj.effect_size = 0.015;
          resultObj.effect_size_name = "Coefficient de dispersion des écarts";
          resultObj.h0 = `Toutes les variances de '${colX}' au sein de '${colY}' sont parfaitement égales (homoscédasticité).`;
          resultObj.h1 = `Au moins une catégorie dévie significativement avec des variances inégales (hétéroscédasticité).`;
          resultObj.decision = "Non-rejet de H0. Homoscédasticité admise.";
          resultObj.extra_info = {
            "Variance de la classe A": "144.20",
            "Variance de la classe B": "121.50",
            "Variance de la classe C": "156.40",
            "Levene-Statistic": "1.124"
          };
          resultObj.assumptions = [
            { name: "Médiane robuste", status: "validated", details: "L'application sur écarts à la médiane tolère l'absence de normalité." }
          ];
          interpretation = `Le test de Levene (p = 0.328) confirme que les variances ne sont pas significativement différentes. L'homoscédasticité requise pour une ANOVA classique est respectée de manière idéale.`;
          chart = {
            data: [
              {
                y: [20, 24, 28, 32, 36, 40, 44],
                type: 'box',
                name: 'Variance A (std=12)',
                marker: { color: '#3b82f6' }
              },
              {
                y: [22, 25, 28, 31, 34, 37, 40],
                type: 'box',
                name: 'Variance B (std=11)',
                marker: { color: '#10b981' }
              }
            ],
            layout: { title: `Vérification d'égalité des variances` }
          };
          break;

        case 'chi2':
          statistic = 14.521;
          p_value = 0.006;
          resultObj.n = 150;
          resultObj.df = 4;
          resultObj.effect_size = 0.221;
          resultObj.effect_size_name = "V de Cramér";
          resultObj.h0 = `Les variables '${colX}' et '${colY}' sont totalement indépendantes (pas d'association).`;
          resultObj.h1 = `Il existe une relation de dépendance ou d'association significative entre '${colX}' et '${colY}'.`;
          resultObj.decision = "Rejet de H0. Variables significativement associées.";
          resultObj.extra_info = {
            "Nombre total d'individus": "150",
            "Cases avec effectif théorique < 5": "0 sur 9 (0.0%)",
            "Force de liaison (V de Cramér)": "0.221 (association moyenne)"
          };
          resultObj.assumptions = [
            { name: "Effectifs théoriques suffisants", status: "validated", details: "100.0% des cases ont un effectif théorique ≥ 5 (idéalement ≥ 80%)." }
          ];
          interpretation = `Le test du Chi-Deux révèle une interdépendance significative entre les caractéristiques de '${colX}' et '${colY}' (p = 0.006, χ2 = 14.521). Le V de Cramér de 0.221 qualifie une interaction d'intensité moyenne.`;
          chart = {
            data: [
              {
                x: ['Faible', 'Moyen', 'Élevé'],
                y: [24, 18, 8],
                type: 'bar',
                name: 'Classe A',
                marker: { color: '#4f46e5' }
              },
              {
                x: ['Faible', 'Moyen', 'Élevé'],
                y: [12, 28, 20],
                type: 'bar',
                name: 'Classe B',
                marker: { color: '#06b6d4' }
              },
              {
                x: ['Faible', 'Moyen', 'Élevé'],
                y: [6, 14, 20],
                type: 'bar',
                name: 'Classe C',
                marker: { color: '#a855f7' }
              }
            ],
            layout: { barmode: 'group', title: `Répartition croisée observée` }
          };
          break;

        case 'kendall':
          statistic = 0.521;
          p_value = 0.0005;
          resultObj.n = 150;
          resultObj.effect_size = 0.521;
          resultObj.effect_size_name = "tau-b de Kendall";
          resultObj.h0 = `Il n'y a pas d'association de rangs (tau de Kendall = 0) entre '${colX}' et '${colY}'.`;
          resultObj.h1 = `Il existe une association de rangs significative entre '${colX}' et '${colY}' (tau ${alt_sym} 0).`;
          resultObj.decision = "Rejet de H0 (Association monotone significative)";
          resultObj.extra_info = {
            "Coefficient tau de Kendall": "0.5210",
            "Nombre d'observations": "150"
          };
          resultObj.assumptions = [
            { name: "Variables continues ou ordinales", status: "validated", details: "L'échelle est ordinale ou continue, idéale pour de petits échantillons." }
          ];
          interpretation = `Le coefficient tau-b de Kendall est de 0.521, confirmant que l'association monotone dans les rangs des paires d'observations de '${colX}' et '${colY}' est statistiquement significative (p = 0.0005).`;
          chart = {
            data: [
              {
                x: [10, 15, 17, 20, 24, 28, 30, 35, 40, 42, 45, 50, 52, 58, 60],
                y: [8, 12, 13, 22, 28, 35, 38, 48, 55, 58, 61, 70, 72, 85, 90],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#3b82f6', size: 8 }
              }
            ],
            layout: { title: `Ajustement de Corrélation de Kendall (${colX} vs ${colY})` }
          };
          break;

        case 'fisher':
          statistic = 4.25;
          p_value = 0.018;
          resultObj.n = 35;
          resultObj.effect_size = 0.384;
          resultObj.effect_size_name = "V de Cramér";
          resultObj.h0 = `Les variables '${colX}' et '${colY}' sont parfaitement indépendantes.`;
          resultObj.h1 = `Les variables '${colX}' et '${colY}' sont dépendantes (l'association est significative).`;
          resultObj.decision = "Rejet de H0 (Association prouvée)";
          resultObj.extra_info = {
            "Rapport des cotes (Odds Ratio (OR))": "4.2500",
            "Effectif total (N)": "35",
            "Félicité d'application": "Idéal pour petits échantillons (< 20 individus ou effectifs < 5 dans les cases)"
          };
          resultObj.assumptions = [
            { name: "Petits effectifs admis", status: "validated", details: "Le calcul de probabilités hypergéométriques exactes garantit la robustesse du test." }
          ];
          interpretation = `Le test exact de Fisher montre que l'association entre '${colX}' et '${colY}' est statistiquement significative (p = 0.018) pour ce petit effectif de 35 sujets. L'Odds Ratio de 4.25 suggère que les chances de succès sont plus de 4 fois supérieures dans le premier groupe.`;
          chart = {
            data: [
              {
                x: ['G1 - Succès', 'G1 - Échec'],
                y: [12, 3],
                type: 'bar',
                name: 'Groupe 1',
                marker: { color: '#4f46e5' }
              },
              {
                x: ['G2 - Succès', 'G2 - Échec'],
                y: [5, 15],
                type: 'bar',
                name: 'Groupe 2',
                marker: { color: '#06b6d4' }
              }
            ],
            layout: { barmode: 'group', title: `Test exact de Fisher : effectifs observés` }
          };
          break;

        case 'mcnemar':
          statistic = 6.125;
          p_value = 0.013;
          resultObj.n = 80;
          resultObj.df = 1;
          resultObj.effect_size = 0.28;
          resultObj.effect_size_name = "g de Cohen";
          resultObj.h0 = `Les proportions marginales sont égales (pas de changement ou d'effet de transition).`;
          resultObj.h1 = `Les proportions marginales diffèrent (effet de transition ou changement avéré).`;
          resultObj.decision = "Rejet de H0 (Effet de changement statistiquement significatif)";
          resultObj.extra_info = {
            "Discordances b (Oui -> Non)": "22",
            "Discordances c (Non -> Oui)": "8",
            "Concordances a (Oui -> Oui)": "35",
            "Concordances d (Non -> Non)": "15"
          };
          resultObj.assumptions = [
            { name: "Données appariées", status: "validated", details: "Les mesures et observations sont répétés sur les mêmes individus." },
            { name: "Effectif discordant (b + c ≥ 10)", status: "validated", details: "Somme des discordances = 30 ≥ 10 (la correction de continuité s'applique)." }
          ];
          interpretation = `Le test de McNemar avec correction de continuité met en évidence une modification statistiquement significative des proportions (p = 0.013, χ² = 6.125). Le coefficient g de Cohen de 0.280 indique un effet de transition d'intensité intermédiaire.`;
          chart = {
            data: [
              {
                x: ['Avant (Positif) / Après (Négatif)', 'Avant (Négatif) / Après (Positif)'],
                y: [22, 8],
                type: 'bar',
                name: 'Discordances',
                marker: { color: ['#f43f5e', '#10b981'] }
              }
            ],
            layout: { title: `Test de McNemar: Transition de proportions (discordants)` }
          };
          break;

        case 'cramer':
          statistic = 0.324;
          p_value = 0.0002;
          resultObj.n = 180;
          resultObj.df = 4;
          resultObj.effect_size = 0.324;
          resultObj.effect_size_name = "V de Cramér";
          resultObj.h0 = `Il n'y a aucune association entre les distributions de '${colX}' et '${colY}' (V = 0).`;
          resultObj.h1 = `Il existe une force d'association statistiquement significative entre '${colX}' et '${colY}' (V > 0).`;
          resultObj.decision = "Rejet de H0 (Association catégorielle significative)";
          resultObj.extra_info = {
            "Force de liaison (V de Cramér)": "0.3240 (interaction modérée)",
            "Statistique de Chi-Deux associée": "37.8100",
            "Nombre d'observations": "180"
          };
          resultObj.assumptions = [
            { name: "Observations indépendantes", status: "validated", details: "Chaque observation appartient à une unique case." }
          ];
          interpretation = `L'indice V de Cramér de 0.324 atteste d'une force d'association modérément forte et hautement significative (p = 0.0002) entre les modalités de '${colX}' et '${colY}'.`;
          chart = {
            data: [
              {
                x: ['Groupe A', 'Groupe B', 'Groupe C'],
                y: [45, 15, 10],
                type: 'bar',
                name: 'Catégorie Basse',
                marker: { color: '#818cf8' }
              },
              {
                x: ['Groupe A', 'Groupe B', 'Groupe C'],
                y: [15, 35, 10],
                type: 'bar',
                name: 'Catégorie Moyenne',
                marker: { color: '#34d399' }
              },
              {
                x: ['Groupe A', 'Groupe B', 'Groupe C'],
                y: [5, 15, 30],
                type: 'bar',
                name: 'Catégorie Haute',
                marker: { color: '#fb7185' }
              }
            ],
            layout: { barmode: 'stack', title: `Association : Proportion cumulée des catégories` }
          };
          break;

        case 'dagostino':
          statistic = 1.894;
          p_value = 0.388;
          resultObj.n = 120;
          resultObj.h0 = `La variable '${colX}' suit une distribution normale.`;
          resultObj.h1 = `La variable '${colX}' ne suit pas une distribution normale.`;
          resultObj.decision = "Non-rejet de l'hypothèse de normalité (H0)";
          resultObj.extra_info = {
            "Skewness (Asymétrie)": "0.112 (p = 0.45)",
            "Kurtosis (Aplatissement)": "0.198 (p = 0.35)"
          };
          resultObj.assumptions = [
            { name: "Effectif minimal", status: "validated", details: "N = 120 (recommandé N ≥ 8 pour D'Agostino-Pearson)" }
          ];
          interpretation = `Le test omnibus de normalité de D'Agostino-Pearson ne permet pas de rejeter l'hypothèse de normalité (p = 0.388). L'asymétrie et l'aplatissement de la distribution sont parfaitement compatibles avec une forme gaussienne théorique.`;
          chart = {
            data: [
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [2, 5, 12, 18, 26, 24, 15, 9, 5, 3, 1],
                type: 'bar',
                name: 'Fréquences observées',
                marker: { color: 'rgba(56, 189, 248, 0.65)' }
              },
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [1.2, 4.5, 11.4, 19.8, 25.1, 24.8, 17.5, 9.8, 4.2, 1.1, 0.1],
                type: 'scatter',
                mode: 'lines',
                name: 'Modèle Normal Corrigé',
                line: { color: '#4f46e5', width: 2.5 }
              }
            ],
            layout: { title: `Distribution & Test d'Asymétrie de ${colX}` }
          };
          break;

        case 'jarque_bera':
          statistic = 1.458;
          p_value = 0.482;
          resultObj.n = 150;
          resultObj.h0 = `La variable '${colX}' présente un coefficient d'asymétrie et d'aplatissement conformes à la loi normale (skewness=0, kurtosis=3).`;
          resultObj.h1 = `Le couple asymétrie/aplatissement s'écarte significativement de la normale.`;
          resultObj.decision = "Non-rejet de l'hypothèse nulle";
          resultObj.extra_info = {
            "Statistique Jarque-Bera": "1.458",
            "Degrés de liberté": "2",
            "Estimation Skewness": "-0.081",
            "Estimation Kurtosis": "3.184"
          };
          resultObj.assumptions = [
            { name: "Grands échantillons", status: "validated", details: "N = 150 (approprié car asymptotique)" }
          ];
          interpretation = `Le test de Jarque-Bera indique que la skewness et la kurtosis de la variable '${colX}' ne présentent aucun écart statistiquement significatif par rapport à une distribution normale théorique (p = 0.482, JB = 1.458). Les données sont adaptées aux techniques de modélisation paramétrique.`;
          chart = {
            data: [
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [2, 5, 12, 18, 26, 24, 15, 9, 5, 3, 1],
                type: 'bar',
                name: 'Échantillon',
                marker: { color: 'rgba(99, 102, 241, 0.6)' }
              }
            ],
            layout: { title: `Ajustement Jarque-Bera sur ${colX}` }
          };
          break;

        case 'kolmogorov':
          statistic = 0.052;
          p_value = 0.412;
          resultObj.n = 120;
          resultObj.h0 = `La distribution empirique de '${colX}' s'ajuste à la distribution normale de référence.`;
          resultObj.h1 = `La distribution de '${colX}' d'écarte significativement de la normale de référence.`;
          resultObj.decision = "Non-rejet de H0. Ajustement optimal.";
          resultObj.extra_info = {
            "Distance D maximale": "0.052",
            "Seuil d'ajustement": "0.081"
          };
          resultObj.assumptions = [
            { name: "Variable continue", status: "validated", details: "Vérifié" }
          ];
          interpretation = `L'ajustement Lilliefors/Kolmogorov-Smirnov confirme l'excellente superposition de l'échantillon à une loi normale théorique (p = 0.412, distance maximale D = 0.052).`;
          chart = {
            data: [
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [0.01, 0.05, 0.15, 0.35, 0.65, 0.85, 0.94, 0.98, 0.99, 1.0, 1.0],
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Fonction de répartition (ECDF)',
                line: { color: '#6366f1' }
              },
              {
                x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                y: [0.01, 0.04, 0.14, 0.34, 0.62, 0.84, 0.93, 0.97, 0.99, 1.0, 1.0],
                type: 'scatter',
                mode: 'lines',
                name: 'Loi Normale Théorique (CDF)',
                line: { color: '#b91c1c', dash: 'dash' }
              }
            ],
            layout: { title: `Fonction de répartition cumulative (ECDF vs CDF)` }
          };
          break;

        case 'chi2_1samp':
          statistic = 2.451;
          p_value = 0.293;
          resultObj.n = 100;
          resultObj.df = 2;
          resultObj.h0 = `Les proportions observées de '${colX}' s'ajustent aux proportions théoriques d'équiprobabilité (uniforme).`;
          resultObj.h1 = `Les proportions observées diffèrent significativement des attentes théoriques.`;
          resultObj.decision = "Non-rejet de H0. Adéquation validée.";
          resultObj.extra_info = {
            "Chi-Deux calculé (χ²)": "2.451",
            "Degrés de liberté": "2"
          };
          resultObj.assumptions = [
            { name: "Effectif attendu suffisant", status: "validated", details: "Toutes les catégories possèdent un effectif théorique ≥ 5." }
          ];
          interpretation = `Le test du Chi-Deux d'adéquation montre que la distribution empirique des modalités de '${colX}' est statistiquement conforme au modèle théorique spécifié (p = 0.293, χ² = 2.451). Aucune divergence majeure n'est observée.`;
          chart = {
            data: [
              {
                x: ['Modalité A', 'Modalité B', 'Modalité C'],
                y: [38, 30, 32],
                type: 'bar',
                name: 'Observé',
                marker: { color: '#4f46e5' }
              },
              {
                x: ['Modalité A', 'Modalité B', 'Modalité C'],
                y: [33.3, 33.3, 33.3],
                type: 'bar',
                name: 'Théorique attendu',
                marker: { color: '#cbd5e1' }
              }
            ],
            layout: { barmode: 'group', title: `Effectifs observés vs théoriques` }
          };
          break;

        case 'anova_rm':
          statistic = 7.942;
          p_value = 0.0006;
          resultObj.n = 150; // 50 subjects * 3 repetitions
          resultObj.df = "(2, 98)";
          resultObj.effect_size = 0.142;
          resultObj.effect_size_name = "Eta-carré partiel (η²p)";
          resultObj.h0 = `Les moyennes de '${colX}' sont identiques à chaque mesure répétée (facteur : ${colY}).`;
          resultObj.h1 = `Au moins une période ou condition de '${colY}' présente une moyenne de '${colX}' différente des autres.`;
          resultObj.decision = "Rejet de H0 (Variation temporelle ou intra-sujet significative)";
          resultObj.extra_info = {
            "Facteur de répétition hétérogène": colY,
            "Mesures par sujet": "3 répétitions",
            "F-Value Intra-Sujets": "7.942",
            "Sphéricité de Mauchly (W)": "0.941 (p-value = 0.231)",
            "Correction Greenhouse-Geisser (ε)": "1.000 (aucune correction nécessaire)"
          };
          resultObj.assumptions = [
            { name: "Sujets appariés / Blocs complets", status: "validated", details: "Mêmes individus ou unités analysés systématiquement." },
            { name: "Normalité univariée par groupe", status: "validated", details: "Tests de Shapiro-Wilk validés sur chaque répétition (p > 0.05)." },
            { name: "Sphéricité des variances de différence", status: "validated", details: "Test de Mauchly non significatif (p = 0.231), variances homogènes." }
          ];
          resultObj.post_hoc = [
            { g1: "T1 (Pré)", g2: "T2 (Post)", difference: 3.82, p_value: 0.012, significant: true },
            { g1: "T1 (Pré)", g2: "T3 (Suivi)", difference: 6.14, p_value: 0.0002, significant: true },
            { g1: "T2 (Post)", g2: "T3 (Suivi)", difference: 2.32, p_value: 0.084, significant: false }
          ];
          interpretation = `L'Analyse de Variance (ANOVA) à mesures répétées met en lumière un effet temporel très marqué et hautement significatif (p = 0.0006, F = 7.942). L'ampleur de l'effet est forte (η²p = 0.142). Le suivi post-hoc révèle une progression notable de '${colX}' consécutive au passage du temps entre la phase initiale (Pré) et les évaluations suivantes (Post & Suivi).`;
          chart = {
            data: [
              {
                x: ['Pré-test (T1)', 'Post-test (T2)', 'Suivi (T3)'],
                y: [42.1, 45.9, 48.2],
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Moyenne observée',
                line: { color: '#6366f1', width: 3.5 },
                marker: { size: 10, color: '#4f46e5' },
                error_y: {
                  type: 'data',
                  array: [1.2, 1.4, 1.1],
                  visible: true,
                  color: '#818cf8',
                  thickness: 1.5,
                  width: 5
                }
              }
            ],
            layout: { title: `Évolution temporelle moyenne de ${colX} (Mesures Répétées)` }
          };
          break;

        case 'friedman':
          statistic = 14.825;
          p_value = 0.0006;
          resultObj.n = 150;
          resultObj.df = 2;
          resultObj.h0 = `Les médianes de rangs de '${colX}' sont identiques sur l'ensemble des répétitions de '${colY}'.`;
          resultObj.h1 = `Au moins une répétition de '${colY}' présente des rangs de distribution significativement décalés de '${colX}'.`;
          resultObj.decision = "Rejet de H0 (Évolution non paramétrique significative)";
          resultObj.extra_info = {
            "Chi-deux de Friedman (Q)": "14.825",
            "Degrés de liberté (k - 1)": "2",
            "Nombre de blocs (sujets)": "50"
          };
          resultObj.assumptions = [
            { name: "Observations appariées", status: "validated", details: "Mêmes individus ou blocs de taille constante." }
          ];
          resultObj.post_hoc = [
            { g1: "T1 (Pré)", g2: "T2 (Post)", difference: 1.22, p_value: 0.024, significant: true },
            { g1: "T1 (Pré)", g2: "T3 (Suivi)", difference: 2.15, p_value: 0.0004, significant: true },
            { g1: "T2 (Post)", g2: "T3 (Suivi)", difference: 0.93, p_value: 0.112, significant: false }
          ];
          interpretation = `Le test de Friedman (alternative non paramétrique) démontre que les rangs de '${colX}' varient de manière hautement significative au fil des conditions (p = 0.0006, Chi² = 14.83). Ceci étaye solidement l'hypothèse d'une transformation structurale de la variable à travers les cycles répétés. L'effet est robuste contre les biais de distribution.`;
          chart = {
            data: [
              { y: [35, 38, 41, 42, 45, 47, 50], type: 'box', name: 'T1 (Pré)', marker: { color: '#6366f1' } },
              { y: [38, 42, 44, 46, 48, 50, 52], type: 'box', name: 'T2 (Post)', marker: { color: '#a855f7' } },
              { y: [41, 45, 47, 49, 52, 54, 58], type: 'box', name: 'T3 (Suivi)', marker: { color: '#ec4899' } }
            ],
            layout: { title: `Distribution non paramétrique de ${colX} par Échéance (Friedman)` }
          };
          break;

        case 'ancova':
          statistic = 6.621;
          p_value = 0.0018;
          resultObj.n = 150;
          resultObj.df = "(2, 146)";
          resultObj.effect_size = 0.083;
          resultObj.effect_size_name = "Eta-carré partiel (η²p)";
          resultObj.h0 = `Après ajustement de la covariable, les moyennes de '${colX}' sont identiques entre les groupes de '${colY}'.`;
          resultObj.h1 = `Après ajustement de la covariable, au moins un groupe de '${colY}' présente une moyenne ajustée de '${colX}' divergente.`;
          resultObj.decision = "Rejet de H0 (Effet de groupe avéré après ajustement)";
          resultObj.extra_info = {
            "Variable dépendante": colX,
            "Facteur principal (Groupe)": colY,
            "Covariable continue contrôlée": params.covariate || "Covariable",
            "F-Value du traitement/groupe": "6.621 (p = 0.0018)",
            "F-Value de la covariable": "24.410 (p < 0.0001 - covariable indispensable au modèle)"
          };
          resultObj.assumptions = [
            { name: "Linéarité", status: "validated", details: "Relation linéaire rigoureuse observée entre la covariable et la variable dépendante." },
            { name: "Homogénéité des pentes de régression", status: "validated", details: "L'interaction Groupe × Covariable n'est pas significative (p = 0.548). Pentes parallèles validées." },
            { name: "Homéoscédasticité des résidus", status: "validated", details: "Levene sur résidus non significatif (p = 0.385)." }
          ];
          resultObj.post_hoc = [
            { g1: "Groupe Témoin", g2: "Traitement A", difference: 3.12, p_value: 0.041, significant: true },
            { g1: "Groupe Témoin", g2: "Traitement B", difference: 5.84, p_value: 0.001, significant: true },
            { g1: "Traitement A", g2: "Traitement B", difference: 2.72, p_value: 0.092, significant: false }
          ];
          interpretation = `L'Analyse de Covariance (ANCOVA) confirme l'existence d'une différence majeure entre les groupes après élimination des écarts initiaux attribués à la covariable de bruit '${params.covariate || 'Covariable'}' (F = 6.62, p = 0.0018, η²p = 0.083). L'effet propre de '${colY}' est persistant et indépendant du biais contrôlé.`;
          chart = {
            data: [
              {
                x: [10, 15, 20, 25, 30, 35, 40],
                y: [15, 22, 28, 32, 40, 44, 48],
                type: 'scatter',
                mode: 'markers',
                name: 'Groupe Témoin',
                marker: { color: '#cbd5e1', size: 8 }
              },
              {
                x: [10, 15, 20, 25, 30, 35, 40],
                y: [20, 27, 33, 38, 45, 49, 54],
                type: 'scatter',
                mode: 'markers',
                name: 'Traitement A',
                marker: { color: '#6366f1', size: 8 }
              },
              {
                x: [10, 15, 20, 25, 30, 35, 40],
                y: [24, 30, 37, 42, 49, 53, 59],
                type: 'scatter',
                mode: 'markers',
                name: 'Traitement B',
                marker: { color: '#10b981', size: 8 }
              },
              {
                x: [10, 40],
                y: [16, 47],
                type: 'scatter',
                mode: 'lines',
                name: 'Régression ajustée Témoin',
                line: { color: '#94a3b8', width: 2, dash: 'dot' }
              },
              {
                x: [10, 40],
                y: [21, 52],
                type: 'scatter',
                mode: 'lines',
                name: 'Régression ajustée Traitement A',
                line: { color: '#4f46e5', width: 2 }
              },
              {
                x: [10, 40],
                y: [25, 56],
                type: 'scatter',
                mode: 'lines',
                name: 'Régression ajustée Traitement B',
                line: { color: '#059669', width: 2 }
              }
            ],
            layout: { title: `Pentes de régression ANCOVA : ${colX} ajusté par ${params.covariate || "Covariable"}` }
          };
          break;

        case 'ancova_rank':
          statistic = 5.918;
          p_value = 0.0034;
          resultObj.n = 150;
          resultObj.df = "(2, 146)";
          resultObj.h0 = `Après ajustement non paramétrique robuste de la covariable, les médianes de rangs de '${colX}' sont identiques entre les groupes de '${colY}'.`;
          resultObj.h1 = `Au moins un groupe présente un décalage significatif de rangs ajustés.`;
          resultObj.decision = "Rejet de H0 (Effet robuste persistant après contrôle)";
          resultObj.extra_info = {
            "Méthode d'ajustement non paramétrique": "Rangs de Quade",
            "Statistique de test (F de Quade)": "5.918",
            "p-value robuste": "0.0034",
            "Covariable continue": params.covariate || "Covariable"
          };
          resultObj.assumptions = [
            { name: "Échantillonnage indépendant", status: "validated", details: "Les sujets appartiennent à des groupes d'affectation s'excluant mutuellement." }
          ];
          resultObj.post_hoc = [
            { g1: "Groupe Témoin", g2: "Traitement A", difference: 2.82, p_value: 0.048, significant: true },
            { g1: "Groupe Témoin", g2: "Traitement B", difference: 5.15, p_value: 0.002, significant: true }
          ];
          interpretation = `L'ANCOVA non paramétrique sur Rangs (modèle robuste de Quade) confirme de manière indiscutable l'effet significatif du facteur principal '${colY}' sur '${colX}' (p = 0.0034) indépendamment des fluctuations anormales de la covariable. Ce test est immunisé contre les résidus non gaussiens ou hétéroscédastiques.`;
          chart = {
            data: [
              { y: [12, 18, 25, 30, 36, 42, 51], type: 'box', name: 'Témoin (Rangs)', marker: { color: '#94a3b8' } },
              { y: [22, 29, 36, 44, 52, 61, 70], type: 'box', name: 'Traitement A (Rangs)', marker: { color: '#4f46e5' } },
              { y: [35, 42, 50, 58, 67, 78, 88], type: 'box', name: 'Traitement B (Rangs)', marker: { color: '#059669' } }
            ],
            layout: { title: `Médianes des Rangs Ajustés de Quade : ${colX} contrôlé par ${params.covariate || "Covariable"}` }
          };
          break;

        case 'manova':
          statistic = 0.852;
          p_value = 0.0001;
          resultObj.n = 150;
          resultObj.df = "(4, 292)";
          resultObj.effect_size = 0.077;
          resultObj.effect_size_name = "Eta-carré partiel global (η²p)";
          resultObj.h0 = `Les vecteurs de moyennes combinées de l'ensemble des variables dépendantes sont parfaitement synchronisés entre les catégories de '${colY}'.`;
          resultObj.h1 = `Au moins une catégorie de '${colY}' présente un vecteur de moyennes significativement décentré.`;
          resultObj.decision = "Rejet de H0 (Vecteurs de moyennes globalement distincts)";
          resultObj.extra_info = {
            "Variables dépendantes": `${colX} et Var_Multi_Dépendante`,
            "Facteur explicatif": colY,
            "Lambda de Wilks": "0.8520",
            "Trace de Pillai": "0.1511",
            "F multivarié approximatif": "6.142"
          };
          resultObj.assumptions = [
            { name: "Normalité multivariée", status: "validated", details: "Indice de Henze-Zirkler satisfaisant (HZ = 0.812, p = 0.321)." },
            { name: "Homogénéité des matrices de covariance", status: "validated", details: "Test M de Box validé (M = 8.420, p = 0.149)." }
          ];
          interpretation = `L'Analyse de Variance Multivariée (MANOVA) valide l'existence de profils de moyennes consolidées significativement contrastés selon le groupe de '${colY}' (Lambda de Wilks = 0.852, p < 0.001). Intégrer conjointement ces mesures prévient l'inflation d'erreur type I liée à des ANOVA répétées de manière isolée.`;
          chart = {
            data: [
              {
                x: [12, 14, 15, 16, 18, 19, 21],
                y: [30, 32, 34, 33, 35, 36, 38],
                type: 'scatter',
                mode: 'markers',
                name: 'Classe A',
                marker: { color: '#6366f1', size: 9 },
                line: { color: '#6366f1' }
              },
              {
                x: [16, 17, 19, 20, 22, 23, 25],
                y: [32, 35, 37, 36, 38, 40, 42],
                type: 'scatter',
                mode: 'markers',
                name: 'Classe B',
                marker: { color: '#10b981', size: 9 },
                line: { color: '#10b981' }
              },
              {
                x: [18, 20, 21, 23, 24, 26, 28],
                y: [35, 38, 40, 39, 41, 44, 46],
                type: 'scatter',
                mode: 'markers',
                name: 'Classe C',
                marker: { color: '#f59e0b', size: 9 },
                line: { color: '#f59e0b' }
              }
            ],
            layout: { 
              title: `Biplot de MANOVA : Centroïdes des groupes dans l'espace conjoint de réponses`,
              xaxis: { title: `Var Dépendante 1 (${colX})` },
              yaxis: { title: "Var Dépendante 2" }
            }
          };
          break;

        case 'permanova':
          statistic = 7.152;
          p_value = 0.001;
          resultObj.n = 150;
          resultObj.df = 2;
          resultObj.h0 = `Les centroïdes spatiaux et la variance de distribution globale ne diffèrent pas significativement entre les groupes de '${colY}'.`;
          resultObj.h1 = `Au moins un groupe présente des centroïdes statistiquement repoussés dans l'espace de distance.`;
          resultObj.decision = "Rejet de H0 (Séparation spatiale par permutation hautement avérée)";
          resultObj.extra_info = {
            "F-Value permutée (pseudo-F)": "7.152",
            "Permutations aléatoires de validation": "999",
            "Métrique de distance employée": "Euclidienne"
          };
          resultObj.assumptions = [
            { name: "Échantillonnage représentatif indépendant", status: "validated", details: "Hypothèse de base du bootstraps validée." }
          ];
          interpretation = `La PERMANOVA démontre au travers de 999 permutations aléatoires que le facteur '${colY}' divise indiscutablement l'espace multidimensionnel d'évaluation (pseudo-F = 7.15, p = 0.0010). Ce résultat est pleinement immunisé contre l'absence de normalité ou la disparité des homoscédasticités multivariées.`;
          chart = {
            data: [
              {
                x: [-1.4, -1.1, -0.8, -0.5, -0.2, 0.1, -0.6],
                y: [0.5, 0.8, -0.1, 0.3, 0.7, -0.2, 0.2],
                type: 'scatter',
                mode: 'markers',
                name: 'Classe A (Projection ACP)',
                marker: { color: '#4f46e5', size: 7 }
              },
              {
                x: [0.2, 0.5, 0.8, 1.1, 0.4, 0.7, 0.9],
                y: [-0.4, -0.1, 0.5, 0.2, -0.6, 0.1, 0.0],
                type: 'scatter',
                mode: 'markers',
                name: 'Classe B (Projection ACP)',
                marker: { color: '#059669', size: 7 }
              }
            ],
            layout: { 
              title: `Analyse de Coordonnées Principales (PCoA/PCA) suite à la PERMANOVA`,
              xaxis: { title: "Axe de variance 1" },
              yaxis: { title: "Axe de variance 2" }
            }
          };
          break;

        case 'mancova':
          statistic = 0.814;
          p_value = 0.0001;
          resultObj.n = 150;
          resultObj.df = "(4, 288)";
          resultObj.effect_size = 0.098;
          resultObj.effect_size_name = "Eta-carré partiel global (η²p)";
          resultObj.h0 = `Après élimination de la covariance contrôlée, les vecteurs de réponses conjointes restent identiques entre les cellules de '${colY}'.`;
          resultObj.h1 = `Après contrôle, au moins un groupe de '${colY}' possède des moyennes ajustées de réponses séparées.`;
          resultObj.decision = "Rejet de H0 (Séparation conjointe robuste après contrôle)";
          resultObj.extra_info = {
            "Lambda de Wilks (Ajusté)": "0.8140",
            "F de Snedecor de Groupe associé": "7.810 (p < 0.0001)",
            "Covariable continue ajustée": params.covariate || "Covariable",
            "Indice d'efficacité ajusté global (η²)": "0.0980"
          };
          resultObj.assumptions = [
            { name: "Normalité résiduelle combinée", status: "validated", details: "Résidus multivariés sans asymétrie critique." },
            { name: "Homogénéité des hyper-pentes de covariable", status: "validated", details: "Pentes de la covariables extrapolées identiques pour chaque groupe." }
          ];
          interpretation = `La MANCOVA confirme l'importance du facteur de regroupement '${colY}' sur l'ensemble de l'espace combiné de réponse (p < 0.0001, F = 7.810), et ce même après élimination stricte de l'influence parasite initialement engendrée par la covariable '${params.covariate || "Covariable"}'.`;
          chart = {
            data: [
              {
                x: [10, 20, 30, 40],
                y: [22, 34, 46, 58],
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Ajustement Groupe A',
                line: { color: '#4f46e5' }
              },
              {
                x: [10, 20, 30, 40],
                y: [28, 40, 52, 64],
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Ajustement Groupe B',
                line: { color: '#059669' }
              }
            ],
            layout: { 
              title: `Hyper-plans de réponses ajustées (MANCOVA)`,
              xaxis: { title: `Covariable (${params.covariate || "Covariable"})` },
              yaxis: { title: `Réponse combinée (${colX})` }
            }
          };
          break;

        case 'permancova':
          statistic = 8.412;
          p_value = 0.001;
          resultObj.n = 150;
          resultObj.df = 2;
          resultObj.h0 = `Après contrôle par permutation de la covariable, les centroïdes multidimensionnels de '${colX}' sont identiques entre les groupes de '${colY}'.`;
          resultObj.h1 = `Au moins une différence de centroïdes ajustés survit aux bootstraps permutés de validation.`;
          resultObj.decision = "Rejet de H0 (Équivalent multivarié non paramétrique validé)";
          resultObj.extra_info = {
            "Pseudo-F ajusté de validation": "8.412",
            "Nombre de permutations": "999",
            "Métrique de distance résiduelle": "Euclidienne"
          };
          resultObj.assumptions = [
            { name: "Structure d'échangeabilité", status: "validated", details: "Résidus permutables au sein des groupes homogènes." }
          ];
          interpretation = `Le test de PERMANCOVA par permutations robuste (alternative non paramétrique moderne) prouve que les sous-populations de '${colY}' occupent des positions distinctes (p = 0.0010) au sein de la matrice de distances combinées une fois corrigée par le gradient résiduel de covariation.`;
          chart = {
            data: [
              { x: [-1.2, -0.9, -0.6, -0.3], y: [0.1, 0.4, 0.2, 0.5], type: 'scatter', mode: 'markers', name: 'Groupe A (Ajusté)', marker: { color: '#4f46e5', size: 9 } },
              { x: [0.4, 0.7, 1.0, 1.3], y: [-0.3, -0.1, -0.2, 0.1], type: 'scatter', mode: 'markers', name: 'Groupe B (Ajusté)', marker: { color: '#059669', size: 9 } }
            ],
            layout: { 
              title: `Projection bidimensionnelle des résidus ajustés par PERMANCOVA`,
              xaxis: { title: "Axe orthogonal ajusté 1" },
              yaxis: { title: "Axe orthogonal ajusté 2" }
            }
          };
          break;

        default:
          statistic = 1.0;
          p_value = 0.05;
          interpretation = "Résultats standards pour test statistique inconnu.";
          break;
      }

      resolve({
        success: true,
        test_name: test_id,
        result: {
          statistic,
          p_value,
          ...resultObj
        },
        interpretation,
        chart
      });
    }, 600);
  });
},

get_comprehensive_univariate_stats: async (column_name: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const previewData = (window as any).__previewData || [];
      const columns = (window as any).__columns || [];
      const colMeta = columns.find((c: any) => c.name === column_name);
      const colType = colMeta ? colMeta.type : 'continuous';

      if (previewData.length > 0) {
        const values = previewData
          .map((row: any) => {
            const val = row[column_name];
            if (val === undefined || val === null || val === '') return null;
            return typeof val === 'number' ? val : parseFloat(val);
          })
          .filter((v: any) => v !== null && !isNaN(v));

        if (colType === 'continuous' || colType === 'discrete') {
          if (values.length > 0) {
            const sum = values.reduce((a: number, b: number) => a + b, 0);
            const mean = parseFloat((sum / values.length).toFixed(3));
            const sorted = [...values].sort((a, b) => a - b);
            const median = parseFloat(sorted[Math.floor(sorted.length / 2)].toFixed(3));
            const min = parseFloat(sorted[0].toFixed(3));
            const max = parseFloat(sorted[sorted.length - 1].toFixed(3));
            
            const avg = sum / values.length;
            const squareDiffs = values.map((v: number) => Math.pow(v - avg, 2));
            const variance = squareDiffs.reduce((a: number, b: number) => a + b, 0) / (values.length > 1 ? values.length - 1 : 1);
            const std_dev = parseFloat(Math.sqrt(variance).toFixed(3));
            
            resolve({
              success: true,
              column: column_name,
              type: 'continuous',
              metrics: { mean, median, std_dev, min, max, count: values.length },
              interpretation: `Statistiques descriptives de la variable quantitative '${column_name}' : la moyenne est de ${mean} et l'écart-type est de ${std_dev}.`
            });
            return;
          }
        } else {
          const originalValues = previewData
            .map((row: any) => {
              const val = row[column_name];
              return val === undefined || val === null || val === '' ? 'Manquant' : String(val);
            });
          const counts: Record<string, number> = {};
          originalValues.forEach((v: string) => {
            counts[v] = (counts[v] || 0) + 1;
          });
          const mode = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'Aucun');
          resolve({
            success: true,
            column: column_name,
            type: 'nominal',
            metrics: { mode, unique_count: Object.keys(counts).length, count: originalValues.length },
            frequencies: Object.entries(counts).map(([label, count]) => ({
              label,
              count,
              percentage: parseFloat(((count / originalValues.length) * 100).toFixed(1))
            })),
            interpretation: `Variable qualitative '${column_name}' contenant ${Object.keys(counts).length} modalités différentes. La modalité la plus fréquente (mode) est '${mode}'.`
          } as any);
          return;
        }
      }

      resolve({
         success: true,
         column: column_name,
         type: 'continuous',
         metrics: { mean: 35.4, median: 34, std_dev: 12.3 },
         interpretation: "La distribution de la variable est asymétrique."
      });
    }, 400);
  });
},

get_comprehensive_bivariate_stats: async (col_x: string, col_y: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const previewData = (window as any).__previewData || [];
      const columns = (window as any).__columns || [];
      
      const colMetaX = columns.find((c: any) => c.name === col_x);
      const colMetaY = columns.find((c: any) => c.name === col_y);
      
      const typeX = colMetaX ? colMetaX.type : 'continuous';
      const typeY = colMetaY ? colMetaY.type : 'continuous';
      
      if (previewData.length > 0) {
        const isNumX = typeX === 'continuous' || typeX === 'discrete';
        const isNumY = typeY === 'continuous' || typeY === 'discrete';
        
        if (isNumX && isNumY) {
          const paired = previewData.map((row: any) => {
            const vx = parseFloat(row[col_x]);
            const vy = parseFloat(row[col_y]);
            return { vx, vy };
          }).filter(p => !isNaN(p.vx) && !isNaN(p.vy));
          
          if (paired.length > 1) {
            const meanX = paired.reduce((sum, p) => sum + p.vx, 0) / paired.length;
            const meanY = paired.reduce((sum, p) => sum + p.vy, 0) / paired.length;
            
            const num = paired.reduce((sum, p) => sum + (p.vx - meanX) * (p.vy - meanY), 0);
            const denX = paired.reduce((sum, p) => sum + Math.pow(p.vx - meanX, 2), 0);
            const denY = paired.reduce((sum, p) => sum + Math.pow(p.vy - meanY, 2), 0);
            
            const pearson_r = denX > 0 && denY > 0 ? parseFloat((num / Math.sqrt(denX * denY)).toFixed(4)) : 0;
            const r_squared = parseFloat(Math.pow(pearson_r, 2).toFixed(4));
            
            resolve({
              success: true,
              col_x,
              col_y,
              type_x: 'continuous',
              type_y: 'continuous',
              analysis_type: 'quant_quant',
              metrics: {
                pearson_r,
                r_squared,
                n: paired.length
              },
              interpretation: `Liaison linéaire calculée entre '${col_x}' et '${col_y}' sur ${paired.length} observations : coefficient de corrélation de Pearson r = ${pearson_r}.`
            });
            return;
          }
        } else if (!isNumX && !isNumY) {
          const pairs = previewData.map((row: any) => ({
            vx: row[col_x] === undefined || row[col_x] === null || row[col_x] === '' ? 'Manquant' : String(row[col_x]),
            vy: row[col_y] === undefined || row[col_y] === null || row[col_y] === '' ? 'Manquant' : String(row[col_y])
          }));
          
          const catsX = Array.from(new Set(pairs.map(p => p.vx))).slice(0, 8) as string[];
          const catsY = Array.from(new Set(pairs.map(p => p.vy))).slice(0, 8) as string[];
          
          const grid: Record<string, Record<string, number>> = {};
          catsX.forEach(cx => {
            grid[cx] = {};
            catsY.forEach(cy => {
              grid[cx][cy] = 0;
            });
          });
          
          pairs.forEach(p => {
            if (grid[p.vx] && grid[p.vx][p.vy] !== undefined) {
              grid[p.vx][p.vy]++;
            }
          });
          
          const header = ['', ...catsY, 'Total'];
          const gridRows: any[] = [];
          
          catsX.forEach(cx => {
            const rowSum = catsY.reduce((sum, cy) => sum + grid[cx][cy], 0);
            gridRows.push([cx, ...catsY.map(cy => grid[cx][cy]), rowSum]);
          });
          
          const colTotals = catsY.map(cy => catsX.reduce((sum, cx) => sum + grid[cx][cy], 0));
          const grandTotal = colTotals.reduce((sum, v) => sum + v, 0);
          gridRows.push(['Total', ...colTotals, grandTotal]);
          
          const contingency_table = [header, ...gridRows];
          
          resolve({
            success: true,
            col_x,
            col_y,
            type_x: 'nominal',
            type_y: 'nominal',
            analysis_type: 'qual_qual',
            metrics: {
              contingency_table,
              top_associations_percentages: []
            },
            interpretation: `Tableau de contingence réel créé entre '${col_x}' et '${col_y}' (N = ${pairs.length}).`
          });
          return;
        } else {
          const catCol = isNumX ? col_y : col_x;
          const numCol = isNumX ? col_x : col_y;
          
          const cats = Array.from(new Set(previewData.map((row: any) => {
            const v = row[catCol];
            return v === undefined || v === null || v === '' ? 'Manquant' : String(v);
          }))).slice(0, 10) as string[];
          
          const group_means = cats.map(cat => {
            const values = previewData
              .filter((r: any) => {
                const label = r[catCol] === undefined || r[catCol] === null || r[catCol] === '' ? 'Manquant' : String(r[catCol]);
                return label === cat;
              })
              .map((r: any) => parseFloat(r[numCol]))
              .filter(v => !isNaN(v));
            
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = values.length > 0 ? parseFloat((sum / values.length).toFixed(3)) : 0;
            return { category: cat, mean, count: values.length };
          });
          
          resolve({
            success: true,
            col_x,
            col_y,
            type_x: isNumX ? 'continuous' : 'nominal',
            type_y: isNumY ? 'continuous' : 'nominal',
            analysis_type: 'qual_quant',
            metrics: {
              group_means
            },
            interpretation: `Analyse croisée de '${numCol}' (moyennes) selon les classes de '${catCol}'.`
          });
          return;
        }
      }
      
      resolve({
         success: true,
         col_x,
         col_y,
         type_x: 'nominal',
         type_y: 'nominal',
         analysis_type: 'qual_qual',
         metrics: {
           pearson_r: 0.82, 
           spearman_rho: 0.79,
           contingency_table: [
            ['', 'Cat B', 'Cat C', 'Total'],
            ['Groupe 1', 12, 5, 17],
            ['Total', 12, 5, 17]
           ],
           top_associations_percentages: []
         },
         interpretation: "Test d'indépendance avec tableau croisé généré."
      });
    }, 400);
  });
},

generate_descriptive_chart: async (chart_type: string, col_x: string, col_y?: string | null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const previewData = (window as any).__previewData || [];
      
      if (previewData.length > 0) {
        const xValues = previewData.map((row: any) => row[col_x]).filter((v: any) => v !== undefined && v !== null);
        
        if (chart_type === 'qqplot' || chart_type === 'ppplot') {
          resolve({
            success: true,
            chart: {
              data: [{
                x: [-2, -1, 0, 1, 2],
                y: [-2.1, -0.9, 0.1, 1.2, 1.9],
                type: 'scatter',
                mode: 'markers',
                marker: { color: 'rgba(99, 102, 241, 0.65)' },
                name: 'Observations'
              }, {
                x: [-2, 2],
                y: [-2, 2],
                type: 'scatter',
                mode: 'lines',
                line: { color: 'red', dash: 'dash' },
                name: 'Référence'
              }],
              layout: {
                title: chart_type === 'qqplot' ? `Q-Q Plot de ${col_x}` : `P-P Plot de ${col_x}`,
                xaxis: { title: chart_type === 'qqplot' ? 'Quantiles Théoriques' : 'Probabilités Théoriques' },
                yaxis: { title: chart_type === 'qqplot' ? 'Valeurs Observées' : 'Probabilités Empiriques' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                showlegend: false
              }
            }
          });
          return;
        }

        if (chart_type === 'histogram') {
          resolve({
            success: true,
            chart: {
              data: [{
                x: xValues.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v)),
                type: 'histogram',
                marker: { color: 'rgba(99, 102, 241, 0.65)' }
              }],
              layout: {
                title: `Distribution : ${col_x}`,
                xaxis: { title: col_x },
                yaxis: { title: 'Fréquence' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
              }
            }
          });
          return;
        }
        
        if (chart_type === 'bar') {
          const counts: Record<string, number> = {};
          xValues.forEach(v => {
            const str = String(v);
            counts[str] = (counts[str] || 0) + 1;
          });
          resolve({
            success: true,
            chart: {
              data: [{
                x: Object.keys(counts),
                y: Object.values(counts),
                type: 'bar',
                marker: { color: 'rgba(56, 189, 248, 0.75)' }
              }],
              layout: {
                title: `Frequencies de ${col_x}`,
                xaxis: { title: col_x },
                yaxis: { title: 'Fréquence' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
              }
            }
          });
          return;
        }
        
        if (chart_type === 'box') {
          if (col_y) {
            const yValues = previewData.map((row: any) => row[col_y]);
            const categories = Array.from(new Set(yValues.filter(v => v !== undefined && v !== null)));
            const data = categories.map(cat => {
              const subX = previewData
                .filter((row: any) => String(row[col_y]) === String(cat))
                .map((row: any) => {
                  const v = row[col_x];
                  return typeof v === 'number' ? v : parseFloat(v);
                })
                .filter(v => !isNaN(v));
              return {
                y: subX,
                type: 'box',
                name: String(cat)
              };
            });
            resolve({
              success: true,
              chart: {
                data,
                layout: {
                  title: `Dispersion de ${col_x} par ${col_y}`,
                  xaxis: { title: col_y },
                  yaxis: { title: col_x },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent'
                }
              }
            });
            return;
          } else {
            resolve({
              success: true,
              chart: {
                data: [{
                  y: xValues.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v)),
                  type: 'box',
                  name: col_x,
                  marker: { color: 'rgba(168, 85, 247, 0.7)' }
                }],
                layout: {
                  title: `Boîte à moustaches : ${col_x}`,
                  yaxis: { title: col_x },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent'
                }
              }
            });
            return;
          }
        }
        
        if (chart_type === 'scatter' && col_y) {
          const yValues = previewData.map((row: any) => {
            const v = row[col_y];
            return typeof v === 'number' ? v : parseFloat(v);
          }).filter(v => !isNaN(v));
          const parsedX = xValues.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
          resolve({
            success: true,
            chart: {
              data: [{
                x: parsedX,
                y: yValues,
                mode: 'markers',
                type: 'scatter',
                marker: { color: 'rgba(99, 102, 241, 0.7)', size: 8 }
              }],
              layout: {
                title: `Nuage de points : ${col_x} vs ${col_y}`,
                xaxis: { title: col_x },
                yaxis: { title: col_y },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
              }
            }
          });
          return;
        }
      }

      resolve({
         success: true,
         chart: {
           data: [{ x: [1, 2, 3], y: [4, 5, 6], type: 'scatter' }],
           layout: { title: `Graphique de ${col_x}` }
         }
      });
    }, 400);
  });
},

run_regression_analysis: async (params: any) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const type = params.regression_type || 'linear_simple';
      const target = params.target_column || 'Performance';
      const predictors = params.predictor_columns || ['Budget_R_D'];
      const firstPredictor = predictors[0] || 'Prédicteur';
      
      const isLogistic = type.startsWith('logistic');
      const isMultinomial = type === 'logistic_multinomial';
      const isMultiple = type === 'linear_multiple';
      const isSimple = type === 'linear_simple';

      // 1. COEFFICIENTS SIMULATIONS
      let coefficients: any[] = [];
      if (isMultinomial) {
        coefficients = [
          { variable: 'Constante', class: 'Moyen', reference: 'Faible', coefficient: -1.24, std_error: 0.35, statistic: -3.54, p_value: 0.0004, odds_ratio: 0.289, ci_lower: 0.145, ci_upper: 0.574, significance: '***' },
          { variable: 'Constante', class: 'Élevé', reference: 'Faible', coefficient: -2.85, std_error: 0.42, statistic: -6.78, p_value: 0.0001, odds_ratio: 0.058, ci_lower: 0.025, ci_upper: 0.132, significance: '***' },
          ...predictors.flatMap((pred) => [
            { variable: pred, class: 'Moyen', reference: 'Faible', coefficient: 0.45, std_error: 0.12, statistic: 3.75, p_value: 0.0002, odds_ratio: 1.568, ci_lower: 1.238, ci_upper: 1.986, significance: '***' },
            { variable: pred, class: 'Élevé', reference: 'Faible', coefficient: 1.15, std_error: 0.18, statistic: 6.39, p_value: 0.0001, odds_ratio: 3.158, ci_lower: 2.214, ci_upper: 4.506, significance: '***' }
          ])
        ];
      } else {
        coefficients = [
          { variable: 'Constante', coefficient: isLogistic ? -2.85 : 8.42, std_error: 0.18, statistic: isLogistic ? -15.83 : 46.77, p_value: 0.0001, odds_ratio: isLogistic ? 0.0578 : undefined, ci_lower: isLogistic ? 0.041 : 8.06, ci_upper: isLogistic ? 0.082 : 8.78, significance: '***' },
          ...predictors.map((pred: string, idx: number) => ({
            variable: pred,
            coefficient: isLogistic ? 0.065 * (idx + 1) : 1.78 * (idx + 1),
            std_error: 0.012,
            statistic: isLogistic ? 5.41 : 148.33,
            p_value: 0.0001,
            odds_ratio: isLogistic ? parseFloat(Math.exp(0.065 * (idx + 1)).toFixed(4)) : undefined,
            ci_lower: isLogistic ? parseFloat(Math.exp(0.065 * (idx + 1) - 1.96 * 0.012).toFixed(4)) : parseFloat((1.78 * (idx + 1) - 1.96 * 0.012).toFixed(4)),
            ci_upper: isLogistic ? parseFloat(Math.exp(0.065 * (idx + 1) + 1.96 * 0.012).toFixed(4)) : parseFloat((1.78 * (idx + 1) + 1.96 * 0.012).toFixed(4)),
            significance: '***'
          }))
        ];
      }

      // 2. METRICS & OTHER TABLES
      let metrics: any = {};
      let anovaTable: any = null;
      let classificationTable: any = null;
      let modelLhSummary: any = null;

      if (isLogistic) {
        metrics = isMultinomial ? {
          accuracy: 76.5,
          mac_auc: 0.842,
          aic: 198.3,
          bic: 224.6,
          pseudo_r2: 0.354,
          log_likelihood: -87.2,
          null_log_likelihood: -135.0,
          lrt_stat: 95.6,
          lrt_p: 1.2e-15,
          classes: ["Faible", "Moyen", "Élevé"],
          confusion_matrix_multi: [
            [38, 6, 4],
            [5, 42, 5],
            [6, 8, 36]
          ]
        } : {
          aic: parseFloat((145.2 + Math.random() * 5).toFixed(1)),
          bic: parseFloat((158.4 + Math.random() * 5).toFixed(1)),
          pseudo_r2: 0.462,
          log_likelihood: -66.6,
          null_log_likelihood: -123.8,
          lrt_stat: 114.4,
          lrt_p: 3.8e-24,
          accuracy: 89.3,
          sensitivity: 87.8,
          specificity: 90.7,
          auc: 0.925,
          confusion_matrix: { tn: 78, fp: 8, fn: 9, tp: 65 }
        };

        modelLhSummary = {
          log_likelihood: metrics.log_likelihood,
          null_log_likelihood: metrics.null_log_likelihood,
          lrt_stat: metrics.lrt_stat,
          lrt_p: metrics.lrt_p,
          pseudo_r2: metrics.pseudo_r2,
          aic: metrics.aic,
          bic: metrics.bic
        };

        if (!isMultinomial) {
          classificationTable = {
            tn: metrics.confusion_matrix.tn,
            fp: metrics.confusion_matrix.fp,
            fn: metrics.confusion_matrix.fn,
            tp: metrics.confusion_matrix.tp,
            sensitivity: metrics.sensitivity,
            specificity: metrics.specificity,
            precision: 89.0,
            f1_score: 88.4
          };
        }
      } else {
        metrics = {
          r_squared: isMultiple ? 0.865 : 0.814,
          r_squared_adj: isMultiple ? 0.859 : 0.809,
          residual_std_error: isMultiple ? 0.94 : 1.12,
          f_statistic: isMultiple ? 194.2 : 326.5,
          f_p_value: isMultiple ? 1.8e-34 : 4.2e-28,
          n: 150,
          p_predictors: predictors.length
        };

        const df_regr = predictors.length;
        const df_resid = 150 - df_regr - 1;
        const ss_regr = isMultiple ? 485.4 : 412.3;
        const ss_resid = isMultiple ? 113.8 : 186.9;
        
        anovaTable = {
          regression: { df: df_regr, ss: ss_regr, ms: parseFloat((ss_regr / df_regr).toFixed(2)), f: metrics.f_statistic, p: metrics.f_p_value },
          residual: { df: df_resid, ss: ss_resid, ms: parseFloat((ss_resid / df_resid).toFixed(2)) },
          total: { df: 149, ss: parseFloat((ss_regr + ss_resid).toFixed(2)) }
        };
      }

      // 3. DIAGNOSTICS & ASSUMPTIONS
      const diagnostics = isLogistic ? {
        collinearity: predictors.reduce((acc: any, p: string) => ({ ...acc, [p]: parseFloat((1.05 + Math.random() * 0.4).toFixed(3)) }), {})
      } : {
        shapiro_stat: 0.988,
        shapiro_p: 0.312,
        shapiro_status: 'Compliant (p >= 0.05)',
        dw_stat: 1.97,
        dw_status: 'No Autocorrelation (DW ~ 2.0)',
        bp_stat: 1.18,
        bp_p: 0.554,
        bp_status: 'Homoscedastic (p >= 0.05)',
        collinearity: predictors.reduce((acc: any, p: string) => ({ ...acc, [p]: parseFloat((1.05 + Math.random() * 0.4).toFixed(3)) }), {})
      };

      // 4. NATURAL LANGUAGE REPORT GENERATION
      let interpretation = `### Rapport d'Interprétation Statistique Nuru \n\n` +
        `**Type de Modèle :** ${isMultinomial ? "Régression Logistique Multinomiale" : isLogistic ? "Régression Logistique Binaire" : isMultiple ? "Régression Linéaire Multiple" : "Régression Linéaire Simple"}\n\n` +
        `#### 1. Validité Globale et Ajustement du Modèle\n`;

      if (isMultinomial) {
        interpretation += `Le modèle multinomial mis en place pour expliquer la variable nominale **${target}** est statistiquement hautement significatif d'après le test du rapport de vraisemblance (LRT = 95.6, p < 0.001).\n` +
          `Le Pseudo-R² de McFadden de d'environ **${Math.round(metrics.pseudo_r2 * 100)}%** démontre une force d'association satisfaisante pour des données qualitatives.\n` +
          `L'exactitude (Accuracy) globale de classification s'élève à **${metrics.accuracy}%**, classifant convenablement la majorité des profils observés à travers les 3 classes ("Faible", "Moyen", "Élevé").`;
      } else if (isLogistic) {
        interpretation += `Le modèle de régression logistique binaire mis en place pour expliquer la variable qualitative **${target}** est hautement significatif d'après le test de rapport de vraisemblance (LRT = 114.40, p < 0.001).\n` +
          `Le Pseudo R² de McFadden est de **${Math.round(metrics.pseudo_r2 * 100)}%**, indiquant un excellent pouvoir prédictif. L'exactitude globale (Accuracy) de classification est de **${metrics.accuracy}%**, avec une sensibilité de **${metrics.sensitivity}%** (taux de vrais positifs capturés) et une spécificité de **${metrics.specificity}%**.\n` +
          `L'Aire sous la courbe ROC (AUC) s'élève à **${metrics.auc}**, ce qui correspond à un pouvoir discriminant exceptionnellement robuste.`;
      } else {
        interpretation += `Le modèle explique **${Math.round(metrics.r_squared * 100)}%** de la variance globale de la variable numérique **${target}** (R² ajusté = ${Math.round(metrics.r_squared_adj * 100)}%).\n` +
          `L'analyse de variance globale (F = ${metrics.f_statistic}, p < 0.001) garantit de manière formelle que les prédicteurs apportent un gain d'information déterminant pour appréhender ${target}.\n` +
          `L'écart-type résiduel (RSE = ${metrics.residual_std_error}) stipule l'écart type moyen observé entre nos valeurs réelles et ajustées.`;
      }

      interpretation += `\n\n#### 2. Analyse des Coefficients de Régression\n`;
      if (isMultinomial) {
        interpretation += `Le modèle Multinomial calibre des coefficients par rapport à la catégorie de référence **Faible** :\n` +
          `* **Pour la classe Moyen (vs Faible) :**\n` +
          `  * L'Odds Ratio de **Budget_R_D** est de **1.568**. Un incrément unitaire augmente les odds d'appartenir au groupe Moyen plutôt que Faible de **56.8%**.\n` +
          `* **Pour la classe Élevé (vs Faible) :**\n` +
          `  * L'Odds Ratio de **Budget_R_D** est de **3.158**. Un budget plus important multiplie par plus de 3 les odds de basculer dans le groupe de performance Élevé par rapport à Faible.`;
      } else {
        coefficients.filter(c => c.variable !== 'Constante').forEach(c => {
          interpretation += `* **${c.variable}** : Le coefficient est de **${c.coefficient}** (p < 0.001). ` +
            (isLogistic 
              ? `L'Odds Ratio associé est de **${c.odds_ratio}** (IC à 95% : [${c.ci_lower} ; ${c.ci_upper}]). Un incrément d'une unité de **${c.variable}** multiplie les odds de réussite de l'événement cible par **${c.odds_ratio}**.`
              : `Pour chaque augmentation d'une unité de **${c.variable}**, la variable cible **${target}** augmente en moyenne de **${c.coefficient}** unités.`
            ) + `\n`;
        });
      }

      interpretation += `\n\n#### 3. Validation des Hypothèses Fondamentales (Diagnostics)\n` +
        (isLogistic
          ? `* **Colinéarité (VIF) :** Tous les facteurs d'inflation de la variance sont inférieurs à 2.0, excluant tout problème de multicolinéarité.\n` +
            `* **Spécification du Lien :** Le pouvoir discriminant robuste suggère que la fonction de lien Logit est parfaitement spécifiée.`
          : `* **Normalité des résidus :** Le test de Shapiro-Wilk (p = 0.312 >= 0.05) confirme que les résidus suivent de manière satisfaisante une distribution normale.\n` +
            `* **Autocorrélation :** L'indice Durbin-Watson de 1.97 est très proche de 2.0, excluant toute corrélation d'ordre 1 entre les résidus.\n` +
            `* **Homoscédasticité :** Le test de Breusch-Pagan (p = 0.554) valide l'hypothèse d'homoscédasticité (variance constante des erreurs).\n` +
            `* **Multicolinéarité (VIF) :** Toutes les variables indépendantes présentent des VIF inférieurs à 2.0, garantissant la stabilité des coefficients.`
        ) + `\n\n` +
        `**Recommandation Stratégique d'Experts :** Au vu des résultats, nous suggérons d'optimiser la valeur ou la gestion de **${predictors.join(', ')}** afin de maximiser les réponses théoriques positives sur **${target}**.`;

      // 5. CHART DOCK (plotly structures)
      let chart: any = null;
      let roc_chart: any = null;
      let actual_vs_predicted: any = null;
      let residuals_vs_fitted: any = null;
      let residuals_hist: any = null;
      let qq_plot: any = null;
      let prob_density: any = null;

      if (isLogistic) {
        if (isMultinomial) {
          const curve_x: number[] = [];
          const prob_faible: number[] = [];
          const prob_moyen: number[] = [];
          const prob_eleve: number[] = [];
          
          for (let x = 10; x <= 90; x += 3) {
            curve_x.push(x);
            const score_moyen = -1.24 + 0.045 * x;
            const score_eleve = -2.85 + 0.09 * x;
            const eth_faible = 1.0;
            const eth_moyen = Math.exp(score_moyen);
            const eth_eleve = Math.exp(score_eleve);
            const total = eth_faible + eth_moyen + eth_eleve;
            
            prob_faible.push(parseFloat((eth_faible / total).toFixed(3)));
            prob_moyen.push(parseFloat((eth_moyen / total).toFixed(3)));
            prob_eleve.push(parseFloat((eth_eleve / total).toFixed(3)));
          }

          chart = {
            data: [
              { x: curve_x, y: prob_faible, mode: 'lines', type: 'scatter', name: 'Probabilité "Faible"', line: { color: '#ef4444', width: 2.5 } },
              { x: curve_x, y: prob_moyen, mode: 'lines', type: 'scatter', name: 'Probabilité "Moyen"', line: { color: '#f59e0b', width: 2.5 } },
              { x: curve_x, y: prob_eleve, mode: 'lines', type: 'scatter', name: 'Probabilité "Élevé"', line: { color: '#10b981', width: 2.5 } }
            ],
            layout: {
              title: `Courbe de Probabilités Multinomiales : ${target}`,
              xaxis: { title: `${firstPredictor} (X)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              yaxis: { title: 'Probabilité Prédite de Classe', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)', range: [-0.05, 1.05] },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent'
            }
          };

          roc_chart = {
            data: [
              { x: [0, 0.05, 0.15, 0.32, 0.55, 1.0], y: [0, 0.42, 0.76, 0.88, 0.95, 1.0], mode: 'lines', type: 'scatter', name: 'Faible vs Reste (AUC = 0.812)', line: { color: '#ef4444', width: 2.5 } },
              { x: [0, 0.08, 0.20, 0.42, 0.65, 1.0], y: [0, 0.35, 0.68, 0.82, 0.91, 1.0], mode: 'lines', type: 'scatter', name: 'Moyen vs Reste (AUC = 0.794)', line: { color: '#f59e0b', width: 2.5 } },
              { x: [0, 0.02, 0.06, 0.15, 0.35, 1.0], y: [0, 0.55, 0.84, 0.92, 0.97, 1.0], mode: 'lines', type: 'scatter', name: 'Élevé vs Reste (AUC = 0.871)', line: { color: '#10b981', width: 2.5 } },
              { x: [0, 1], y: [0, 1], mode: 'lines', type: 'scatter', name: 'Référence aléatoire (AUC = 0.5)', line: { color: '#cbd5e1', width: 1.5, dash: 'dash' } }
            ],
            layout: {
              title: 'Sensibilité vs Coop : Courbe ROC Multi-classe (OVR)',
              xaxis: { title: 'Taux de Faux Positifs (1 - Spécificité)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              yaxis: { title: 'Taux de Vrais Positifs (Sensibilité)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent'
            }
          };
        } else {
          const scatter_x: number[] = [];
          const scatter_y: number[] = [];
          for (let i = 0; i < 25; i++) {
            scatter_x.push(Math.round(15 + Math.random() * 45));
            scatter_y.push(0);
          }
          for (let i = 0; i < 25; i++) {
            scatter_x.push(Math.round(40 + Math.random() * 45));
            scatter_y.push(1);
          }
          const curve_x: number[] = [];
          const curve_y: number[] = [];
          for (let x_val = 15; x_val <= 85; x_val += 2) {
            curve_x.push(x_val);
            const z = 0.12 * (x_val - 45);
            curve_y.push(parseFloat((1 / (1 + Math.exp(-z))).toFixed(3)));
          }

          chart = {
            data: [
              { x: scatter_x, y: scatter_y, mode: 'markers', type: 'scatter', name: 'Observations réelles', marker: { color: 'rgba(99, 102, 241, 0.65)', size: 9, line: { color: '#4f46e5', width: 1 } } },
              { x: curve_x, y: curve_y, mode: 'lines', type: 'scatter', name: 'Probabilité Logistique Ajustée', line: { color: '#10b981', width: 3 } }
            ],
            layout: {
              title: `Régression Logistique : Probabilité de réussite de ${target}`,
              xaxis: { title: `${firstPredictor} (X)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              yaxis: { title: `Probabilité de succès Y=1`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)', range: [-0.1, 1.1] },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent'
            }
          };

          roc_chart = {
            data: [
              { x: [0, 0.02, 0.05, 0.08, 0.12, 0.22, 0.45, 0.8, 1.0], y: [0, 0.45, 0.72, 0.84, 0.89, 0.94, 0.97, 0.99, 1.0], mode: 'lines', type: 'scatter', name: 'Courbe ROC (AUC = 0.925)', line: { color: '#6366f1', width: 3 } },
              { x: [0, 1], y: [0, 1], mode: 'lines', type: 'scatter', name: 'Référence aléatoire (AUC = 0.5)', line: { color: '#cbd5e1', width: 1.5, dash: 'dash' } }
            ],
            layout: {
              title: 'Pouvoir Discriminant : Courbe ROC',
              xaxis: { title: 'Taux de Faux Positifs (1 - Spécificité)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              yaxis: { title: 'Taux de Vrais Positifs (Sensibilité)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent'
            }
          };
        }

        prob_density = {
          data: [
            {
              x: Array.from({ length: 30 }, () => parseFloat((Math.random() * 0.4 + 0.1).toFixed(3))),
              type: 'histogram',
              name: 'Individus négatifs Réels',
              opacity: 0.6,
              marker: { color: '#ef4444' }
            },
            {
              x: Array.from({ length: 30 }, () => parseFloat((Math.random() * 0.4 + 0.52).toFixed(3))),
              type: 'histogram',
              name: 'Individus positifs Réels',
              opacity: 0.6,
              marker: { color: '#10b981' }
            }
          ],
          layout: {
            title: 'Distribution des Probabilités Prédites',
            xaxis: { title: 'Probabilité Prédite de Succès P(Y=1)' },
            yaxis: { title: 'Nombre de cas' },
            barmode: 'overlay',
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };

      } else {
        const scatter_x: number[] = [];
        const scatter_y: number[] = [];
        const fit_x: number[] = [];
        const fit_y: number[] = [];

        const b0 = 12.5;
        const b1 = 1.34;
        
        for (let i = 0; i < 50; i++) {
          const x_val = Math.round(10 + i * 1.6 + (Math.random() * 6 - 3));
          const eps = (Math.random() * 12 - 6);
          const y_val = parseFloat((b0 + b1 * x_val + eps).toFixed(2));
          scatter_x.push(x_val);
          scatter_y.push(y_val);
        }

        const minX = Math.min(...scatter_x);
        const maxX = Math.max(...scatter_x);
        fit_x.push(minX, maxX);
        fit_y.push(parseFloat((b0 + b1 * minX).toFixed(2)), parseFloat((b0 + b1 * maxX).toFixed(2)));

        chart = {
          data: [
            { x: scatter_x, y: scatter_y, mode: 'markers', type: 'scatter', name: 'Observations réelles', marker: { color: 'rgba(99, 102, 241, 0.65)', size: 9, line: { color: '#4f46e5', width: 1 } } },
            { x: fit_x, y: fit_y, mode: 'lines', type: 'scatter', name: `Droite d'ajustement (R² = ${metrics.r_squared})`, line: { color: '#10b981', width: 3 } }
          ],
          layout: {
            title: `Ajustement Linéaire : ${target} vs ${firstPredictor}`,
            xaxis: { title: `${firstPredictor} (X)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            yaxis: { title: `${target} (Y)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };

        const predicted_y = scatter_y.map(y => parseFloat((y + (Math.random() * 2 - 1)).toFixed(2)));
        const minY = Math.min(...scatter_y);
        const maxY = Math.max(...scatter_y);

        actual_vs_predicted = {
          data: [
            { x: predicted_y, y: scatter_y, mode: 'markers', type: 'scatter', name: 'Observations', marker: { color: 'rgba(124, 58, 237, 0.65)', size: 8 } },
            { x: [minY, maxY], y: [minY, maxY], mode: 'lines', type: 'scatter', name: 'Ligne d\'ajustement idéal (Y = Y_prédit)', line: { color: '#f59e0b', width: 2, dash: 'dash' } }
          ],
          layout: {
            title: 'Valeurs Réelles vs Valeurs Prédites',
            xaxis: { title: 'Valeurs Prédites (Ajustées)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            yaxis: { title: 'Valeurs Réelles (Observées)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };

        const residuals = scatter_y.map((y, idx) => parseFloat((y - predicted_y[idx]).toFixed(2)));
        residuals_vs_fitted = {
          data: [
            { x: predicted_y, y: residuals, mode: 'markers', type: 'scatter', name: 'Résidus', marker: { color: 'rgba(244, 63, 94, 0.6)', size: 8 } },
            { x: [minY, maxY], y: [0, 0], mode: 'lines', type: 'scatter', name: 'Zéro de référence', line: { color: '#455a64', width: 2 } }
          ],
          layout: {
            title: 'Analyse des Résidus vs Valeurs Ajustées',
            xaxis: { title: 'Valeurs Ajustées (Prédites)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            yaxis: { title: 'Résidus (Erreurs de prédiction)', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };

        residuals_hist = {
          data: [
            { x: residuals, type: 'histogram', name: 'Fréquence des Résidus', marker: { color: 'rgba(99, 102, 241, 0.6)' } }
          ],
          layout: {
            title: 'Distribution de l\'erreur résiduelle',
            xaxis: { title: 'Espérance des résidus' },
            yaxis: { title: 'Nombre d\'occurrences' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };

        const sortedResid = [...residuals].sort((a, b) => a - b);
        const theoreticalQuantiles: number[] = [];
        const n_val = sortedResid.length;
        for (let i = 1; i <= n_val; i++) {
          const p = (i - 0.5) / n_val;
          const q = Math.sqrt(2) * Math.min(Math.max(statisticsInverseErf(2 * p - 1), -3.0), 3.0);
          theoreticalQuantiles.push(parseFloat(q.toFixed(3)));
        }

        qq_plot = {
          data: [
            { x: theoreticalQuantiles, y: sortedResid, mode: 'markers', type: 'scatter', name: 'Écarts résiduels', marker: { color: '#0ea5e9', size: 8 } },
            { x: [-2.5, 2.5], y: [-3.5, 3.5], mode: 'lines', type: 'scatter', name: 'Première bissectrice Q-Q', line: { color: '#ec4899', width: 2 } }
          ],
          layout: {
            title: 'Graphe de Probabilité Normale (Q-Q Plot)',
            xaxis: { title: 'Quantiles Théoriques', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            yaxis: { title: 'Résidus Triés / Standardisés', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent'
          }
        };
      }

      resolve({
        success: true,
        regression_type: type,
        metrics,
        coefficients,
        diagnostics,
        interpretation,
        chart,
        roc_chart,
        actual_vs_predicted,
        residuals_vs_fitted,
        residuals_hist,
        qq_plot,
        prob_density,
        anova_table: anovaTable,
        classification_table: classificationTable,
        model_lh_summary: modelLhSummary,
        variables: [target, ...predictors]
      });
    }, 450);
  });
},
run_multivariate_analysis: async (params: any) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const type = params.analysis_type || 'acp';
        const cols = params.columns || ['Variable 1', 'Variable 2', 'Variable 3'];

        if (type === 'acp') {
          const previewData = (window as any).__previewData || [];
          const scale_data = params.scale_data !== false;
          
          if (previewData.length >= 3 && cols.length >= 2) {
            try {
              // 1. Complete Cases (filtering out NaN or non-numeric rows)
              const validRows = previewData.filter((row: any) => {
                return cols.every(col => {
                  const v = row[col];
                  const num = typeof v === 'number' ? v : parseFloat(v);
                  return v !== undefined && v !== null && !isNaN(num);
                });
              });

              if (validRows.length < 3) {
                resolve({
                  success: false,
                  error: "Données insuffisantes après suppression des valeurs manquantes (au moins 3 lignes requises)."
                });
                return;
              }

              const n = validRows.length;
              const p = cols.length;

              // 2. Compute mean & standard deviation (population std dev)
              const means = cols.map(col => {
                const sum = validRows.reduce((acc, row) => acc + (typeof row[col] === 'number' ? row[col] : parseFloat(row[col])), 0);
                return sum / n;
              });

              const stds = cols.map((col, j) => {
                const mean = means[j];
                const variance = validRows.reduce((acc, row) => {
                  const val = typeof row[col] === 'number' ? row[col] : parseFloat(row[col]);
                  return acc + Math.pow(val - mean, 2);
                }, 0);
                return Math.sqrt(variance / n);
              });

              // Check for zero variance
              const zeroVarCols: string[] = [];
              stds.forEach((v, idx) => {
                if (v === 0) zeroVarCols.push(cols[idx]);
              });
              if (zeroVarCols.length > 0) {
                resolve({
                  success: false,
                  error: `Les variables suivantes ont une variance nulle : ${zeroVarCols.join(', ')}. Veuillez les retirer.`
                });
                return;
              }

              // 3. Construct centered and scaled matrix
              const X_scaled = validRows.map(row => {
                return cols.map((col, j) => {
                  const val = typeof row[col] === 'number' ? row[col] : parseFloat(row[col]);
                  return (val - means[j]) / (scale_data ? (stds[j] || 1e-15) : 1);
                });
              });

              // 4. Compute correlation/covariance matrix R of size p x p
              const R: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
              for (let j = 0; j < p; j++) {
                for (let k = 0; k < p; k++) {
                  let sum = 0;
                  for (let i = 0; i < n; i++) {
                    sum += X_scaled[i][j] * X_scaled[i][k];
                  }
                  R[j][k] = sum / n;
                }
              }

              // 5. Symmetric Jacobi Diagonalization algorithm
              const jacobiDiagonalize = (matrix: number[][], tolerance: number = 1e-10, maxIterations: number = 150) => {
                const size = matrix.length;
                const d = Array.from({ length: size }, (_, i) => matrix[i][i]);
                const v: number[][] = Array.from({ length: size }, (_, i) =>
                  Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
                );

                let iter = 0;
                while (iter < maxIterations) {
                  let maxVal = 0;
                  let pIdx = 0;
                  let qIdx = 0;
                  for (let i = 0; i < size - 1; i++) {
                    for (let j = i + 1; j < size; j++) {
                      if (Math.abs(matrix[i][j]) > maxVal) {
                        maxVal = Math.abs(matrix[i][j]);
                        pIdx = i;
                        qIdx = j;
                      }
                    }
                  }

                  if (maxVal < tolerance) {
                    break;
                  }

                  const app = matrix[pIdx][pIdx];
                  const aqq = matrix[qIdx][qIdx];
                  const apq = matrix[pIdx][qIdx];
                  const phi = (aqq - app) / (2 * apq);
                  let t = 0;
                  if (phi >= 0) {
                    t = 1.0 / (phi + Math.sqrt(1.0 + phi * phi));
                  } else {
                    t = -1.0 / (-phi + Math.sqrt(1.0 + phi * phi));
                  }
                  const c = 1.0 / Math.sqrt(1.0 + t * t);
                  const s = t * c;

                  matrix[pIdx][pIdx] = app - t * apq;
                  matrix[qIdx][qIdx] = aqq + t * apq;
                  matrix[pIdx][qIdx] = 0;
                  matrix[qIdx][pIdx] = 0;

                  for (let i = 0; i < size; i++) {
                    if (i !== pIdx && i !== qIdx) {
                      const aip = matrix[i][pIdx];
                      const aiq = matrix[i][qIdx];
                      matrix[i][pIdx] = c * aip - s * aiq;
                      matrix[pIdx][i] = matrix[i][pIdx];
                      matrix[i][qIdx] = s * aip + c * aiq;
                      matrix[qIdx][i] = matrix[i][qIdx];
                    }
                  }

                  for (let i = 0; i < size; i++) {
                    const vip = v[i][pIdx];
                    const viq = v[i][qIdx];
                    v[i][pIdx] = c * vip - s * viq;
                    v[i][qIdx] = s * vip + c * viq;
                  }

                  for (let i = 0; i < size; i++) {
                    d[i] = matrix[i][i];
                  }
                  iter++;
                }

                return { eigenvalues: d, eigenvectors: v };
              };

              // 6. Sort and match eigenpairs (largest to smallest)
              const { eigenvalues: eigenValuesRaw, eigenvectors: eigenVectorsRaw } = jacobiDiagonalize(R);
              const eigenPairs = eigenValuesRaw.map((val, idx) => ({
                value: Math.max(0, val),
                vector: eigenVectorsRaw.map(row => row[idx])
              }));
              eigenPairs.sort((a, b) => b.value - a.value);

              const total_variance = eigenPairs.reduce((acc, p) => acc + p.value, 0) || p;
              let cum_inertia = 0;
              const eigenvaluesTable = eigenPairs.map((pair, idx) => {
                const inertia = total_variance > 0 ? (pair.value / total_variance) * 100 : 0;
                cum_inertia += inertia;
                return {
                  axis: `Axe ${idx + 1}`,
                  eigenvalue: pair.value,
                  inertia: inertia,
                  cum_inertia: Math.min(100, cum_inertia)
                };
              });

              const numAxes = Math.min(p, n, 5);

              // 7. Compute Individual coordinates (F = X_scaled * V)
              const ind_coords: number[][] = Array.from({ length: n }, () => Array(numAxes).fill(0));
              for (let i = 0; i < n; i++) {
                for (let a = 0; a < numAxes; a++) {
                  let sum = 0;
                  for (let j = 0; j < p; j++) {
                    sum += X_scaled[i][j] * eigenPairs[a].vector[j];
                  }
                  ind_coords[i][a] = sum;
                }
              }

              // Individual contributions (ctr)
              const ind_ctr: number[][] = Array.from({ length: n }, () => Array(numAxes).fill(0));
              for (let a = 0; a < numAxes; a++) {
                const val = eigenPairs[a].value;
                const denom = n * val;
                for (let i = 0; i < n; i++) {
                  ind_ctr[i][a] = denom > 0 ? (Math.pow(ind_coords[i][a], 2) / denom) * 100 : 0;
                }
              }

              // Individual quality of representation (cos2)
              const ind_cos2: number[][] = Array.from({ length: n }, () => Array(numAxes).fill(0));
              for (let i = 0; i < n; i++) {
                let dist2 = 0;
                for (let j = 0; j < p; j++) {
                  dist2 += Math.pow(X_scaled[i][j], 2);
                }
                for (let a = 0; a < numAxes; a++) {
                  ind_cos2[i][a] = dist2 > 0 ? Math.pow(ind_coords[i][a], 2) / dist2 : 0;
                }
              }

              // 8. Variable coordinates (correlations with axes G = V * sqrt(eigenvalues))
              const var_coords: number[][] = Array.from({ length: p }, () => Array(numAxes).fill(0));
              for (let j = 0; j < p; j++) {
                for (let a = 0; a < numAxes; a++) {
                  var_coords[j][a] = eigenPairs[a].vector[j] * Math.sqrt(eigenPairs[a].value);
                }
              }

              // Variable contributions (ctr)
              const var_ctr: number[][] = Array.from({ length: p }, () => Array(numAxes).fill(0));
              for (let j = 0; j < p; j++) {
                for (let a = 0; a < numAxes; a++) {
                  var_ctr[j][a] = Math.pow(eigenPairs[a].vector[j], 2) * 100;
                }
              }

              // Variable quality of representation (cos2)
              const var_cos2: number[][] = Array.from({ length: p }, () => Array(numAxes).fill(0));
              for (let j = 0; j < p; j++) {
                for (let a = 0; a < numAxes; a++) {
                  var_cos2[j][a] = Math.pow(var_coords[j][a], 2);
                }
              }

              // 9. Map observations names inside the list
              const firstRowKeys = Object.keys(validRows[0]);
              const labelColCandidate = firstRowKeys.find(key => {
                const kLower = key.toLowerCase();
                return kLower === 'nom' || kLower === 'name' || kLower === 'id' || kLower === 'label' || kLower === 'libellé' || kLower === 'identifier';
              });
              const indLabels = validRows.map((row, i) => {
                if (labelColCandidate && row[labelColCandidate] !== undefined && row[labelColCandidate] !== null) {
                  return String(row[labelColCandidate]);
                }
                return String(row.label || row.id || `Obs ${i + 1}`);
              });

              const ind_list = validRows.map((_, i) => ({
                label: indLabels[i],
                coords: ind_coords[i],
                ctr: ind_ctr[i],
                cos2: ind_cos2[i]
              }));

              const var_list = cols.map((col, idx) => ({
                name: col,
                coords: var_coords[idx],
                ctr: var_ctr[idx],
                cos2: var_cos2[idx]
              }));

              // 10. Generate Plotly configurations
              const scree_chart = {
                data: [
                  {
                    x: eigenPairs.map((_, idx) => `F${idx + 1}`),
                    y: eigenvaluesTable.map(row => row.inertia),
                    type: 'bar',
                    name: 'Inertie individuelle',
                    marker: { color: '#4f46e5' }
                  },
                  {
                    x: eigenPairs.map((_, idx) => `F${idx + 1}`),
                    y: eigenvaluesTable.map(row => row.cum_inertia),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Inertie cumulée',
                    line: { color: '#db2777', width: 3 }
                  }
                ],
                layout: {
                  title: 'Éboulis des valeurs propres (Inerties explicatives)',
                  xaxis: { title: 'Composantes factorielles', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  yaxis: { title: "Pourcentage d'inertie (%)", showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#334155' }
                }
              };

              const thetaCircle = Array.from({ length: 101 }, (_, t) => (t * 2 * Math.PI) / 100);
              const circle_chart = {
                data: [
                  {
                    x: thetaCircle.map(t => Math.cos(t)),
                    y: thetaCircle.map(t => Math.sin(t)),
                    mode: 'lines',
                    name: 'Cercle unitaire',
                    line: { color: '#cbd5e1', dash: 'dash' },
                    showlegend: false
                  },
                  ...cols.map((name, j) => {
                    const vx = var_coords[j][0] || 0;
                    const vy = numAxes > 1 ? (var_coords[j][1] || 0) : 0;
                    return {
                      x: [0, vx],
                      y: [0, vy],
                      mode: 'lines+markers+text',
                      text: ['', name],
                      textposition: 'top right',
                      name: name,
                      line: { width: 2.5, color: '#4f46e5' },
                      marker: { size: 6 }
                    };
                  })
                ],
                layout: {
                  title: 'Cercle des corrélations (F1 & F2)',
                  xaxis: { title: 'Facteur F1', range: [-1.1, 1.1], constrain: 'domain', showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  yaxis: { title: 'Facteur F2', range: [-1.1, 1.1], scaleanchor: 'x', scaleratio: 1, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#334155' }
                }
              };

              // Make individuals graph with neat centers and borders
              const min_x_ind = Math.min(...ind_coords.map(c => c[0]));
              const max_x_ind = Math.max(...ind_coords.map(c => c[0]));
              const min_y_ind = Math.min(...ind_coords.map(c => numAxes > 1 ? c[1] : 0));
              const max_y_ind = Math.max(...ind_coords.map(c => numAxes > 1 ? c[1] : 0));

              const ind_chart = {
                data: [
                  {
                    x: ind_coords.map(c => c[0]),
                    y: ind_coords.map(c => numAxes > 1 ? c[1] : 0),
                    mode: 'markers+text',
                    text: indLabels,
                    textposition: 'top center',
                    marker: { color: '#06b6d4', size: 8, line: { color: '#0891b2', width: 1 } },
                    name: 'Individus'
                  }
                ],
                layout: {
                  title: 'Cartographie des Individus (F1 & F2)',
                  xaxis: { title: `Facteur F1 (${(eigenvaluesTable[0]?.inertia || 0).toFixed(1)}%)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  yaxis: { title: `Facteur F2 (${numAxes > 1 ? (eigenvaluesTable[1]?.inertia || 0).toFixed(1) : 0}%)`, showgrid: true, gridcolor: 'rgba(226, 232, 240, 0.6)' },
                  shapes: [
                    { type: 'line', x0: min_x_ind - 0.5, x1: max_x_ind + 0.5, y0: 0, y1: 0, line: { color: 'rgba(148,163,184,0.4)', width: 1, dash: 'dash' } },
                    { type: 'line', x0: 0, x1: 0, y0: min_y_ind - 0.5, y1: max_y_ind + 0.5, line: { color: 'rgba(148,163,184,0.4)', width: 1, dash: 'dash' } }
                  ],
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#334155' }
                }
              };

              // 11. Descriptive Statistics on active cols
              const descriptive_stats = cols.map((col, j) => {
                const vals = validRows.map(row => typeof row[col] === 'number' ? row[col] : parseFloat(row[col])).sort((a,b) => a-b);
                const min = vals[0];
                const max = vals[vals.length - 1];
                const sum = vals.reduce((acc, v) => acc + v, 0);
                const mean = sum / n;
                const median = vals.length % 2 === 0 ? (vals[vals.length/2 - 1] + vals[vals.length/2]) / 2 : vals[Math.floor(vals.length/2)];
                const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
                const std = Math.sqrt(variance / (n - 1 || 1));
                return {
                  variable: col,
                  n: n,
                  mean: mean,
                  std: std,
                  min: min,
                  median: median,
                  max: max
                };
              });

              // 12. Dynamic scientific interpretation
              const kaiser_axes = eigenvaluesTable.filter(e => e.eigenvalue > 1.0).length;
              
              const f1Corrs = var_coords.map((v, idx) => ({ name: cols[idx], val: v[0] }));
              let bestF1Idx = 0;
              let bestF1Max = 0;
              f1Corrs.forEach((item, idx) => {
                if (Math.abs(item.val) > bestF1Max) {
                  bestF1Max = Math.abs(item.val);
                  bestF1Idx = idx;
                }
              });
              const bestF1Var = f1Corrs[bestF1Idx];

              let f2Interpretation = "";
              if (numAxes > 1) {
                const f2Corrs = var_coords.map((v, idx) => ({ name: cols[idx], val: v[1] }));
                let bestF2Idx = 0;
                let bestF2Max = 0;
                f2Corrs.forEach((item, idx) => {
                  if (Math.abs(item.val) > bestF2Max) {
                    bestF2Max = Math.abs(item.val);
                    bestF2Idx = idx;
                  }
                });
                const bestF2Var = f2Corrs[bestF2Idx];
                f2Interpretation = `\n- **Axe F2 :** Principalement structuré par la variable **${bestF2Var.name}** (corrélation de ${bestF2Var.val.toFixed(3)}).`;
              }

              const extremeIndIdx = ind_coords.map((c, idx) => ({ idx, val: c[0] }))
                                        .reduce((extreme, curr) => Math.abs(curr.val) > Math.abs(extreme.val) ? curr : extreme, { idx: 0, val: 0 }).idx;
              const extremeIndLabel = indLabels[extremeIndIdx];

              const interpretation = `### Rapport d'Interprétation de l'Analyse en Composantes Principales (ACP)

Analyse réalisée sur **${n} observations** et **${p} variables quantitatives**.

#### 1. Part d'Inertie Explicative & Valeurs Propres
- Le premier axe factoriel (**F1**) explique **${(eigenvaluesTable[0]?.inertia || 0).toFixed(2)}%** de la variance totale.
- Le second axe factoriel (**F2**) explique **${(eigenvaluesTable[1]?.inertia || 0).toFixed(2)}%** de la variance.
- Ensemble, les deux premiers axes représentent un cumul de **${(eigenvaluesTable[Math.min(1, numAxes - 1)]?.cum_inertia || eigenvaluesTable[0]?.cum_inertia || 0).toFixed(2)}%** de l'information totale.

${kaiser_axes > 0 ? `🟢 **Règle de Kaiser :** ${kaiser_axes} composante(s) ont une valeur propre supérieure à 1,0. Ce sont les axes structurants du jeu de données.` : `⚠️ **Variance diffuse :** Aucune composante ne dépasse la valeur propre de 1,0.`}

#### 2. Corrélation des Variables (Cercle des corrélations)
Le cercle des corrélations permet d'analyser la liaison entre les variables initiales et les axes factoriels :
- **Axe F1 :** Principalement structuré par la variable **${bestF1Var.name}** (corrélation de ${bestF1Var.val.toFixed(3)}).${f2Interpretation}

#### 3. Analyse des individus (Graphique des individus)
- **Individu atypique :** L'observation **${extremeIndLabel}** se détache le plus sur l'axe F1 (coordonnée de ${ind_coords[extremeIndIdx][0].toFixed(3)}). Cela révèle un profil discriminant majeur que l'on peut qualifier de pôle structurant du jeu de données.`;

              resolve({
                success: true,
                analysis_type: 'acp',
                n,
                p,
                eigenvalues: eigenvaluesTable,
                individuals: ind_list,
                variables: var_list,
                scree_chart,
                circle_chart,
                ind_chart,
                descriptive_stats,
                interpretation
              });
              return;

            } catch (err: any) {
              console.warn("Calculating real math ACP failed:", err);
            }
          }

          // Fallback to high-quality generated dummy if no/insufficient previewData available
          const fallbackDataLength = 30;
          const randomInds = Array.from({ length: fallbackDataLength }).map((_, i) => ({
            label: `Individu ${i + 1}`,
            coords: [Math.random() * 4 - 2, Math.random() * 3 - 1.5, Math.random() * 2 - 1],
            ctr: [Math.random() * 5, Math.random() * 5, Math.random() * 5],
            cos2: [Math.random() * 0.8, Math.random() * 0.5, Math.random() * 0.2]
          }));

          const randomVars = cols.map((name, i) => ({
            name,
            coords: [0.7 - i * 0.2 + Math.random() * 0.15, -0.5 + i * 0.3, 0.2 - i * 0.1],
            ctr: [25 + i * 5, 20 - i * 5, 15 + i * 2],
            cos2: [0.6, 0.3, 0.1]
          }));

          const fallbackScree = {
            data: [
              { x: ['F1', 'F2', 'F3', 'F4'], y: [53.5, 28.0, 13.5, 5.0], type: 'bar', name: 'Inertie', marker: { color: '#4f46e5' } },
              { x: ['F1', 'F2', 'F3', 'F4'], y: [53.5, 81.5, 95.0, 100.0], type: 'scatter', mode: 'lines+markers', name: 'Cumul', line: { color: '#db2777', width: 3 } }
            ],
            layout: { title: 'Éboulis des valeurs propres (ACP - Simulée)', paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
          };

          const fallbackCircle = {
            data: [
              {
                x: Array.from({ length: 100 }).map((_, t) => Math.cos((t * 2 * Math.PI) / 100)),
                y: Array.from({ length: 100 }).map((_, t) => Math.sin((t * 2 * Math.PI) / 100)),
                mode: 'lines',
                line: { color: '#cbd5e1', dash: 'dash' },
                showlegend: false
              },
              ...cols.map((name, i) => ({
                x: [0, 0.7 - i * 0.2],
                y: [0, -0.5 + i * 0.35],
                mode: 'lines+markers+text',
                text: ['', name],
                textposition: 'top right',
                name,
                line: { width: 2, color: '#4f46e5' },
                marker: { size: 6 }
              }))
            ],
            layout: {
              title: 'Cercle des corrélations (F1 & F2 - Simulé)',
              xaxis: { range: [-1.1, 1.1] },
              yaxis: { range: [-1.1, 1.1], scaleanchor: 'x', scaleratio: 1 },
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' }
            }
          };

          const fallbackInd = {
            data: [
              {
                x: randomInds.map(ind => ind.coords[0]),
                y: randomInds.map(ind => ind.coords[1]),
                mode: 'markers+text',
                text: randomInds.map(ind => ind.label),
                marker: { color: '#06b6d4', size: 8 },
                name: 'Individus'
              }
            ],
            layout: { title: 'Projection des Individus (F1 & F2 - Simulé)', paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
          };

          resolve({
            success: true,
            analysis_type: 'acp',
            n: fallbackDataLength,
            p: cols.length,
            eigenvalues: [
              { axis: 'Axe F1', eigenvalue: 2.14, inertia: 53.5, cum_inertia: 53.5 },
              { axis: 'Axe F2', eigenvalue: 1.12, inertia: 28.0, cum_inertia: 81.5 },
              { axis: 'Axe F3', eigenvalue: 0.54, inertia: 13.5, cum_inertia: 95.0 },
              { axis: 'Axe F4', eigenvalue: 0.20, inertia: 5.0, cum_inertia: 100.0 }
            ],
            individuals: randomInds,
            variables: randomVars,
            scree_chart: fallbackScree,
            circle_chart: fallbackCircle,
            ind_chart: fallbackInd,
            interpretation: `### Rapport d'Interprétation de l'Analyse en Composantes Principales (ACP - Version Simulée)
            
L'ACP s'emploie à synthétiser l'information contenue dans un ensemble de variables quantitatives.
- **Axe F1 (53.5% d'inertie explicative)** : Structuré principalement par les variables initiales de manière homogène.
- **Axe F2 (28.0% d'inertie explicative)** : Apporte un éclairage complémentaire sur les variances résiduelles.
- 🟢 **Règle de Kaiser validée** : 2 composantes ont des valeurs propres supérieures à 1,0. Les données simulées suggèrent une structure factorielle stable.`
          });
        } else if (type === 'afc') {
          resolve({
            success: true,
            analysis_type: 'afc',
            n_total: 450,
            chi2_stat: 124.52,
            chi2_p: 2.45e-8,
            cramer_v: 0.324,
            eigenvalues: [
              { axis: 'Axe 1', eigenvalue: 0.154, inertia: 68.2, cum_inertia: 68.2 },
              { axis: 'Axe 2', eigenvalue: 0.072, inertia: 31.8, cum_inertia: 100.0 }
            ],
            rows: [
              { label: 'Ligne A', coords: [0.42, -0.15], ctr: [45.1, 15.2], cos2: [0.72, 0.18] },
              { label: 'Ligne B', coords: [-0.35, 0.28], ctr: [35.2, 38.6], cos2: [0.61, 0.32] },
              { label: 'Ligne C', coords: [-0.12, -0.42], ctr: [19.7, 46.2], cos2: [0.15, 0.78] }
            ],
            columns: [
              { label: 'Colonne X', coords: [0.55, -0.05], ctr: [55.3, 2.1], cos2: [0.85, 0.02] },
              { label: 'Colonne Y', coords: [-0.28, 0.35], ctr: [28.1, 48.6], cos2: [0.45, 0.48] },
              { label: 'Colonne Z', coords: [-0.15, -0.45], ctr: [16.6, 49.3], cos2: [0.22, 0.71] }
            ],
            scree_chart: {
              data: [{ x: ['Axe 1', 'Axe 2'], y: [68.2, 31.8], type: 'bar', marker: { color: '#4f46e5' } }],
              layout: { title: "Éboulis de valeurs propres - AFC", paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            biplot_chart: {
              data: [
                { x: [0.42, -0.35, -0.12], y: [-0.15, 0.28, -0.42], mode: 'markers+text', text: ['Ligne A', 'Ligne B', 'Ligne C'], name: 'Lignes', marker: { color: '#db2777', size: 10 } },
                { x: [0.55, -0.28, -0.15], y: [-0.05, 0.35, -0.45], mode: 'markers+text', text: ['Colonne X', 'Colonne Y', 'Colonne Z'], name: 'Colonnes', marker: { color: '#4f46e5', symbol: 'triangle-up', size: 10 } }
              ],
              layout: { title: 'Projection AFC : Biplot Variables', paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            interpretation: `### Rapport Scientifique de l'AFC (Analyse des Correspondances)
- **Trace d'Inertie** : 0.226.
- **Significativité du Chi-Deux** : χ² = 124.52, p < 0.001. La dépendance entre lignes et colonnes est validée.
- 🟢 **Affinités clés** : Magnifique attraction constatée entre 'Ligne A' et 'Colonne X', traduisant une singularité statistique positive.`
          });
        } else if (type === 'acm') {
          resolve({
            success: true,
            analysis_type: 'acm',
            n_rows: 150,
            total_categories: 12,
            eigenvalues: [
              { axis: 'Axe 1', raw_eigenvalue: 0.34, adj_eigenvalue: 0.12, adj_inertia: 72.5, cum_adj_inertia: 72.5 },
              { axis: 'Axe 2', raw_eigenvalue: 0.21, adj_eigenvalue: 0.046, adj_inertia: 27.5, cum_adj_inertia: 100.0 }
            ],
            categories: [
              { variable: 'Var A', category: 'A_Basse', coords: [0.65, -0.1], ctr: [15, 2], cos2: [0.75, 0.05] },
              { variable: 'Var A', category: 'A_Haute', coords: [-0.55, 0.15], ctr: [12, 4], cos2: [0.65, 0.08] },
              { variable: 'Var B', category: 'B_Oui', coords: [0.52, 0.35], ctr: [18, 14], cos2: [0.55, 0.25] },
              { variable: 'Var B', category: 'B_Non', coords: [-0.48, -0.3], ctr: [14, 11], cos2: [0.5, 0.2] }
            ],
            scree_chart: {
              data: [{ x: ['Axe 1', 'Axe 2'], y: [72.5, 27.5], type: 'bar', marker: { color: '#10b981' } }],
              layout: { title: "Éboulis de Benzécri (ACM)", paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            categories_chart: {
              data: [
                { x: [0.65, -0.55], y: [-0.1, 0.15], mode: 'markers+text', text: ['Basse', 'Haute'], name: 'Var: Var A', marker: { color: '#4f46e5', size: 11 } },
                { x: [0.52, -0.48], y: [0.35, -0.3], mode: 'markers+text', text: ['Oui', 'Non'], name: 'Var: Var B', marker: { color: '#db2777', size: 11 } }
              ],
              layout: { title: "Plan Factoriel de l'ACM (Catégories)", paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            interpretation: `### Rapport Scientifique de l'ACM (Analyse des Correspondances Multiples)
Analyse croisée multicatégorielle. Les taux d'inertie de Benzécri rectifient admirablement les sous-évaluations usuelles.
- **Axe F1 (72.5% d'inertie corrigée)** : Structure les comportements d'opposition.
- **Axe F2 (27.5% d'inertie corrigée)** : Segmente les alternatives comportementales secondaires.`
          });
        } else { // CAH
          resolve({
            success: true,
            analysis_type: 'cah',
            n_total: 100,
            linkage_method: params.linkage_method || 'ward',
            num_clusters: params.num_clusters || 3,
            profiles: [
              { cluster: 1, size: 42, percentage: 42.0, means: { 'Variable A': 24.5, 'Variable B': 15.2 } },
              { cluster: 2, size: 38, percentage: 38.0, means: { 'Variable A': 52.1, 'Variable B': 44.8 } },
              { cluster: 3, size: 20, percentage: 20.0, means: { 'Variable A': 12.8, 'Variable B': 85.1 } }
            ],
            global_means: { 'Variable A': 32.6, 'Variable B': 40.5 },
            dendrogram_chart: {
              data: [
                { x: [1.5, 1.5, 2.5, 2.5], y: [0, 1.2, 1.2, 0], mode: 'lines', line: { color: '#4f46e5' }, showlegend: false },
                { x: [3.5, 3.5, 4.5, 4.5], y: [0, 0.8, 0.8, 0], mode: 'lines', line: { color: '#4f46e5' }, showlegend: false },
                { x: [2, 2, 4, 4], y: [1.2, 2.5, 2.5, 0.8], mode: 'lines', line: { color: '#db2777' }, showlegend: false }
              ],
              layout: { title: "Dendrogramme de Classification (CAH)", paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            profile_chart: {
              data: [
                { x: ['Variable A', 'Variable B'], y: [24.5, 15.2], type: 'bar', name: 'Cluster 1 (N=42)' },
                { x: ['Variable A', 'Variable B'], y: [52.1, 44.8], type: 'bar', name: 'Cluster 2 (N=38)' },
                { x: ['Variable A', 'Variable B'], y: [12.8, 85.1], type: 'bar', name: 'Cluster 3 (N=20)' }
              ],
              layout: { title: 'Profils Comparatifs des Centres de Gravité', paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#334155' } }
            },
            interpretation: `### Rapport Scientifique de la CAH (Classification Agglomérative)
Construction d'une partition typologique par distances géodésiques ou euclidiennes.
- **Partition optimale** : Retenue à **3 clusters**.
- 🔵 **Cluster 1** (N=42) : Profil modeste sur l'ensemble.
- 🔵 **Cluster 2** (N=38) : Profil sur-représentatif sur Variable A.
- 🔵 **Cluster 3** (N=20) : Profil exceptionnellement élevé sur Variable B.`
          });
        }
      }, 500);
    });
  },

  run_what_if_simulation: async (analysis_type, test_id, params, modifications) => {
    return new Promise(async (resolve) => {
      try {
        const { useWorkspaceStore } = await import('./store');
        const previewData = useWorkspaceStore.getState().previewData;
        
        if (!previewData || previewData.length === 0) {
          resolve({ success: true, simulated_result: null, modifications });
          return;
        }

        // Clone the active dataset
        const sim_data = previewData.map((row: any) => ({ ...row }));

        // Apply modifications: scale, offset, noise
        const rand = createSeededRandom(42);
        const getNormal = (m: number, s: number) => {
          const u1 = rand() || 0.0001;
          const u2 = rand();
          return m + s * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        };

        for (const [col, mods] of Object.entries(modifications)) {
          const m = mods as any;
          const offset = m.offset !== undefined ? parseFloat(m.offset) : 0;
          const scale = m.scale !== undefined ? parseFloat(m.scale) : 1.0;
          const noise = m.noise !== undefined ? parseFloat(m.noise) : 0.0;

          sim_data.forEach((row: any) => {
            if (row[col] !== undefined && row[col] !== null) {
              const valNum = parseFloat(row[col]);
              if (!isNaN(valNum)) {
                let newVal = valNum * scale + offset;
                if (noise > 0) {
                  newVal += getNormal(0, noise);
                }
                row[col] = parseFloat(newVal.toFixed(4));
              }
            }
          });
        }

        if (analysis_type === 'regression') {
          const target = params.target_column || 'Performance';
          const predictors = params.predictor_columns || ['Budget_R_D'];
          const firstPredictor = predictors[0] || 'Prédicteur';

          const validRows = sim_data.filter((row: any) => {
            const yVal = parseFloat(row[target]);
            const xVal = parseFloat(row[firstPredictor]);
            return !isNaN(yVal) && !isNaN(xVal);
          });

          if (validRows.length >= 3) {
            const xArr = validRows.map((r: any) => parseFloat(r[firstPredictor]));
            const yArr = validRows.map((r: any) => parseFloat(r[target]));
            const fit = performLinearRegression(xArr, yArr);

            const minX = Math.min(...xArr);
            const maxX = Math.max(...xArr);
            const fit_x = [minX, maxX];
            const fit_y = [
              parseFloat((fit.intercept + fit.slope * minX).toFixed(3)),
              parseFloat((fit.intercept + fit.slope * maxX).toFixed(3))
            ];

            const simulated_result = {
              success: true,
              metrics: {
                r_squared_all: fit.rvalue2,
                p_value: fit.pvalue,
                slope_all: fit.slope
              },
              diagnostics: {
                shapiro_p: 0.3 + rand() * 0.4
              },
              chart: {
                data: [
                  { x: xArr, y: yArr, mode: 'markers', type: 'scatter', name: 'Observations simulées', marker: { color: 'rgba(236, 72, 153, 0.65)', size: 9, line: { color: '#db2777', width: 1 } } },
                  { x: fit_x, y: fit_y, mode: 'lines', type: 'scatter', name: `Simulation What-If (R² = ${(fit.rvalue2 * 100).toFixed(1)}%)`, line: { color: '#6366f1', width: 3 } }
                ],
                layout: {
                  title: `Ajustement Linéaire (Simulation)`,
                  xaxis: { title: `${firstPredictor} (Simulation)` },
                  yaxis: { title: `${target} (Simulation)` }
                }
              }
            };

            resolve({ success: true, simulated_result, modifications });
            return;
          }
        } else if (analysis_type === 'stat_test') {
          const colX = params.col_x || 'Variable X';
          const testType = test_id || 'shapiro';

          const validVals = sim_data.map((r: any) => parseFloat(r[colX])).filter(v => !isNaN(v));

          if (validVals.length >= 3) {
            const mean = validVals.reduce((a, b) => a + b, 0) / validVals.length;
            const variance = validVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (validVals.length - 1 || 1);
            const std = Math.sqrt(variance);

            let simulated_result: any = { success: true };
            
            if (testType === 'shapiro') {
              const sum3 = validVals.reduce((a, b) => a + Math.pow(b - mean, 3), 0);
              const skewness = std > 0 ? (sum3 / validVals.length) / Math.pow(variance, 1.5) : 0;
              const p_val = Math.max(0.0001, Math.min(0.9999, 0.5 - Math.abs(skewness) * 0.5 + rand() * 0.1));

              simulated_result = {
                success: true,
                metrics: {
                  p_value: p_val,
                  statistic: 1.0 - Math.abs(skewness) * 0.1
                },
                diagnostics: {
                  shapiro_p: p_val
                },
                chart: {
                  data: [
                    { x: validVals, type: 'histogram', name: 'Simulés', marker: { color: 'rgba(236, 72, 153, 0.65)' } }
                  ],
                  layout: {
                    title: `Visualisation de la normalité de ${colX} (What-If)`
                  }
                }
              };
            } else if (testType === 'ttest_1samp') {
              const mu = parseFloat(params.mu) || 0;
              const se = std / Math.sqrt(validVals.length);
              const t_stat = se > 0 ? (mean - mu) / se : 0;
              const p_val = 2 * (1 - statsNormalCdf(Math.abs(t_stat)));

              simulated_result = {
                success: true,
                metrics: {
                  p_value: p_val,
                  t_stat: t_stat,
                  mean_actual: mean
                },
                chart: {
                  data: [
                    { x: validVals, type: 'histogram', name: 'Simulé', marker: { color: 'rgba(236, 72, 153, 0.65)' } }
                  ],
                  layout: {
                    title: `Comparaison à la moyenne théorique μ = ${mu}`
                  }
                }
              };
            } else {
              simulated_result = {
                success: true,
                metrics: {
                  p_value: 0.05 + rand() * 0.1
                },
                chart: {
                  data: [
                    { x: validVals, type: 'histogram', name: 'Variable', marker: { color: 'rgba(236, 72, 153, 0.65)' } }
                  ],
                  layout: {
                    title: `${colX} (Simulation)`
                  }
                }
              };
            }

            resolve({ success: true, simulated_result, modifications });
            return;
          }
        }

        resolve({ success: true, simulated_result: null, modifications });
      } catch (err) {
        console.error("Error in run_what_if_simulation fallback:", err);
        resolve({ success: false, error: String(err) });
      }
    });
  },

  lab_simulate_descriptive: async (mean, std_dev, n_samples) => {
    return new Promise((resolve) => setTimeout(() => {
      const rand = createSeededRandom(42);
      const getNormal = (m: number, s: number) => {
        const u1 = rand() || 0.0001;
        const u2 = rand();
        return m + s * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      };

      const samples: number[] = [];
      for (let i = 0; i < n_samples; i++) {
        samples.push(getNormal(mean, std_dev));
      }

      const numBins = 30;
      const min = Math.min(...samples);
      const max = Math.max(...samples);
      const range = max - min;
      const binWidth = range > 0 ? (range / numBins) : 0.1;
      const counts = new Array(numBins).fill(0);
      for (const x of samples) {
        let binIdx = Math.floor((x - min) / binWidth);
        if (binIdx >= numBins) binIdx = numBins - 1;
        if (binIdx < 0) binIdx = 0;
        counts[binIdx]++;
      }

      const hist_x: number[] = [];
      const hist_y: number[] = [];
      for (let i = 0; i < numBins; i++) {
        const bin_left = min + i * binWidth;
        const bin_right = bin_left + binWidth;
        hist_x.push(parseFloat(((bin_left + bin_right) / 2).toFixed(3)));
        hist_y.push(parseFloat((counts[i] / (n_samples * binWidth)).toFixed(5)));
      }

      const pdf_x: number[] = [];
      const pdf_y: number[] = [];
      const startX = mean - 4 * std_dev;
      const endX = mean + 4 * std_dev;
      const step = (endX - startX) / 100;
      for (let i = 0; i <= 100; i++) {
        const x = startX + i * step;
        pdf_x.push(parseFloat(x.toFixed(3)));
        const y = (1 / (std_dev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std_dev, 2));
        pdf_y.push(parseFloat(y.toFixed(5)));
      }

      const actual_mean = samples.reduce((s, x) => s + x, 0) / n_samples;
      const actual_variance = samples.reduce((s, x) => s + Math.pow(x - actual_mean, 2), 0) / (n_samples - 1 || 1);
      const actual_std = Math.sqrt(actual_variance);

      resolve({
        success: true,
        metrics: {
          mean_theorical: floatOrNum(mean),
          mean_actual: floatOrNum(actual_mean),
          std_theorical: floatOrNum(std_dev),
          std_actual: floatOrNum(actual_std)
        },
        plots: {
          hist_x,
          hist_y,
          pdf_x,
          pdf_y
        }
      });
    }, 100));
  },
  lab_simulate_hypothesis: async (sample_mean, sample_size, pop_mean, pop_std) => {
    return new Promise((resolve) => setTimeout(() => {
      const se = pop_std / Math.sqrt(sample_size);
      const z_stat = (sample_mean - pop_mean) / se;
      const p_value = 2 * (1 - statsNormalCdf(Math.abs(z_stat)));
      const margin = 1.96 * se;
      const ci_lower = sample_mean - margin;
      const ci_upper = sample_mean + margin;

      const critical_lower = pop_mean - 1.96 * se;
      const critical_upper = pop_mean + 1.96 * se;

      const pdf_x: number[] = [];
      const pdf_y: number[] = [];
      const startX = pop_mean - 4 * se;
      const endX = pop_mean + 4 * se;
      const step = (endX - startX) / 100;
      for (let i = 0; i <= 100; i++) {
        const x = startX + i * step;
        pdf_x.push(parseFloat(x.toFixed(3)));
        const y = (1 / (se * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - pop_mean) / se, 2));
        pdf_y.push(parseFloat(y.toFixed(5)));
      }

      resolve({
        success: true,
        metrics: {
          z_stat: floatOrNum(z_stat),
          p_value: floatOrNum(p_value),
          ci_lower: floatOrNum(ci_lower),
          ci_upper: floatOrNum(ci_upper)
        },
        plots: {
          pdf_x,
          pdf_y,
          obs_mean: floatOrNum(sample_mean),
          critical_lower: floatOrNum(critical_lower),
          critical_upper: floatOrNum(critical_upper)
        }
      });
    }, 100));
  },
  lab_simulate_regression: async (slope, noise, outlier_x, outlier_y, has_outlier) => {
    return new Promise((resolve) => setTimeout(() => {
      const rand = createSeededRandom(1337);
      const getNormal = () => {
        const u1 = rand() || 0.0001;
        const u2 = rand();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      };

      const n = 50;
      const scatter_x: number[] = [];
      const scatter_y: number[] = [];
      for (let i = 0; i < n; i++) {
        const x_val = (i / (n - 1)) * 10;
        const y_noise = getNormal() * noise;
        const y_val = slope * x_val + 5 + y_noise;
        scatter_x.push(parseFloat(x_val.toFixed(3)));
        scatter_y.push(parseFloat(y_val.toFixed(3)));
      }

      const scatter_x_all = [...scatter_x];
      const scatter_y_all = [...scatter_y];

      if (has_outlier) {
        scatter_x_all.push(outlier_x);
        scatter_y_all.push(outlier_y);
      }

      const cleanFit = performLinearRegression(scatter_x, scatter_y);
      const allFit = performLinearRegression(scatter_x_all, scatter_y_all);

      const line_x = [0, 10];
      const line_y_clean = [
        parseFloat((cleanFit.intercept + cleanFit.slope * 0).toFixed(3)),
        parseFloat((cleanFit.intercept + cleanFit.slope * 10).toFixed(3))
      ];
      const line_y_all = [
        parseFloat((allFit.intercept + allFit.slope * 0).toFixed(3)),
        parseFloat((allFit.intercept + allFit.slope * 10).toFixed(3))
      ];

      resolve({
        success: true,
        metrics: {
          r_squared_clean: floatOrNum(cleanFit.rvalue2),
          r_squared_all: floatOrNum(allFit.rvalue2),
          slope_all: floatOrNum(allFit.slope),
          p_value_all: floatOrNum(allFit.pvalue)
        },
        plots: {
          scatter_x,
          scatter_y,
          line_x,
          line_y_clean,
          line_y_all
        }
      });
    }, 100));
  }
};

function floatOrNum(val: number): number {
  return isNaN(val) ? 0 : parseFloat(val.toFixed(5));
}

function createSeededRandom(seed: number) {
  let s = seed;
  return function() {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function statsErf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = (x < 0) ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function statsNormalCdf(x: number): number {
  return 0.5 * (1 + statsErf(x / Math.sqrt(2)));
}

function performLinearRegression(xArr: number[], yArr: number[]) {
  const n = xArr.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xArr[i];
    sumY += yArr[i];
    sumXY += xArr[i] * yArr[i];
    sumXX += xArr[i] * xArr[i];
    sumYY += yArr[i] * yArr[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const numerator = sumXY - (sumX * sumY) / n;
  const denominator = sumXX - (sumX * sumX) / n;
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  
  const rNum = n * sumXY - sumX * sumY;
  const rDen = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const r = rDen === 0 ? 0 : rNum / rDen;
  const rvalue2 = r * r;
  
  let ss_resid = 0;
  for (let i = 0; i < n; i++) {
     const yEst = intercept + slope * xArr[i];
     ss_resid += (yArr[i] - yEst) * (yArr[i] - yEst);
  }
  const df = n - 2;
  const s_err = df > 0 ? Math.sqrt(ss_resid / df) : 0;
  
  let ss_x = 0;
  for (let i = 0; i < n; i++) {
     ss_x += (xArr[i] - meanX) * (xArr[i] - meanX);
  }
  const slope_se = (ss_x > 0 && s_err > 0) ? s_err / Math.sqrt(ss_x) : 1;
  const t_stat = slope_se > 0 ? slope / slope_se : 0;
  const pvalue = 2 * (1 - statsNormalCdf(Math.abs(t_stat)));
  
  return { slope, intercept, rvalue2, pvalue };
}

function statisticsInverseErf(x: number): number {
  if (x === 0) return 0;
  const a = 0.147;
  const logTerm = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + logTerm / 2;
  const innerSqrt = term1 * term1 - logTerm / a;
  const sign = x < 0 ? -1 : 1;
  const value = sign * Math.sqrt(Math.sqrt(innerSqrt) - term1);
  return isNaN(value) ? 0 : value;
}

export const getApi = (): PywebviewAPI => {
if (typeof window !== 'undefined' && window.pywebview && window.pywebview.api) {
    return window.pywebview.api; // Real Desktop context
  }
  return mockPywebviewApi; // Web preview context
};
