import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listModels, listProblemSets, getProviders } from '../../lib/api';
import { ChevronRight, ChevronDown, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useBenchmarkSettings } from '../../stores/settings';

const CreateSchema = z.object({
  name: z.string().optional(),
  problemSetId: z.string().min(1, 'Please select a problem set'),
  judgeModelId: z.string().min(1, 'Please select a judge model'),
  modelIds: z.array(z.string()).min(1, 'Please select at least one model'),
  stream: z.boolean().default(true),
});

type CreateValues = z.infer<typeof CreateSchema>;

interface NewRunFormProps {
  onSubmit: (values: CreateValues) => void;
  isSubmitting: boolean;
  error?: string | null;
  onReset: () => void;
}

export default function NewRunForm({ onSubmit, isSubmitting, error, onReset }: NewRunFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    models: true,
    advanced: false,
  });

  const benchmarkSettings = useBenchmarkSettings();

  const problemSets = useQuery({ queryKey: ['problemSets','runsForm'], queryFn: listProblemSets, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });
  const models = useQuery({ queryKey: ['models','runsForm'], queryFn: () => listModels(), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });
  const providers = useQuery({ queryKey: ['providers','runsForm'], queryFn: getProviders, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });

  // Ensure fresh data when the form mounts
  useEffect(() => {
    models.refetch();
    problemSets.refetch();
    providers.refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<CreateValues>({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      stream: benchmarkSettings.streamingEnabled,
      modelIds: [],
      judgeModelId: benchmarkSettings.defaultJudgeModelId || '',
    },
    mode: 'onChange',
  });

  const watchedValues = watch();
  // If settings change while the form is open, reflect them for new runs (do not override user edits)
  useEffect(() => {
    const current = watchedValues.judgeModelId;
    if (!current) setValue('judgeModelId', benchmarkSettings.defaultJudgeModelId || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkSettings.defaultJudgeModelId]);
  const selectedModels = watchedValues.modelIds || [];

  // Group models by provider for better organization
  const modelsByProvider = models.data?.reduce((acc, model) => {
    const provider = providers.data?.find(p => p.id === model.provider_id);
    const providerName = provider?.name || 'Unknown Provider';
    if (!acc[providerName]) acc[providerName] = [];
    acc[providerName].push(model);
    return acc;
  }, {} as Record<string, typeof models.data>) || {};

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleModel = (modelId: string) => {
    const current = new Set(selectedModels);
    if (current.has(modelId)) {
      current.delete(modelId);
    } else {
      current.add(modelId);
    }
    setValue('modelIds', Array.from(current), { shouldValidate: true });
  };

  const selectAllModels = () => {
    const allModelIds = models.data?.map(m => m.id) || [];
    setValue('modelIds', allModelIds, { shouldValidate: true });
  };

  const clearAllModels = () => {
    setValue('modelIds', [], { shouldValidate: true });
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return !!watchedValues.problemSetId && !!watchedValues.judgeModelId;
      case 2:
        return selectedModels.length > 0;
      default:
        return true;
    }
  };

  const getStepIcon = (step: number) => {
    if (currentStep > step || isStepValid(step)) {
      return <CheckCircle size={20} className="text-[var(--success)]" />;
    }
    if (currentStep === step) {
      return <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-black text-sm font-bold">{step}</div>;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-textDim text-sm">{step}</div>;
  };

  return (
    <form className="card p-0 grid animate-scale-in" onSubmit={handleSubmit(onSubmit)}>
      {/* Header */}
      <div className="section-header animate-slide-in-down">
        <div>
          <div className="section-title">Create New Run</div>
          <div className="text-xs text-textDim">Configure your benchmark run with multiple AI models</div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getStepIcon(1)}
            <span className={`text-sm ${currentStep >= 1 ? 'text-text' : 'text-textDim'}`}>Setup</span>
          </div>
          <ChevronRight size={16} className="text-textDim" />
          <div className="flex items-center gap-2">
            {getStepIcon(2)}
            <span className={`text-sm ${currentStep >= 2 ? 'text-text' : 'text-textDim'}`}>Models</span>
          </div>
          <ChevronRight size={16} className="text-textDim" />
          <div className="flex items-center gap-2">
            {getStepIcon(3)}
            <span className={`text-sm ${currentStep >= 3 ? 'text-text' : 'text-textDim'}`}>Review</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Basic Configuration */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-slide-in-right">
            <div>
              <h3 className="text-lg font-medium mb-4">Basic Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-textDim mb-2">
                    Run Name (Optional)
                  </label>
                  <input
                    className="w-full bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
                    placeholder="Enter a descriptive name for this run..."
                    {...register('name')}
                  />
                  <p className="text-xs text-textDim mt-1">
                    <Info size={12} className="inline mr-1" />
                    If left empty, a unique ID will be generated
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-textDim mb-2">
                      Problem Set *
                    </label>
                    <select
                      className="w-full bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
                      {...register('problemSetId')}
                    >
                      <option value="">Select a problem set...</option>
                      {problemSets.data?.map(ps => (
                        <option value={ps.id} key={ps.id}>{ps.name}</option>
                      ))}
                    </select>
                    {formState.errors.problemSetId && (
                      <p className="text-[var(--danger)] text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {formState.errors.problemSetId.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textDim mb-2">
                      Judge Model *
                    </label>
                    <select
                      className="w-full bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
                      {...register('judgeModelId')}
                    >
                      <option value="">
                        {models.isLoading ? 'Loading models...' :
                         models.data?.length === 0 ? 'No models available' :
                         'Select a judge model...'}
                      </option>
                      {models.data?.map(m => (
                        <option value={m.id} key={m.id}>{m.label}</option>
                      ))}
                    </select>
                    {formState.errors.judgeModelId && (
                      <p className="text-[var(--danger)] text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {formState.errors.judgeModelId.message}
                      </p>
                    )}
                    {models.data?.length === 0 && !models.isLoading && (
                      <p className="text-[var(--warn)] text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        No models configured. Please set up providers and models first.
                      </p>
                    )}
                    {models.data && models.data.length > 0 && (
                      <p className="text-xs text-textDim mt-1">
                        <Info size={12} className="inline mr-1" />
                        This model will evaluate the responses from other models
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Model Selection */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-slide-in-right">
            <div>
              <h3 className="text-lg font-medium mb-4">Select Models to Benchmark</h3>
              
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-textDim">
                  Choose which AI models to include in your benchmark run
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllModels}
                    className="text-xs px-3 py-1 rounded bg-surface2 hover:bg-surface1 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllModels}
                    className="text-xs px-3 py-1 rounded bg-surface2 hover:bg-surface1 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(modelsByProvider).map(([providerName, providerModels]) => (
                  <div key={providerName} className="border border-[var(--border)] rounded-lg">
                    <div className="p-3 bg-surface2 border-b border-[var(--border)]">
                      <h4 className="text-sm font-medium">{providerName}</h4>
                      <p className="text-xs text-textDim">{providerModels?.length || 0} models available</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {providerModels?.map(model => (
                        <label key={model.id} className="flex items-center gap-3 p-2 rounded hover:bg-surface1 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedModels.includes(model.id)}
                            onChange={() => toggleModel(model.id)}
                            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{model.label}</div>
                            <div className="text-xs text-textDim">{model.model_id}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {formState.errors.modelIds && (
                <p className="text-[var(--danger)] text-sm mt-2 flex items-center gap-1">
                  <AlertCircle size={16} />
                  {formState.errors.modelIds.message}
                </p>
              )}

              <div className="mt-4 p-3 bg-surface2 rounded-lg">
                <p className="text-sm">
                  <strong>{selectedModels.length}</strong> model{selectedModels.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Advanced Options */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-slide-in-right">
            <div>
              <h3 className="text-lg font-medium mb-4">Review & Launch</h3>
              
              {/* Summary */}
              <div className="bg-surface2 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium mb-3">Run Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-textDim">Problem Set:</span>
                    <span>{problemSets.data?.find(ps => ps.id === watchedValues.problemSetId)?.name || 'Not selected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textDim">Judge Model:</span>
                    <span>{models.data?.find(m => m.id === watchedValues.judgeModelId)?.label || 'Not selected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textDim">Models to Test:</span>
                    <span>{selectedModels.length} selected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textDim">Streaming:</span>
                    <span>{watchedValues.stream ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="border border-[var(--border)] rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSection('advanced')}
                  className="w-full p-3 flex items-center justify-between hover:bg-surface1 transition-colors"
                >
                  <span className="text-sm font-medium">Advanced Options</span>
                  {expandedSections.advanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {expandedSections.advanced && (
                  <div className="p-3 border-t border-[var(--border)]">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" {...register('stream')} />
                      <span className="text-sm">Enable real-time streaming</span>
                    </label>
                    <p className="text-xs text-textDim mt-1 ml-6">
                      Show model responses as they're generated in real-time
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-[var(--border)]">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-surface1 transition-colors"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                onReset();
                setCurrentStep(1);
              }}
              className="px-4 py-2 text-sm text-textDim hover:text-text transition-colors"
            >
              Reset
            </button>
            
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!isStepValid(currentStep)}
                className="px-4 py-2 text-sm bg-[var(--accent)] text-black rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !isStepValid(1) || !isStepValid(2)}
                className="px-6 py-2 text-sm bg-[var(--accent)] text-black rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Creating Run...' : 'Create & Start Run'}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
