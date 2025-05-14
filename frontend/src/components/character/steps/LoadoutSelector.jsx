// src/components/character/steps/LoadoutSelector.jsx
import PropTypes from 'prop-types';

export default function LoadoutSelector({ loadout, onLoadoutChange }) {
  // Generate load description based on the current value
  const getLoadDescription = (loadValue) => {
    if (loadValue <= 3) {
      return "Light load lets you blend in with normal civilians and move quickly.";
    } else if (loadValue <= 5) {
      return "Normal load means you're clearly ready for trouble but not overly burdened.";
    } else if (loadValue === 6) {
      return "Heavy load makes you slow-moving and visibly armed.";
    } else {
      return "Encumbered means you're severely hindered and very noticeable.";
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Loadout</h3>
      <p className="text-gray-600">
        Determine how much equipment your character typically carries.
      </p>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Load</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={loadout}
          onChange={e => onLoadoutChange(Number(e.target.value))}
        >
          <optgroup label="Light (1-3)">
            {[1, 2, 3].map(i => (
              <option key={i} value={i}>{i} Load - Light</option>
            ))}
          </optgroup>
          <optgroup label="Normal (4-5)">
            {[4, 5].map(i => (
              <option key={i} value={i}>{i} Load - Normal</option>
            ))}
          </optgroup>
          <optgroup label="Heavy (6)">
            <option value={6}>6 Load - Heavy</option>
          </optgroup>
          <optgroup label="Encumbered (7-9)">
            {[7, 8, 9].map(i => (
              <option key={i} value={i}>{i} Load - Encumbered</option>
            ))}
          </optgroup>
        </select>
        
        <div className="mt-3 bg-gray-50 p-3 rounded border">
          <p>{getLoadDescription(loadout)}</p>
        </div>
        
        <div className="mt-4 bg-blue-50 p-3 rounded border">
          <h4 className="font-medium">Equipment Access:</h4>
          <p className="mt-1 text-sm">
            Your specific equipment will be chosen during each mission based on your load limit.
            This represents your typical capacity, not the exact items you're carrying.
          </p>
        </div>
      </div>
    </div>
  );
}

LoadoutSelector.propTypes = {
  loadout: PropTypes.number.isRequired,
  onLoadoutChange: PropTypes.func.isRequired
};