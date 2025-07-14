import { useState, useRef, useEffect } from 'react';
import { searchAPI } from '../../character-sheet/services/api';

export const useSearch = (isAuthenticated = true) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const performSearch = async (query) => {
    if (!query.trim() || !isAuthenticated) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      // Use backend search API
      const results = await searchAPI.globalSearch(query);
      
      // Transform backend results to frontend format
      const transformedResults = results.map(result => ({
        type: result.model || 'Unknown',
        title: result.name || result.title || 'Untitled',
        subtitle: result.description || result.subtitle || '',
        id: result.id,
        url: `/${result.model?.toLowerCase()}/${result.id}`,
        score: result.score || 0,
        backendData: result
      }));
      
      setSearchResults(transformedResults);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to mock results if backend fails
      const mockResults = [
        { type: 'Character', title: 'Metal Fingers', subtitle: 'Cyborg Stand User', id: 1, url: '/characters/1' },
        { type: 'Ability', title: 'Iron Will', subtitle: 'Standard Ability', id: 2, url: '/abilities/iron-will' }
      ];
      setSearchResults(mockResults);
      setShowSearchResults(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleSearchResultClick = (result) => {
    setShowSearchResults(false);
    setSearchQuery('');
    // Mock navigation - in a real app this would use router
    console.log('Navigate to:', result.url);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    searchQuery,
    searchResults,
    showSearchResults,
    searchLoading,
    searchRef,
    handleSearchChange,
    handleSearchResultClick,
    handleSearchSubmit,
    setShowSearchResults
  };
}; 