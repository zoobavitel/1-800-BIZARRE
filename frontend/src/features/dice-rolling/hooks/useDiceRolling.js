import { useState } from 'react';
import { characterAPI } from '../../character-sheet/services/api';

export const useDiceRolling = (characterId, xpTracks, setXpTracks) => {
  const [diceResult, setDiceResult] = useState(null);
  const [rolling, setRolling] = useState(false);

  const rollDice = async (actionName, diceCount, isResistanceRoll = false, isDesperateAction = false) => {
    if (!characterId) {
      // Fallback to client-side rolling if no character ID
      return rollDiceClientSide(actionName, diceCount, isResistanceRoll, isDesperateAction);
    }

    setRolling(true);
    
    try {
      const result = await characterAPI.rollAction(characterId, {
        action: actionName,
        dice_count: diceCount,
        is_resistance_roll: isResistanceRoll,
        is_desperate_action: isDesperateAction
      });
      
      setDiceResult({
        action: actionName,
        dice: result.dice || [],
        result: result.highest_result || 0,
        outcome: result.outcome || 'Failure',
        special: result.special || '',
        isResistance: isResistanceRoll,
        stressCost: result.stress_cost || null,
        zeroDice: diceCount === 0,
        isDesperateAction: isDesperateAction,
        backendResult: result
      });

      // Auto-mark XP for desperate actions if backend didn't handle it
      if (isDesperateAction && !isResistanceRoll && result.xp_gained) {
        const actionToAttribute = {
          'HUNT': 'insight', 'STUDY': 'insight', 'SURVEY': 'insight', 'TINKER': 'insight',
          'FINESSE': 'prowess', 'PROWL': 'prowess', 'SKIRMISH': 'prowess', 'WRECK': 'prowess',
          'BIZARRE': 'resolve', 'COMMAND': 'resolve', 'CONSORT': 'resolve', 'SWAY': 'resolve'
        };
        
        const attribute = actionToAttribute[actionName];
        if (attribute && xpTracks[attribute] < 5) {
          setXpTracks(prev => ({
            ...prev,
            [attribute]: Math.min(prev[attribute] + result.xp_gained, 5)
          }));
        }
      }

      return result;
    } catch (error) {
      console.error('Backend dice roll failed, falling back to client-side:', error);
      // Fallback to client-side rolling
      return rollDiceClientSide(actionName, diceCount, isResistanceRoll, isDesperateAction);
    } finally {
      setRolling(false);
    }
  };

  const rollDiceClientSide = (actionName, diceCount, isResistanceRoll = false, isDesperateAction = false) => {
    if (diceCount === 0) {
      // Roll 2 dice and take the lower result for 0 dice
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const result = Math.min(dice1, dice2);
      
      let outcome = 'Failure';
      if (result >= 6) outcome = 'Success';
      else if (result >= 4) outcome = 'Partial Success';
      
      setDiceResult({
        action: actionName,
        dice: [dice1, dice2],
        result: result,
        outcome: outcome,
        special: '0 dice: Roll 2d6, take lower',
        isResistance: isResistanceRoll,
        stressCost: isResistanceRoll ? 6 - result : null,
        zeroDice: true,
        isDesperateAction: isDesperateAction
      });
    } else {
      const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      const highest = Math.max(...dice);
      const sixes = dice.filter(d => d === 6).length;
      
      let outcome = 'Failure';
      if (highest >= 6) {
        outcome = sixes > 1 ? 'Critical Success' : 'Success';
      } else if (highest >= 4) {
        outcome = 'Partial Success';
      }
      
      setDiceResult({
        action: actionName,
        dice: dice,
        result: highest,
        outcome: outcome,
        special: sixes > 1 ? `Critical! (${sixes} sixes)` : '',
        isResistance: isResistanceRoll,
        stressCost: isResistanceRoll ? 6 - highest : null,
        zeroDice: false,
        isDesperateAction: isDesperateAction
      });
    }

    // Auto-mark XP for desperate actions
    if (isDesperateAction && !isResistanceRoll) {
      // Mark XP in the appropriate attribute for the action
      const actionToAttribute = {
        'HUNT': 'insight', 'STUDY': 'insight', 'SURVEY': 'insight', 'TINKER': 'insight',
        'FINESSE': 'prowess', 'PROWL': 'prowess', 'SKIRMISH': 'prowess', 'WRECK': 'prowess',
        'BIZARRE': 'resolve', 'COMMAND': 'resolve', 'CONSORT': 'resolve', 'SWAY': 'resolve'
      };
      
      const attribute = actionToAttribute[actionName];
      if (attribute && xpTracks[attribute] < 5) {
        setXpTracks(prev => ({
          ...prev,
          [attribute]: Math.min(prev[attribute] + 1, 5)
        }));
      }
    }
  };

  const markAsDesperateAction = () => {
    if (!diceResult || diceResult.isResistance || diceResult.isDesperateAction) return;

    const actionToAttribute = {
      'HUNT': 'insight', 'STUDY': 'insight', 'SURVEY': 'insight', 'TINKER': 'insight',
      'FINESSE': 'prowess', 'PROWL': 'prowess', 'SKIRMISH': 'prowess', 'WRECK': 'prowess',
      'BIZARRE': 'resolve', 'COMMAND': 'resolve', 'CONSORT': 'resolve', 'SWAY': 'resolve'
    };
    
    const attribute = actionToAttribute[diceResult.action];
    if (attribute && xpTracks[attribute] < 5) {
      setXpTracks(prev => ({
        ...prev,
        [attribute]: Math.min(prev[attribute] + 1, 5)
      }));
      setDiceResult(prev => ({ ...prev, isDesperateAction: true }));
    }
  };

  const clearDiceResult = () => {
    setDiceResult(null);
  };

  return {
    diceResult,
    rolling,
    rollDice,
    markAsDesperateAction,
    clearDiceResult
  };
}; 