import { useSettingsStore, useExportSettings } from '../../stores/settings';

export default function ExportSettings() {
  const settings = useExportSettings();
  const { updateExport } = useSettingsStore();

  return (
    <div className="space-y-8">
      {/* Export Format */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Export Format</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Default Format</label>
          <div className="grid grid-cols-2 gap-2">
            {(['csv', 'json'] as const).map((format) => (
              <button
                key={format}
                onClick={() => updateExport({ defaultFormat: format })}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                  settings.defaultFormat === format
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Export Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto-download</div>
              <div className="text-xs text-textDim">Automatically download exports when ready</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoDownload}
                onChange={(e) => updateExport({ autoDownload: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>
        </div>
      </div>

    </div>
  );
}
