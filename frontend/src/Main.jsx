// src/Main.jsx - UPDATED
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';

// Import pages
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import CharacterDashboard from './pages/CharacterDashboard';
import CharacterCreate from './pages/CharacterCreate';
import CharacterEdit from './pages/CharacterEdit';
import CharacterSheetPage from './pages/CharacterSheetPage';
import CampaignDashboard from './pages/CampaignDashboard';
import Rules from './pages/Rules';
import Learn from './pages/Learn';
import Collections from './pages/Collections';
import LoadingSpinner from './components/LoadingSpinner';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const Main = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/rules/*" element={<Rules />} />
          <Route path="/learn" element={<Learn />} />
          
          {/* Protected routes */}
          <Route 
            path="/collections" 
            element={
              <ProtectedRoute>
                <Collections />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/characters" 
            element={
              <ProtectedRoute>
                <CharacterDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-character" 
            element={
              <ProtectedRoute>
                <CharacterCreate />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/characters/:id" 
            element={
              <ProtectedRoute>
                <CharacterSheetPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/characters/:id/edit" 
            element={
              <ProtectedRoute>
                <CharacterEdit />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/campaigns" 
            element={
              <ProtectedRoute>
                <CampaignDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default Main;