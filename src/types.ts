export type StatType = 'nominal' | 'ordinal' | 'discrete' | 'continuous' | 'datetime';
export type ImputationStrategy = 'drop_rows' | 'mean' | 'median' | 'mode';
export type FilterOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
export type FilterLogic = 'AND' | 'OR';
export type MathOperation = 'log' | 'sqrt' | 'standardize' | 'add' | 'subtract' | 'multiply' | 'divide';
export type DuplicateKeep = 'first' | 'last';
export type StringCleanOperation = 'trim' | 'lower' | 'upper' | 'title';
export type BinningMethod = 'auto' | 'custom';
export type EncodingMethod = 'label' | 'onehot';

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: string | number;
  logic: FilterLogic;
}

export interface TransformationStep {
  id: string;
  type: string; // 'imputation' | 'filter' | 'math_transform' | 'remove_duplicates' | 'string_clean' | 'binning' | 'grouping' | 'encoding'
  columnName?: string;
  strategy?: string;
  conditions?: FilterCondition[];
  operation?: MathOperation | StringCleanOperation;
  datePart?: 'day' | 'week' | 'month' | 'year' | 'quarter';
  newColumnName?: string;
  targetColumn?: string;
  constant?: number;
  duplicateKeep?: DuplicateKeep;
  binningMethod?: BinningMethod;
  numBins?: number;
  thresholds?: number[];
  labels?: string[];
  mapping?: Record<string, string>;
  encodingMethod?: EncodingMethod;
  dropFirst?: boolean;
  detectMethod?: 'iqr' | 'zscore';
  treatMethod?: 'winsorize' | 'exclude' | 'median';
  formula?: string;
  enabled: boolean;
  timestamp: string;
}

export interface ManualColumnDefinition {
  id: string;
  name: string;
  type: StatType;
  labels?: Record<string, string>;
}

export interface ColumnMetadata {
  name: string;
  type: StatType;
  missing_values: number;
  raw_dtype: string;
}

export interface DatasetInfo {
  success: boolean;
  error?: string;
  row_count?: number;
  col_count?: number;
  columns?: ColumnMetadata[];
  preview?: Record<string, any>[];
}

export interface ChartAnnotation {
  text: string;
  x: number;
  y: number;
  showArrow: boolean;
}

export interface AnalysisResult {
  id: string;
  title: string;
  timestamp: string;
  type: 'univariate' | 'bivariate' | 'exploratory_correlation';
  variables: string[];
  metrics: any;
  interpretation: string;
  chart?: any;
  annotations?: ChartAnnotation[];
  group?: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  columns: any[];
  preview: any[];
}

