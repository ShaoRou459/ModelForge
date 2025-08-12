import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';

// Load env
dotenv.config();

const PORT = Number(process.env.PORT || 5174);

// DB path resolution that works for both layouts (apps/api/var and apps/api/apps/api/var)
const ROOT = process.cwd();
const DB_DIR_CANDIDATES = [
  join(ROOT, 'apps', 'api', 'var'),
  join(ROOT, 'apps', 'api', 'apps', 'api', 'var'),
];
const existingDirs = DB_DIR_CANDIDATES.filter((p) => existsSync(p));
const DB_DIR = (existingDirs.length > 0 ? existingDirs[0] : DB_DIR_CANDIDATES[0]) as string;
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = join(DB_DIR as string, 'data.sqlite');

// Init DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Bootstrap schema (core tables)
db.exec(`
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adapter TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_enc BLOB,
  default_model TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  label TEXT NOT NULL,
  model_id TEXT NOT NULL,
  settings TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);
CREATE TABLE IF NOT EXISTS problem_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  expected_answer TEXT,
  html_assets TEXT,
  scoring TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id)
);
`);

// Runs + run_results schema with AI-judge required semantics (judge_model_id NOT NULL)
db.exec(`
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  name TEXT,
  problem_set_id TEXT NOT NULL,
  model_ids TEXT NOT NULL,
  judge_model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  stream INTEGER NOT NULL DEFAULT 0,
  cancelled_at INTEGER,
  cancelled_by TEXT,
  FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id),
  FOREIGN KEY (judge_model_id) REFERENCES models(id)
);
CREATE TABLE IF NOT EXISTS run_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  output TEXT,
  score REAL,
  status TEXT NOT NULL,
  judged_by TEXT,
  created_at INTEGER NOT NULL,
  cancelled_at INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(id),
  FOREIGN KEY (problem_id) REFERENCES problems(id)
);
`);

/* One-time defensive ALTERs: add missing columns if they do not exist */
try {
  // Ensure runs.stream exists
  const runCols = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
  const hasStream = runCols.some((c) => c.name === 'stream');
  if (!hasStream) {
    db.exec("ALTER TABLE runs ADD COLUMN stream INTEGER NOT NULL DEFAULT 0");
  }

  // Ensure providers.last_checked exists (store last successful probe timestamp)
  const provCols = db.prepare("PRAGMA table_info(providers)").all() as Array<{ name: string }>;
  const hasLastChecked = provCols.some((c) => c.name === 'last_checked');
  if (!hasLastChecked) {
    db.exec("ALTER TABLE providers ADD COLUMN last_checked INTEGER");
  }

  // Ensure problems.created_at exists (for chronological ordering)
  const problemCols = db.prepare("PRAGMA table_info(problems)").all() as Array<{ name: string }>;
  const hasCreatedAt = problemCols.some((c) => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE problems ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0");
    // Update existing problems with current timestamp
    db.exec(`UPDATE problems SET created_at = ${now()} WHERE created_at = 0`);
  }

  // Ensure run_results.judge_reasoning exists (for storing judge explanations)
  const runResultsCols = db.prepare("PRAGMA table_info(run_results)").all() as Array<{ name: string }>;
  const hasJudgeReasoning = runResultsCols.some((c) => c.name === 'judge_reasoning');
  if (!hasJudgeReasoning) {
    db.exec("ALTER TABLE run_results ADD COLUMN judge_reasoning TEXT");
  }

  // Ensure cancellation columns exist
  const runsCols = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
  const hasCancelledAt = runsCols.some((c) => c.name === 'cancelled_at');
  const hasCancelledBy = runsCols.some((c) => c.name === 'cancelled_by');
  if (!hasCancelledAt) {
    db.exec("ALTER TABLE runs ADD COLUMN cancelled_at INTEGER");
  }
  if (!hasCancelledBy) {
    db.exec("ALTER TABLE runs ADD COLUMN cancelled_by TEXT");
  }

  const runResultsHasCancelledAt = runResultsCols.some((c) => c.name === 'cancelled_at');
  if (!runResultsHasCancelledAt) {
    db.exec("ALTER TABLE run_results ADD COLUMN cancelled_at INTEGER");
  }
} catch (e) {
  // Fastify app not yet initialized here; use console as a safe fallback
  console.warn('Could not ensure DB schema columns:', String(e));
}

// Minimal helpers
function now(): number {
  return Date.now();
}
function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Kill switch management
const runCancellations = new Map<string, AbortController>();
const modelCancellations = new Map<string, AbortController>(); // key: runId-modelId

function createRunCancellation(runId: string): AbortController {
  const controller = new AbortController();
  runCancellations.set(runId, controller);
  return controller;
}

function createModelCancellation(runId: string, modelId: string): AbortController {
  const controller = new AbortController();
  const key = `${runId}-${modelId}`;
  modelCancellations.set(key, controller);
  return controller;
}

