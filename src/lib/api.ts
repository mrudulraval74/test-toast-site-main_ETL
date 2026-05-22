import { supabase } from '@/integrations/supabase/client';

// Functions base URL handles both local dev and production
export const FUNCTIONS_BASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('https://', 'https://').replace('.supabase.co', '.supabase.co/functions/v1');

const getFunctionUrl = (path: string) => {
  // Always use etl-api as the destination for all connections, queries, and ETL activities
  const cleanPath = path.replace(/^\/?(agent-api|etl-api)\//, '');
  return `${FUNCTIONS_BASE_URL}/etl-api/${cleanPath}`;
};

// Primary ETL API endpoint (no agent required)
export const ETL_API_BASE_URL = `${FUNCTIONS_BASE_URL}/etl-api`;

// Point legacy AI chat to the new ETL function
export const API_BASE_URL = ETL_API_BASE_URL;

// Helper for authenticated Edge Function calls
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    console.warn("No active session found for API call");
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || "ANON_KEY"}`,
    // 'apikey': ... // Optional if Authorization is present, but some proxies check apikey
  };
};

export const connectionsApi = {
  test: async (config: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/connections/test`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(config),
      });
      const data = await response.json();
      return { data, error: response.ok ? null : (data.error || "Failed to test connection") };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  save: async (config: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/connections/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });
      const data = await response.json();
      return { data: response.ok ? data : null, error: response.ok ? null : (data.error || "Failed to save connection") };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  list: async () => {
    const { data, error } = await supabase
      .from('connections' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("List connections error:", error);
      return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
  },

  // Dropdown alias for list
  dropdown: async () => {
    const { data, error } = await supabase
      .from('connections' as any)
      .select('id, name, type') // optimized select
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Dropdown connections error:", error);
      return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
  },

  getJob: async (jobId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: headers,
      });
      const data = await response.json();
      return { data: response.ok ? data : null, error: response.ok ? null : (data.error || 'Failed to fetch job') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  getMetadata: async (id: string, agentId?: string) => {
    try {
      if (agentId) {
        const headers = await getAuthHeaders();
        const response = await fetch(`${ETL_API_BASE_URL}/connections/${id}/metadata`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ agentId }),
        });
        const data = await response.json();
        return { data: response.ok ? data : null, error: response.ok ? null : (data.error || 'Failed to fetch metadata') };
      }

      let response = await fetch(`${ETL_API_BASE_URL}/connections/${id}/metadata`, {
        method: 'GET',
      });
      if (!response.ok && (response.status === 404 || response.status === 405)) {
        const headers = await getAuthHeaders();
        response = await fetch(`${ETL_API_BASE_URL}/connections/${id}/metadata`, {
          method: 'POST',
          headers,
        });
      }
      const data = await response.json();
      return { data: response.ok ? data : null, error: response.ok ? null : (data.error || 'Failed to fetch metadata') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  metadata: async (id: string, agentId?: string) => {
    // Alias for getMetadata
    return connectionsApi.getMetadata(id, agentId);
  },


  delete: async (id: string) => {
    const { error } = await supabase
      .from('connections' as any)
      .delete()
      .eq('id', id);
    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  },

  update: async (id: string, config: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/connections/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });
      const data = await response.json();
      return { data: response.ok ? data : null, error: response.ok ? null : (data.error || "Failed to update connection") };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  }
};

