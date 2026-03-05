const { mergePersonalData, DEFAULT_PERSONAL_DATA } = require('../../server');

describe('mergePersonalData', () => {
  test('empty input returns defaults', () => {
    const result = mergePersonalData({});
    expect(result).toEqual(DEFAULT_PERSONAL_DATA);
  });

  test('undefined input returns defaults', () => {
    const result = mergePersonalData(undefined);
    expect(result).toEqual(DEFAULT_PERSONAL_DATA);
  });

  test('partial override merges with defaults', () => {
    const result = mergePersonalData({ imeIPrezime: 'Petar Petrović' });
    expect(result.imeIPrezime).toBe('Petar Petrović');
    expect(result.tipPoreskogObveznika).toBe('1'); // default preserved
  });

  test('full override replaces all defaults', () => {
    const custom = {
      tipPoreskogObveznika: '2',
      poreskiIdentifikacioniBroj: '123456789',
      imeIPrezime: 'Petar Petrović',
      prebivalisteSifra: '70101',
      adresa: 'Knez Mihailova 1',
      telefon: '0111234567',
      email: 'petar@example.com',
      jmbg: '0101990710000',
    };
    const result = mergePersonalData(custom);
    expect(result).toEqual(custom);
  });
});