function cancelRun(runId: string): boolean {
  const controller = runCancellations.get(runId);
  if (controller) {
    controller.abort();
    runCancellations.delete(runId);
    
    // Also cancel all model operations for this run
    const keysToDelete: string[] = [];
    for (const [key, modelController] of modelCancellations.entries()) {
      if (key.startsWith(`${runId}-`)) {
        modelController.abort();
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => modelCancellations.delete(key));
    
    return true;
  }
  return false;
}

function cancelModel(runId: string, modelId: string): boolean {
  const key = `${runId}-${modelId}`;
  const controller = modelCancellations.get(key);
  if (controller) {
    controller.abort();
    modelCancellations.delete(key);
    return true;
  }
  return false;
}

function cleanupCancellations(runId: string): void {
  runCancellations.delete(runId);
  const keysToDelete: string[] = [];
  for (const key of modelCancellations.keys()) {
    if (key.startsWith(`${runId}-`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => modelCancellations.delete(key));
}

// Create server
const app = Fastify({
  logger: true,
});

// Plugins
await app.register(sensible);
await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

// Ensure Cloudflare/Proxies do not buffer SSE; also allow long-lived connections
app.addHook('onRequest', async (_req, reply) => {
  reply.header('Cache-Control', 'no-cache, no-transform');
  reply.header('X-Accel-Buffering', 'no'); // Nginx
  reply.header('Connection', 'keep-alive');
});

// CORS (basic for dev)
app.addHook('onSend', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return;
});
app.options('/*', async (_req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  reply.code(204).send();
});

// Health
app.get('/api/health', async () => ({ status: 'ok', time: now() }));

// Providers
app.get('/api/providers', async () => {
  // Include last_checked so clients can show last test timestamp
  const rows = db
    .prepare(
      'SELECT id,name,adapter,base_url,default_model,created_at,last_checked FROM providers'
    )
    .all();
  return rows;
});

app.post('/api/providers', async (req, reply) => {
  const body = req.body as {
    name: string;
    adapter: string;
    baseUrl: string;
    apiKey?: string;
    defaultModel?: string;
  };
  if (!body?.name || !body?.adapter || !body?.baseUrl) {
    return reply.badRequest('Missing required fields');
  }
  // Normalize adapter to expected aliases to avoid mismatch later
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  let adapterStored = body.adapter;
  const a = norm(adapterStored);
  if (a === 'openaicompatible' || a === 'oai' || a === 'compatible' || a === 'openai') {
    adapterStored = 'openai_compat';
  }
  const stmt = db.prepare(
    `INSERT INTO providers (id,name,adapter,base_url,api_key_enc,default_model,created_at)
     VALUES (@id,@name,@adapter,@base_url,@api_key_enc,@default_model,@created_at)`
  );
  const id = genId();
  stmt.run({
    id,
    name: body.name,
    adapter: adapterStored,
    base_url: body.baseUrl.replace(/\/+$/, ''), // trim trailing slash
    api_key_enc: body.apiKey ?? null,
    default_model: body.defaultModel ?? null,
    created_at: now(),
  });
  reply.code(201);
  return { id };
});

// Models
app.get('/api/models', async (req) => {
  const providerId = (req.query as any)?.providerId as string | undefined;
  if (providerId) {
    return db.prepare('SELECT * FROM models WHERE provider_id = ?').all(providerId);
  }
  return db.prepare('SELECT * FROM models').all();
});

app.post('/api/models', async (req, reply) => {
  const body = req.body as {
    providerId: string;
    label: string;
    modelId: string;
    settings?: Record<string, unknown>;
  };
  if (!body?.providerId || !body?.label || !body?.modelId) {
    return reply.badRequest('Missing required fields');
  }
  const stmt = db.prepare(
    `INSERT INTO models (id,provider_id,label,model_id,settings)
     VALUES (@id,@provider_id,@label,@model_id,@settings)`
  );
  const id = genId();
  stmt.run({
    id,
    provider_id: body.providerId,
    label: body.label,
    model_id: body.modelId,
    settings: body.settings ? JSON.stringify(body.settings) : null,
  });
  reply.code(201);
  return { id };
});

// Update provider
app.put('/api/providers/:id', async (req, reply) => {
  const { id } = req.params as any;
  const body = req.body as {
    name?: string;
    adapter?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
  };

  // Check if provider exists
  const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
  if (!provider) {
    return reply.notFound('Provider not found');
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    values.push(body.name);
  }
  if (body.adapter !== undefined) {
    updates.push('adapter = ?');
    values.push(body.adapter);
  }
  if (body.baseUrl !== undefined) {
    updates.push('base_url = ?');
    values.push(body.baseUrl);
  }
  if (body.apiKey !== undefined && body.apiKey !== '') {
    updates.push('api_key_enc = ?');
    values.push(body.apiKey);
  }
  if (body.defaultModel !== undefined) {
    updates.push('default_model = ?');
    values.push(body.defaultModel);
  }

  if (updates.length === 0) {
    return reply.badRequest('No fields to update');
  }

  values.push(id); // for WHERE clause
  const query = `UPDATE providers SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...values);

  reply.code(200);
  return { success: true };
});

/**
 * Provider connection test endpoint with richer diagnostics.
 * Attempts GETs against common provider endpoints using stored credentials.
 * Returns { ok: true, status, url, attempts } on success or 400 with attempts array on failure.
 */
app.post('/api/providers/:id/test', async (req, reply) => {
  const { id } = req.params as any;
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
  if (!provider) return reply.notFound('Provider not found');

  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const a = norm(provider.adapter || '');

  // Normalize base: trim trailing slashes and strip a trailing /v1 to avoid double /v1 paths
  const baseUrlRaw = String(provider.base_url || '');
  const baseUrlTrimmed = baseUrlRaw.replace(/\/+$/, '');
  const normalizedBase = baseUrlTrimmed.replace(/\/v1$/i, '');
  const apiKey = provider.api_key_enc ? String(provider.api_key_enc) : '';

  // Candidate endpoints to probe (try canonical endpoints using normalized base)
  const tryUrls = [
    `${normalizedBase}/v1/models`,
    `${normalizedBase}/models`,
    normalizedBase,
  ];

  const attempts: Array<any> = [];

  for (const urlBase of tryUrls) {
    const urlTry = String(urlBase);
    try {
      let url = urlTry;
      const headers: Record<string, string> = { 'Accept': 'application/json' };

      // Adapter-specific auth hints
      if (a.includes('anthropic') || a.includes('claude')) {
        if (apiKey) headers['x-api-key'] = apiKey;
      } else if (a.includes('google') || a.includes('gemini') || a.includes('googleai')) {
        // Google/Gemini often use ?key= API key; attach if available
        if (apiKey && !url.includes('?')) url = `${url}?key=${encodeURIComponent(apiKey)}`;
      } else {
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(url, { method: 'GET', headers, redirect: 'follow' as RequestRedirect });
      const text = await res.text().catch(() => '');

      attempts.push({
        url,
        ok: !!res && res.ok,
        status: res?.status ?? null,
        snippet: String(text).slice(0, 1000),
        headers: (() => {
          try {
            // collect a few headers for diagnostics
            const h: Record<string, string | null> = {};
            if (res?.headers) {
              h['content-type'] = res.headers.get('content-type');
              h['www-authenticate'] = res.headers.get('www-authenticate');
            }
            return h;
          } catch { return {}; }
        })(),
      });

      if (res && res.ok) {
        // Persist last successful probe time so UI can display a reliable "Last checked"
        try {
          db.prepare('UPDATE providers SET last_checked = ? WHERE id = ?').run(now(), id);
        } catch (e) {
          app.log.warn({ err: String(e) }, 'Failed to persist provider.last_checked');
        }
        return reply.code(200).send({ ok: true, status: res.status, url, attempts });
      }
    } catch (err: any) {
      attempts.push({
        url: urlTry,
        ok: false,
        error: String(err).slice(0, 1000),
      });
    }
  }

  // All probes failed - return diagnostic info
  return reply.code(400).send({
    ok: false,
    message: 'All probes failed; see attempts for details',
    attempts,
  });
});

/**
 * Delete provider (cascade delete runs and results that reference provider's models).
 * This will remove any runs that reference models from the provider, clear associated run_results,
 * then remove the provider and its models in a transaction.
 */
app.delete('/api/providers/:id', async (req, reply) => {
  const { id } = req.params as any;
  
  // Check if provider exists
  const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
  if (!provider) {
    return reply.notFound('Provider not found');
  }

  // Gather models for this provider
  const models = db.prepare('SELECT id FROM models WHERE provider_id = ?').all(id) as Array<{ id: string }>;
  const modelIds = models.map(m => m.id);

  // Find runs that reference these models either as judge_model_id or included in model_ids JSON
  let runs: Array<{ id: string }> = [];
  if (modelIds.length > 0) {
    // judge_model_id usage
    const judgeRuns = db.prepare('SELECT id FROM runs WHERE judge_model_id IN (' + modelIds.map(() => '?').join(',') + ')').all(...modelIds) as Array<{ id: string }>;
    // model_ids JSON usage
    const allRuns = db.prepare('SELECT id, model_ids FROM runs').all() as Array<{ id: string; model_ids: string }>;
    const modelIdsRuns = allRuns.filter(run => {
      try {
        const runModelIds = JSON.parse(run.model_ids);
        return modelIds.some(modelId => runModelIds.includes(modelId));
      } catch {
        return false;
      }
    });

    runs = [...judgeRuns, ...modelIdsRuns.map(r => ({ id: r.id }))];
    // Deduplicate
    runs = runs.filter((run, index, self) => self.findIndex(r => r.id === run.id) === index);
  }

  // Perform cascade deletion: remove run_results for these runs, delete runs, then models and provider.
  const delRunResultsByRun = db.prepare('DELETE FROM run_results WHERE run_id = ?');
  const delRun = db.prepare('DELETE FROM runs WHERE id = ?');
  const deleteModels = db.prepare('DELETE FROM models WHERE provider_id = ?');
  const deleteProvider = db.prepare('DELETE FROM providers WHERE id = ?');

  // Temporarily disable FK checks to guarantee we can delete cleanly even if constraints exist
  const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma('foreign_keys = OFF');

  try {
    db.transaction(() => {
      for (const r of runs) {
        delRunResultsByRun.run(r.id);
        delRun.run(r.id);
      }
      deleteModels.run(id);
      deleteProvider.run(id);
    })();
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON');
  }

  reply.code(204);
  return null as any;
});

// Update model
app.put('/api/models/:id', async (req, reply) => {
  const { id } = req.params as any;
  const body = req.body as {
    label?: string;
    modelId?: string;
    settings?: Record<string, unknown>;
  };

  // Check if model exists
  const model = db.prepare('SELECT id FROM models WHERE id = ?').get(id);
  if (!model) {
    return reply.notFound('Model not found');
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (body.label !== undefined) {
    updates.push('label = ?');
    values.push(body.label);
  }
  if (body.modelId !== undefined) {
    updates.push('model_id = ?');
    values.push(body.modelId);
  }
  if (body.settings !== undefined) {
    updates.push('settings = ?');
    values.push(JSON.stringify(body.settings));
  }

  if (updates.length === 0) {
    return reply.badRequest('No fields to update');
  }

  values.push(id); // for WHERE clause
  const query = `UPDATE models SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...values);

  reply.code(200);
  return { success: true };
});

// Delete model
app.delete('/api/models/:id', async (req, reply) => {
  const { id } = req.params as any;
  const { cascade } = req.query as any;

  // Check if model exists
  const model = db.prepare('SELECT id, label FROM models WHERE id = ?').get(id) as any;
  if (!model) {
    return reply.notFound('Model not found');
  }

  // Check for associated runs (both as judge model and in model_ids)
  const judgeRuns = db.prepare('SELECT id, name, created_at FROM runs WHERE judge_model_id = ?').all(id) as Array<{ id: string; name: string | null; created_at: number }>;

  // Check for model_ids JSON usage
  const allRuns = db.prepare('SELECT id, name, model_ids, created_at FROM runs').all() as Array<{ id: string; name: string | null; model_ids: string; created_at: number }>;
  const modelIdsRuns = allRuns.filter(run => {
    try {
      const runModelIds = JSON.parse(run.model_ids);
      return runModelIds.includes(id);
    } catch {
      return false;
    }
  });

  const runs = [...judgeRuns, ...modelIdsRuns];
  // Remove duplicates
  const uniqueRuns = runs.filter((run, index, self) => self.findIndex(r => r.id === run.id) === index);

  if (uniqueRuns.length > 0) {
    if (cascade === 'true') {
      // Cascade delete: remove all associated runs and their results
      const delRunResultsByRun = db.prepare('DELETE FROM run_results WHERE run_id = ?');
      const delRun = db.prepare('DELETE FROM runs WHERE id = ?');
      const delModel = db.prepare('DELETE FROM models WHERE id = ?');

      db.transaction(() => {
        for (const run of uniqueRuns) {
          delRunResultsByRun.run(run.id);
          delRun.run(run.id);
        }
        delModel.run(id);
      })();

      reply.code(200);
      return {
        message: `Model "${model.label}" and ${uniqueRuns.length} associated runs deleted successfully`,
        deletedRuns: uniqueRuns.length
      };
    } else {
      // Provide detailed information about blocking runs
      const runDetails = uniqueRuns.map(run => ({
        id: run.id,
        name: run.name || `Run ${run.id.slice(0, 8)}`,
        created: new Date(run.created_at).toISOString(),
        isJudgeModel: judgeRuns.some(jr => jr.id === run.id),
        isTestModel: modelIdsRuns.some(mr => mr.id === run.id)
      }));

      reply.code(400);
      return {
        error: 'Cannot delete model: runs are using this model',
        message: `Cannot delete model "${model.label}": ${uniqueRuns.length} runs are using this model. Delete those runs first or use cascade deletion.`,
        modelId: id,
        modelLabel: model.label,
        blockingRuns: runDetails,
        totalBlockingRuns: uniqueRuns.length,
        cascadeDeleteUrl: `/api/models/${id}?cascade=true`
      };
    }
  }

  // Delete the model
  db.prepare('DELETE FROM models WHERE id = ?').run(id);

  reply.code(204);
  return null as any;
});

// Problem Sets
app.get('/api/problem-sets', async () => {
  return db.prepare('SELECT * FROM problem_sets').all();
});
app.post('/api/problem-sets', async (req, reply) => {
  const body = req.body as { name: string; description?: string };
  if (!body?.name) return reply.badRequest('Missing name');
  const id = genId();
  db.prepare(
    `INSERT INTO problem_sets (id,name,description,created_at)
     VALUES (@id,@name,@description,@created_at)`
  ).run({
    id,
    name: body.name,
    description: body.description ?? null,
    created_at: now(),
  });
  reply.code(201);
  return { id };
});

// Update a problem set
app.put('/api/problem-sets/:id', async (req, reply) => {
  const { id } = req.params as any;
  const body = req.body as { name?: string; description?: string };
  const row = db.prepare('SELECT id FROM problem_sets WHERE id = ?').get(id);
  if (!row) return reply.notFound('Problem set not found');
  if (!body?.name && typeof body?.description === 'undefined') {
    return reply.badRequest('Nothing to update');
  }
  const current = db.prepare('SELECT name, description FROM problem_sets WHERE id = ?').get(id) as any;
  const name = body.name ?? current.name;
  const description = typeof body.description === 'undefined' ? current.description : body.description ?? null;
  db.prepare('UPDATE problem_sets SET name=@name, description=@description WHERE id=@id').run({ id, name, description });
  return { id };
});

// Delete a problem set (cascade: delete runs/results and problems)
app.delete('/api/problem-sets/:id', async (req, reply) => {
  const { id } = req.params as any;
  const row = db.prepare('SELECT id FROM problem_sets WHERE id = ?').get(id);
  if (!row) return reply.notFound('Problem set not found');

  const runs = db.prepare('SELECT id FROM runs WHERE problem_set_id = ?').all(id) as Array<{ id: string }>;
  const problemIds = db.prepare('SELECT id FROM problems WHERE problem_set_id = ?').all(id) as Array<{ id: string }>;

  const delRunResultsByRun = db.prepare('DELETE FROM run_results WHERE run_id = ?');
  const delRunResultsByProblem = db.prepare('DELETE FROM run_results WHERE problem_id = ?');
  const delRunsBySet = db.prepare('DELETE FROM runs WHERE problem_set_id = ?');
  const delProblemsBySet = db.prepare('DELETE FROM problems WHERE problem_set_id = ?');
  const delProblemSet = db.prepare('DELETE FROM problem_sets WHERE id = ?');

  // Temporarily disable FK checks to ensure clean cascade even if orphaned rows exist
  const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const p of problemIds) {
        delRunResultsByProblem.run(p.id);
      }
      for (const r of runs) {
        delRunResultsByRun.run(r.id);
      }
      delRunsBySet.run(id);
      delProblemsBySet.run(id);
      delProblemSet.run(id);
    })();
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON');
  }

  reply.code(204);
  return null as any;
});

