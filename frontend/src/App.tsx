import './index.css';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectionPage } from './pages/ConnectionPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { HistoryPage } from './pages/HistoryPage';
import { MapsPage } from './pages/MapsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUiStore } from './stores/uiStore';

// Initialize WebSocket connection
import './stores/telemetryStore';

export default function App() {
  const { activeTab } = useUiStore();

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardPage />;
      case 'connection': return <ConnectionPage />;
      case 'profiles': return <ProfilesPage />;
      case 'history': return <HistoryPage />;
      case 'maps': return <MapsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}
