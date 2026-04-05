import { useState } from 'react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUiStore } from '../../stores/uiStore';

const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'connection', label: 'Connection' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'history', label: 'History' },
  { id: 'maps', label: 'Maps' },
  { id: 'settings', label: 'Settings' },
];

export function Header() {
  const { serialStatus, wsConnected } = useTelemetryStore();
  const { activeTab, setActiveTab, editMode, setEditMode } = useUiStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 flex-shrink-0">
      {/* Main bar */}
      <div className="px-4 py-2 flex items-center justify-between">
        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-4">
          <h1 className="text-white font-bold text-lg tracking-wide">GrandGUI</h1>

          {/* Desktop navigation — hidden on mobile */}
          <nav className="hidden md:flex gap-1">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: status + edit button + hamburger */}
        <div className="flex items-center gap-3">
          {/* Edit Layout — desktop only */}
          {activeTab === 'dashboard' && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`hidden md:block px-3 py-1 rounded text-sm font-medium transition-colors ${
                editMode
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {editMode ? 'Done' : 'Edit Layout'}
            </button>
          )}

          {/* WS status */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-400 hidden sm:inline text-xs">WS</span>
          </div>

          {/* Serial status */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${serialStatus.connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            <span className="text-gray-400 hidden sm:inline text-xs">
              {serialStatus.connected ? (serialStatus.source_type || '?') : 'Disconnected'}
            </span>
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="メニューを開く"
            className="md:hidden p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            {mobileMenuOpen ? (
              /* X icon */
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu — shown only when open */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-700 bg-gray-900 px-3 py-2 space-y-1">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full text-left px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Edit Layout in mobile menu */}
          {activeTab === 'dashboard' && (
            <button
              onClick={() => { setEditMode(!editMode); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded text-sm font-medium transition-colors mt-1 border-t border-gray-700 pt-2.5 ${
                editMode
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {editMode ? '✓ Done (Edit Layout)' : 'Edit Layout'}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
