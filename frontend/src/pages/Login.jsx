// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios'; // Import axios directly for debugging
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../utils/AuthContext';
import '../styles/Auth.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = localStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, navigate]);
  
  // Check if redirected from session expiry
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('session_expired') === 'true') {
      setError('Your session has expired. Please log in again.');
    }
    if (params.get('registered') === 'true') {
      setError('Account created successfully! You can now log in.');
    }
  }, [location]);

  const testServerConnection = async () => {
    try {
      const response = await axios.get('http://localhost:8000/');
      console.log('Server connection test:', response.data);
      return true;
    } catch (error) {
      console.error('Server connection test failed:', error);
      return false;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Test server connection first
      const serverUp = await testServerConnection();
      if (!serverUp) {
        setError('Cannot connect to the server. Please ensure the Django server is running.');
        setLoading(false);
        return;
      }
      
      console.log('Attempting login with username:', username);
      
      // Try the direct URL approach instead of relying on the api instance
      const loginUrl = 'http://localhost:8000/api/accounts/login/';
      console.log('Sending request to:', loginUrl);
      
      const res = await axios.post(loginUrl, 
        { username, password },
        { 
          headers: { 
            'Content-Type': 'application/json',
          }
        }
      );
      
      console.log('Login response received:', res.status);
      
      // Check if we got a token back
      if (res.data && res.data.token) {
        console.log('Token received, calling login function');
        // Use the login function from AuthContext
        await login(res.data.user, res.data.token, rememberMe);
        
        // Check if there's a redirect path saved
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        localStorage.removeItem('redirectAfterLogin'); // Clear it
        
        // Navigate to the redirect path or home
        navigate(redirectPath || '/');
      } else {
        console.error('No token in response:', res.data);
        setError('Authentication failed: No token received from server.');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response) {
        console.error('Error status:', err.response.status);
        console.error('Error data:', err.response.data);
        
        if (err.response.status === 400) {
          setError('Invalid username or password.');
        } else if (err.response.status === 404) {
          setError('Login endpoint not found. Check server configuration.');
        } else if (err.response.status === 405) {
          setError('Method not allowed. The login endpoint is misconfigured.');
        } else {
          const errorMsg = err.response.data.error || err.response.data.detail || 'An error occurred during login.';
          setError(`Error ${err.response.status}: ${errorMsg}`);
        }
      } else if (err.request) {
        // Request was made but no response
        console.error('No response received:', err.request);
        setError('Server not responding. Please check your connection.');
      } else {
        // Something else
        console.error('Request setup error:', err.message);
        setError('Connection error: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="form-page">
        <div className="form-container">
          <h2 className="form-title">Sign In</h2>
          
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                type="text"
                id="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="remember">Remember me</label>
            </div>
            
            <button
              type="submit"
              className="form-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="form-footer">
            Don't have an account? <Link to="/signup" className="form-link">Sign up</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}