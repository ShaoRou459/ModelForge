import { useState } from 'react';
import { ChevronDown, ChevronRight, Info, Settings, RotateCcw } from 'lucide-react';

export interface ParameterConfig {
  enabled: boolean;
  value: any;
}

export interface AdvancedParameters {
  temperature?: ParameterConfig;
  max_tokens?: ParameterConfig;
  top_p?: ParameterConfig;
  top_k?: ParameterConfig;
  frequency_penalty?: ParameterConfig;
  presence_penalty?: ParameterConfig;
  stop_sequences?: ParameterConfig;
}



interface ParameterDefinition {
  key: keyof AdvancedParameters;
  label: string;
  description: string;
  type: 'slider' | 'number' | 'textarea';
  min?: number;
  max?: number;
  step?: number;
  defaultValue: any;
  supportedAPIs: ('openai_compat' | 'anthropic' | 'gemini')[];
  placeholder?: string;
  enabledByDefault?: boolean; // New: whether this parameter should be enabled by default
}

const PARAMETER_DEFINITIONS: ParameterDefinition[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Controls randomness in responses. Lower values (0.0-0.3) for focused/analytical tasks, higher values (0.7-1.0) for creative tasks.',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.1,
    defaultValue: 0.7,
    supportedAPIs: ['openai_compat', 'anthropic', 'gemini'],
    enabledByDefault: true, // Temperature is commonly used
  },
  {
    key: 'max_tokens',
    label: 'Max Tokens',
    description: 'Maximum number of tokens in the response. Controls response length.',
    type: 'number',
    min: 1,
    max: 8192,
    defaultValue: 1000,
    supportedAPIs: ['openai_compat', 'anthropic', 'gemini'],
    enabledByDefault: false, // Usually not needed unless you want to limit response length
  },
  {
    key: 'top_p',
    label: 'Top P (Nucleus Sampling)',
    description: 'Alternative to temperature. Use either temperature OR top_p, not both. Controls diversity by sampling from top tokens with cumulative probability.',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.9,
    supportedAPIs: ['openai_compat', 'anthropic', 'gemini'],
    enabledByDefault: false, // Advanced parameter, most users prefer temperature
  },
  {
    key: 'top_k',
    label: 'Top K',
    description: 'Limits sampling to the top K most likely tokens. Reduces low-probability responses.',
    type: 'number',
    min: 1,
    max: 100,
    defaultValue: 40,
    supportedAPIs: ['anthropic', 'gemini'],
    enabledByDefault: false, // Advanced parameter
  },
  {
    key: 'frequency_penalty',
    label: 'Frequency Penalty',
    description: 'Reduces repetition by penalizing tokens based on their frequency in the text so far.',
    type: 'slider',
    min: -2,
    max: 2,
    step: 0.1,
    defaultValue: 0,
    supportedAPIs: ['openai_compat', 'gemini'],
    enabledByDefault: false, // Only needed when repetition is an issue
  },
  {
    key: 'presence_penalty',
    label: 'Presence Penalty',
    description: 'Encourages new topics by penalizing tokens that have already appeared.',
    type: 'slider',
    min: -2,
    max: 2,
    step: 0.1,
    defaultValue: 0,
    supportedAPIs: ['openai_compat', 'gemini'],
    enabledByDefault: false, // Only needed when you want to encourage topic diversity
  },
  {
    key: 'stop_sequences',
    label: 'Stop Sequences',
    description: 'Custom text sequences that will cause the model to stop generating. Enter one sequence per line.',
    type: 'textarea',
    defaultValue: [],
    supportedAPIs: ['openai_compat', 'anthropic', 'gemini'],
    placeholder: 'Enter stop sequences, one per line...',
    enabledByDefault: false, // Only needed for specific use cases
  },
];

interface AdvancedParametersConfigProps {
  adapter: 'openai_compat' | 'anthropic' | 'gemini' | 'custom';
  parameters: AdvancedParameters;
  onChange: (parameters: AdvancedParameters) => void;
}

