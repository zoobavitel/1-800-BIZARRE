import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Home from './pages/Home.jsx';
import ResponsiveTest from './pages/ResponsiveTest.jsx';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    // Check URL hash to determine which page to show
    const hash = window.location.hash.substring(1);
    if (hash === 'test') {
      setCurrentPage('test');
    }
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.location.hash = page === 'home' ? '' : page;
  };

  return (
    <div>
      {/* Simple navigation */}
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <button 
          onClick={() => handlePageChange('home')}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            currentPage === 'home' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Home
        </button>
        <button 
          onClick={() => handlePageChange('test')}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            currentPage === 'test' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Responsive Test
        </button>
      </div>

      {/* Render current page */}
      {currentPage === 'home' ? <Home /> : <ResponsiveTest />}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
