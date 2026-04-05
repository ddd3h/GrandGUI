const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Serial
  getPorts: () => request<{ port: string; description?: string }[]>('/serial/ports'),
  getSerialStatus: () => request<import('../types').SerialStatus>('/serial/status'),
  connect: (body: import('../types').ConnectRequest) =>
    request<{ status: string; source_type: string }>('/serial/connect', {
      method: 'POST', body: JSON.stringify(body),
    }),
  disconnect: () =>
    request<{ status: string }>('/serial/disconnect', { method: 'POST' }),

  // Profiles
  getProfiles: () => request<import('../types').UartProfile[]>('/profiles'),
  createProfile: (body: unknown) =>
    request<import('../types').UartProfile>('/profiles', { method: 'POST', body: JSON.stringify(body) }),
  updateProfile: (id: number, body: unknown) =>
    request<import('../types').UartProfile>(`/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProfile: (id: number) =>
    fetch(`${BASE}/profiles/${id}`, { method: 'DELETE' }),
  validateSample: (id: number, sample_line: string) =>
    request<{ success: boolean; parsed?: Record<string, unknown>; error?: string }>(
      `/profiles/${id}/validate-sample`, { method: 'POST', body: JSON.stringify({ sample_line }) }
    ),

  // Telemetry
  getLatest: () => request<import('../types').TelemetryPoint | null>('/telemetry/latest'),
  getHistory: (params?: { start?: string; end?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.start) q.set('start', params.start);
    if (params?.end) q.set('end', params.end);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return request<import('../types').TelemetryPoint[]>(`/telemetry/history?${q}`);
  },
  exportData: (format: 'csv' | 'json', params?: { start?: string; end?: string }) => {
    const q = new URLSearchParams({ format });
    if (params?.start) q.set('start', params.start);
    if (params?.end) q.set('end', params.end);
    return fetch(`${BASE}/telemetry/export?${q}`);
  },

  // Dashboard
  getDashboards: () => request<import('../types').Dashboard[]>('/dashboard'),
  createDashboard: (body: unknown) =>
    request<import('../types').Dashboard>('/dashboard', { method: 'POST', body: JSON.stringify(body) }),
  createWidget: (body: unknown) =>
    request<import('../types').Widget>('/widgets', { method: 'POST', body: JSON.stringify(body) }),
  updateWidget: (id: number, body: unknown) =>
    request<import('../types').Widget>(`/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWidget: (id: number) =>
    fetch(`${BASE}/widgets/${id}`, { method: 'DELETE' }),
  patchLayout: (layouts: unknown[]) =>
    request<{ status: string }>('/dashboard/layout', { method: 'PATCH', body: JSON.stringify({ layouts }) }),

  // Maps
  getMapPackages: () => request<import('../types').OfflineMapPackage[]>('/maps/offline-packages'),
  getActiveMapPackage: () =>
    request<import('../types').ActiveMapPackage | null>('/maps/active'),
  activateMapPackage: (id: number) =>
    request<{ status: string; id: number }>(`/maps/offline-packages/${id}/activate`, { method: 'POST' }),
  deactivateMapPackage: (id: number) =>
    request<{ status: string; id: number }>(`/maps/offline-packages/${id}/deactivate`, { method: 'POST' }),
  deleteMapPackage: (id: number) =>
    fetch(`${BASE}/maps/offline-packages/${id}`, { method: 'DELETE' }),
};
