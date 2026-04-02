import { resolveHeritagePkForSave } from './characterUtils';

const list = [
  { id: 1, name: 'Human' },
  { id: 2, name: 'Rock Human' },
  { id: 3, name: 'Vampire' },
];

describe('resolveHeritagePkForSave', () => {
  test('throws when heritageList is empty', () => {
    expect(() => resolveHeritagePkForSave(1, [])).toThrow(
      /Could not resolve heritage: heritages unavailable/
    );
    expect(() => resolveHeritagePkForSave(1, null)).toThrow(
      /Could not resolve heritage: heritages unavailable/
    );
  });

  test('throws when first row has invalid id', () => {
    expect(() => resolveHeritagePkForSave(1, [{ id: 'x', name: 'Bad' }])).toThrow(
      /Could not resolve heritage: heritages unavailable/
    );
  });

  test('returns finite number as-is', () => {
    expect(resolveHeritagePkForSave(2, list)).toBe(2);
  });

  test('coerces digit string', () => {
    expect(resolveHeritagePkForSave('3', list)).toBe(3);
  });

  test('resolves name case-insensitively', () => {
    expect(resolveHeritagePkForSave('rock human', list)).toBe(2);
    expect(resolveHeritagePkForSave('VAMPIRE', list)).toBe(3);
  });

  test('null and empty string fall back to first PK', () => {
    expect(resolveHeritagePkForSave(null, list)).toBe(1);
    expect(resolveHeritagePkForSave('', list)).toBe(1);
  });

  test('non-matching string falls back to first PK', () => {
    expect(resolveHeritagePkForSave('Unknown Lineage', list)).toBe(1);
  });

  test('coerces string id on match', () => {
    expect(
      resolveHeritagePkForSave('Rock Human', [
        { id: '2', name: 'Rock Human' },
        { id: 1, name: 'Human' },
      ])
    ).toBe(2);
  });
});
