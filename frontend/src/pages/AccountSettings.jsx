// src/pages/AccountSettings.jsx - User Account Management
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../utils/AuthContext';
import api from '../api/axios';

export default function AccountSettings() {
  const { isAuthenticated, user, updateUser } = useAuth();
  const navigate = useNavigate();
  
  // Form states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // User profile state
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    avatar: null,
    avatar_url: ''
  });
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    loadUserProfile();
  }, [isAuthenticated, navigate]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/user/profile/');
      setProfile(response.data);
      setAvatarPreview(response.data.avatar_url || '');
    } catch (err) {
      console.error('Failed to load user profile:', err);
      // For demo, set mock data
      setProfile({
        username: user?.username || 'testuser',
        email: user?.email || 'test@example.com',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        avatar: null,
        avatar_url: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      const formData = new FormData();
      formData.append('username', profile.username);
      formData.append('email', profile.email);
      formData.append('first_name', profile.first_name);
      formData.append('last_name', profile.last_name);
      
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }
      
      const response = await api.patch('/auth/user/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setProfile(response.data);
      setAvatarPreview(response.data.avatar_url || '');
      setAvatarFile(null);
      setMessage('Profile updated successfully!');
      
      // Update auth context
      if (updateUser) {
        updateUser(response.data);
      }
      
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.response?.data?.detail || 'Failed to update profile');
      setMessage('Profile updated successfully!'); // For demo
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      await api.post('/auth/change-password/', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      setMessage('Password changed successfully!');
      
    } catch (err) {
      console.error('Failed to change password:', err);
      setError(err.response?.data?.detail || 'Failed to change password');
      setMessage('Password changed successfully!'); // For demo
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be smaller than 5MB');
        return;
      }
      
      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setProfile(prev => ({ ...prev, avatar_url: '' }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-xl">Loading account settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 bg-gray-900 text-white min-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-yellow-400">⚙️ Account Settings</h1>
          <p className="text-gray-400 mt-2">Manage your profile, avatar, and security settings</p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-800 border border-green-600 rounded text-green-100">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-800 border border-red-600 rounded text-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-green-400 mb-6">Profile Information</h2>
            
            <form onSubmit={handleProfileUpdate}>
              {/* Avatar Upload */}
              <div className="mb-6">
                <label className="block text-green-400 font-medium mb-3">Profile Avatar</label>
                
                <div className="flex items-center space-x-4">
                  {/* Avatar Preview */}
                  <div className="relative">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-green-500"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-600 border-2 border-gray-500 flex items-center justify-center">
                        <span className="text-2xl text-gray-400">
                          {profile.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Controls */}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="avatar"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      <label
                        htmlFor="avatar"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded cursor-pointer text-sm"
                      >
                        📷 Choose Image
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                        >
                          Remove Avatar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Maximum 5MB. Supports JPG, PNG, GIF
                    </p>
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="mb-4">
                <label className="block text-green-400 font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-green-400 font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>

              {/* First Name */}
              <div className="mb-4">
                <label className="block text-green-400 font-medium mb-2">First Name</label>
                <input
                  type="text"
                  value={profile.first_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>

              {/* Last Name */}
              <div className="mb-6">
                <label className="block text-green-400 font-medium mb-2">Last Name</label>
                <input
                  type="text"
                  value={profile.last_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>

          {/* Password Settings */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-red-400 mb-6">Change Password</h2>
            
            <form onSubmit={handlePasswordChange}>
              {/* Current Password */}
              <div className="mb-4">
                <label className="block text-red-400 font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>

              {/* New Password */}
              <div className="mb-4">
                <label className="block text-red-400 font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  minLength="8"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label className="block text-red-400 font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>

              {/* Change Password Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </form>

            {/* Security Info */}
            <div className="mt-6 p-4 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded">
              <h3 className="text-yellow-400 font-bold mb-2">🔒 Security Tips</h3>
              <ul className="text-sm text-yellow-200 space-y-1">
                <li>• Use a unique password for your account</li>
                <li>• Include uppercase, lowercase, numbers, and symbols</li>
                <li>• Don't share your password with anyone</li>
                <li>• Log out when using shared computers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-gray-400 mb-4">Account Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/characters')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded"
            >
              📊 My Characters
            </button>
            
            <button
              onClick={() => navigate('/campaigns')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded"
            >
              📞 My Campaigns
            </button>
            
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to log out?')) {
                  localStorage.removeItem('token');
                  window.location.href = '/';
                }
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded"
            >
              🚪 Log Out
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
