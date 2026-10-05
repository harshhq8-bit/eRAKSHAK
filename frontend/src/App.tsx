import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext.js';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { DeviceProvider } from './contexts/DeviceContext.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Dashboard } from './pages/Dashboard.js';
import { MobileCompanion } from './pages/MobileCompanion.js';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs uppercase tracking-widest text-slate-400">Loading Simple IoT World...</span>
        </div>
      </div>
    );
  }

  // If user is logged in or in test mode, allow access
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DeviceProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Mobile Companion (Directly accessible from Android phone via QR / URL) */}
              <Route path="/mobile" element={<MobileCompanion />} />

              {/* Protected Dashboard Route */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Default redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </DeviceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
