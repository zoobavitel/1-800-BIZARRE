// src/components/character/steps/HeritageSelector.jsx
import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { HeritageDropdown } from '../heritage/HeritageDropdown';
import { HpCounter } from '../heritage/HpCounter';
import { BenefitsList } from '../heritage/BenefitsList';
import { DetrimentsList } from '../heritage/DetrimentsList';
import { BackgroundInput } from '../heritage/BackgroundInput';

export default function HeritageSelector({
  heritages,
  selectedHeritageId,
  onHeritageChange,
  backgroundNote,
  onBackgroundNoteChange,
  selectedBenefits,
  onSelectedBenefitsChange,
  selectedDetriments,
  onSelectedDetrimentsChange,
  bonusHpFromXp,
  onBonusHpChange,
  heritageHP,
}) {
  // Find the selected heritage from the list
  const selectedHeritage = useMemo(() => 
    heritages.find(h => h.id === Number(selectedHeritageId)),
  [selectedHeritageId, heritages]);
  
  // Get the base HP from the selected heritage
  const baseHp = useMemo(() => 
    selectedHeritage?.base_hp || 0, 
  [selectedHeritage]);
  
  // Filter benefits and detriments into required and optional
  const requiredBenefits = useMemo(() => 
    selectedHeritage?.benefits?.filter(b => b.required) || [],
  [selectedHeritage]);
  
  const optionalBenefits = useMemo(() => 
    selectedHeritage?.benefits?.filter(b => !b.required) || [],
  [selectedHeritage]);
  
  const requiredDetriments = useMemo(() => 
    selectedHeritage?.detriments?.filter(d => d.required) || [],
  [selectedHeritage]);
  
  const optionalDetriments = useMemo(() => 
    selectedHeritage?.detriments?.filter(d => !d.required) || [],
  [selectedHeritage]);
  
  // Add required benefits/detriments when heritage changes
  useEffect(() => {
    if (!selectedHeritageId) return;

    // Set required benefits and detriments
    onSelectedBenefitsChange(requiredBenefits.map(b => b.id));
    onSelectedDetrimentsChange(requiredDetriments.map(d => d.id));
  }, [selectedHeritageId, requiredBenefits, requiredDetriments, onSelectedBenefitsChange, onSelectedDetrimentsChange]);

  // Toggle benefit selection
  const toggleBenefit = (id) => {
    onSelectedBenefitsChange(prev => {
      if (prev.includes(id)) {
        return prev.filter(b => b !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Toggle detriment selection
  const toggleDetriment = (id) => {
    onSelectedDetrimentsChange(prev => {
      if (prev.includes(id)) {
        return prev.filter(d => d !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Choose Your Heritage</h3>
      <p className="text-gray-600">
        Your heritage influences your character's origins and innate capabilities.
      </p>
      
      <HeritageDropdown 
        heritages={heritages}
        selectedHeritageId={selectedHeritageId}
        onHeritageChange={onHeritageChange}
      />
      
      {selectedHeritage && (
        <div className="bg-gray-50 p-3 rounded border">
          <HpCounter
            baseHp={baseHp}
            totalHp={heritageHP}
            bonusHp={bonusHpFromXp}
            onBonusHpChange={onBonusHpChange}
          />
          
          <BenefitsList
            benefits={requiredBenefits}
            selectedIds={selectedBenefits}
            onToggle={() => {}} // No toggle for required benefits
            isRequired={true}
          />
          
          <BenefitsList
            benefits={optionalBenefits}
            selectedIds={selectedBenefits}
            onToggle={toggleBenefit}
            isRequired={false}
          />
          
          <DetrimentsList
            detriments={requiredDetriments}
            selectedIds={selectedDetriments}
            onToggle={() => {}} // No toggle for required detriments
            isRequired={true}
          />
          
          <DetrimentsList
            detriments={optionalDetriments}
            selectedIds={selectedDetriments}
            onToggle={toggleDetriment}
            isRequired={false}
          />
        </div>
      )}
      
      <BackgroundInput
        value={backgroundNote}
        onChange={onBackgroundNoteChange}
      />
    </div>
  );
}

HeritageSelector.propTypes = {
  heritages: PropTypes.array.isRequired,
  selectedHeritageId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onHeritageChange: PropTypes.func.isRequired,
  backgroundNote: PropTypes.string,
  onBackgroundNoteChange: PropTypes.func.isRequired,
  selectedBenefits: PropTypes.array.isRequired,
  onSelectedBenefitsChange: PropTypes.func.isRequired,
  selectedDetriments: PropTypes.array.isRequired,
  onSelectedDetrimentsChange: PropTypes.func.isRequired,
  bonusHpFromXp: PropTypes.number.isRequired,
  onBonusHpChange: PropTypes.func.isRequired,
  heritageHP: PropTypes.number.isRequired,
};