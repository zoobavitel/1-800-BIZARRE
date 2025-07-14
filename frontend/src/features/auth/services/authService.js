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

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log('DEBUG: API_BASE_URL:', API_BASE_URL);
  console.log('DEBUG: endpoint:', endpoint);
  console.log('DEBUG: fullUrl:', fullUrl);

  try {
    const response = await fetch(fullUrl, config);
    
    if (!response.ok) {
      console.error('Auth API response not OK:', response);
      const errorData = await response.json().catch(() => ({}));
      console.error('Auth API error data:', errorData);
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Auth API request failed:', error);
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