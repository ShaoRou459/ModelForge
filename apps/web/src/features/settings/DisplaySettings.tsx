import { useSettingsStore, useDisplaySettings } from '../../stores/settings';

export default function DisplaySettings() {
  const settings = useDisplaySettings();
  const { updateDisplay } = useSettingsStore();

  return (
    <div className="space-y-8">
      {/* Result Display */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Result Display</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Show Model Scores</div>
              <div className="text-xs text-textDim">Display numerical scores in results</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showScores}
                onChange={(e) => updateDisplay({ showScores: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Show Judge Reasoning</div>
              <div className="text-xs text-textDim">Display detailed judge explanations</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showReasoning}
                onChange={(e) => updateDisplay({ showReasoning: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Show Timestamps</div>
              <div className="text-xs text-textDim">Display creation and completion times</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showTimestamps}
                onChange={(e) => updateDisplay({ showTimestamps: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          {/* Model Icons setting removed (not implemented) */}
        </div>
      </div>

      {/* Layout Options */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Layout Options</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Default Result View</label>
            <div className="grid grid-cols-2 gap-2">
              {(['chat', 'matrix'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => updateDisplay({ defaultResultView: view })}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    settings.defaultResultView === view
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)} View
                </button>
              ))}
            </div>
          </div>

          {/* Compact Cards setting removed (not yet wired) */}
        </div>
      </div>
    </div>
  );
}
