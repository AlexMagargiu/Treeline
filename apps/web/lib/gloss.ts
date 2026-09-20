/**
 * Place names stay Romanian, with a translation in brackets the first time they appear on
 * a screen and never a second time: Prapastiile Zarnestiului (Zarnesti Gorges), then
 * Prapastiile Zarnestiului. On the mountain you read what the paint says, so the Romanian
 * form is the name and the gloss is a note beside it.
 *
 * Nothing is invented here. `route.name_en` is empty for all 185 seeded rows today, so
 * every name renders bare, and the bracket appears by itself the day the column is filled.
 * A translated signpost would be worse than no translation at all.
 *
 * A fresh gloss belongs to one render of one screen. Build it in the component body, not
 * in state, so a re-render starts from nothing seen and the brackets land in the same
 * places they did before.
 */
export function createGloss(): (nameRo: string, nameEn?: string | null) => string {
  const seen = new Set<string>();

  return (nameRo, nameEn) => {
    const first = !seen.has(nameRo);
    seen.add(nameRo);

    const gloss = nameEn?.trim();
    if (!first || !gloss || gloss === nameRo) return nameRo;

    return `${nameRo} (${gloss})`;
  };
}
