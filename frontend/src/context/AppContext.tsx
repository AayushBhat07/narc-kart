import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Seizure } from '../types';

interface AppState {
  selectedSeizure: Seizure | null;
  isFilterOpen: boolean;
  isLoading: boolean;
  sidebarTab: 'radar' | 'intel' | 'network' | 'terminal';
}

type AppAction =
  | { type: 'SET_SELECTED_SEIZURE'; payload: Seizure | null }
  | { type: 'TOGGLE_FILTER' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SIDEBAR_TAB'; payload: AppState['sidebarTab'] };

const initialState: AppState = {
  selectedSeizure: null,
  isFilterOpen: false,
  isLoading: true,
  sidebarTab: 'radar',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SELECTED_SEIZURE':
      return { ...state, selectedSeizure: action.payload };
    case 'TOGGLE_FILTER':
      return { ...state, isFilterOpen: !state.isFilterOpen };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SIDEBAR_TAB':
      return { ...state, sidebarTab: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
