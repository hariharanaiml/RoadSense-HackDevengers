// Centralized API service for RoadSense AI backend
// In dev mode, Vite proxies /api to the FastAPI backend.
// In production, set VITE_API_URL to point at the backend.
const BASE_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return res.json();
}

export const api = {
  getHealth: () => request('/api/health'),

  getStats: () => request('/api/inspection/stats'),

  getInspectionHistory: async (params = 50) => {
    let query;
    if (typeof params === 'number') {
      query = `limit=${params}`;
    } else if (params && typeof params === 'object') {
      const q = new URLSearchParams();
      if (params.limit !== undefined) q.append('limit', params.limit);
      if (params.offset !== undefined) q.append('offset', params.offset);
      if (params.severity && params.severity !== 'ALL') q.append('severity', params.severity);
      if (params.has_gps !== undefined && params.has_gps !== null && params.has_gps !== 'all') {
        q.append('has_gps', params.has_gps);
      }
      query = q.toString();
    }
    const data = await request(`/api/inspection/history${query ? `?${query}` : ''}`);
    if (typeof params === 'number') {
      return Array.isArray(data) ? data : (data.inspections || []);
    }
    return data;
  },

  getInspection: (id) => request(`/api/inspection/${id}`),

  /**
   * Analyze an image with optional GPS coordinates.
   * When latitude and longitude are provided (both non-null), they are sent to the API.
   * When GPS is absent, only the image is sent — 0,0 or fake coordinates are never used.
   */
  analyzeInspection: (file, latitude = null, longitude = null) => {
    const fd = new FormData();
    fd.append('image', file, file.name);
    if (latitude != null && longitude != null) {
      fd.append('latitude', String(latitude));
      fd.append('longitude', String(longitude));
    }
    return request('/api/inspection/analyze', { method: 'POST', body: fd });
  },
};
