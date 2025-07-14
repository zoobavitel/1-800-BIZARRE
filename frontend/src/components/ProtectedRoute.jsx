import React from 'react';
import { useAuth } from '../features/auth';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return children;
};

// Simple login page component that will be replaced by the auth forms
const LoginPage = () => {
  const [isLogin, setIsLogin] = React.useState(true);
  const { LoginForm, SignupForm } = require('../features/auth');

  return (
    <>
      {isLogin ? (
        <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
      ) : (
        <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </>
  );
};

export default ProtectedRoute; 