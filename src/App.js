import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import AdminDashboard from './components/AdminDashboard';

// Composant PrivateRoute pour protéger les routes
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  const { loading } = useAuth();
  console.log("App rendering, loading state:", loading);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-100"> {/* Ajout d'un fond visible */}
          <Routes>
            <Route path="/login" element={
              <div>
                <p className="text-black">Login page</p> {/* Test visible */}
                <AuthPage />
              </div>
            } />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <div>
                    <p className="text-black">Dashboard page</p> {/* Test visible */}
                    <AdminDashboard />
                  </div>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;