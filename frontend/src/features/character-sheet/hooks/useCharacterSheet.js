import { useState, useEffect } from 'react';
import { createDefaultCharacter } from '../utils/characterUtils';

export const useCharacterSheet = (character, onSave) => {
  const [characterData, setCharacterData] = useState(createDefaultCharacter());
  const [stressBoxes, setStressBoxes] = useState(Array(9).fill(false));
  const [traumaChecks, setTraumaChecks] = useState({
    COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
    RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
  });
  const [armorUses, setArmorUses] = useState({ armor: false, heavy: false, special: false });
  const [harmEntries, setHarmEntries] = useState({
    level3: [''],
    level2: ['', ''],
    level1: ['', '']
  });
  const [coinBoxes, setCoinBoxes] = useState(Array(4).fill(false));
  const [stashBoxes, setStashBoxes] = useState(Array(40).fill(false));
  const [healingClock, setHealingClock] = useState(0);
  const [actionRatings, setActionRatings] = useState({
    HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
    FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
    BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
  });
  const [standStats, setStandStats] = useState({
    power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
  });
  const [xpTracks, setXpTracks] = useState({
    insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
  });
  const [selectedAbilities, setSelectedAbilities] = useState([]);
  const [customClocks, setCustomClocks] = useState([]);

  // Update component state when character prop changes
  useEffect(() => {
    if (character) {
      setCharacterData({
        name: character.name || '',
        standName: character.standName || '',
        heritage: character.heritage || 'Human',
        background: character.background || '',
        look: character.look || '',
        vice: character.vice || '',
        crew: character.crew || ''
      });
      setStressBoxes(character.stress || Array(9).fill(false));
      setTraumaChecks(character.trauma || {
        COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
        RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
      });
      setArmorUses(character.armor || { armor: false, heavy: false, special: false });
      setHarmEntries(character.harmEntries || {
        level3: [''],
        level2: ['', ''],
        level1: ['', '']
      });
      setCoinBoxes(character.coin || Array(4).fill(false));
      setStashBoxes(character.stash || Array(40).fill(false));
      setHealingClock(character.healingClock || 0);
      setActionRatings(character.actionRatings || {
        HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
        FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
        BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
      });
      setStandStats(character.standStats || {
        power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
      });
      setXpTracks(character.xp || {
        insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
      });
      setSelectedAbilities(character.abilities || []);
      setCustomClocks(character.clocks || []);
    } else {
      // Reset to default values for new character
      const defaultChar = createDefaultCharacter();
      setCharacterData(defaultChar);
      setStressBoxes(defaultChar.stress);
      setTraumaChecks(defaultChar.trauma);
      setArmorUses(defaultChar.armor);
      setHarmEntries(defaultChar.harmEntries);
      setCoinBoxes(defaultChar.coin);
      setStashBoxes(defaultChar.stash);
      setHealingClock(defaultChar.healingClock);
      setActionRatings(defaultChar.actionRatings);
      setStandStats(defaultChar.standStats);
      setXpTracks(defaultChar.xp);
      setSelectedAbilities(defaultChar.abilities);
      setCustomClocks(defaultChar.clocks);
    }
  }, [character]);

  const handleSave = () => {
    const updatedCharacter = {
      ...characterData,
      actionRatings,
      standStats,
      stress: stressBoxes,
      trauma: traumaChecks,
      armor: armorUses,
      harmEntries,
      coin: coinBoxes,
      stash: stashBoxes,
      healingClock,
      xp: xpTracks,
      abilities: selectedAbilities,
      clocks: customClocks,
      id: character?.id || Date.now(),
      lastModified: new Date().toISOString()
    };
    
    onSave(updatedCharacter);
  };

  return {
    characterData,
    setCharacterData,
    stressBoxes,
    setStressBoxes,
    traumaChecks,
    setTraumaChecks,
    armorUses,
    setArmorUses,
    harmEntries,
    setHarmEntries,
    coinBoxes,
    setCoinBoxes,
    stashBoxes,
    setStashBoxes,
    healingClock,
    setHealingClock,
    actionRatings,
    setActionRatings,
    standStats,
    setStandStats,
    xpTracks,
    setXpTracks,
    selectedAbilities,
    setSelectedAbilities,
    customClocks,
    setCustomClocks,
    handleSave
  };
}; 