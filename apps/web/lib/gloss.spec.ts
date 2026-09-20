import { createGloss } from './gloss';

describe('createGloss', () => {
  it('glosses a name the first time and never again', () => {
    const gloss = createGloss();
    expect(gloss('Prăpăstiile Zărneștiului', 'Zărnești Gorges')).toBe(
      'Prăpăstiile Zărneștiului (Zărnești Gorges)',
    );
    expect(gloss('Prăpăstiile Zărneștiului', 'Zărnești Gorges')).toBe(
      'Prăpăstiile Zărneștiului',
    );
  });

  it('keeps the diacritics the seed stored', () => {
    const gloss = createGloss();
    expect(gloss('Șapte Scări')).toBe('Șapte Scări');
    expect(gloss('Bușteni')).toBe('Bușteni');
  });

  it('renders the name bare when there is no translation to give', () => {
    const gloss = createGloss();
    expect(gloss('Bucegi', null)).toBe('Bucegi');
    expect(gloss('Baiului', '')).toBe('Baiului');
    expect(gloss('Ciucaș', '   ')).toBe('Ciucaș');
  });

  it('does not repeat a name that translates to itself', () => {
    const gloss = createGloss();
    expect(gloss('Comana', 'Comana')).toBe('Comana');
  });

  it('tracks each name separately', () => {
    const gloss = createGloss();
    expect(gloss('Valea Cerbului', 'Stag Valley')).toBe('Valea Cerbului (Stag Valley)');
    expect(gloss('Șaua Baiului', 'Baiu Saddle')).toBe('Șaua Baiului (Baiu Saddle)');
    expect(gloss('Valea Cerbului', 'Stag Valley')).toBe('Valea Cerbului');
  });

  it('starts from nothing seen on a new render', () => {
    const first = createGloss();
    first('Bucegi', 'Bucegi Mountains');
    const second = createGloss();
    expect(second('Bucegi', 'Bucegi Mountains')).toBe('Bucegi (Bucegi Mountains)');
  });

  it('adds no em dash and no en dash of its own', () => {
    const gloss = createGloss();
    expect(gloss('Piatra Craiului', "The King's Rock")).toBe("Piatra Craiului (The King's Rock)");
    expect(gloss('Postăvaru', 'Postavaru')).not.toMatch(/[\u2013\u2014]/);
  });
});
