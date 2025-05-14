// src/components/character/heritage/BackgroundInput.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function BackgroundInput({ value, onChange }) {
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium mb-1">Family Background</label>
      <textarea 
        className="w-full border rounded px-3 py-2 h-24"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Write about your family's background and history..."
        required
      />
    </div>
  );
}

BackgroundInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired
};

export default BackgroundInput;