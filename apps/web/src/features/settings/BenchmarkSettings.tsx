import { useQuery } from '@tanstack/react-query';
import { useSettingsStore, useBenchmarkSettings } from '../../stores/settings';
import { listModels } from '../../lib/api';
import { LoadingSpinner } from '../../components/animations';

export default function BenchmarkSettings() {
  const settings = useBenchmarkSettings();
  const { updateBenchmark } = useSettingsStore();

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => listModels(),
  });

  const judgeModels = models || [];

  return (
    <div className="space-y-8">
      {/* Default Judge Model */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Default Judge Model</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Judge Model</label>
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <LoadingSpinner size={16} />
              <span className="text-sm text-textDim">Loading models...</span>
            </div>
          ) : (
            <select
              value={settings.defaultJudgeModelId || ''}
              onChange={(e) => updateBenchmark({ defaultJudgeModelId: e.target.value || null })}
              className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            >
              <option value="">Select a judge model...</option>
              {judgeModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          )}
          <div className="text-xs text-textDim mt-1">
            This model will be pre-selected when creating new runs
          </div>
        </div>
      </div>

      {/* Run Configuration */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Run Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Enable Streaming by Default</div>
              <div className="text-xs text-textDim">Show responses as they're generated</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.streamingEnabled}
                onChange={(e) => updateBenchmark({ streamingEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto-start Runs</div>
              <div className="text-xs text-textDim">Automatically execute runs after creation</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStartRuns}
                onChange={(e) => updateBenchmark({ autoStartRuns: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          {/* Removed Default Timeout and Max Retries (not implemented on server) */}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Current Configuration</h3>
        <div className="card p-4 bg-[var(--surface-1)]">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-textDim">Judge Model:</span>
              <span>
                {settings.defaultJudgeModelId
                  ? judgeModels.find(m => m.id === settings.defaultJudgeModelId)?.label || 'Unknown'
                  : 'Not selected'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-textDim">Streaming:</span>
              <span className={settings.streamingEnabled ? 'text-green-400' : 'text-red-400'}>
                {settings.streamingEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-textDim">Auto-start:</span>
              <span className={settings.autoStartRuns ? 'text-green-400' : 'text-red-400'}>
                {settings.autoStartRuns ? 'Enabled' : 'Disabled'}
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
