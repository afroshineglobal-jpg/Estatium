import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SocketProvider } from './hooks/useSocket';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import Visitors from './pages/Visitors';
import Parcels from './pages/Parcels';
import Amenities from './pages/Amenities';
import Billing from './pages/Billing';
import Vehicles from './pages/Vehicles';
import Staff from './pages/Staff';
import Maintenance from './pages/Maintenance';
import Emergency from './pages/Emergency';
import Communication from './pages/Communication';
import Analytics from './pages/Analytics';
import Advertisements from './pages/Advertisements';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="fixed inset-0 bg-surface-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-estate-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuToggle={() => setSidebarOpen(v => !v)} />
      <main className="lg:ml-[var(--sidebar-width)] pt-[var(--header-height)]">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/residents" element={<Residents />} />
            <Route path="/visitors" element={<Visitors />} />
            <Route path="/parcels" element={<Parcels />} />
            <Route path="/amenities" element={<Amenities />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/communication" element={<Communication />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/advertisements" element={<Advertisements />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster position="top-right" toastOptions={{
            style: { background: '#1a2420', color: '#e2e8f0', border: '1px solid #1a3a28', borderRadius: '12px' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#0a2e1a' } },
          }} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
