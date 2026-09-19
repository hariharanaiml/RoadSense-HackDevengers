// Severity/Priority class helper
export function severityClass(value) {
  const v = (value || '').toLowerCase();
  if (v === 'high') return 'badge-high';
  if (v === 'medium') return 'badge-medium';
  if (v === 'low') return 'badge-low';
  return 'badge-none';
}

export function severityValueClass(value) {
  const v = (value || '').toLowerCase();
  if (v === 'high') return 'severity-high';
  if (v === 'medium') return 'severity-medium';
  if (v === 'low') return 'severity-low';
  return 'severity-none';
}

// Format currency in INR
export function formatCost(value) {
  if (!value && value !== 0) return '—';
  const num = Number(value);
  if (num === 0) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

// Format date/time
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Format confidence as %
export function formatConfidence(val) {
  if (val == null) return '—';
  return (Number(val) * 100).toFixed(2) + '%';
}

// Format file size
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
