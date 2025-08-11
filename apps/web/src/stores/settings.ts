import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Settings types
export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  layoutDensity: 'compact' | 'comfortable' | 'spacious';
}

export interface BenchmarkSettings {
  defaultJudgeModelId: string | null;
  streamingEnabled: boolean;
  autoStartRuns: boolean;
}

export interface DisplaySettings {
  showScores: boolean;
  showReasoning: boolean;
  showTimestamps: boolean;
  defaultResultView: 'chat' | 'matrix';
}

export interface ExportSettings {
  defaultFormat: 'csv' | 'json';
  autoDownload: boolean;
}

export interface NotificationSettings {
  runCompletion: boolean;
  errorAlerts: boolean;
  browserNotifications: boolean;
}

export interface AppSettings {
  appearance: AppearanceSettings;
  benchmark: BenchmarkSettings;
  display: DisplaySettings;
  export: ExportSettings;
  notifications: NotificationSettings;
}

// Default settings
const defaultSettings: AppSettings = {
  appearance: {
    theme: 'system',
    accentColor: '#4cc2ff',
    layoutDensity: 'comfortable',
  },
  benchmark: {
    defaultJudgeModelId: null,
    streamingEnabled: true,
    autoStartRuns: false,
  },
  display: {
    showScores: true,
    showReasoning: true,
    showTimestamps: true,
    defaultResultView: 'chat',
  },
  export: {
    defaultFormat: 'json',
    autoDownload: false,
  },
  notifications: {
    runCompletion: true,
    errorAlerts: true,
    browserNotifications: false,
  },
};

// Settings store interface
interface SettingsStore {
  settings: AppSettings;
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
  updateBenchmark: (updates: Partial<BenchmarkSettings>) => void;
  updateDisplay: (updates: Partial<DisplaySettings>) => void;
  updateExport: (updates: Partial<ExportSettings>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  resetToDefaults: () => void;
  resetCategory: (category: keyof AppSettings) => void;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => boolean;
}

// Create the settings store
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,

      updateAppearance: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            appearance: { ...state.settings.appearance, ...updates },
          },
        })),

      updateBenchmark: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            benchmark: { ...state.settings.benchmark, ...updates },
          },
        })),

      updateDisplay: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            display: { ...state.settings.display, ...updates },
          },
        })),

      updateExport: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            export: { ...state.settings.export, ...updates },
          },
        })),

      updateNotifications: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: { ...state.settings.notifications, ...updates },
          },
        })),

      resetToDefaults: () => set({ settings: defaultSettings }),

      resetCategory: (category) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [category]: defaultSettings[category],
          },
        })),

      exportSettings: () => {
        const { settings } = get();
        return JSON.stringify(settings, null, 2);
      },

      importSettings: (settingsJson) => {
        try {
          const importedSettings = JSON.parse(settingsJson) as AppSettings;
          // Validate the structure (basic validation)
          if (
            importedSettings &&
            typeof importedSettings === 'object' &&
            'appearance' in importedSettings &&
            'benchmark' in importedSettings
          ) {
            set({ settings: { ...defaultSettings, ...importedSettings } });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'ai-benchmark-settings',
      version: 1,
    }
  )
);

// Utility hooks for specific settings categories
export const useAppearanceSettings = () => useSettingsStore((state) => state.settings.appearance);
export const useBenchmarkSettings = () => useSettingsStore((state) => state.settings.benchmark);
export const useDisplaySettings = () => useSettingsStore((state) => state.settings.display);
export const useExportSettings = () => useSettingsStore((state) => state.settings.export);
export const useNotificationSettings = () => useSettingsStore((state) => state.settings.notifications);

