import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Home from './pages/Home.jsx';
import ResponsiveTest from './pages/ResponsiveTest.jsx';
import NPCSheetPage from './pages/NPCSheet.jsx';
import { AuthProvider } from './features/auth';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash === 'test') setCurrentPage('test');
    else if (hash === 'npcs') setCurrentPage('npcs');
    else if (hash) setCurrentPage('home');
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.location.hash = page === 'home' ? '' : page;
  };

  return (
    <ProtectedRoute>
      <div>
        <div className="fixed top-4 left-4 z-50 flex gap-2">
          <button 
            onClick={() => handlePageChange('home')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'home' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Home
          </button>
          <button 
            onClick={() => handlePageChange('npcs')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'npcs' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            GM — NPCs
          </button>
          <button 
            onClick={() => handlePageChange('test')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'test' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Responsive Test
          </button>
        </div>

        {currentPage === 'home' && <Home />}
        {currentPage === 'npcs' && <NPCSheetPage />}
        {currentPage === 'test' && <ResponsiveTest />}
      </div>
    </ProtectedRoute>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
