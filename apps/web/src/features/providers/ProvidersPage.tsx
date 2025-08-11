import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createProvider, getProviders, listModels, createModel, deleteProvider, deleteModel, updateProvider, updateModel, testProvider } from '../../lib/api';
import AdvancedParametersConfig, { type AdvancedParameters } from './AdvancedParametersConfig';

const FormSchema = z.object({
  name: z.string().min(1),
  adapter: z.enum(['openai_compat','anthropic','gemini','custom']).default('openai_compat'),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export default function ProvidersPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showAddProvider, setShowAddProvider] = useState(false);

  const providers = useQuery({ queryKey: ['providers'], queryFn: getProviders });
  const models = useQuery({ queryKey: ['models'], queryFn: () => listModels() });

  // Group models by provider
  const modelsByProvider = models.data?.reduce((acc, model) => {
    const key = model.provider_id || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(model);
    return acc;
  }, {} as Record<string, typeof models.data>) || {};

  // Auto-select first provider if none selected
  useEffect(() => {
    if (providers.data?.length && !selectedProvider && providers.data[0]) {
      setSelectedProvider(providers.data[0].id);
    }
  }, [providers.data, selectedProvider]);

  const currentProvider = providers.data?.find(p => p.id === selectedProvider);

  return (
    <div className="grid gap-6" aria-label="Providers">
      {/* Header with contextual actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI Providers</h1>
          <p className="text-sm text-textDim">Manage your AI provider connections and available models</p>
        </div>
        <button 
          onClick={() => setShowAddProvider(true)}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90"
        >
          Add Provider
        </button>
      </div>

      {/* Main content area */}
      {providers.data?.length === 0 ? (
        <EmptyState onAddProvider={() => setShowAddProvider(true)} />
      ) : (
        <div className="grid grid-cols-[300px_1fr] gap-6">
          {/* Left sidebar - Provider list */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-textDim mb-3">
              Your Providers ({providers.data?.length || 0})
            </div>
            {providers.data?.map((provider: any) => (
              <ProviderSidebarItem
                key={provider.id}
                provider={provider}
                isSelected={selectedProvider === provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                modelCount={modelsByProvider[provider.id]?.length || 0}
              />
            ))}
          </div>

          {/* Right content - Selected provider details */}
          <div className="min-h-0">
            {currentProvider ? (
              <ProviderDetailsPanel 
                provider={currentProvider} 
                models={modelsByProvider[currentProvider.id] || []}
                onProviderUpdate={() => {
                  providers.refetch();
                  models.refetch();
                }}
              />
            ) : (
              <div className="card p-8 text-center">
                <div className="text-textDim">Select a provider to view details</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddProvider && (
        <AddProviderModal 
          onClose={() => setShowAddProvider(false)}
          onSuccess={(providerId) => {
            setSelectedProvider(providerId);
            providers.refetch();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onAddProvider }: { onAddProvider: () => void }) {
  return (
    <div className="card p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-4xl mb-4">🤖</div>
        <h2 className="text-lg font-semibold mb-2">No AI Providers Connected</h2>
        <p className="text-textDim mb-6">
          Connect to AI providers like OpenAI, Anthropic, or custom endpoints to start running benchmarks.
        </p>
        <button 
          onClick={onAddProvider}
          className="px-6 py-3 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90"
        >
          Add Your First Provider
        </button>
      </div>
    </div>
  );
}

function ProviderSidebarItem({
  provider,
  isSelected,
  onClick,
  modelCount
}: {
  provider: any;
  isSelected: boolean;
  onClick: () => void;
  modelCount: number;
}) {
  const [status, setStatus] = useState<'unknown'|'online'|'offline'>('unknown');

  useEffect(() => {
    let mounted = true;
    // Run a single test on mount to determine provider reachability
    testProvider(provider.id)
      .then((res) => {
        if (!mounted) return;
        if (res?.ok) setStatus('online');
        else setStatus('offline');
      })
      .catch(() => {
        if (!mounted) return;
        setStatus('offline');
      });
    return () => { mounted = false; };
  }, [provider.id]);

  const getStatusColor = () => {
    if (status === 'online') return 'text-green-400';
    if (status === 'offline') return 'text-[var(--danger)]';
    return 'text-textDim';
  };

  const statusText = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown';

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-md text-left transition-colors ${
        isSelected
          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
          : 'border border-[var(--border)] hover:bg-surface2/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{provider.name}</div>
          <div className="text-xs text-textDim">{provider.adapter}</div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-2">
          <div className={`text-xs ${getStatusColor()}`}>● {statusText}</div>
          <div className="text-xs text-textDim">{modelCount} models</div>
        </div>
      </div>
    </button>
  );
}

function ProviderDetailsPanel({ 
  provider, 
  models, 
  onProviderUpdate 
}: { 
  provider: any; 
  models: any[]; 
  onProviderUpdate: () => void; 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const qc = useQueryClient();
  const deleteProviderMutation = useMutation({
    mutationFn: () => deleteProvider(provider.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      qc.invalidateQueries({ queryKey: ['models'] });
      onProviderUpdate();
    },
  });

  const getAdapterLabel = (adapter: string) => {
    switch (adapter) {
      case 'openai_compat': return 'OpenAI Compatible';
      case 'anthropic': return 'Anthropic';
      case 'gemini': return 'Gemini';
      case 'custom': return 'Custom';
      default: return adapter;
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testProvider(provider.id);
      if (res?.ok) {
        setTestResult('Connection successful');
        // Refresh provider data so last_checked persists and is visible
        onProviderUpdate();
      } else {
        setTestResult(res?.message ?? 'Connection failed');
      }
    } catch (err: any) {
      setTestResult(String(err?.message ?? err));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Header */}
      <div className="card p-6">
        {isEditing ? (
          <InlineProviderEdit 
            provider={provider}
            onCancel={() => setIsEditing(false)}
            onSave={() => {
              setIsEditing(false);
              onProviderUpdate();
            }}
          />
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{provider.name}</h2>
                <p className="text-textDim">{getAdapterLabel(provider.adapter)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3 py-2 rounded-md border border-[var(--border)] hover:bg-surface2 disabled:opacity-50"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-2 rounded-md border border-[var(--border)] hover:bg-surface2"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10"
                >
                  Delete
                </button>
              </div>
            </div>

            {testResult && (
              <div className="mt-2 text-sm">
                <span className="text-textDim">Test:</span>
                <span className="ml-2">{testResult}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-textDim">Base URL:</span>
                <div className="font-mono text-xs mt-1 p-2 bg-surface2 rounded">{provider.base_url}</div>
              </div>
              <div>
                <span className="text-textDim">Status:</span>
                <div className="mt-1">
                  <span className="text-green-400">● Connected</span>
                  {provider.last_checked ? (
                    <span className="text-xs text-textDim ml-2">Last checked: {new Date(provider.last_checked).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
              <div>
                <span className="text-textDim">Created:</span>
                <div className="mt-1">{new Date(provider.created_at).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-textDim">Models:</span>
                <div className="mt-1">{models.length} configured</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Models Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Models ({models.length})</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => {/* TODO: Auto-discover models */}}
              className="px-3 py-2 text-sm rounded-md border border-[var(--border)] hover:bg-surface2"
            >
              Auto-Discover
            </button>
            <button 
              onClick={() => setShowAddModel(true)}
              className="px-3 py-2 text-sm rounded-md bg-[var(--accent)] text-black font-medium"
            >
              Add Model
            </button>
          </div>
        </div>

        {models.length === 0 && !showAddModel ? (
          <div className="text-center py-8">
            <div className="text-textDim mb-4">No models configured for this provider</div>
            <button
              onClick={() => setShowAddModel(true)}
              className="px-4 py-2 rounded-md bg-[var(--accent)] text-black font-medium"
            >
              Add Your First Model
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {models.map((model: any) => (
              <ModelRow key={model.id} model={model} provider={provider} onUpdate={onProviderUpdate} />
            ))}
          </div>
        )}

        {/* Always render the add model form when showAddModel is true, regardless of existing models */}
        {showAddModel && (
          <div className="mt-3">
            <InlineModelAdd
              providerId={provider.id}
              onCancel={() => setShowAddModel(false)}
              onSave={() => {
                setShowAddModel(false);
                onProviderUpdate();
              }}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Provider"
          message={`Are you sure you want to delete "${provider.name}"? This will also delete all ${models.length} associated models. This action cannot be undone.`}
          confirmText="Delete"
          confirmStyle="danger"
          onConfirm={() => {
            deleteProviderMutation.mutate();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
          isLoading={deleteProviderMutation.isPending}
          error={deleteProviderMutation.error ? String(deleteProviderMutation.error) : undefined}
        />
      )}
    </div>
  );
}

function ModelRow({ model, provider, onUpdate }: { model: any; provider: any; onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<any>(null);

  const qc = useQueryClient();
  const deleteModelMutation = useMutation({
    mutationFn: (cascade: boolean = false) => deleteModel(model.id, cascade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['models'] });
      onUpdate();
      setShowDeleteConfirm(false);
      setDeleteError(null);
    },
    onError: (error: any) => {
      if (error.details?.blockingRuns) {
        setDeleteError(error.details);
      } else {
        setDeleteError({ message: error.message });
      }
    },
  });

  if (isEditing) {
    return (
      <InlineModelEdit
        model={model}
        provider={provider}
        onCancel={() => setIsEditing(false)}
        onSave={() => {
          setIsEditing(false);
          onUpdate();
        }}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-md hover:bg-surface2/50 transition-colors">
        <div>
          <div className="font-medium">{model.label}</div>
          <div className="text-sm text-textDim font-mono">{model.model_id}</div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(true)}
            className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-surface2"
          >
            Edit
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="px-2 py-1 text-xs rounded border border-red-600 text-red-400 hover:bg-red-600/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ModelDeleteDialog
          model={model}
          deleteError={deleteError}
          isLoading={deleteModelMutation.isPending}
          onConfirm={(cascade: boolean) => deleteModelMutation.mutate(cascade)}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }}
        />
      )}
    </>
  );
}

function InlineProviderEdit({ provider, onCancel, onSave }: { provider: any; onCancel: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (v: FormValues) => updateProvider(provider.id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      onSave();
    },
  });

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: provider.name,
      adapter: provider.adapter,
      baseUrl: provider.base_url,
      apiKey: '',
      defaultModel: provider.default_model || '',
    },
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Name</span>
          <input 
            className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
            {...register('name')} 
          />
          {formState.errors.name && (
            <span className="text-[var(--danger)] text-xs">{formState.errors.name.message}</span>
          )}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Adapter</span>
          <select className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" {...register('adapter')}>
            <option value="openai_compat">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-textDim">Base URL</span>
        <input 
          className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
          {...register('baseUrl')} 
        />
        {formState.errors.baseUrl && (
          <span className="text-[var(--danger)] text-xs">{formState.errors.baseUrl.message}</span>
        )}
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-textDim">API Key (leave blank to keep current)</span>
        <input 
          className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
          type="password" 
          placeholder="Leave blank to keep current"
          {...register('apiKey')} 
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-textDim">Default Model (optional)</span>
        <input 
          className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
          {...register('defaultModel')} 
          placeholder="gpt-4o-mini"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-3 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={mutation.isPending} 
          className="px-3 py-2 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {mutation.isError && (
        <div className="text-[var(--danger)] text-sm">{String(mutation.error)}</div>
      )}
    </form>
  );
}

function InlineModelEdit({ model, provider, onCancel, onSave }: { model: any; provider: any; onCancel: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  // Initialize with exactly what's stored in the database to avoid state mismatches
  const [advancedParameters, setAdvancedParameters] = useState<AdvancedParameters>(
    model.settings?.parameters || {}
  );
  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      label: model.label,
      modelId: model.model_id,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      // Only save parameters that are actually enabled to avoid storing unnecessary data
      const enabledParameters = Object.fromEntries(
        Object.entries(advancedParameters).filter(([_, config]) => config.enabled)
      );
      const settings = Object.keys(enabledParameters).length > 0 ? { parameters: enabledParameters } : undefined;
      return updateModel(model.id, { ...data, settings });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['models'] });
      onSave();
    },
  });

  return (
    <form 
      className="p-3 border border-[var(--accent)] rounded-md bg-[var(--accent)]/5" 
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Label</span>
          <input
            className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring text-sm"
            {...register('label', { required: true })}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Model ID</span>
          <input
            className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring text-sm font-mono"
            {...register('modelId', { required: true })}
          />
        </label>
      </div>

      <div className="mb-3">
        <AdvancedParametersConfig
          adapter={provider.adapter}
          parameters={advancedParameters}
          onChange={setAdvancedParameters}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-2 py-1 text-xs rounded border border-[var(--border)] text-textDim hover:bg-surface2"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={mutation.isPending} 
          className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {mutation.isError && (
        <div className="text-[var(--danger)] text-xs mt-2">{String(mutation.error)}</div>
      )}
    </form>
  );
}

function InlineModelAdd({ providerId, onCancel, onSave }: { providerId: string; onCancel: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm({
    defaultValues: {
      label: '',
      modelId: '',
    },
  });
  
  const mutation = useMutation({
    mutationFn: (data: any) => createModel({ providerId, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['models'] });
      reset();
      onSave();
    },
  });

  return (
    <form 
      className="p-3 border-2 border-dashed border-[var(--accent)] rounded-md bg-[var(--accent)]/5" 
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Label</span>
          <input 
            className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring text-sm" 
            placeholder="GPT-4o Mini"
            {...register('label', { required: true })} 
            autoFocus
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-textDim">Model ID</span>
          <input 
            className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring text-sm font-mono" 
            placeholder="gpt-4o-mini"
            {...register('modelId', { required: true })} 
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-2 py-1 text-xs rounded border border-[var(--border)] text-textDim hover:bg-surface2"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={mutation.isPending} 
          className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? 'Adding…' : 'Add Model'}
        </button>
      </div>

      {mutation.isError && (
        <div className="text-[var(--danger)] text-xs mt-2">{String(mutation.error)}</div>
      )}
    </form>
  );
}



function AddProviderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (providerId: string) => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (v: FormValues) => createProvider(v),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      onSuccess?.(result.id);
      onClose();
    },
  });

  const { register, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { adapter: 'openai_compat' },
  });

  const onSubmit = (v: FormValues) => {
    mutation.mutate(v);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-md border border-[var(--border)] shadow-2xl"
           style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Provider</h2>
          <button onClick={onClose} className="text-textDim hover:text-text">✕</button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Name</span>
            <input 
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
              placeholder="My OpenAI" 
              {...register('name')} 
            />
            {formState.errors.name && (
              <span className="text-[var(--danger)] text-xs">{formState.errors.name.message}</span>
            )}
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Adapter</span>
            <select className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" {...register('adapter')}>
              <option value="openai_compat">OpenAI-compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Base URL</span>
            <input 
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
              placeholder="https://api.openai.com/v1" 
              {...register('baseUrl')} 
            />
            {formState.errors.baseUrl && (
              <span className="text-[var(--danger)] text-xs">{formState.errors.baseUrl.message}</span>
            )}
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">API Key (stored server-side)</span>
            <input 
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
              type="password" 
              placeholder="sk-..." 
              {...register('apiKey')} 
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Default Model (optional)</span>
            <input 
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring" 
              placeholder="gpt-4o-mini" 
              {...register('defaultModel')} 
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={mutation.isPending} 
              className="px-3 py-2 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>

          {mutation.isError && (
            <div className="text-[var(--danger)] text-sm">{String(mutation.error)}</div>
          )}
        </form>
      </div>
    </div>
  );
}



