import { LayoutDashboard, Search, History, Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useHealth } from '../hooks/useHealth';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'inspect', label: 'Inspect Road', icon: Search },
  { key: 'history', label: 'Inspection History', icon: History },
];

export default function Layout({ page, setPage, children }) {
  const [open, setOpen] = useState(false);
  const { health, loading } = useHealth();

  const modelLoaded = health?.model_loaded === true;
  const aiOnline = !loading && modelLoaded;

  const navItem = NAV.find(n => n.key === page) || NAV[0];

  return (
    <div className="app-layout">
      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${open ? 'visible' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Shield size={18} />
          </div>
          <h1>RoadSense AI</h1>
          <p>Infrastructure Intelligence</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${page === key ? 'active' : ''}`}
              onClick={() => { setPage(key); setOpen(false); }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="ai-status">
            <span className={`status-dot ${aiOnline ? 'online' : 'offline'}`} />
            <div className="ai-status-text">
              <div className="label">AI Engine</div>
              <div className="value">{loading ? 'Checking…' : aiOnline ? 'Online' : 'Offline'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <button className="hamburger btn-icon" onClick={() => setOpen(o => !o)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div>
            <div className="topbar-title">{navItem.label}</div>
            <div className="topbar-subtitle">RoadSense AI · Hack Devengers 2.0</div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-body">
          {children}
        </main>
      </div>
    </div>
  );
}
