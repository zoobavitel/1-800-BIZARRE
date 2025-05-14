// src/components/character/steps/PlaybookSelector.jsx
import React from 'react';
import PropTypes from 'prop-types';

const PlaybookSelector = ({ playbook, onPlaybookChange }) => {
  const playbookDescriptions = {
    STAND: 
      "Stand users manifest a supernatural entity that represents their fighting spirit and unique abilities. " +
      "Stands are versatile and can range from close-combat fighters to long-range specialists.",
    HAMON: 
      "Hamon practitioners channel solar energy through specialized breathing techniques. " +
      "Their powers focus on healing, enhancing physical capabilities, and defeating supernatural threats.",
    SPIN: 
      "Spin users manipulate the golden ratio to create rotating energy they can apply to objects. " +
      "This technique allows for devastating ranged attacks and precise control over projectiles."
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Choose Your Playbook</h3>
      <p className="text-gray-600">
        Your playbook defines your character's focus area—Stand, Hamon, or Spin.
      </p>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Playbook</label>
        <select 
          className="w-full border rounded px-3 py-2"
          value={playbook} 
          onChange={e => onPlaybookChange(e.target.value)}
          required
        >
          <option value="">— Choose Playbook —</option>
          <option value="STAND">Stand</option>
          <option value="HAMON">Hamon</option>
          <option value="SPIN">Spin</option>
        </select>
      </div>
      
      {playbook && (
        <div className="bg-gray-50 p-3 rounded border mt-4">
          <h4 className="font-semibold">Playbook Overview: {playbook}</h4>
          <p className="mt-2">{playbookDescriptions[playbook]}</p>
        </div>
      )}
    </div>
  );
};

PlaybookSelector.propTypes = {
  playbook: PropTypes.string.isRequired,
  onPlaybookChange: PropTypes.func.isRequired
};

export default PlaybookSelector;