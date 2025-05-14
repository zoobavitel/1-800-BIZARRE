// src/components/character/heritage/DetrimentsList.jsx
import PropTypes from 'prop-types';

export function DetrimentsList({ detriments, selectedIds, onToggle, isRequired }) {
  if (!detriments || detriments.length === 0) return null;
  
  return (
    <div className="mt-3">
      <h4 className="font-semibold">
        {isRequired ? "Required Detriments" : "Optional Detriments (For more HP)"}
      </h4>
      <ul className={isRequired ? "list-disc pl-5" : "space-y-1"}>
        {detriments.map(detriment => (
          <li key={detriment.id} className={isRequired ? "" : "flex items-start"}>
            {!isRequired && (
              <input
                type="checkbox"
                className="mt-1 mr-2"
                checked={selectedIds.includes(detriment.id)}
                onChange={() => onToggle(detriment.id)}
              />
            )}
            <span>
              {detriment.name} (+{detriment.hp_value} HP)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

DetrimentsList.propTypes = {
  detriments: PropTypes.array.isRequired,
  selectedIds: PropTypes.array.isRequired,
  onToggle: PropTypes.func.isRequired,
  isRequired: PropTypes.bool.isRequired
};