export const queriesApi = {
  list: async (connectionId?: string) => {
    let query = supabase.from('saved_queries' as any).select('*').order('created_at', { ascending: false });
    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }
    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
  },
  save: async (data: any) => {
    const { id, ...payload } = data;
    const operation = id
      ? supabase.from('saved_queries' as any).update(payload).eq('id', id)
      : supabase.from('saved_queries' as any).insert([payload]);
    const { data: result, error } = await operation.select().single();
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: result, error: null };
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from('saved_queries' as any)
      .delete()
      .eq('id', id);
    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  },
  saved: {
    list: async (connectionId?: string) => {
      let query = supabase.from('saved_queries' as any).select('*').order('created_at', { ascending: false });
      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }
      const { data, error } = await query;
      if (error) {
        return { data: [], error: error.message };
      }
      return { data: data || [], error: null };
    },
    save: async (data: any) => {
      const { id, ...payload } = data;
      const operation = id
        ? supabase.from('saved_queries' as any).update(payload).eq('id', id)
        : supabase.from('saved_queries' as any).insert([payload]);
      const { data: result, error } = await operation.select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      return { data: result, error: null };
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('saved_queries' as any)
        .delete()
        .eq('id', id);
      if (error) return { data: null, error: error.message };
      return { data: { success: true }, error: null };
    },
  },
  preview: async (data: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/queries/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return { data: response.ok ? result : null, error: response.ok ? null : (result.error || 'Failed to preview query') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  }
};

export const compareApi = {
  run: async (config: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/compare/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });
      const data = await response.json();
      return { data, error: response.ok ? null : (data.error || 'Comparison failed to start') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },
  status: async (runId: string) => {
    // ETL status is tracked in agent_job_queue
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/jobs/${runId}`, {
        headers
      });
      const data = await response.json();
      return { data, error: response.ok ? null : (data.error || 'Failed to fetch status') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },
  results: async (runId: string) => {
    try {
      const headers = await getAuthHeaders();
      // Alias to job details endpoint for ETL comparison result retrieval
      const response = await fetch(`${ETL_API_BASE_URL}/jobs/${runId}`, {
        headers
      });
      const data = await response.json();
      return { data, error: response.ok ? null : (data.error || 'Failed to fetch results') };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  },
  report: async (runId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/reports/${runId}/download`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to download report');
      const blob = await response.blob();
      return { data: blob, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Network error' };
    }
  }
};

