import { create } from 'zustand';

export type DashboardItemType = 'text' | 'image' | 'analysis_chart' | 'analysis_metric_card' | 'analysis_decision' | 'analysis_table' | 'analysis_associations_list';

export interface DashboardItem {
  id: string;
  type: DashboardItemType;
  title: string;
  content?: string; // markdown text or image data url
  analysisId?: string; // used for analysis results
  chartKey?: string; // specific chart key inside analysis metrics or top level
  metricKey?: string;
  metricLabel?: string;
  metricData?: any;
  layout: { x: number; y: number; w: number; h: number };
  style?: {
    fontSize?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface DashboardPage {
  id: string;
  title: string;
  items: DashboardItem[];
}

export interface DashboardTheme {
  bgColor: string;
  textColor: string;
  metricColor: string;
  cardBgColor: string;
  borderColor: string;
}

interface DashboardState {
  pages: DashboardPage[];
  currentPageId: string;
  dashboardTitle: string;
  customTheme: DashboardTheme;
  addPage: (title: string) => void;
  removePage: (id: string) => void;
  renamePage: (id: string, title: string) => void;
  setCurrentPage: (id: string) => void;
  setDashboardTitle: (title: string) => void;
  setCustomTheme: (theme: Partial<DashboardTheme>) => void;
  
  addItem: (item: Omit<DashboardItem, 'id' | 'layout'> & { layout?: { x: number; y: number; w: number; h: number } }) => void;
  updateItem: (id: string, updates: Partial<DashboardItem>) => void;
  removeItem: (id: string) => void;
  updateLayout: (layouts: { i: string; x: number; y: number; w: number; h: number }[]) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  pages: [{ id: 'page-1', title: 'Page 1', items: [] }],
  currentPageId: 'page-1',
  dashboardTitle: 'Tableau de Bord Nuru',
  customTheme: {
    bgColor: '#f8fafc',
    textColor: '#1f2937',
    metricColor: '#4f46e5',
    cardBgColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  setDashboardTitle: (title) => set({ dashboardTitle: title }),
  setCustomTheme: (theme) => set((state) => ({
    customTheme: { ...state.customTheme, ...theme }
  })),
  addPage: (title) => set((state) => {
    const id = crypto.randomUUID().substring(0, 8);
    return {
      pages: [...state.pages, { id, title, items: [] }],
      currentPageId: id
    };
  }),
  removePage: (id) => set((state) => {
    if (state.pages.length <= 1) return state; // minimum 1 page
    const newPages = state.pages.filter(p => p.id !== id);
    return {
      pages: newPages,
      currentPageId: state.currentPageId === id ? newPages[0].id : state.currentPageId
    };
  }),
  renamePage: (id, title) => set((state) => ({
    pages: state.pages.map(p => p.id === id ? { ...p, title } : p)
  })),
  setCurrentPage: (id) => set({ currentPageId: id }),

  addItem: (item) => set((state) => {
    const pageIndex = state.pages.findIndex(p => p.id === state.currentPageId);
    if (pageIndex === -1) return state;

    let layout = item.layout;
    if (!layout) {
      const maxY = state.pages[pageIndex].items.reduce((max, i) => Math.max(max, i.layout.y + i.layout.h), 0);
      let defaultW = 6, defaultH = 4;
      if (item.type === 'text') { defaultW = 6; defaultH = 4; }
      if (item.type === 'analysis_metric_card') { defaultW = 2; defaultH = 2; }
      if (item.type === 'analysis_decision') { defaultW = 6; defaultH = 3; }
      if (item.type === 'analysis_chart') { defaultW = 6; defaultH = 8; }
      if (item.type === 'analysis_table') { defaultW = 6; defaultH = 6; }
      if (item.type === 'analysis_associations_list') { defaultW = 6; defaultH = 6; }
      layout = { x: 0, y: maxY, w: defaultW, h: defaultH };
    }
    const id = crypto.randomUUID().substring(0, 8);
    
    const newPages = [...state.pages];
    newPages[pageIndex] = {
      ...newPages[pageIndex],
      items: [...newPages[pageIndex].items, { ...item, id, layout }]
    };
    
    return { pages: newPages };
  }),
  updateItem: (id, updates) => set((state) => {
    const pageIndex = state.pages.findIndex(p => p.id === state.currentPageId);
    if (pageIndex === -1) return state;
    
    const newPages = [...state.pages];
    newPages[pageIndex] = {
      ...newPages[pageIndex],
      items: newPages[pageIndex].items.map(i => i.id === id ? { ...i, ...updates } : i)
    };
    return { pages: newPages };
  }),
  removeItem: (id) => set((state) => {
    const pageIndex = state.pages.findIndex(p => p.id === state.currentPageId);
    if (pageIndex === -1) return state;

    const newPages = [...state.pages];
    newPages[pageIndex] = {
      ...newPages[pageIndex],
      items: newPages[pageIndex].items.filter(i => i.id !== id)
    };
    return { pages: newPages };
  }),
  updateLayout: (layouts) => set((state) => {
    const pageIndex = state.pages.findIndex(p => p.id === state.currentPageId);
    if (pageIndex === -1) return state;

    const layoutMap = new Map(layouts.map(l => [l.i, l]));
    const newPages = [...state.pages];
    newPages[pageIndex] = {
      ...newPages[pageIndex],
      items: newPages[pageIndex].items.map(i => {
        const l = layoutMap.get(i.id);
        if (l) return { ...i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
        return i;
      })
    };
    return { pages: newPages };
  })
}));
