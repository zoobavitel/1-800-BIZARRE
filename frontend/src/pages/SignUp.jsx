// src/pages/SignUp.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import '../styles/Auth.css'; // Reusing the same CSS for both auth pages

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Password validation
  const isPasswordValid = (password) => {
    // At least 8 characters with a mix of letters and numbers
    return password.length >= 8 && 
           /[a-zA-Z]/.test(password) && 
           /[0-9]/.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!acceptTerms) {
      setError('You must accept the Terms of Service');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters with a mix of letters and numbers');
      return;
    }
    
    setLoading(true);
    
    try {
      await api.post('accounts/signup/', { 
        username, 
        password,
        email // Note: Make sure your backend accepts this field
      });
      
      // Redirect to login on success
      navigate('/login?registered=true');
    } catch (err) {
      if (err.response?.data) {
        // Format Django REST validation errors
        const errors = err.response.data;
        if (errors.username) {
          setError(`Username: ${errors.username[0]}`);
        } else if (errors.email) {
          setError(`Email: ${errors.email[0]}`);
        } else if (errors.password) {
          setError(`Password: ${errors.password[0]}`);
        } else {
          setError('Registration failed. Please try again.');
        }
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="form-page">
        <div className="form-container">
          <h2 className="form-title">Create Account</h2>
          
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
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
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                id="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <div className="password-requirements">
                Password must be at least 8 characters long and include a mix of letters and numbers.
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                disabled={loading}
              />
              <label htmlFor="terms">
                I agree to the <Link to="/terms" className="form-link">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="form-link">Privacy Policy</Link>
              </label>
            </div>
            
            <button
              type="submit"
              className="form-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="form-footer">
            Already have an account? <Link to="/login" className="form-link">Sign in</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
} 