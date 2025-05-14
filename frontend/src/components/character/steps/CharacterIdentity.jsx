// src/components/character/steps/CharacterIdentity.jsx
import PropTypes from 'prop-types';

export default function CharacterIdentity({
  trueName,
  onTrueNameChange,
  alias,
  onAliasChange,
  appearance,
  onAppearanceChange
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Name, Alias & Appearance</h3>
      <p className="text-gray-600">
        Define how your character is known in the bizarre underworld.
      </p>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">True Name</label>
        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={trueName}
          onChange={e => onTrueNameChange(e.target.value)}
          placeholder="Your character's real name..."
          required
        />
        
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Alias (Optional)</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={alias}
            onChange={e => onAliasChange(e.target.value)}
            placeholder="Any nickname or pseudonym..."
          />
        </div>
        
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Appearance</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-24"
            value={appearance}
            onChange={e => onAppearanceChange(e.target.value)}
            placeholder="Describe your character's physical appearance, clothing style, and any distinctive features..."
          />
        </div>
      </div>
    </div>
  );
}

CharacterIdentity.propTypes = {
  trueName: PropTypes.string.isRequired,
  onTrueNameChange: PropTypes.func.isRequired,
  alias: PropTypes.string,
  onAliasChange: PropTypes.func.isRequired,
  appearance: PropTypes.string,
  onAppearanceChange: PropTypes.func.isRequired
};