function AddModelModal({
  onClose,
  providers,
  defaultProviderId,
  onSuccess
}: {
  onClose: () => void;
  providers: any;
  defaultProviderId?: string;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();

  // Initialize with default parameters (temperature enabled by default)
  const getDefaultParameters = (adapter: string): AdvancedParameters => {
    const defaults: AdvancedParameters = {};

    // Enable temperature by default for all supported APIs
    if (['openai_compat', 'anthropic', 'gemini'].includes(adapter)) {
      defaults.temperature = { enabled: true, value: 0.7 };
    }

    return defaults;
  };

  const [advancedParameters, setAdvancedParameters] = useState<AdvancedParameters>({});
  const { register, handleSubmit, formState, reset, watch } = useForm<{ providerId: string; label: string; modelId: string }>({
    defaultValues: {
      providerId: defaultProviderId || '',
      label: '',
      modelId: ''
    },
  });

  const selectedProviderId = watch('providerId');
  const selectedProvider = providers?.find((p: any) => p.id === selectedProviderId);

  // Update advanced parameters when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const defaults = getDefaultParameters(selectedProvider.adapter);
      setAdvancedParameters(defaults);
    }
  }, [selectedProvider?.adapter]);

  const mutation = useMutation({
    mutationFn: (data: { providerId: string; label: string; modelId: string; settings?: Record<string, unknown> }) => createModel(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['models'] });
      reset({ providerId: defaultProviderId || '' });
      setAdvancedParameters({});
      onSuccess?.();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-md border border-[var(--border)] shadow-2xl"
           style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Model</h2>
          <button onClick={onClose} className="text-textDim hover:text-text">✕</button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit((v) => {
          // Only save parameters that are actually enabled to avoid storing unnecessary data
          const enabledParameters = Object.fromEntries(
            Object.entries(advancedParameters).filter(([_, config]) => config.enabled)
          );
          const settings = Object.keys(enabledParameters).length > 0 ? { parameters: enabledParameters } : undefined;
          mutation.mutate({ ...v, settings });
        })}>
          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Provider</span>
            <select
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
              {...register('providerId', { required: true })}
            >
              <option value="">Select…</option>
              {providers.data?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Label</span>
            <input
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
              {...register('label', { required: true })}
              placeholder="GPT-4o Mini"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-textDim">Model ID</span>
            <input
              className="bg-surface2 border border-[var(--border)] rounded-md px-3 py-2 focus-ring"
              {...register('modelId', { required: true })}
              placeholder="gpt-4o-mini"
            />
          </label>

          {selectedProvider && (
            <AdvancedParametersConfig
              adapter={selectedProvider.adapter}
              parameters={advancedParameters}
              onChange={setAdvancedParameters}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={mutation.isPending} 
              className="px-3 py-2 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>

          {mutation.isError && (
            <div className="text-[var(--danger)] text-sm">{String(mutation.error)}</div>
          )}
        </form>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  confirmStyle = "primary",
  onConfirm,
  onCancel,
  isLoading = false,
  error
}: {
  title: string;
  message: string;
  confirmText?: string;
  confirmStyle?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}) {
  const confirmButtonClass = confirmStyle === "danger" 
    ? "px-4 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
    : "px-4 py-2 rounded-md bg-[var(--accent)] text-black font-medium hover:opacity-90 disabled:opacity-50";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-md border border-[var(--border)] shadow-2xl"
           style={{ backgroundColor: 'var(--surface)' }}>
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-textDim mb-6">{message}</p>
        
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-600/10 border border-red-600/20">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmButtonClass}
          >
            {isLoading ? 'Deleting...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModelDeleteDialogProps {
  model: any;
  deleteError: any;
  isLoading: boolean;
  onConfirm: (cascade: boolean) => void;
  onCancel: () => void;
}

function ModelDeleteDialog({ model, deleteError, isLoading, onConfirm, onCancel }: ModelDeleteDialogProps) {
  const hasBlockingRuns = deleteError?.blockingRuns?.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Delete Model</h2>

        {!hasBlockingRuns ? (
          <div>
            <p className="text-textDim mb-6">
              Are you sure you want to delete the model "{model.label}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete Model'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="font-medium text-yellow-800 mb-2">Cannot Delete Model</h3>
              <p className="text-yellow-700 text-sm">
                {deleteError.message}
              </p>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3">Blocking Runs ({deleteError.totalBlockingRuns}):</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {deleteError.blockingRuns.map((run: any) => (
                  <div key={run.id} className="p-3 bg-[var(--surface-1)] border border-[var(--border)] rounded text-sm">
                    <div className="font-medium">{run.name}</div>
                    <div className="text-textDim text-xs mt-1">
                      ID: {run.id} • Created: {new Date(run.created).toLocaleDateString()}
                      {run.isJudgeModel && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">Judge Model</span>}
                      {run.isTestModel && <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs">Test Model</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="font-medium text-red-800 mb-2">Cascade Deletion Option</h4>
              <p className="text-red-700 text-sm mb-3">
                You can force delete this model along with all {deleteError.totalBlockingRuns} associated runs.
                This will permanently delete all run data and results. This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 rounded-md border border-[var(--border)] text-textDim hover:bg-surface2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(true)}
                disabled={isLoading}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : `Force Delete Model + ${deleteError.totalBlockingRuns} Runs`}
              </button>
            </div>
          </div>
        )}

        {deleteError && !hasBlockingRuns && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {deleteError.message}
          </div>
        )}
      </div>
    </div>
  );
}

