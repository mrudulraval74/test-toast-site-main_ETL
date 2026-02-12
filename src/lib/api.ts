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
    // ETL status is checked via reports table in etl-agent-api or direct DB
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${ETL_API_BASE_URL}/reports/${runId}`, {
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
      const response = await fetch(`${ETL_API_BASE_URL}/reports/${runId}`, {
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
    const { id, ...payload } = data;
    // 'reports' table uses 'compare_id', 'source_connection_id' etc.
    // Ensure payload matches schema.
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

// Polling for comparison progress
export function pollComparisonStatus(
  comparisonId: string,
  onProgress: (data: any) => void,
  onError: (error: string) => void,
  onComplete: (results: any) => void
): () => void {
  let intervalId: number | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      const { data: statusData, error: statusError } = await compareApi.status(comparisonId);

      if (statusError) {
        onError(statusError);
        stopped = true;
        if (intervalId) clearInterval(intervalId);
        return;
      }

      if (statusData && typeof statusData === 'object') {
        const status = statusData as any;
        onProgress(status);

        if (status.status === 'completed') {
          // Fetch full results
          const { data: results, error: resultsError } = await compareApi.results(comparisonId);
          if (resultsError) {
            onError(resultsError);
          } else if (results) {
            onComplete(results);
          }
          stopped = true;
          if (intervalId) clearInterval(intervalId);
        } else if (status.status === 'failed') {
          onError(status.errorMessage || 'Comparison failed');
          stopped = true;
          if (intervalId) clearInterval(intervalId);
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Polling error');
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    }
  };

  // Start polling immediately, then every 1 second
  poll();
  intervalId = window.setInterval(poll, 1000);

  // Return cleanup function
  return () => {
    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
