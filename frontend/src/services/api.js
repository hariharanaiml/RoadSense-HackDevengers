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
  getInspectionHistory: (limit = 50) => request(`/api/inspection/history?limit=${limit}`),
  getInspection: (id) => request(`/api/inspection/${id}`),
  analyzeInspection: (file) => {
    const fd = new FormData();
    fd.append('image', file, file.name);
    return request('/api/inspection/analyze', { method: 'POST', body: fd });
  },
};

