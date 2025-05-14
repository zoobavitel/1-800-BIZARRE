// src/components/character/steps/AbilitySelector.jsx
import PropTypes from 'prop-types';

export default function AbilitySelector({
  abilities,
  standAbilities,
  onStandAbilitiesChange,
  customAbilityType,
  onCustomAbilityTypeChange,
  customAbilityDescription,
  onCustomAbilityDescriptionChange,
  selectedStandardAbilities,
  onSelectedStandardAbilitiesChange,
  totalStandAbilities,
  totalStandardAbilities,
  aGradeCount
}) {
  // Filter to only standard abilities
  const standardList = abilities.filter(a => a.type === 'standard');

  // Update a stand ability at a specific index
  const updateStandAbility = (index, field, value) => {
    const updatedAbilities = [...standAbilities];
    updatedAbilities[index] = { 
      ...updatedAbilities[index], 
      [field]: value 
    };
    onStandAbilitiesChange(updatedAbilities);
  };

  // Handle updating a standard ability selection at a specific index
  const updateStandardAbility = (index, value) => {
    const updated = [...selectedStandardAbilities];
    updated[index] = Number(value); // Ensure it's a number
    onSelectedStandardAbilitiesChange(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Choose Your Special Ability</h3>
      <p className="text-gray-600">Pick one standard ability and build your Stand's unique ability(ies).</p>

      {/* ——— Stand Abilities ——— */}
      <div className="bg-gray-50 p-4 rounded border">
        <h4 className="font-semibold mb-2">Stand Abilities</h4>
        <p className="text-sm mb-2">
          You start with 1 unique ability (3 effects) or 3 abilities (1 effect each). For each A grade, you get +2 effects or +2 abilities, etc.
          <br />Total allowed: {totalStandAbilities}
        </p>

        <div className="mb-4">
          <label className="block font-medium mb-1">Ability Type</label>
          <div className="flex space-x-4">
            <label>
              <input
                type="radio"
                value="single_with_3_uses"
                checked={customAbilityType === "single_with_3_uses"}
                onChange={(e) => onCustomAbilityTypeChange(e.target.value)}
                className="mr-2"
              />
              One Ability (3 uses)
            </label>
            <label>
              <input
                type="radio"
                value="three_separate_uses"
                checked={customAbilityType === "three_separate_uses"}
                onChange={(e) => onCustomAbilityTypeChange(e.target.value)}
                className="mr-2"
              />
              Three Abilities (1 use each)
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-1">Describe your Stand Ability</label>
          <textarea
            className="w-full border rounded px-2 py-1"
            placeholder="Describe your custom Stand ability here..."
            value={customAbilityDescription}
            onChange={(e) => onCustomAbilityDescriptionChange(e.target.value)}
            rows={4}
          />
        </div>

        {standAbilities.map((ability, index) => (
          <div key={index} className="mb-2">
            <input
              type="text"
              placeholder={`Ability #${index + 1} name…`}
              value={ability.name || ''}
              onChange={e => updateStandAbility(index, 'name', e.target.value)}
              className="w-full border rounded px-2 py-1 mb-1"
              required
            />
            <textarea
              placeholder="Describe what it does…"
              value={ability.desc || ''}
              onChange={e => updateStandAbility(index, 'desc', e.target.value)}
              className="w-full border rounded px-2 py-1"
              rows={2}
              required
            />
          </div>
        ))}
      </div>

      {/* ——— Standard Abilities ——— */}
      <div className="bg-gray-50 p-4 rounded border">
        <h4 className="font-semibold mb-2">Standard Abilities</h4>
        <p className="text-sm mb-2">
          Select up to {totalStandardAbilities} standard ability{totalStandardAbilities > 1 ? 'ies' : ''}. 1 base +1 per A grade.
        </p>

        {Array.from({ length: totalStandardAbilities }).map((_, index) => (
          <div key={index} className="mb-2">
            <label className="block font-medium mb-1">Standard Ability #{index + 1}</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={selectedStandardAbilities[index] || ''}
              onChange={e => updateStandardAbility(index, e.target.value)}
            >
              <option value="">— Select Ability —</option>
              {standardList.map(ability => (
                <option key={ability.id} value={ability.id}>
                  {ability.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

AbilitySelector.propTypes = {
  abilities: PropTypes.array.isRequired,
  standAbilities: PropTypes.array.isRequired,
  onStandAbilitiesChange: PropTypes.func.isRequired,
  customAbilityType: PropTypes.string.isRequired,
  onCustomAbilityTypeChange: PropTypes.func.isRequired,
  customAbilityDescription: PropTypes.string.isRequired,
  onCustomAbilityDescriptionChange: PropTypes.func.isRequired,
  selectedStandardAbilities: PropTypes.array.isRequired,
  onSelectedStandardAbilitiesChange: PropTypes.func.isRequired,
  totalStandAbilities: PropTypes.number.isRequired,
  totalStandardAbilities: PropTypes.number.isRequired,
  aGradeCount: PropTypes.number.isRequired
};