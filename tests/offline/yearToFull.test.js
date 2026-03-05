const { yearToFull } = require('../../public/offline-core');

describe('yearToFull', () => {
  test('"25" → 2025', () => {
    expect(yearToFull('25')).toBe(2025);
  });

  test('"2025" → 2025', () => {
    expect(yearToFull('2025')).toBe(2025);
  });

  test('"0" → 2000', () => {
    expect(yearToFull('0')).toBe(2000);
  });

  test('"99" → 2099', () => {
    expect(yearToFull('99')).toBe(2099);
  });

  test('"100" → 100 (no adjustment)', () => {
    expect(yearToFull('100')).toBe(100);
  });

  test('"abc" → null', () => {
    expect(yearToFull('abc')).toBeNull();
  });

  test('undefined → null', () => {
    expect(yearToFull(undefined)).toBeNull();
  });
});
