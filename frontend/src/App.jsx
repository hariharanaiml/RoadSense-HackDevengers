import { useState } from 'react';
import './index.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import InspectPage from './pages/InspectPage';
import HistoryPage from './pages/HistoryPage';
import InspectionDetail from './pages/InspectionDetail';
import RoadMapPage from './pages/RoadMapPage';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard setPage={setPage} setSelectedId={setSelectedId} />;
      case 'inspect':
        return <InspectPage />;
      case 'history':
        return <HistoryPage setPage={setPage} setSelectedId={setSelectedId} />;
      case 'detail':
        return <InspectionDetail id={selectedId} setPage={setPage} />;
      case 'map':
        return <RoadMapPage setPage={setPage} setSelectedId={setSelectedId} />;
      default:
        return <Dashboard setPage={setPage} setSelectedId={setSelectedId} />;
    }
  };

  return (
    <Layout page={page} setPage={setPage}>
      {renderPage()}
    </Layout>
  );
}