// Problems
app.get('/api/problems', async (req) => {
  const problemSetId = (req.query as any)?.problemSetId as string | undefined;
  if (problemSetId) {
    return db
      .prepare('SELECT * FROM problems WHERE problem_set_id = ? ORDER BY created_at ASC')
      .all(problemSetId);
  }
  return db.prepare('SELECT * FROM problems ORDER BY created_at ASC').all();
});
app.post('/api/problems', async (req, reply) => {
  const body = req.body as {
    problemSetId: string;
    type: 'text' | 'html';
    prompt: string;
    expectedAnswer?: string;
    htmlAssets?: { html?: string; css?: string; js?: string };
    scoring?: Record<string, unknown>;
  };
  if (!body?.problemSetId || !body?.type || !body?.prompt) {
    return reply.badRequest('Missing required fields');
  }
  const id = genId();
  db.prepare(
    `INSERT INTO problems (id,problem_set_id,type,prompt,expected_answer,html_assets,scoring,created_at)
     VALUES (@id,@problem_set_id,@type,@prompt,@expected_answer,@html_assets,@scoring,@created_at)`
  ).run({
    id,
    problem_set_id: body.problemSetId,
    type: body.type,
    prompt: body.prompt,
    expected_answer: body.expectedAnswer ?? null,
    html_assets: body.htmlAssets ? JSON.stringify(body.htmlAssets) : null,
    scoring: body.scoring ? JSON.stringify(body.scoring) : null,
    created_at: now(),
  });
  reply.code(201);
  return { id };
});

// Update a problem
app.put('/api/problems/:id', async (req, reply) => {
  const { id } = req.params as any;
  const body = req.body as {
    type?: 'text' | 'html';
    prompt?: string;
    expectedAnswer?: string;
    htmlAssets?: { html?: string; css?: string; js?: string } | null;
    scoring?: Record<string, unknown> | null;
    problemSetId?: string;
  };
  const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(id) as any;
  if (!row) return reply.notFound('Problem not found');
  const next = {
    type: body.type ?? row.type,
    prompt: body.prompt ?? row.prompt,
    problem_set_id: body.problemSetId ?? row.problem_set_id,
    expected_answer: typeof body.expectedAnswer === 'undefined' ? row.expected_answer : body.expectedAnswer ?? null,
    html_assets: typeof body.htmlAssets === 'undefined' ? row.html_assets : (body.htmlAssets ? JSON.stringify(body.htmlAssets) : null),
    scoring: typeof body.scoring === 'undefined' ? row.scoring : (body.scoring ? JSON.stringify(body.scoring) : null),
  } as const;
  db.prepare(
    'UPDATE problems SET type=@type, prompt=@prompt, problem_set_id=@problem_set_id, expected_answer=@expected_answer, html_assets=@html_assets, scoring=@scoring WHERE id=@id'
  ).run({ id, ...next });
  return { id };
});

// Delete a problem (cascade delete associated run_results)
app.delete('/api/problems/:id', async (req, reply) => {
  const { id } = req.params as any;
  const row = db.prepare('SELECT id FROM problems WHERE id = ?').get(id);
  if (!row) return reply.notFound('Problem not found');

  // Cascade delete: first delete all run_results for this problem, then delete the problem
  const delRunResultsByProblem = db.prepare('DELETE FROM run_results WHERE problem_id = ?');
  const delProblem = db.prepare('DELETE FROM problems WHERE id = ?');

  // Temporarily disable FK checks to ensure clean cascade
  const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma('foreign_keys = OFF');

  try {
    db.transaction(() => {
      delRunResultsByProblem.run(id);
      delProblem.run(id);
    })();
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON');
  }

  reply.code(204);
  return null as any;
});

