// Authentication service for user management

import { getApiBaseUrl } from '../../../config/apiConfig';

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  const base = getApiBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${path}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Token ${token}` }),
      ...(fullUrl.includes('ngrok') && { 'ngrok-skip-browser-warning': '1' }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(fullUrl, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors[0]) ||
        errorData.detail ||
        errorData.error ||
        (typeof errorData.username === 'string' ? errorData.username : errorData.username?.[0]) ||
        (typeof errorData.password === 'string' ? errorData.password : errorData.password?.[0]) ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Could not reach game server. Check the Game server URL, ensure the host\'s backend is running, and try disabling ad blockers for this site.');
    }
    throw error;
  }
};

// Authentication API functions
export const authAPI = {
  // Login user
  login: (credentials) => apiRequest('/accounts/login/', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  
  // Register new user
  signup: (userData) => apiRequest('/accounts/signup/', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  // Get current user info (for token validation and display)
  getCurrentUser: () => apiRequest('/accounts/me/'),
  
  // Logout (clear token)
  logout: () => {
    localStorage.removeItem('authToken');
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
}; 