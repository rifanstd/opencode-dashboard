import { create } from 'zustand'

interface AppState {
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  setLoading: (isLoading: boolean) => void
  setSyncing: (isSyncing: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  isSyncing: false,
  error: null,
  setLoading: (isLoading) => set({ isLoading }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