// Retry utility with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain error types
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('404')) {
        throw error;
      }

      if (attempt === maxRetries) {
        app.log.error({
          context,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: error.message
        }, `${context} failed after ${maxRetries + 1} attempts`);
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
      app.log.warn({
        context,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        error: error.message
      }, `${context} failed, retrying in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Minimal model dispatcher
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function callModel(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
  context: string = 'model_call'
): Promise<string> {
  const provider = db
    .prepare('SELECT * FROM providers WHERE id = ?')
    .get(providerId) as any;
  if (!provider) throw new Error('Provider not found');

  // Get model settings - modelId here is the actual model_id field, not the database id
  const model = db
    .prepare('SELECT * FROM models WHERE provider_id = ? AND model_id = ?')
    .get(providerId, modelId) as any;

  const modelSettings = model?.settings ? JSON.parse(model.settings) : {};
  const parameters = modelSettings.parameters || {};

  const rawAdapter = String(provider.adapter || '');
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const a = norm(rawAdapter);
  const baseUrl = String(provider.base_url);
  const apiKey = provider.api_key_enc ? String(provider.api_key_enc) : '';

  const sys = messages.find((m) => m.role === 'system')?.content;
  const userParts = messages.filter((m) => m.role !== 'system');

  // Helper function to build API parameters from model settings
  const buildApiParams = (adapter: string) => {
    const params: any = {};

    // Only add parameters that are explicitly enabled
    if (parameters.temperature?.enabled) {
      params.temperature = parameters.temperature.value;
    }

    if (parameters.max_tokens?.enabled) {
      if (adapter === 'gemini') {
        params.max_output_tokens = parameters.max_tokens.value;
      } else {
        params.max_tokens = parameters.max_tokens.value;
      }
    }

    if (parameters.top_p?.enabled && ['openai_compat', 'anthropic', 'gemini'].includes(adapter)) {
      params.top_p = parameters.top_p.value;
    }

    if (parameters.top_k?.enabled && ['anthropic', 'gemini'].includes(adapter)) {
      params.top_k = parameters.top_k.value;
    }

    if (parameters.frequency_penalty?.enabled && ['openai_compat', 'gemini'].includes(adapter)) {
      params.frequency_penalty = parameters.frequency_penalty.value;
    }

    if (parameters.presence_penalty?.enabled && ['openai_compat', 'gemini'].includes(adapter)) {
      params.presence_penalty = parameters.presence_penalty.value;
    }

    if (parameters.stop_sequences?.enabled && Array.isArray(parameters.stop_sequences.value) && parameters.stop_sequences.value.length > 0) {
      if (adapter === 'anthropic') {
        params.stop_sequences = parameters.stop_sequences.value;
      } else {
        params.stop = parameters.stop_sequences.value;
      }
    }

    return params;
  };

  // OpenAI-compatible aliases
  if (a === 'openai' || a === 'openaicompatible' || a === 'openai_compat' || a === 'openaicompat' || a === 'oai' || a === 'compatible') {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const apiParams = buildApiParams('openai_compat');
    const body = {
      model: modelId,
      messages: [
        ...(sys ? [{ role: 'system', content: sys }] : []),
        ...userParts.map((m) => ({ role: m.role, content: m.content })),
      ],
      ...apiParams,
    };

    return await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`OpenAI-compatible error: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as any;
      const text = json.choices?.[0]?.message?.content ?? '';
      return String(text ?? '');
    }, 3, 1000, `${context} (OpenAI-compatible)`);
  }

  // Anthropic aliases
  if (a === 'anthropic' || a === 'claude') {
    const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
    const apiParams = buildApiParams('anthropic');

    // Anthropic requires max_tokens, so provide a default if not set
    if (!apiParams.max_tokens) {
      apiParams.max_tokens = 1024;
    }

    const body = {
      model: modelId,
      system: sys ?? undefined,
      messages: userParts.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      ...apiParams,
    };

    return await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as any;
      const content = json.content?.[0]?.text ?? '';
      return String(content ?? '');
    }, 3, 1000, `${context} (Anthropic)`);
  }

  // Google/Gemini aliases
  if (a === 'google' || a === 'gemini' || a === 'googlegenai' || a === 'googleai') {
    const prompt = [sys, ...userParts.map((m) => m.content)].filter(Boolean).join('\n\n');
    const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${encodeURIComponent(
      modelId
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const apiParams = buildApiParams('gemini');
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: apiParams,
    };

    return await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as any;
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return String(text ?? '');
    }, 3, 1000, `${context} (Gemini)`);
  }

  throw new Error(`Unsupported adapter: ${rawAdapter}`);
}

