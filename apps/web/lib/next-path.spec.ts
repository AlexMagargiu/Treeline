import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it('keeps a path on this origin', () => {
    expect(safeNextPath('/')).toBe('/');
    expect(safeNextPath('/massif/bucegi')).toBe('/massif/bucegi');
    expect(safeNextPath('/routes?massif=bucegi&sort=fit')).toBe('/routes?massif=bucegi&sort=fit');
    expect(safeNextPath('/trail/52#seasons')).toBe('/trail/52#seasons');
  });

  it('refuses an absolute url', () => {
    expect(safeNextPath('https://evil.test/steal')).toBe('/');
    expect(safeNextPath('http://evil.test')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('refuses a protocol-relative url', () => {
    expect(safeNextPath('//evil.test')).toBe('/');
    expect(safeNextPath('//evil.test/massif/bucegi')).toBe('/');
  });

  it('refuses a backslash, which some browsers read as a slash', () => {
    expect(safeNextPath('/\\evil.test')).toBe('/');
  });

  it('refuses a control character', () => {
    expect(safeNextPath('/massif\nLocation: https://evil.test')).toBe('/');
  });

  it('falls back to home when there is nothing to go to', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });
});
