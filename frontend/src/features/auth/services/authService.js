// Authentication service for user management

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Token ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${path}`;

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
  
  // Get current user info (for token validation)
  getCurrentUser: () => apiRequest('/characters/'), // Use characters endpoint as a test
  
  // Logout (clear token)
  logout: () => {
    localStorage.removeItem('authToken');
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
}; 