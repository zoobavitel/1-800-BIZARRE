// src/components/Layout.jsx (updated to use auth context)
import React from 'react';
import Header from './Header';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

const Layout = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Check if current page is a form page (login/signup)
  const isFormPage = location.pathname === '/login' || location.pathname === '/signup';
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <Header isAuthenticated={isAuthenticated} />
      
      {/* Main content - adjusted for pages */}
      <main className={`flex-grow pt-16 ${isFormPage ? 'bg-primary-red' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;