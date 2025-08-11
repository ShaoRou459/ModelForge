import { useSettingsStore, useAppearanceSettings } from '../../stores/settings';
import { AnimatedCard } from '../../components/animations';

const accentColors = [
  { name: 'Blue', value: '#4cc2ff' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
];

export default function AppearanceSettings() {
  const settings = useAppearanceSettings();
  const { updateAppearance } = useSettingsStore();

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Theme</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Color Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateAppearance({ theme: mode })}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    settings.theme === mode
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Accent Color</label>
            <div className="grid grid-cols-6 gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateAppearance({ accentColor: color.value })}
                  className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 ${
                    settings.accentColor === color.value
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="mt-3">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => updateAppearance({ accentColor: e.target.value })}
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-transparent cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Layout</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Density</label>
          <div className="grid grid-cols-3 gap-2">
            {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
              <button
                key={density}
                onClick={() => updateAppearance({ layoutDensity: density })}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                  settings.layoutDensity === density
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                {density.charAt(0).toUpperCase() + density.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatedCard className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: settings.accentColor }}
              />
              <div className="text-sm font-medium">Sample Card</div>
            </div>
            <div className="text-xs text-textDim">
              This is how cards will look with your current settings.
            </div>
          </AnimatedCard>
          
          <AnimatedCard className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: settings.accentColor }}
              />
              <div className="text-sm font-medium">Interactive Element</div>
            </div>
            <div className="text-xs text-textDim">
              Hover over this card to see the animation effect.
            </div>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}
