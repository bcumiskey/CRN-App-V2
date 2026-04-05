import { create } from "zustand";
import { defaultAdminTabBar } from "../constants/navigation";

interface TabSlot {
  position: number;
  section: string;
}

interface NavState {
  tabBarSlots: TabSlot[];
  centerAction: string;
  setTabBarSlots: (slots: TabSlot[]) => void;
  setCenterAction: (action: string) => void;
  initFromPreferences: (prefs: { tabBarSlots?: TabSlot[]; centerAction?: string }) => void;
}

export const useNavStore = create<NavState>((set) => ({
  tabBarSlots: defaultAdminTabBar,
  centerAction: "quick_add_job",

  setTabBarSlots: (slots) => set({ tabBarSlots: slots }),
  setCenterAction: (action) => set({ centerAction: action }),

  initFromPreferences: (prefs) =>
    set({
      tabBarSlots: prefs.tabBarSlots ?? defaultAdminTabBar,
      centerAction: prefs.centerAction ?? "quick_add_job",
    }),
}));
