// src/utils/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Set the authorization header for all future requests
          api.defaults.headers.common['Authorization'] = `Token ${token}`;
          
          // Try to get user details - this can be any authenticated endpoint
          // that will validate the token
          try {
            // First, check if the token is valid by making a request to any protected endpoint
            // For example, you can try to fetch the user's characters
            const response = await api.get('characters/');
            // If the request doesn't throw an error, the token is valid
            setUser({ id: 'authenticated', username: 'User' });
          } catch (error) {
            // If the endpoint returns 401, token is invalid
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
              console.log("Token invalid or expired");
              localStorage.removeItem('token');
              delete api.defaults.headers.common['Authorization'];
            } else {
              // Other errors might mean the endpoint exists but user has no characters
              // Still consider them authenticated
              console.log("Authenticated but encountered error:", error);
              setUser({ id: 'authenticated', username: 'User' });
            }
          }
        } catch (error) {
          // Handle unexpected errors
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (userData, token, rememberMe = false) => {
    // Set user state
    setUser(userData || { id: 'authenticated', username: 'User' });
    
    // Store token
    localStorage.setItem('token', token);
    
    // Set the authorization header
    api.defaults.headers.common['Authorization'] = `Token ${token}`;
    
    return true;
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    
    // Optional: call logout endpoint if you have one
    // try {
    //   await api.post('accounts/logout/');
    // } catch (error) {
    //   console.error('Logout error:', error);
    // }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);