export const reportsApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('reports' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
  },
  get: async (id: string) => {
    const { data, error } = await supabase
      .from('reports' as any)
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  },
  saveTestRun: async (data: any) => {
    const {
      id,
      sourceConnectionId,
      sourceConnectionIds,
      targetConnectionId,
      testCases,
      fileName,
      folderName,
      summary,
      ...rest
    } = data || {};

    const compareId = rest.compareId || rest.compare_id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cmp_${Date.now()}`);
    const normalizedTestCases = Array.isArray(testCases) ? testCases : (summary?.testCases || []);
    const fallbackSourceQuery = normalizedTestCases[0]?.sourceSQL || normalizedTestCases[0]?.source_sql || "SELECT 1 AS SourceCheck";
    const fallbackTargetQuery = normalizedTestCases[0]?.targetSQL || normalizedTestCases[0]?.target_sql || "SELECT 1 AS TargetCheck";
    const sourceQuery = rest.source_query || rest.sourceQuery || fallbackSourceQuery;
    const targetQuery = rest.target_query || rest.targetQuery || fallbackTargetQuery;

    // Map UI payload to actual reports schema (snake_case columns).
    const payload = {
      compare_id: compareId,
      name: fileName || rest.name || "Saved ETL Run",
      note: folderName ? `Folder: ${folderName}` : (rest.note || null),
      source_connection_id: sourceConnectionId || rest.source_connection_id || null,
      target_connection_id: targetConnectionId || rest.target_connection_id || null,
      source_query: sourceQuery,
      target_query: targetQuery,
      status: rest.status || "completed",
      progress: 100,
      summary: {
        ...(summary || {}),
        isTestSuite: true,
        fileName: fileName || summary?.fileName || "Saved ETL Run",
        folderName: folderName || summary?.folderName || "Uncategorized",
        testCases: normalizedTestCases,
        sourceConnectionIds: Array.isArray(sourceConnectionIds) ? sourceConnectionIds : [],
      },
      error_message: rest.error_message || null,
      completed_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('reports' as any)
      .insert([payload])
      .select()
      .single();
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: result, error: null };
  },
  update: async (id: string, data: any) => {
    const { error } = await supabase
      .from('reports' as any)
      .update(data)
      .eq('id', id);
    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from('reports' as any)
      .delete()
      .eq('id', id);
    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  }
};

type JobPollingOptions = {
  intervalMs?: number;
  maxIntervalMs?: number;
  timeoutMs?: number;
  onTick?: (job: any | null, error: string | null) => void | Promise<void>;
};

type JobPollingResult = {
  data: any | null;
  error: string | null;
  cancelled?: boolean;
  timedOut?: boolean;
};

export function pollJobUntilComplete(
  jobId: string,
  options: JobPollingOptions = {}
): { cancel: () => void; promise: Promise<JobPollingResult> } {
  const intervalMs = options.intervalMs ?? 2500;
  const maxIntervalMs = options.maxIntervalMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 60000;

  let currentInterval = intervalMs;
  let cancelled = false;
  let settled = false;
  let inFlight = false;
  let timerId: ReturnType<typeof window.setTimeout> | null = null;
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
  let resolvePromise: ((value: JobPollingResult) => void) | null = null;

  const clearTimers = () => {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const finish = (result: JobPollingResult) => {
    if (settled) return;
    settled = true;
    clearTimers();
    resolvePromise?.(result);
  };

  const scheduleNext = (delayMs: number) => {
    if (settled || cancelled) return;
    timerId = window.setTimeout(() => {
      void runTick();
    }, delayMs);
  };

  const runTick = async () => {
    if (settled) return;
    if (cancelled) {
      finish({ data: null, error: null, cancelled: true });
      return;
    }
    if (inFlight) {
      scheduleNext(currentInterval);
      return;
    }

    inFlight = true;
    try {
      const { data, error } = await connectionsApi.getJob(jobId);
      await options.onTick?.(data ?? null, error ?? null);

      if (cancelled) {
        finish({ data: null, error: null, cancelled: true });
        return;
      }

      if (error || !data) {
        currentInterval = Math.min(maxIntervalMs, Math.round(currentInterval * 1.5));
        scheduleNext(currentInterval);
        return;
      }

      currentInterval = intervalMs;
      const status = data.status;
      if (status === 'completed' || status === 'failed' || status === 'error') {
        finish({ data, error: null });
        return;
      }

      scheduleNext(currentInterval);
    } finally {
      inFlight = false;
    }
  };

  const promise = new Promise<JobPollingResult>((resolve) => {
    resolvePromise = resolve;
    timeoutId = window.setTimeout(() => {
      finish({ data: null, error: 'timed_out', timedOut: true });
    }, timeoutMs);
    void runTick();
  });

  return {
    cancel: () => {
      cancelled = true;
      if (!settled) {
        finish({ data: null, error: null, cancelled: true });
      }
    },
    promise,
  };
}

// Polling for comparison progress
export function pollComparisonStatus(
  comparisonId: string,
  onProgress: (data: any) => void,
  onError: (error: string) => void,
  onComplete: (results: any) => void
): () => void {
  let stopped = false;
  let inFlight = false;
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
  let nextDelay = 2000;

  const clearPolling = () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    timeoutId = window.setTimeout(() => {
      void poll();
    }, delayMs);
  };

  const poll = async () => {
    if (stopped || inFlight) return;
    inFlight = true;

    try {
      const { data: statusData, error: statusError } = await compareApi.status(comparisonId);

      if (statusError) {
        onError(statusError);
        stopped = true;
        return;
      }

      if (statusData && typeof statusData === 'object') {
        const status = statusData as any;
        onProgress(status);

        if (status.status === 'completed') {
          onComplete(status);
          stopped = true;
        } else if (status.status === 'failed') {
          onError(status.error_log || status.errorMessage || 'Comparison failed');
          stopped = true;
        } else {
          scheduleNext(nextDelay);
        }
      } else {
        nextDelay = Math.min(5000, nextDelay + 500);
        scheduleNext(nextDelay);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Polling error');
      stopped = true;
    } finally {
      inFlight = false;
    }
  };

  void poll();

  // Return cleanup function
  return () => {
    stopped = true;
    clearPolling();
  };
}
