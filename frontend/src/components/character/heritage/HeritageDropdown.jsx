// src/components/character/heritage/HeritageDropdown.jsx
import PropTypes from 'prop-types';

export function HeritageDropdown({ heritages, selectedHeritageId, onHeritageChange }) {
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium mb-1">Heritage</label>
      <select
        className="w-full border rounded px-3 py-2"
        value={selectedHeritageId}
        onChange={e => onHeritageChange(e.target.value)}
        required
      >
        <option value="">— Choose Heritage —</option>
        {heritages.map(h => (
          <option key={h.id} value={h.id}>
            {h.name} — Base HP: {h.base_hp}
          </option>
        ))}
      </select>
    </div>
  );
}

HeritageDropdown.propTypes = {
  heritages: PropTypes.array.isRequired,
  selectedHeritageId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onHeritageChange: PropTypes.func.isRequired
};