import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CounterpartiesPage from './pages/counterparties/CounterpartiesPage';
import ContractsPage from './pages/contracts/ContractsPage';
import PowerProfilesPage from './pages/power-profiles/PowerProfilesPage';
import CalculationsPage from './pages/calculations/CalculationsPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruRU} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1677ff' } }}
        tooltip={{ mouseEnterDelay: 1, trigger: 'hover' }}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="counterparties" element={<CounterpartiesPage />} />
                <Route path="contracts" element={<ContractsPage />} />
                <Route path="power-profiles" element={<PowerProfilesPage />} />
                <Route path="calculations" element={<CalculationsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