export interface PywebviewAPI {
  generate_random_dataset?: (params: any) => Promise<{ success: boolean; error?: string; dataset_id?: string; name?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  switch_dataset?: (dataset_id: string) => Promise<{ success: boolean; error?: string; dataset_id?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  toggle_fullscreen?: () => Promise<{ success: boolean; is_fullscreen?: boolean; error?: string }>;
  get_store_item?: (key: string) => Promise<{ success: boolean; value?: any; error?: string }>;
  set_store_item?: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
  remove_store_item?: (key: string) => Promise<{ success: boolean; error?: string }>;
  get_hardware_info?: () => Promise<{ success: boolean; hardware_id?: string; is_licensed?: boolean; first_name?: string; last_name?: string; days_remaining?: number; expiry_date?: string; error?: string }>;
  verify_and_save_license?: (file_path: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  open_license_dialog?: () => Promise<string | null>;
  save_base64_file?: (content_base64: string, default_filename: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  open_file_dialog: () => Promise<string | null>;
  check_excel_sheets: (file_path: string) => Promise<{ success: boolean; multiple: boolean; sheets?: string[]; error?: string }>;
  preprocess_excel_preview?: (file_path: string, sheet_name?: string | number, manual_header_row?: number | null, selected_block_idx?: number, exclude_cols?: string[]) => Promise<{
    success: boolean;
    error?: string;
    detected_header_row?: number;
    data_start_row?: number;
    nb_rows_detected?: number;
    nb_columns?: number;
    columns?: any[];
    sample_data?: any[];
    titles?: string[];
    blocks?: any[];
    selected_block?: number;
  }>;
  import_preprocessed_excel?: (file_path: string, sheet_name?: string | number, manual_header_row?: number | null, selected_block_idx?: number, exclude_cols?: string[]) => Promise<{
    success: boolean;
    error?: string;
    dataset_id?: string;
    row_count?: number;
    col_count?: number;
    columns?: any[];
    preview?: any[];
    titles?: string[];
    selected_block?: number;
    blocks?: any[];
  }>;

  load_dataset: (file_path: string, sheet_name?: string | null) => Promise<DatasetInfo & { dataset_id?: string }>;
  edit_cell: (row_idx: number, col_name: string, new_val_str: string) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  delete_row: (row_idx: number) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  keep_columns: (columns_to_keep: string[]) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  delete_column: (col_name: string) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  update_column: (old_name: string, new_name: string, new_type: StatType) => Promise<{ success: boolean; error?: string; raw_dtype?: string; preview?: Record<string, any>[] }>;
  handle_missing_values: (column_name: string, strategy: ImputationStrategy) => Promise<{ success: boolean; error?: string; missing_values?: number; row_count?: number; preview?: Record<string, any>[] }>;
  detect_outliers: (column_name: string, method: 'iqr' | 'zscore') => Promise<{ success: boolean; error?: string; outlier_count?: number; total_count?: number; lower_bound?: number; upper_bound?: number; min_val?: number; max_val?: number; median?: number; q1?: number; q3?: number; iqr?: number; mean?: number; std?: number }>;
  treat_outliers: (column_name: string, detect_method: 'iqr' | 'zscore', treat_method: 'winsorize' | 'exclude' | 'median') => Promise<{ success: boolean; error?: string; row_count?: number; outlier_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  get_unique_values: (column_name: string) => Promise<{ success: boolean; unique_values?: any[]; error?: string }>;
  get_full_dataset: () => Promise<{ success: boolean; data?: Record<string, any>[]; error?: string }>;
  apply_filter: (conditions: FilterCondition[]) => Promise<{ success: boolean; error?: string; row_count?: number; preview?: Record<string, any>[] }>;
  apply_math_transform: (source_col: string, operation: MathOperation, new_col_name: string, target_col?: string | null, constant?: number | null) => Promise<{ success: boolean; error?: string; col_count?: number; preview?: Record<string, any>[]; new_column?: ColumnMetadata }>;
  extract_date_part: (source_col: string, part: 'day' | 'week' | 'month' | 'year' | 'quarter', new_col_name: string) => Promise<{ success: boolean; error?: string; col_count?: number; preview?: Record<string, any>[]; new_column?: ColumnMetadata }>;
  remove_duplicates: (keep: DuplicateKeep) => Promise<{ success: boolean; error?: string; duplicates_removed?: number; row_count?: number; preview?: Record<string, any>[] }>;
  clean_string_column: (column_name: string, operation: StringCleanOperation) => Promise<{ success: boolean; error?: string; preview?: Record<string, any>[] }>;
  convert_column_to_date: (column_name: string, new_col_name?: string | null) => Promise<{ success: boolean; error?: string; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  split_qualitative_column: (column_name: string, method: string, target_col1: string, target_col2: string, separator?: string | null, length?: number | null) => Promise<{ success: boolean; error?: string; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  discretize_column: (column_name: string, method: BinningMethod, new_col_name: string, num_bins?: number | null, thresholds?: number[] | null, labels?: string[] | null) => Promise<{ success: boolean; error?: string; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  group_categories: (column_name: string, mapping: Record<string, string>, new_col_name?: string | null) => Promise<{ success: boolean; error?: string; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  encode_column: (column_name: string, method: EncodingMethod, new_col_name?: string | null, drop_first?: boolean) => Promise<{ success: boolean; error?: string; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  append_dataframe_columns: (new_columns_dict: Record<string, any[]>) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  run_pipeline: (pipeline_steps: TransformationStep[]) => Promise<{ success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  initialize_manual_dataframe: (schema: ManualColumnDefinition[], rows: Record<string, any>[], is_crosstab?: boolean) => Promise<{ dataset_id?: string; success: boolean; error?: string; row_count?: number; col_count?: number; columns?: ColumnMetadata[]; preview?: Record<string, any>[] }>;
  load_raw_data: (file_path: string, sheet_name?: string) => Promise<{ success: boolean; data?: any[][]; error?: string }>;
  get_comprehensive_univariate_stats: (column_name: string) => Promise<{ success: boolean; column?: string; type?: string; metrics?: any; interpretation?: string; error?: string }>;
  get_comprehensive_bivariate_stats: (col_x: string, col_y: string) => Promise<{ success: boolean; col_x?: string; col_y?: string; type_x?: string; type_y?: string; analysis_type?: string; metrics?: any; interpretation?: string; error?: string }>;
  generate_descriptive_chart: (chart_type: string, col_x: string, col_y?: string | null) => Promise<{ success: boolean; chart?: any; error?: string }>;
  run_statistical_test: (test_id: string, params: any) => Promise<{ success: boolean; test_name?: string; result?: any; interpretation?: string; error?: string; chart?: any; qq_plot?: any; pp_plot?: any; residuals_hist?: any; residuals_plot?: any }>;
  run_multivariate_analysis: (params: {
    analysis_type: 'acp' | 'afc' | 'acm' | 'cah';
    columns?: string[];
    row_column?: string;
    col_column?: string;
    scale_data?: boolean;
    linkage_method?: string;
    num_clusters?: number;
  }) => Promise<{
    success: boolean;
    analysis_type?: string;
    eigenvalues?: any[];
    individuals?: any[];
    variables?: any[];
    rows?: any[];
    columns?: any[];
    categories?: any[];
    profiles?: any[];
    global_means?: Record<string, number>;
    assignments?: any[];
    scree_chart?: any;
    circle_chart?: any;
    ind_chart?: any;
    biplot_chart?: any;
    categories_chart?: any;
    dendrogram_chart?: any;
    profile_chart?: any;
    interpretation?: string;
    error?: string;
    n?: number;
    p?: number;
    n_total?: number;
    n_rows?: number;
    total_categories?: number;
    chi2_stat?: number;
    chi2_p?: number;
    cramer_v?: number;
    [key: string]: any;
  }>;
  run_regression_analysis: (params: {
    regression_type: 'linear_simple' | 'linear_multiple' | 'logistic_binary' | 'logistic_multinomial';
    target_column: string;
    predictor_columns: string[];
    calculation_method?: 'ols' | 'wls' | 'robust';
    alpha?: number;
  }) => Promise<{
    success: boolean;
    regression_type?: string;
    metrics?: any;
    coefficients?: any[];
    diagnostics?: any;
    interpretation?: string;
    chart?: any;
    roc_chart?: any;
    actual_vs_predicted?: any;
    residuals_vs_fitted?: any;
    residuals_hist?: any;
    qq_plot?: any;
    prob_density?: any;
    anova_table?: any;
    classification_table?: any;
    model_lh_summary?: any;
    variables?: string[];
    residuals_distribution?: any;
    [key: string]: any;
    error?: string;
  }>;
  run_what_if_simulation?: (analysis_type: string, test_id: string, params: any, modifications: any) => Promise<{ success: boolean; simulated_result?: any; modifications?: any; error?: string }>;
  lab_simulate_descriptive?: (mean: number, std_dev: number, n_samples: number) => Promise<{ success: boolean; metrics?: any; plots?: any; error?: string }>;
  lab_simulate_hypothesis?: (sample_mean: number, sample_size: number, pop_mean: number, pop_std: number) => Promise<{ success: boolean; metrics?: any; plots?: any; error?: string }>;
  lab_simulate_regression?: (slope: number, noise: number, outlier_x: number, outlier_y: number, has_outlier: boolean) => Promise<{ success: boolean; metrics?: any; plots?: any; error?: string }>;
  export_report_docx?: (report_data: {
    title: string;
    author: string;
    date: string;
    sections: Array<{
      type: 'text' | 'heading' | 'table' | 'image';
      content?: string;
      level?: number;
      headers?: string[];
      rows?: any[][];
      base64?: string;
      caption?: string;
    }>;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  export_dataset?: (default_filename: string, file_format: 'xlsx' | 'csv') => Promise<{ success: boolean; message?: string; error?: string }>;
}

export interface RecentProject {
  filename: string;
  datasetName: string | null;
  rowCount: number;
  colCount: number;
  updatedAt: string;
  data: any;
}

export interface PendingImport {
  filePath: string | null;
  datasetName: string;
  rowCount: number;
  colCount: number;
  columns: ColumnMetadata[];
  previewData: any[];
  dataset_id?: string;
}

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewAPI;
    };
  }
}
