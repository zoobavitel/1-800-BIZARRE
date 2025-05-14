// src/components/character/steps/BackgroundEditor.jsx
import PropTypes from 'prop-types';

export default function BackgroundEditor({ backgroundNote, onBackgroundNoteChange }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Your Personal Background</h3>
      <p className="text-gray-600">
        Detail your previous life, occupation, or significant experiences that led to your current path.
      </p>
      <div className="mt-4">
        <textarea
          className="w-full border rounded px-3 py-2 h-36"
          value={backgroundNote}
          onChange={e => onBackgroundNoteChange(e.target.value)}
          placeholder="Describe your character's personal background, experiences, and how they found their way to their current situation..."
          required
        />
      </div>
    </div>
  );
}

BackgroundEditor.propTypes = {
  backgroundNote: PropTypes.string.isRequired,
  onBackgroundNoteChange: PropTypes.func.isRequired
};