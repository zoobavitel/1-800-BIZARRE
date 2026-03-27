import {
  computeActionPoolBreakdown,
  attributeGroupForAction,
  INSIGHT_ACTIONS,
} from './actionDicePool';

describe('actionDicePool', () => {
  test('attributeGroupForAction maps HUNT to insight group', () => {
    expect(attributeGroupForAction('HUNT')).toEqual(INSIGHT_ACTIONS);
  });

  test('computeActionPoolBreakdown: rating + attribute dice', () => {
    const ratings = {
      HUNT: 2,
      STUDY: 0,
      SURVEY: 1,
      TINKER: 0,
      FINESSE: 0,
      PROWL: 0,
      SKIRMISH: 0,
      WRECK: 0,
      BIZARRE: 0,
      COMMAND: 0,
      CONSORT: 0,
      SWAY: 0,
    };
    const b = computeActionPoolBreakdown('HUNT', ratings);
    expect(b.action_rating).toBe(2);
    // survey has a dot → +1 attribute die for insight
    expect(b.attribute_dice).toBe(2);
    expect(b.basePool).toBe(4);
  });
});
