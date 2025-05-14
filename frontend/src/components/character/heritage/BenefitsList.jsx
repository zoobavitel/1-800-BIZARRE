// src/components/character/heritage/BenefitsList.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function BenefitsList({ benefits, selectedIds, onToggle, isRequired }) {
  if (!benefits || benefits.length === 0) return null;
  
  return (
    <div className="mt-3">
      <h4 className="font-semibold">
        {isRequired ? "Required Benefits" : "Optional Benefits (Choose wisely)"}
      </h4>
      <ul className={isRequired ? "list-disc pl-5" : "space-y-1"}>
        {benefits.map(benefit => (
          <li key={benefit.id} className={isRequired ? "" : "flex items-start"}>
            {!isRequired && (
              <input
                type="checkbox"
                className="mt-1 mr-2"
                checked={selectedIds.includes(benefit.id)}
                onChange={() => onToggle(benefit.id)}
              />
            )}
            <span>
              {benefit.name} ({benefit.hp_cost} HP)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

BenefitsList.propTypes = {
  benefits: PropTypes.array.isRequired,
  selectedIds: PropTypes.array.isRequired,
  onToggle: PropTypes.func.isRequired,
  isRequired: PropTypes.bool.isRequired
};

export default BenefitsList;