import { create } from "zustand";

interface JobFilters {
  status: string[];
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  clientPaid?: boolean;
  teamPaid?: boolean;
}

interface FilterState {
  jobFilters: JobFilters;
  setJobFilters: (filters: Partial<JobFilters>) => void;
  resetJobFilters: () => void;
}

const defaultJobFilters: JobFilters = {
  status: ["SCHEDULED", "IN_PROGRESS"],
};

export const useFilterStore = create<FilterState>((set) => ({
  jobFilters: defaultJobFilters,

  setJobFilters: (filters) =>
    set((state) => ({
      jobFilters: { ...state.jobFilters, ...filters },
    })),

  resetJobFilters: () => set({ jobFilters: defaultJobFilters }),
}));