export default function AdvancedParametersConfig({ 
  adapter, 
  parameters, 
  onChange 
}: AdvancedParametersConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateParameter = (key: keyof AdvancedParameters, config: ParameterConfig) => {
    onChange({
      ...parameters,
      [key]: config,
    });
  };

  const getParameterValue = (key: keyof AdvancedParameters, defaultValue: any, enabledByDefault: boolean = false) => {
    // If parameter exists in stored settings, use it exactly as stored
    if (parameters[key] !== undefined) {
      return parameters[key];
    }

    // If parameter doesn't exist, create it with enabledByDefault but don't auto-save
    // This ensures UI shows the correct state without persisting unwanted defaults
    return { enabled: enabledByDefault, value: defaultValue };
  };

  const isParameterSupported = (paramDef: ParameterDefinition) => {
    return adapter !== 'custom' && paramDef.supportedAPIs.includes(adapter as any);
  };

  const supportedParameters = PARAMETER_DEFINITIONS.filter(isParameterSupported);

  if (adapter === 'custom' || supportedParameters.length === 0) {
    return null;
  }

  return (
    <div className="border border-[var(--border)] rounded-md animate-scale-in">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-1)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-[var(--accent)]" />
          <div className="text-left">
            <div className="text-sm font-medium">Advanced Parameters</div>
            <div className="text-xs text-textDim">
              Configure model behavior for {adapter} API
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-6 animate-slide-in-down">
          {supportedParameters.map((paramDef) => {
            const paramConfig = getParameterValue(paramDef.key, paramDef.defaultValue, paramDef.enabledByDefault);

            return (
              <ParameterControl
                key={paramDef.key}
                definition={paramDef}
                config={paramConfig}
                onChange={(config) => updateParameter(paramDef.key, config)}
              />
            );
          })}
          
          <div className="text-xs text-textDim bg-[var(--surface-1)] p-3 rounded-md">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Note:</strong> Only parameters supported by the {adapter} API are shown. 
                Disabled parameters will not be sent with requests. Some parameters like temperature 
                and top_p should not be used together.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParameterControlProps {
  definition: ParameterDefinition;
  config: ParameterConfig;
  onChange: (config: ParameterConfig) => void;
}

function ParameterControl({ definition, config, onChange }: ParameterControlProps) {
  const handleToggle = (enabled: boolean) => {
    onChange({ ...config, enabled });
  };

  const handleValueChange = (value: any) => {
    onChange({ ...config, value });
  };

  const handleStopSequencesChange = (text: string) => {
    const sequences = text.split('\n').filter(line => line.trim().length > 0);
    handleValueChange(sequences);
  };

  const handleResetToDefault = () => {
    onChange({ ...config, value: definition.defaultValue });
  };

  const isDefaultValue = () => {
    if (definition.type === 'textarea') {
      return Array.isArray(config.value) && config.value.length === 0;
    }
    return config.value === definition.defaultValue;
  };

  const willBeSubmitted = () => {
    if (!config.enabled) return false;
    if (definition.type === 'textarea') {
      return Array.isArray(config.value) && config.value.length > 0;
    }
    return config.value !== undefined && config.value !== null;
  };

  return (
    <div className="space-y-3 animate-slide-in-up">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleToggle(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0"
              />
              <span className="text-sm font-medium">{definition.label}</span>
              {willBeSubmitted() && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded">
                  Will Submit
                </span>
              )}
              {config.enabled && !willBeSubmitted() && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                  Enabled (No Value)
                </span>
              )}
              {!isDefaultValue() && (
                <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded">
                  Modified
                </span>
              )}
            </label>
            <div className="flex gap-1">
              {definition.supportedAPIs.map(api => (
                <span
                  key={api}
                  className="text-xs px-1.5 py-0.5 bg-[var(--surface-2)] text-textDim rounded"
                >
                  {api === 'openai_compat' ? 'OpenAI' : api === 'anthropic' ? 'Anthropic' : 'Gemini'}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-textDim">{definition.description}</p>
        </div>
        {config.enabled && !isDefaultValue() && (
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1 text-xs px-2 py-1 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors"
            title="Reset to default value"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>

      {config.enabled && (
        <div className="ml-6 animate-scale-in">
          {definition.type === 'slider' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-textDim">Value: {config.value}</span>
                <span className="text-xs text-textDim">
                  Range: {definition.min} - {definition.max}
                </span>
              </div>
              <input
                type="range"
                min={definition.min}
                max={definition.max}
                step={definition.step}
                value={config.value}
                onChange={(e) => handleValueChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--surface-2)] rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          )}

          {definition.type === 'number' && (
            <input
              type="number"
              min={definition.min}
              max={definition.max}
              value={config.value}
              onChange={(e) => handleValueChange(parseInt(e.target.value) || definition.defaultValue)}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
            />
          )}

          {definition.type === 'textarea' && (
            <textarea
              value={Array.isArray(config.value) ? config.value.join('\n') : ''}
              onChange={(e) => handleStopSequencesChange(e.target.value)}
              placeholder={definition.placeholder}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm font-mono"
            />
          )}
        </div>
      )}
    </div>
  );
}
