import { useState } from 'react';
import {
  Palette,
  Zap,
  Eye,
  Download,
  Settings as SettingsIcon,
  Bell,
  Code,
  RotateCcw,
  Upload,
  Download as DownloadIcon
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settings';
import { AnimatedCard, FadeIn, SlideIn } from '../../components/animations';
import AppearanceSettings from './AppearanceSettings';
import BenchmarkSettings from './BenchmarkSettings';
import DisplaySettings from './DisplaySettings';
import ExportSettings from './ExportSettings';
import NotificationSettings from './NotificationSettings';

type SettingsTab =
  | 'appearance'
  | 'benchmark'
  | 'display'
  | 'export'
  | 'notifications';

const tabs = [
  { id: 'appearance' as const, label: 'Appearance', icon: Palette, description: 'Theme, colors, and layout' },
  { id: 'benchmark' as const, label: 'Benchmarks', icon: Zap, description: 'Default run configurations' },
  { id: 'display' as const, label: 'Display', icon: Eye, description: 'Result display preferences' },
  { id: 'export' as const, label: 'Export', icon: Download, description: 'Data export settings' },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell, description: 'Browser notifications' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const { resetToDefaults, resetCategory, exportSettings, importSettings } = useSettingsStore();

  const handleExportSettings = () => {
    const settingsJson = exportSettings();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model-forge-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const success = importSettings(content);
          if (success) {
            alert('Settings imported successfully!');
          } else {
            alert('Failed to import settings. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'benchmark':
        return <BenchmarkSettings />;
      case 'display':
        return <DisplaySettings />;
      case 'export':
        return <ExportSettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <AppearanceSettings />;
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <div className="lg:w-80 flex-shrink-0">
        <SlideIn direction="left" className="space-y-4">
          {/* Header */}
          <div className="card p-6">
            <h1 className="text-xl font-semibold mb-2">Settings</h1>
            <p className="text-sm text-textDim">
              Customize your AI benchmarking experience
            </p>
          </div>

          {/* Navigation */}
          <div className="card p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-[var(--accent)] text-black'
                        : 'text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
                    }`}
                  >
                    <Icon size={18} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{tab.label}</div>
                      <div className={`text-xs ${isActive ? 'text-black/70' : 'text-textDim'}`}>
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Actions */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-medium text-textDim">Settings Management</h3>
            <div className="space-y-2">
              <button
                onClick={handleExportSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
              >
                <DownloadIcon size={16} />
                Export Settings
              </button>
              <button
                onClick={handleImportSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
              >
                <Upload size={16} />
                Import Settings
              </button>
              <button
                onClick={() => {
                  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                    resetToDefaults();
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <RotateCcw size={16} />
                Reset All
              </button>
            </div>
          </div>
        </SlideIn>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <FadeIn key={activeTab} className="h-full">
          <div className="card p-6 h-full overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-sm text-textDim mt-1">
                  {tabs.find(t => t.id === activeTab)?.description}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Reset ${tabs.find(t => t.id === activeTab)?.label} settings to defaults?`)) {
                    resetCategory(activeTab);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            <div className="space-y-6">
              {renderTabContent()}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}


