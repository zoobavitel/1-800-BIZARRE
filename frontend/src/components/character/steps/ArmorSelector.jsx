// src/components/character/steps/ArmorSelector.jsx
import { useMemo } from 'react';
import PropTypes from 'prop-types';

export default function ArmorSelector({ playbook, armorType, onArmorTypeChange }) {
  // Armor choices available to the character
  const armorChoices = useMemo(() => [
    { value: 'LIGHT', label: 'Light' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HEAVY', label: 'Heavy' },
    { value: 'ENCUMBERED', label: 'Encumbered' },
  ], []);

  // Playbook-specific armor descriptions
  const getArmorDescription = (type) => {
    const baseDescriptions = {
      LIGHT: "Light armor offers basic protection without hindering your movement or stealth.",
      MEDIUM: "Medium armor provides substantial protection with minimal penalties to movement.",
      HEAVY: "Heavy armor maximizes protection at the cost of agility and stealth.",
      ENCUMBERED: "Being encumbered means sacrificing almost all mobility for maximum protection."
    };

    return baseDescriptions[type] || "";
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{playbook} Armor</h3>
      <p className="text-gray-600">
        {playbook === 'STAND' && "Track special armor abilities tied to your Stand."}
        {playbook === 'HAMON' && "Use armor to absorb or redirect bizarre energies."}
        {playbook === 'SPIN' && "Armor may represent precision deflections or controlled rotations."}
      </p>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Armor Type</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={armorType}
          onChange={e => onArmorTypeChange(e.target.value)}
          required
        >
          <option value="">— Choose Armor Type —</option>
          {armorChoices.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        
        {armorType && (
          <div className="mt-3 bg-gray-50 p-3 rounded border">
            <p>{getArmorDescription(armorType)}</p>
          </div>
        )}
        
        <div className="mt-3">
          <h4 className="font-medium">Armor Effects in Game:</h4>
          <ul className="list-disc pl-5 mt-1 text-sm">
            <li>Each armor box can be marked to resist or reduce a consequence</li>
            <li>Heavier armor provides more boxes but may impact mobility</li>
            <li>Armor resets when you start a new mission</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

ArmorSelector.propTypes = {
  playbook: PropTypes.string.isRequired,
  armorType: PropTypes.string,
  onArmorTypeChange: PropTypes.func.isRequired
};