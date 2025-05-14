// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import Login from './pages/Login';
import CharacterSheet from './components/CharacterSheetAscii';
import CampaignDashboard from './pages/CampaignDashboard';
import CharacterDashboard from './pages/CharacterDashboard';
import CharacterCreate from './pages/CharacterCreate';
import CharacterEdit from './pages/CharacterEdit';
import Home from './pages/Home';
import Rules from './pages/Rules';
import Learn from './pages/Learn';
import SignUp from './pages/SignUp';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const { isAuthenticated, loading } = useAuth();
  
  // Protected route wrapper
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner size="large" />
        </div>
      );
    }
    
    return isAuthenticated ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/rules/*" element={<Rules />} />
        <Route path="/learn" element={<Learn />} />
        
        {/* Protected routes */}
        <Route path="/characters" element={
          <ProtectedRoute>
            <CharacterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/characters/:id" element={
          <ProtectedRoute>
            <CharacterSheet />
          </ProtectedRoute>
        } />
        <Route path="/characters/:id/edit" element={
          <ProtectedRoute>
            <CharacterEdit />
          </ProtectedRoute>
        } />
        <Route path="/create-character" element={
          <ProtectedRoute>
            <CharacterCreate />
          </ProtectedRoute>
        } />
        <Route path="/campaigns" element={
          <ProtectedRoute>
            <CampaignDashboard />
          </ProtectedRoute>
        } />

        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;