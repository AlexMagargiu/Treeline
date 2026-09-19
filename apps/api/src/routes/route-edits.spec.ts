import { changedFields, EDITABLE_FIELDS, RouteFields } from './route-edits';

const stored: RouteFields = {
  nameRo: 'Vârful Baiu Mare (1895)',
  nameEn: null,
  km: '16.00',
  ascentM: 1050,
  terrain: 'TRAIL',
  technical: 'NONE',
  quiet: 4,
  confidence: 'medium',
  seasonWindow: 'JUN-OCT',
  notes: null,
  shape: null,
};

describe('changedFields', () => {
  it('reports nothing for an empty patch', () => {
    expect(changedFields(stored, {})).toEqual([]);
  });

  it('reports one change with the column, the old value and the new one', () => {
    expect(changedFields(stored, { km: '18.40' })).toEqual([
      { field: 'km', column: 'km', oldValue: '16.00', newValue: '18.40' },
    ]);
  });

  it('reports one row per changed field, in the order the fields are declared', () => {
    const changes = changedFields(stored, { quiet: 2, nameEn: 'Baiu Mare peak', km: '18.40' });
    expect(changes.map((change) => change.field)).toEqual(['nameEn', 'km', 'quiet']);
  });

  // A form that posts every field should leave no trail until something moves.
  it('reports nothing when every field is submitted unchanged', () => {
    expect(changedFields(stored, { ...stored })).toEqual([]);
  });

  // km is numeric(5,2). 16 and 16.00 are the same number, and an edit_log row saying the
  // distance changed from 16.00 to 16 is a lie in the one table that must not tell one.
  it('treats 16 and 16.00 as the same distance', () => {
    expect(changedFields(stored, { km: '16' })).toEqual([]);
    expect(changedFields(stored, { km: 16 })).toEqual([]);
    expect(changedFields(stored, { km: '16.000' })).toEqual([]);
  });

  it('reports a distance that really moved, however it was written', () => {
    expect(changedFields(stored, { km: 16.5 })).toEqual([
      { field: 'km', column: 'km', oldValue: '16.00', newValue: '16.5' },
    ]);
  });

  it('records filling a null field', () => {
    expect(changedFields(stored, { notes: 'Ice above the saddle in March.' })).toEqual([
      {
        field: 'notes',
        column: 'notes',
        oldValue: null,
        newValue: 'Ice above the saddle in March.',
      },
    ]);
  });

  it('records clearing a field back to null', () => {
    const withNotes = { ...stored, notes: 'Ice above the saddle in March.' };
    expect(changedFields(withNotes, { notes: null })).toEqual([
      {
        field: 'notes',
        column: 'notes',
        oldValue: 'Ice above the saddle in March.',
        newValue: null,
      },
    ]);
  });

  it('reports nothing for a null field submitted as null', () => {
    expect(changedFields(stored, { nameEn: null, notes: null, shape: null })).toEqual([]);
  });

  it('records an integer change as text', () => {
    expect(changedFields(stored, { ascentM: 1120 })).toEqual([
      { field: 'ascentM', column: 'ascent_m', oldValue: '1050', newValue: '1120' },
    ]);
  });

  it('uses the column name, not the JSON name', () => {
    const changes = changedFields(stored, { nameRo: 'Vârful Baiu Mare', seasonWindow: 'MAY-OCT' });
    expect(changes.map((change) => change.column)).toEqual(['name_ro', 'season_window']);
  });

  it('ignores a field that is not editable', () => {
    const patch = { quiet: 3, massifId: 'somebody else' } as Partial<RouteFields>;
    expect(changedFields(stored, patch).map((change) => change.field)).toEqual(['quiet']);
  });

  it('covers every editable field', () => {
    const everything: Partial<RouteFields> = {
      nameRo: 'a',
      nameEn: 'b',
      km: '1.00',
      ascentM: 1,
      terrain: 'ROCKY',
      technical: 'CHAINS',
      quiet: 1,
      confidence: 'high',
      seasonWindow: 'ALL',
      notes: 'c',
      shape: 'loop',
    };
    expect(changedFields(stored, everything).map((change) => change.field)).toEqual([
      ...EDITABLE_FIELDS,
    ]);
  });
});
