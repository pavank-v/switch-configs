import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { AppLayout } from '@/components/Layout';
import { OkapiMark } from '@/components/icons';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import LoginPage from '@/pages/Login';
import NotFoundPage from '@/pages/NotFound';
import RegisterPage from '@/pages/Register';
import SettingsPage from '@/pages/Settings';
import TasksPage from '@/pages/Tasks';

function SplashScreen() {
  return (
    <div className="grid min-h-full place-items-center">
      <OkapiMark className="size-10 animate-pulse" />
    </div>
  );
}

/** Gates the authenticated area, remembering where the user was headed. */
function RequireAuth() {
  const { account, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return <SplashScreen />;
  }

  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<TasksPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
