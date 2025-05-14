// src/components/character/steps/ViceSelector.jsx
import PropTypes from 'prop-types';

export default function ViceSelector({
  vices,
  selectedViceId,
  viceDetails,
  customViceName,
  onViceChange,
  onViceDetailsChange,
  onCustomViceNameChange
}) {
  const selectedVice = vices.find(v => v.id === Number(selectedViceId));
  const usingCustomVice = selectedViceId === -1;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Choose Your Vice</h3>
      <p className="text-gray-600">
        Your vice helps manage stress but can expose vulnerabilities.
      </p>

      {/* Vice Selector */}
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Vice</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={selectedViceId}
          onChange={e => {
            const val = e.target.value;
            onViceChange(val === "custom" ? -1 : Number(val));
          }}
          required
        >
          <option value="">— Select Vice —</option>
          {vices.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
          <option value="custom">Other (Write Your Own)</option>
        </select>
      </div>

      {/* Vice Description */}
      {selectedVice && (
        <div className="bg-gray-50 p-3 rounded border">
          <p>{selectedVice.description}</p>
        </div>
      )}

      {/* Custom Vice Name (only if custom) */}
      {usingCustomVice && (
        <div>
          <label className="block text-sm font-medium mb-1">Custom Vice Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. Collecting cursed vinyl, competitive noodle-eating"
            value={customViceName}
            onChange={e => onCustomViceNameChange(e.target.value)}
            required
          />
        </div>
      )}

      {/* How & Where */}
      <div>
        <label className="block text-sm font-medium mb-1">How & Where?</label>
        <textarea
          className="w-full border rounded px-3 py-2 h-24"
          value={viceDetails}
          onChange={e => onViceDetailsChange(e.target.value)}
          placeholder="Describe how your character indulges their vice and where they go to do so..."
          required
        />
      </div>

      <div className="bg-gray-50 p-3 rounded border">
        <h4 className="font-medium">Vice in Game:</h4>
        <ul className="list-disc pl-5 mt-1 text-sm">
          <li>During downtime, indulge your vice to clear stress</li>
          <li>Roll dice equal to your lowest attribute rating</li>
          <li>Clear stress equal to your highest die result</li>
          <li>If you clear more stress than you had, you overindulge</li>
        </ul>
      </div>
    </div>
  );
}

ViceSelector.propTypes = {
  vices: PropTypes.array.isRequired,
  selectedViceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  viceDetails: PropTypes.string,
  customViceName: PropTypes.string,
  onViceChange: PropTypes.func.isRequired,
  onViceDetailsChange: PropTypes.func.isRequired,
  onCustomViceNameChange: PropTypes.func.isRequired
};