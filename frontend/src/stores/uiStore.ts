import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoordFormat } from '../types';

interface UiState {
  coordFormat: CoordFormat;
  setCoordFormat: (f: CoordFormat) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mapFollowCurrent: boolean;
  setMapFollowCurrent: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      coordFormat: 'decimal',
      setCoordFormat: (f) => set({ coordFormat: f }),
      editMode: false,
      setEditMode: (v) => set({ editMode: v }),
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
      mapFollowCurrent: true,
      setMapFollowCurrent: (v) => set({ mapFollowCurrent: v }),
    }),
    { name: 'grandgui-ui' }
  )
);
