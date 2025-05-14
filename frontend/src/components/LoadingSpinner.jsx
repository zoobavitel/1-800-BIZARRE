// src/components/LoadingSpinner.jsx
import React from 'react';
import '../styles/LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', color = 'primary' }) => {
  const sizeClass = {
    small: 'spinner-sm',
    medium: 'spinner-md',
    large: 'spinner-lg'
  }[size];
  
  const colorClass = {
    primary: 'spinner-primary',
    white: 'spinner-white',
    dark: 'spinner-dark'
  }[color];
  
  return (
    <div className={`spinner ${sizeClass} ${colorClass}`}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
};

export default LoadingSpinner;