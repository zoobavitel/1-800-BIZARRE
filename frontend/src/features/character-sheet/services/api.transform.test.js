import { transformFrontendToBackend, playbookToBackend } from './api';

/** Minimal sheet-like object for transform coverage (spin_playbook_abilities_ui). */
function makeSheet(overrides = {}) {
  const base = {
    name: 'Test',
    standName: 'Stand',
    heritage: 1,
    playbook: 'Spin',
    background: '',
    look: '',
    vice: null,
    viceDetails: '',
    actionRatings: {
      HUNT: 1,
      STUDY: 0,
      SURVEY: 0,
      TINKER: 0,
      FINESSE: 0,
      PROWL: 0,
      SKIRMISH: 0,
      WRECK: 0,
      BIZARRE: 0,
      COMMAND: 0,
      CONSORT: 0,
      SWAY: 0,
    },
    standStats: {
      power: 0,
      speed: 0,
      range: 0,
      durability: 0,
      precision: 0,
      development: 0,
    },
    stressFilled: 0,
    stress: [],
    trauma: [],
    armor: { armor: false, heavy: false },
    harmEntries: { level1: [''], level2: [''], level3: [''] },
    xp: {},
    clocks: [],
    campaign: null,
    inventory: [],
    reputation_status: {},
    abilities: [],
  };
  return { ...base, ...overrides };
}

describe('transformFrontendToBackend playbook and playbook abilities', () => {
  test('playbookToBackend maps display labels to STAND/HAMON/SPIN', () => {
    expect(playbookToBackend('Stand')).toBe('STAND');
    expect(playbookToBackend('Hamon')).toBe('HAMON');
    expect(playbookToBackend('Spin')).toBe('SPIN');
    expect(playbookToBackend('SPIN')).toBe('SPIN');
  });

  test('coerces heritage to integer PK or null (never passes display name strings)', () => {
    expect(transformFrontendToBackend(makeSheet({ heritage: 2 })).heritage).toBe(2);
    expect(transformFrontendToBackend(makeSheet({ heritage: '7' })).heritage).toBe(7);
    expect(transformFrontendToBackend(makeSheet({ heritage: 'Human' })).heritage).toBe(null);
  });

  test('emits spin_ability_ids and hamon_ability_ids from abilities array', () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [
          { id: 10, type: 'standard', name: 'S' },
          { id: 20, type: 'spin', name: 'Spin move' },
          { id: 30, type: 'hamon', name: 'Hamon move' },
        ],
      })
    );
    expect(out.standard_abilities).toEqual([10]);
    expect(out.spin_ability_ids).toEqual([20]);
    expect(out.hamon_ability_ids).toEqual([30]);
  });
});