// Streaming version of callModel that emits tokens in real-time
async function callModelWithStreaming(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  context: string = 'streaming_model_call'
): Promise<string> {
  const provider = db
    .prepare('SELECT * FROM providers WHERE id = ?')
    .get(providerId) as any;
  if (!provider) throw new Error('Provider not found');

  // Get model settings
  const model = db
    .prepare('SELECT * FROM models WHERE provider_id = ? AND model_id = ?')
    .get(providerId, modelId) as any;

  const modelSettings = model?.settings ? JSON.parse(model.settings) : {};
  const parameters = modelSettings.parameters || {};

  const rawAdapter = String(provider.adapter || '');
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const a = norm(rawAdapter);
  const baseUrl = String(provider.base_url);
  const apiKey = provider.api_key_enc ? String(provider.api_key_enc) : '';

  const sys = messages.find((m) => m.role === 'system')?.content;
  const userParts = messages.filter((m) => m.role !== 'system');

  // Helper function to build API parameters from model settings
  const buildApiParams = (adapter: string) => {
    const params: any = { stream: true }; // Enable streaming

    // Only add parameters that are explicitly enabled
    if (parameters.temperature?.enabled) {
      params.temperature = parameters.temperature.value;
    }

    if (parameters.max_tokens?.enabled) {
      if (adapter === 'gemini') {
        params.max_output_tokens = parameters.max_tokens.value;
      } else {
        params.max_tokens = parameters.max_tokens.value;
      }
    }

    if (parameters.top_p?.enabled && ['openai_compat', 'anthropic', 'gemini'].includes(adapter)) {
      params.top_p = parameters.top_p.value;
    }

    if (parameters.top_k?.enabled && ['anthropic', 'gemini'].includes(adapter)) {
      params.top_k = parameters.top_k.value;
    }

    if (parameters.frequency_penalty?.enabled && ['openai_compat', 'gemini'].includes(adapter)) {
      params.frequency_penalty = parameters.frequency_penalty.value;
    }

    if (parameters.presence_penalty?.enabled && ['openai_compat', 'gemini'].includes(adapter)) {
      params.presence_penalty = parameters.presence_penalty.value;
    }

    if (parameters.stop_sequences?.enabled && Array.isArray(parameters.stop_sequences.value) && parameters.stop_sequences.value.length > 0) {
      params.stop = parameters.stop_sequences.value;
    }

    return params;
  };

  // OpenAI-compatible streaming
  if (a === 'openaicompat' || a === 'openai_compat' || a === 'openai') {
    const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    const apiParams = buildApiParams('openai_compat');

    return await withRetry(async () => {
      const body = {
        model: modelId,
        messages: messages,
        ...apiParams,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Connection': 'keep-alive',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`OpenAI-compatible stream error: ${res.status} ${txt}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const parts = buf.split(/\r?\n/);
          buf = parts.pop() ?? '';

          for (const rawLine of parts) {
            const line = rawLine.trim();
            if (line.length === 0 || line.startsWith(':')) continue;

            if (!line.toLowerCase().startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();

            if (dataStr === '[DONE]' || dataStr === '"[DONE]"') {
              return accumulated;
            }

            try {
              const obj = JSON.parse(dataStr);
              const content = obj.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                onToken(content);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return accumulated;
    }, 3, 1000, `${context} (OpenAI Streaming)`);
  }

  // Anthropic streaming
  if (a === 'anthropic') {
    const url = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;
    const apiParams = buildApiParams('anthropic');
    delete apiParams.stream; // Anthropic uses different streaming format

    return await withRetry(async () => {
      const body = {
        model: modelId,
        max_tokens: apiParams.max_tokens || 1024,
        messages: userParts,
        stream: true,
        ...(sys ? { system: sys } : {}),
        ...apiParams,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'anthropic-version': '2023-06-01',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Anthropic stream error: ${res.status} ${txt}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const parts = buf.split(/\r?\n/);
          buf = parts.pop() ?? '';

          for (const rawLine of parts) {
            const line = rawLine.trim();
            if (line.length === 0 || line.startsWith(':')) continue;

            if (!line.toLowerCase().startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();

            if (dataStr === '[DONE]') {
              return accumulated;
            }

            try {
              const obj = JSON.parse(dataStr);
              if (obj.type === 'content_block_delta' && obj.delta?.text) {
                accumulated += obj.delta.text;
                onToken(obj.delta.text);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return accumulated;
    }, 3, 1000, `${context} (Anthropic Streaming)`);
  }

  // For non-streaming adapters (Gemini), fall back to regular callModel
  // TODO: Implement streaming for Gemini
  const result = await callModel(providerId, modelId, messages, context);
  // Emit the whole result as one token for non-streaming providers
  onToken(result);
  return result;
}

// Helper function to process a single model for a problem with streaming and retry logic
async function processModelForProblem(
  runId: string,
  problem: any,
  model: any,
  judgeModel: any,
  run: any,
  emitProgress: (event: string, data: any) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const rrId = genId();

  // Insert initial run result
  db.prepare(
    `INSERT INTO run_results (id,run_id,problem_id,model_id,output,score,status,judged_by,created_at)
     VALUES (@id,@run_id,@problem_id,@model_id,@output,@score,@status,@judged_by,@created_at)`
  ).run({
    id: rrId,
    run_id: runId,
    problem_id: problem.id,
    model_id: model.id,
    output: null,
    score: null,
    status: problem.type === 'html' ? 'manual' : 'pending',
    judged_by: null,
    created_at: now(),
  });

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(
    (db.prepare('SELECT provider_id FROM models WHERE id = ?').get(model.id) as any).provider_id
  ) as any;

  const systemForType =
    problem.type === 'html'
      ? 'You are a helpful assistant that returns HTML/CSS/JS when asked. Keep responses concise.'
      : 'You are a helpful assistant.';

  try {
    // Check for cancellation before starting
    if (abortSignal?.aborted) {
      db.prepare('UPDATE run_results SET status=@status, cancelled_at=@cancelled_at WHERE id = @id').run({
        id: rrId,
        status: 'cancelled',
        cancelled_at: now(),
      });
      return;
    }

    // Emit progress event
    emitProgress('model_started', {
      run_id: runId,
      problem_id: problem.id,
      model_id: model.id,
      model_name: model.label,
      attempt: 1,
      streaming: run.stream
    });

    let output: string;

    // Emit streaming start indicator
    if (run.stream) {
      emitProgress('model_streaming_started', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        model_name: model.label,
      });
    }

    // Use streaming if enabled, otherwise fallback to non-streaming
    if (run.stream) {
      output = await callModelWithStreaming(
        provider.id,
        model.model_id,
        [
          { role: 'system', content: systemForType },
          { role: 'user', content: String(problem.prompt) },
        ],
        (token: string) => {
          // Check for cancellation during streaming
          if (abortSignal?.aborted) {
            return;
          }
          // Emit each token as it arrives
          emitProgress('candidate_token', {
            run_id: runId,
            problem_id: problem.id,
            model_id: model.id,
            model_name: model.label,
            delta: token,
            kind: problem.type === 'html' ? 'html' : 'text',
          });
        },
        `Problem ${problem.id.slice(0, 8)} - Model ${model.label}`
      );
    } else {
      // Non-streaming fallback
      const context = `Problem ${problem.id.slice(0, 8)} - Model ${model.label}`;
      output = await callModel(provider.id, model.model_id, [
        { role: 'system', content: systemForType },
        { role: 'user', content: String(problem.prompt) },
      ], context);

      // Emit the whole result as one token for non-streaming
      emitProgress('candidate_token', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        model_name: model.label,
        delta: output,
        kind: problem.type === 'html' ? 'html' : 'text',
      });
    }

    // Check for cancellation after model call
    if (abortSignal?.aborted) {
      db.prepare('UPDATE run_results SET status=@status, cancelled_at=@cancelled_at WHERE id = @id').run({
        id: rrId,
        status: 'cancelled',
        cancelled_at: now(),
      });
      return;
    }

    // Update with candidate output
    db.prepare('UPDATE run_results SET output=@output WHERE id=@id').run({
      id: rrId,
      output,
    });

    // Emit completion event
    if (problem.type === 'html') {
      emitProgress('html_candidate_done', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        model_name: model.label,
        html: output,
      });
    } else {
      emitProgress('candidate_done', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        model_name: model.label,
        text: output,
      });
    }

    // Judge the output (if not HTML)
    if (problem.type !== 'html') {
      // Check for cancellation before judging
      if (abortSignal?.aborted) {
        db.prepare('UPDATE run_results SET status=@status, cancelled_at=@cancelled_at WHERE id = @id').run({
          id: rrId,
          status: 'cancelled',
          cancelled_at: now(),
        });
        return;
      }

      const judgeContext = `Judge for Problem ${problem.id.slice(0, 8)} - Model ${model.label}`;

      // Enhanced judge prompt with structured reasoning framework
      const judgePrompt = `You are an expert AI evaluator. Your task is to judge whether a candidate answer correctly solves the given problem.

EVALUATION FRAMEWORK:
1. CORRECTNESS: Does the answer solve the core problem?
2. COMPLETENESS: Are all requirements addressed?
3. ACCURACY: Are the details and facts correct?
4. CLARITY: Is the answer clear and well-structured?

RESPONSE FORMAT:
You must respond with exactly this JSON structure:
{
  "verdict": "PASS" or "FAIL",
  "reasoning": "Brief explanation of your decision (2-3 sentences)",
  "score": 0-100
}

PROBLEM: ${problem.prompt}

EXPECTED ANSWER: ${problem.expected_answer || 'No specific expected answer provided - judge based on correctness and completeness.'}

CANDIDATE ANSWER: ${output}

Evaluate the candidate answer and respond with the JSON format above:`;

      const verdictText = await callModel(judgeModel.provider_id, judgeModel.model_id, [
        { role: 'system', content: 'You are an expert AI evaluator. Always respond with valid JSON in the exact format requested.' },
        { role: 'user', content: judgePrompt },
      ], judgeContext);

      // Parse JSON response or fallback to simple parsing
      let pass = false;
      let reasoning = 'No reasoning provided';
      let score = 0;

      try {
        const judgeResponse = JSON.parse(verdictText.trim());
        pass = judgeResponse.verdict === 'PASS';
        reasoning = judgeResponse.reasoning || 'No reasoning provided';
        score = judgeResponse.score || (pass ? 100 : 0);
      } catch (e) {
        // Fallback to simple text parsing if JSON fails
        const normalized = String(verdictText ?? '').trim().toUpperCase();
        const isFail = /\bFAIL\b/.test(normalized);
        const isPass = /\bPASS\b/.test(normalized) || /^YES\b/.test(normalized);
        pass = isPass && !isFail;
        reasoning = `Simple verdict: ${pass ? 'PASS' : 'FAIL'}. Full response: ${verdictText.slice(0, 200)}`;
        score = pass ? 100 : 0;
      }

      db.prepare(
        'UPDATE run_results SET output=@output, score = @score, status = @status, judged_by = @judged_by, judge_reasoning = @judge_reasoning WHERE id = @id'
      ).run({
        id: rrId,
        output,
        score: score, // Store the actual numeric score (0-100)
        status: 'completed',
        judged_by: judgeModel.id,
        judge_reasoning: reasoning,
      });

      emitProgress('judge_done', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        verdict: pass ? 'PASS' : 'FAIL',
        reasoning: reasoning,
        score: score,
      });
    }
  } catch (error: any) {
    // Check if this was a cancellation
    if (abortSignal?.aborted) {
      db.prepare('UPDATE run_results SET status=@status, cancelled_at=@cancelled_at WHERE id = @id').run({
        id: rrId,
        status: 'cancelled',
        cancelled_at: now(),
      });
      emitProgress('model_cancelled', {
        run_id: runId,
        problem_id: problem.id,
        model_id: model.id,
        model_name: model.label,
      });
      return;
    }

    app.log.error({
      run_id: runId,
      problem_id: problem.id,
      model_id: model.id,
      model_name: model.label,
      error: error.message
    }, 'Model processing failed');

    db.prepare('UPDATE run_results SET status=@status WHERE id = @id').run({
      id: rrId,
      status: 'error',
    });

    emitProgress('model_error', {
      run_id: runId,
      problem_id: problem.id,
      model_id: model.id,
      model_name: model.label,
      error: error.message,
      streaming: run.stream
    });
  }
}

// Runs API (AI judge only)

// Create a run (judgeModelId REQUIRED)
app.post('/api/runs', async (req, reply) => {
  const body = req.body as {
    name?: string;
    problemSetId: string;
    modelIds: string[];
    judgeModelId: string;
    stream?: boolean;
  };
  if (!body?.problemSetId || !Array.isArray(body.modelIds) || body.modelIds.length === 0) {
    return reply.badRequest('Missing problemSetId or modelIds');
  }
  const judge = String(body.judgeModelId ?? '').trim();
  if (judge.length === 0) {
    return reply.badRequest('judgeModelId is required');
  }
  const judgeModelRow = db.prepare('SELECT id FROM models WHERE id = ?').get(judge);
  if (!judgeModelRow) {
    return reply.badRequest('judgeModelId not found');
  }

  const id = genId();
  db.prepare(
    `INSERT INTO runs (id,name,problem_set_id,model_ids,judge_model_id,status,created_at,stream)
     VALUES (@id,@name,@problem_set_id,@model_ids,@judge_model_id,@status,@created_at,@stream)`
  ).run({
    id,
    name: body.name ?? null,
    problem_set_id: body.problemSetId,
    model_ids: JSON.stringify(body.modelIds),
    judge_model_id: judge,
    status: 'queued',
    created_at: now(),
    stream: body.stream ? 1 : 0,
  });
  reply.code(201);
  return { id };
});

// Get a run
app.get('/api/runs/:id', async (req, reply) => {
  const { id } = req.params as any;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
  if (!run) return reply.notFound('Run not found');
  return run;
});

// Cancel a run (kill switch for entire run)
app.post('/api/runs/:id/cancel', async (req, reply) => {
  const { id } = req.params as any;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any;
  if (!run) return reply.notFound('Run not found');
  
  if (run.status !== 'running' && run.status !== 'queued') {
    return reply.badRequest('Can only cancel running or queued runs');
  }

  // Cancel the run operations
  const cancelled = cancelRun(id);
  
  // Update database status
  db.prepare('UPDATE runs SET status = ?, cancelled_at = ?, cancelled_by = ? WHERE id = ?')
    .run('cancelled', now(), 'user', id);
  
  // Cancel any pending run_results
  db.prepare('UPDATE run_results SET status = ?, cancelled_at = ? WHERE run_id = ? AND status IN (?, ?)')
    .run('cancelled', now(), id, 'pending', 'manual');

  // Emit SSE event
  emitSSE(id, 'run_status', { run_id: id, status: 'cancelled' });
  emitSSE(id, 'run_cancelled', { run_id: id, cancelled_by: 'user' });

  return { id, status: 'cancelled', cancelled: cancelled };
});

// Cancel a specific model in a run (kill switch for specific model)
app.post('/api/runs/:runId/models/:modelId/cancel', async (req, reply) => {
  const { runId, modelId } = req.params as any;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
  if (!run) return reply.notFound('Run not found');
  
  if (run.status !== 'running') {
    return reply.badRequest('Can only cancel models in running runs');
  }

  // Check if model is part of this run
  const modelIds = JSON.parse(run.model_ids) as string[];
  if (!modelIds.includes(modelId)) {
    return reply.badRequest('Model not part of this run');
  }

  // Cancel the model operations
  const cancelled = cancelModel(runId, modelId);
  
  // Cancel any pending run_results for this model
  db.prepare('UPDATE run_results SET status = ?, cancelled_at = ? WHERE run_id = ? AND model_id = ? AND status IN (?, ?)')
    .run('cancelled', now(), runId, modelId, 'pending', 'manual');

  // Emit SSE event
  emitSSE(runId, 'model_cancelled', {
    run_id: runId,
    model_id: modelId,
    cancelled_by: 'user'
  });

  return { runId, modelId, status: 'cancelled', cancelled: cancelled };
});

/* CLEAN REPLACEMENT: Execute handler with robust OpenAI-compatible streaming and proper scoping */
app.post('/api/runs/:id/execute', async (req, reply) => {
  const { id } = req.params as any;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any;
  if (!run) return reply.notFound('Run not found');
  if (run.status === 'running') return reply.conflict('Run already running');

  if (!run.judge_model_id || String(run.judge_model_id).trim().length === 0) {
    return reply.badRequest('Run is missing judge_model_id; AI judge is required');
  }

  const modelIdsArr = JSON.parse(run.model_ids) as string[];
  const models = modelIdsArr
    .map((mid) => db.prepare('SELECT id,provider_id,model_id FROM models WHERE id = ?').get(mid) as { id: string; provider_id: string; model_id: string } | undefined)
    .filter((m): m is { id: string; provider_id: string; model_id: string } => !!m);

  const problems = db.prepare('SELECT * FROM problems WHERE problem_set_id = ?').all(run.problem_set_id) as any[];

  db.prepare('UPDATE runs SET status = ? WHERE id = ?').run('running', id);
  // Notify via SSE AND return early status to the POST caller so UI can update immediately
  emitSSE(id, 'run_status', { run_id: id, status: 'running' });
  // Immediately acknowledge the execute request so frontend can proceed to open SSE
  // Do not wait for the whole job; detach async processing below
  try {
    // Hijack the reply to finish now
    reply.code(202).send({ id, status: 'running' });
  } catch {}

  // Continue processing asynchronously without blocking the HTTP response
  setImmediate(async () => {
  try {
    // Get judge model info once
    const judgeModel = db
      .prepare('SELECT id,provider_id,model_id FROM models WHERE id = ?')
      .get(run.judge_model_id) as any;

    if (!judgeModel) {
      throw new Error('Judge model not found');
    }

    // Create cancellation controller for this run
    const runController = createRunCancellation(id);

    // NEW APPROACH: Queue-based parallel processing
    // Each model processes problems sequentially (Q1, Q2, Q3...) but models work independently
    // Faster models can move to the next problem without waiting for slower ones
    
    app.log.info({
      run_id: id,
      problems_count: problems.length,
      models_count: models.length,
      total_tasks: problems.length * models.length
    }, `Starting queue-based parallel processing: ${models.length} models processing ${problems.length} problems sequentially`);

    // Create a sequential processor for each model
    const modelProcessors = models.map(async (model) => {
      const modelController = createModelCancellation(id, model.id);
      
      // Process problems sequentially for this model
      for (const problem of problems) {
        // Check for cancellation before each problem
        if (runController.signal.aborted || modelController.signal.aborted) {
          break;
        }
        
        try {
          await processModelForProblem(
            id,
            problem,
            model,
            judgeModel,
            run,
            (event, data) => emitSSE(id, event, data),
            modelController.signal
          );
        } catch (error) {
          app.log.error({
            run_id: id,
            model_id: model.id,
            problem_id: problem.id,
            error: String(error)
          }, `Model ${model.id} failed on problem ${problem.id}`);
          // Continue to next problem even if this one failed
        }
      }
    });

    // Wait for all model processors to complete
    const results = await Promise.allSettled(modelProcessors);
    
    // Check if run was cancelled
    if (runController.signal.aborted) {
      db.prepare('UPDATE runs SET status = ? WHERE id = ?').run('cancelled', id);
      emitSSE(id, 'run_status', { run_id: id, status: 'cancelled' });
      cleanupCancellations(id);
      return;
    }

    // Count results
    const completed = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    app.log.info({
      run_id: id,
      completed_models: completed,
      failed_models: failed,
      total_models: models.length
    }, `Completed queue-based parallel processing`);

    db.prepare('UPDATE runs SET status = ? WHERE id = ?').run('completed', id);
    emitSSE(id, 'run_status', { run_id: id, status: 'completed' });
    cleanupCancellations(id);
  } catch (err: any) {
    db.prepare('UPDATE runs SET status = ? WHERE id = ?').run('error', id);
    emitSSE(id, 'run_status', { run_id: id, status: 'error' });
    app.log.error({ err: String(err?.message ?? err) }, 'Run execution failed');
    cleanupCancellations(id);
  }
  }); // end setImmediate
});

// List recent runs with optional status filter (?status=queued|running|completed|error) and limit (?limit=50)
// Also supports filtering by problemSetId (?problemSetId=...)
app.get('/api/runs', async (req) => {
  const qparams = req.query as any;
  const status = typeof qparams?.status === 'string' ? String(qparams.status) : undefined;
  const limitNum = parseInt(qparams?.limit ?? '50', 10);
  const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 200) : 50;
  const problemSetId = typeof qparams?.problemSetId === 'string' ? String(qparams.problemSetId) : undefined;

  const base =
    'SELECT id,name,problem_set_id,model_ids,judge_model_id,status,created_at,cancelled_at,cancelled_by FROM runs';
  const clauses: string[] = [];
  const args: any[] = [];
  if (status && ['queued', 'running', 'completed', 'error', 'cancelled'].includes(status)) {
    clauses.push('status = ?');
    args.push(status);
  }
  if (problemSetId) {
    clauses.push('problem_set_id = ?');
    args.push(problemSetId);
  }
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`${base}${where} ORDER BY created_at DESC LIMIT ?`).all(...args, limit);
});

// Bulk delete runs by problemSetId
app.delete('/api/runs', async (req, reply) => {
  const qparams = req.query as any;
  const problemSetId = typeof qparams?.problemSetId === 'string' ? String(qparams.problemSetId) : undefined;
  if (!problemSetId) return reply.badRequest('problemSetId is required');
  const runs = db.prepare('SELECT id FROM runs WHERE problem_set_id = ?').all(problemSetId) as Array<{ id: string }>;
  const problemIds = db.prepare('SELECT id FROM problems WHERE problem_set_id = ?').all(problemSetId) as Array<{ id: string }>;
  let deleted = 0;
  const delRunResultsByRun = db.prepare('DELETE FROM run_results WHERE run_id = ?');
  const delRunResultsByProblem = db.prepare('DELETE FROM run_results WHERE problem_id = ?');
  const delRun = db.prepare('DELETE FROM runs WHERE id = ?');
  db.transaction(() => {
    // Delete all run_results by problem_id (in case any results were created without a run reference)
    for (const p of problemIds) {
      delRunResultsByProblem.run(p.id);
    }
    // Then delete run_results by run, followed by runs
    for (const r of runs) {
      delRunResultsByRun.run(r.id);
      delRun.run(r.id);
      deleted++;
    }
  })();
  return { deleted };
});

// Get results
app.get('/api/runs/:id/results', async (req, reply) => {
  const { id } = req.params as any;
  const rows = db
    .prepare(
      `SELECT rr.*, p.type as problem_type, p.prompt as problem_prompt
       FROM run_results rr
       JOIN problems p ON p.id = rr.problem_id
       WHERE rr.run_id = ?
       ORDER BY rr.created_at ASC`
    )
    .all(id);
  return rows;
});

// Server-Sent Events (SSE) for streaming runs
// Clients open EventSource to receive live tokens/status.
/* CLEAN REPLACEMENT: SSE stream handler with flush and no stray closers */
app.get('/api/runs/:id/stream', async (req, reply) => {
  const { id } = req.params as any;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any;
  if (!run) return reply.notFound('Run not found');
  if (!run.stream) return reply.badRequest('Streaming not enabled for this run');

  // Important: tell Fastify we're handling the raw stream ourselves
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  // Prevent Fastify from trying to serialize/pipe a body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (reply as any).header = () => reply; // no-op further header mutations
  // Avoid Fastify onSend trying to pipe a non-readable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (reply as any).send = () => reply;
  try { /* @ts-ignore */ reply.raw.flushHeaders?.(); } catch {}
  try { reply.raw.write(':ok\n\n'); } catch {}

  // @ts-ignore
  if (!app.sseSubscribers) app.sseSubscribers = new Map<string, Set<import('http').ServerResponse>>();
  // @ts-ignore
  const map: Map<string, Set<import('http').ServerResponse>> = app.sseSubscribers;
  let subs = map.get(id);
  if (!subs) {
    subs = new Set();
    map.set(id, subs);
  }
  subs.add(reply.raw);

  try {
    reply.raw.write(`event: run_status\n`);
    reply.raw.write(`data: ${JSON.stringify({ run_id: id, status: run.status })}\n\n`);
    // @ts-ignore
    reply.raw.flush?.();
  } catch {}

  // Keep connection alive
  req.raw.on('close', () => {
    subs?.delete(reply.raw);
    if (subs?.size === 0) {
      map.delete(id);
    }
  });

  // Don't close the connection - let it stay open for SSE
  return new Promise(() => {}); // Never resolves, keeps connection open
});

// Helper to emit SSE to all subscribers of a run
function emitSSE(runId: string, event: string, payload: any) {
  // @ts-ignore
  const map: Map<string, Set<import('http').ServerResponse>> | undefined = app.sseSubscribers;
  if (!map) return;
  const subs = map.get(runId);
  if (!subs || subs.size === 0) return;
  const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subs) {
    try {
      res.write(data);
    } catch {
      // ignore broken pipe
    }
  }
}

// Export results as CSV
app.get('/api/runs/:id/results.csv', async (req, reply) => {
  const { id } = req.params as any;
  const rows = db
    .prepare(
      `SELECT rr.id, rr.run_id, rr.problem_id, rr.model_id, rr.score, rr.status, rr.judged_by, rr.created_at, p.type as problem_type, p.prompt as problem_prompt, rr.output
       FROM run_results rr
       JOIN problems p ON p.id = rr.problem_id
       WHERE rr.run_id = ?
       ORDER BY rr.created_at ASC`
    )
    .all(id) as Array<{
      id: string; run_id: string; problem_id: string; model_id: string;
      score: number | null; status: string; judged_by: string | null; created_at: number;
      problem_type: string; problem_prompt: string; output: string | null;
    }>;

  const header = [
    'result_id','run_id','problem_id','model_id','problem_type','problem_prompt','status','score','judged_by','created_at','output'
  ];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(','),
    ...rows.map(r => [
      esc(r.id),
      esc(r.run_id),
      esc(r.problem_id),
      esc(r.model_id),
      esc(r.problem_type),
      esc(r.problem_prompt),
      esc(r.status),
      esc(r.score),
      esc(r.judged_by),
      esc(new Date(r.created_at).toISOString()),
      esc(r.output ?? ''),
    ].join(',')),
  ];
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="run-${id}-results.csv"`);
  return lines.join('\n');
});

// Export results as JSON
app.get('/api/runs/:id/results.json', async (req, reply) => {
  const { id } = req.params as any;
  const rows = db
    .prepare(
      `SELECT rr.*, p.type as problem_type, p.prompt as problem_prompt
       FROM run_results rr
       JOIN problems p ON p.id = rr.problem_id
       WHERE rr.run_id = ?
       ORDER BY rr.created_at ASC`
    )
    .all(id);
  reply.header('Content-Type', 'application/json; charset=utf-8');
  return rows;
});

// Get pending manual reviews for HTML problems
app.get('/api/manual-reviews', async (req) => {
  const qparams = req.query as any;
  const limitNum = parseInt(qparams?.limit ?? '50', 10);
  const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 200) : 50;

  const reviews = db.prepare(`
    SELECT
      rr.id,
      rr.run_id,
      rr.problem_id,
      rr.model_id,
      rr.output,
      rr.created_at,
      rr.judge_reasoning,
      p.prompt as problem_prompt,
      p.type as problem_type,
      p.expected_answer,
      p.html_assets,
      m.label as model_name,
      r.name as run_name,
      ps.name as problem_set_name
    FROM run_results rr
    JOIN problems p ON rr.problem_id = p.id
    JOIN models m ON rr.model_id = m.id
    JOIN runs r ON rr.run_id = r.id
    JOIN problem_sets ps ON r.problem_set_id = ps.id
    WHERE rr.status = 'manual' AND p.type = 'html'
    ORDER BY rr.problem_id ASC, rr.created_at ASC
    LIMIT ?
  `).all(limit);

  return reviews;
});

// Manual review endpoint for HTML problems: pass/fail with optional notes
app.post('/api/run-results/:id/review', async (req, reply) => {
  const { id } = req.params as any;
  const body = req.body as { decision: 'pass' | 'fail'; notes?: string };
  if (!body || (body.decision !== 'pass' && body.decision !== 'fail')) {
    return reply.badRequest('Invalid decision');
  }

  const row = db.prepare('SELECT * FROM run_results WHERE id = ?').get(id) as any;
  if (!row) return reply.notFound('Result not found');

  // Ensure this corresponds to an HTML problem
  const p = db.prepare('SELECT type FROM problems WHERE id = ?').get(row.problem_id) as any;
  if (!p || p.type !== 'html') {
    return reply.badRequest('Only HTML results can be manually reviewed');
  }

  db.prepare(
    'UPDATE run_results SET score=@score, status=@status, judged_by=@judged_by WHERE id=@id'
  ).run({
    id,
    score: body.decision === 'pass' ? 100 : 0, // Use 0-100 scale for consistency
    status: 'completed',
    judged_by: 'human',
  });

  return { id, status: 'completed' };
});

// Get latest run results summary for each problem set
app.get('/api/problem-sets/latest-results', async (req) => {
  // Get all problem sets with their latest completed run
  const problemSets = db.prepare(`
    SELECT ps.id, ps.name, ps.description, ps.created_at,
           r.id as latest_run_id, r.created_at as latest_run_date
    FROM problem_sets ps
    LEFT JOIN (
      SELECT problem_set_id, MAX(created_at) as max_created_at
      FROM runs
      WHERE status = 'completed'
      GROUP BY problem_set_id
    ) latest ON ps.id = latest.problem_set_id
    LEFT JOIN runs r ON ps.id = r.problem_set_id
                     AND r.created_at = latest.max_created_at
                     AND r.status = 'completed'
    ORDER BY ps.created_at DESC
  `).all() as Array<{
    id: string; name: string; description: string | null; created_at: number;
    latest_run_id: string | null; latest_run_date: number | null;
  }>;

  return problemSets;
});

// Get model performance summary for a specific problem set across all runs (latest performance per model)
app.get('/api/problem-sets/:id/latest-performance', async (req, reply) => {
  const { id } = req.params as any;

  // Get the latest problem creation date for this problem set (to determine latest version)
  const latestProblemDate = db.prepare(`
    SELECT MAX(created_at) as latest_problem_date
    FROM problems
    WHERE problem_set_id = ?
  `).get(id) as { latest_problem_date: number } | undefined;

  if (!latestProblemDate) {
    return reply.notFound('Problem set not found or has no problems');
  }

  // Get current problem count for validation
  const currentProblemCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM problems
    WHERE problem_set_id = ?
  `).get(id) as { count: number };

  // Get all models that have run the latest version of this problem set
  const performance = db.prepare(`
    WITH valid_runs AS (
      SELECT DISTINCT
        rr.model_id,
        m.label as model_name,
        r.id as run_id,
        r.created_at as run_date,
        COUNT(DISTINCT rr.problem_id) as problems_tested
      FROM run_results rr
      JOIN models m ON rr.model_id = m.id
      JOIN runs r ON rr.run_id = r.id
      JOIN problems p ON rr.problem_id = p.id
      WHERE r.problem_set_id = ?
        AND r.status = 'completed'
        AND rr.status = 'completed'
        AND r.created_at >= ?
        AND p.problem_set_id = ?
      GROUP BY rr.model_id, m.label, r.id, r.created_at
      HAVING COUNT(DISTINCT rr.problem_id) = ?
    ),
    latest_valid_runs AS (
      SELECT
        model_id,
        model_name,
        run_id,
        run_date,
        ROW_NUMBER() OVER (PARTITION BY model_id ORDER BY run_date DESC) as rn
      FROM valid_runs
    ),
    model_performance AS (
      SELECT
        lvr.model_id,
        lvr.model_name,
        lvr.run_id,
        COUNT(*) as total_problems,
        SUM(CASE WHEN rr.score >= 50 THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN rr.score IS NOT NULL THEN rr.score ELSE 0 END), 1) as accuracy_percentage
      FROM latest_valid_runs lvr
      JOIN run_results rr ON lvr.run_id = rr.run_id AND lvr.model_id = rr.model_id
      JOIN problems p ON rr.problem_id = p.id
      WHERE lvr.rn = 1 AND rr.status = 'completed' AND p.problem_set_id = ?
      GROUP BY lvr.model_id, lvr.model_name, lvr.run_id
    )
    SELECT
      model_id,
      model_name,
      total_problems,
      correct_answers,
      accuracy_percentage
    FROM model_performance
    ORDER BY accuracy_percentage DESC, correct_answers DESC
  `).all(id, latestProblemDate.latest_problem_date, id, currentProblemCount.count, id) as Array<{
    model_id: string;
    model_name: string;
    total_problems: number;
    correct_answers: number;
    accuracy_percentage: number;
  }>;

  if (performance.length === 0) {
    return reply.notFound('No completed runs found for the latest version of this problem set');
  }

  // Get the most recent valid run ID for reference
  const latestValidRun = db.prepare(`
    SELECT r.id
    FROM runs r
    JOIN run_results rr ON r.id = rr.run_id
    JOIN problems p ON rr.problem_id = p.id
    WHERE r.problem_set_id = ?
      AND r.status = 'completed'
      AND r.created_at >= ?
      AND p.problem_set_id = ?
    GROUP BY r.id
    HAVING COUNT(DISTINCT rr.problem_id) = ?
    ORDER BY r.created_at DESC
    LIMIT 1
  `).get(id, latestProblemDate.latest_problem_date, id, currentProblemCount.count) as { id: string } | undefined;

  return {
    run_id: latestValidRun?.id || 'aggregated',
    models: performance
  };
});

