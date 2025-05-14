// src/components/character/heritage/HpCounter.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function HpCounter({ baseHp, totalHp, bonusHp, onBonusHpChange }) {
  return (
    <>
      <div className="flex justify-between">
        <span>Base HP: {baseHp}</span>
        <span>Total HP: {totalHp}</span>
      </div>
      
      <div className="mt-2">
        <label className="block text-sm font-medium">Bonus HP from XP:</label>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onBonusHpChange(Math.max(0, bonusHp - 1))}
            className="px-2 bg-red-100 rounded"
            disabled={bonusHp <= 0}
          >-</button>
          <span>{bonusHp}</span>
          <button
            type="button"
            onClick={() => onBonusHpChange(bonusHp + 1)}
            className="px-2 bg-green-100 rounded"
          >+</button>
          <span className="text-xs text-gray-500">(5 XP = 1 HP)</span>
        </div>
      </div>
    </>
  );
}

HpCounter.propTypes = {
  baseHp: PropTypes.number.isRequired,
  totalHp: PropTypes.number.isRequired,
  bonusHp: PropTypes.number.isRequired,
  onBonusHpChange: PropTypes.func.isRequired
};

export default HpCounter;