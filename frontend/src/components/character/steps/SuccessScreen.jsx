// src/components/character/steps/SuccessScreen.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

export default function SuccessScreen({ 
  characterId, 
  characterName,
  playbook,
  onViewSheet,
  onCreateAnother
}) {
  return (
    <div className="text-center">
      <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Character Created!</h3>
      <p className="mb-4 text-gray-600">
        {characterName} ({playbook}) has been successfully created.
      </p>
      
      <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          onClick={onViewSheet}
          className="bg-indigo-600 text-white py-2 px-6 rounded hover:bg-indigo-700"
        >
          View Character Sheet
        </button>
        
        <button
          onClick={onCreateAnother}
          className="bg-gray-200 text-gray-800 py-2 px-6 rounded hover:bg-gray-300"
        >
          Create Another
        </button>
      </div>
      
      <p className="mt-8 text-sm text-gray-500">
        You'll be redirected to the character sheet in a few seconds...
      </p>
    </div>
  );
}

SuccessScreen.propTypes = {
  characterId: PropTypes.number,
  characterName: PropTypes.string.isRequired,
  playbook: PropTypes.string.isRequired,
  onViewSheet: PropTypes.func.isRequired,
  onCreateAnother: PropTypes.func.isRequired
};