// Get detailed results for a specific model in a specific run
app.get('/api/runs/:runId/models/:modelId/results', async (req, reply) => {
  const { runId, modelId } = req.params as any;

  const results = db.prepare(`
    SELECT
      rr.id,
      rr.problem_id,
      rr.output,
      rr.score,
      rr.status,
      rr.judge_reasoning,
      p.prompt as problem_prompt,
      p.type as problem_type,
      p.expected_answer
    FROM run_results rr
    JOIN problems p ON rr.problem_id = p.id
    WHERE rr.run_id = ? AND rr.model_id = ?
    ORDER BY rr.created_at ASC
  `).all(runId, modelId) as Array<{
    id: string;
    problem_id: string;
    output: string | null;
    score: number | null;
    status: string;
    judge_reasoning: string | null;
    problem_prompt: string;
    problem_type: string;
    expected_answer: string | null;
  }>;

  return results;
});

// Leaderboard API - Overall model rankings across all problem sets
app.get('/api/leaderboard', async (req) => {
  // Get all models with their performance across all problem sets
  const models = db.prepare(`
    SELECT DISTINCT m.id, m.label, p.name as provider_name
    FROM models m
    JOIN providers p ON m.provider_id = p.id
  `).all() as Array<{ id: string; label: string; provider_name: string }>;

  // Get all problem sets with their latest problem creation date (to determine latest version)
  const problemSets = db.prepare(`
    SELECT
      ps.id,
      ps.name,
      MAX(p.created_at) as latest_problem_date
    FROM problem_sets ps
    JOIN problems p ON ps.id = p.problem_set_id
    GROUP BY ps.id, ps.name
  `).all() as Array<{ id: string; name: string; latest_problem_date: number }>;

  const leaderboardEntries = [];

  for (const model of models) {
    const problemSetScores = [];
    let totalProblemSets = 0;
    let completedProblemSets = 0;

    for (const problemSet of problemSets) {
      totalProblemSets++;

      // Get the latest completed run for this model and problem set that includes the latest version
      // A run includes the latest version if it was created after the latest problem was added
      const latestValidRun = db.prepare(`
        SELECT r.id, r.created_at
        FROM runs r
        WHERE r.problem_set_id = ?
          AND r.status = 'completed'
          AND JSON_EXTRACT(r.model_ids, '$') LIKE '%' || ? || '%'
          AND r.created_at >= ?
        ORDER BY r.created_at DESC
        LIMIT 1
      `).get(problemSet.id, model.id, problemSet.latest_problem_date) as { id: string; created_at: number } | undefined;

      if (latestValidRun) {
        // Verify this run actually tested against all current problems in the problem set
        const currentProblemCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM problems
          WHERE problem_set_id = ?
        `).get(problemSet.id) as { count: number };

        const runProblemCount = db.prepare(`
          SELECT COUNT(DISTINCT rr.problem_id) as count
          FROM run_results rr
          JOIN problems p ON rr.problem_id = p.id
          WHERE rr.run_id = ? AND rr.model_id = ? AND rr.status = 'completed'
            AND p.problem_set_id = ?
        `).get(latestValidRun.id, model.id, problemSet.id) as { count: number };

        // Only include if the run tested against all current problems (latest version)
        if (runProblemCount.count === currentProblemCount.count) {
          // Get model performance for this run
          const performance = db.prepare(`
            SELECT
              COUNT(*) as total_problems,
              AVG(CASE WHEN rr.score IS NOT NULL THEN rr.score ELSE 0 END) as avg_score
            FROM run_results rr
            JOIN problems p ON rr.problem_id = p.id
            WHERE rr.run_id = ? AND rr.model_id = ? AND rr.status = 'completed'
              AND p.problem_set_id = ?
          `).get(latestValidRun.id, model.id, problemSet.id) as { total_problems: number; avg_score: number } | undefined;

          if (performance && performance.total_problems > 0) {
            completedProblemSets++;
            problemSetScores.push({
              problem_set_id: problemSet.id,
              problem_set_name: problemSet.name,
              accuracy: performance.avg_score,
              run_date: latestValidRun.created_at,
            });
          }
        }
      }
    }

    // Only include models that have completed at least one problem set
    if (completedProblemSets > 0) {
      // Calculate metrics
      const accuracies = problemSetScores.map(ps => ps.accuracy);
      const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
      
      // Consistency factor: 1 - (standard deviation / 100)
      const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - averageAccuracy, 2), 0) / accuracies.length;
      const stdDev = Math.sqrt(variance);
      const consistencyFactor = Math.max(0, 1 - (stdDev / 100));

      // Recency weight: favor results from last 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentScores = problemSetScores.filter(ps => ps.run_date > thirtyDaysAgo);
      const recencyWeight = recentScores.length > 0 ? 1.05 : 1.0;

      // Final score calculation (only for models with complete coverage)
      const isComplete = completedProblemSets === totalProblemSets;
      const finalScore = isComplete ? averageAccuracy * consistencyFactor * recencyWeight : 0;

      // Get the most recent run date
      const lastRunDate = Math.max(...problemSetScores.map(ps => ps.run_date));

      leaderboardEntries.push({
        model_id: model.id,
        model_name: model.label,
        provider_name: model.provider_name,
        final_score: finalScore,
        average_accuracy: averageAccuracy,
        consistency_factor: consistencyFactor,
        recency_weight: recencyWeight,
        problem_sets_completed: completedProblemSets,
        total_problem_sets: totalProblemSets,
        last_run_date: lastRunDate,
        problem_set_scores: problemSetScores,
      });
    }
  }

  // Sort by final score (complete models first), then by average accuracy
  leaderboardEntries.sort((a, b) => {
    const aComplete = a.problem_sets_completed === a.total_problem_sets;
    const bComplete = b.problem_sets_completed === b.total_problem_sets;
    
    if (aComplete && !bComplete) return -1;
    if (!aComplete && bComplete) return 1;
    
    if (aComplete && bComplete) {
      return b.final_score - a.final_score;
    } else {
      return b.average_accuracy - a.average_accuracy;
    }
  });

  return leaderboardEntries;
});

// Start
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API listening on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}