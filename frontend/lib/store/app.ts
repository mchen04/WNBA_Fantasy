import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppPreferences {
  // Display preferences
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  showPlayerPhotos: boolean;
  compactMode: boolean;
  
  // Data preferences
  defaultConsistencyDays: '7' | '14' | '30';
  defaultHotPlayerDays: '5' | '7' | '10' | '14';
  excludeTopNPlayers: number;
  
  // Table preferences
  playersPerPage: number;
  defaultSortBy: string;
  defaultSortOrder: 'asc' | 'desc';
}

interface AppState extends AppPreferences {
  // UI State
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  searchQuery: string;
  selectedPlayerId: string | null;
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedPlayer: (playerId: string | null) => void;
  updatePreferences: (preferences: Partial<AppPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: AppPreferences = {
  dateFormat: 'MM/DD/YYYY',
  showPlayerPhotos: true,
  compactMode: false,
  defaultConsistencyDays: '14',
  defaultHotPlayerDays: '7',
  excludeTopNPlayers: 50,
  playersPerPage: 20,
  defaultSortBy: 'fantasyPoints',
  defaultSortOrder: 'desc',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Default preferences
      ...defaultPreferences,
      
      // UI State (not persisted)
      sidebarOpen: true,
      mobileMenuOpen: false,
      searchQuery: '',
      selectedPlayerId: null,
      
      // Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setSelectedPlayer: (playerId) => set({ selectedPlayerId: playerId }),
      
      updatePreferences: (preferences) =>
        set((state) => ({
          ...state,
          ...preferences,
        })),
      
      resetPreferences: () => set(defaultPreferences),
    }),
    {
      name: 'app-preferences',
      partialize: (state) => {
        // Only persist preferences, not UI state
        const { 
          sidebarOpen, 
          mobileMenuOpen, 
          searchQuery, 
          selectedPlayerId,
          setSidebarOpen,
          setMobileMenuOpen,
          setSearchQuery,
          setSelectedPlayer,
          updatePreferences,
          resetPreferences,
          ...preferences 
        } = state;
        return preferences;
      },
    }
  )
);