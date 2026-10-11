/**
 * RAID Companion: HellHades import boundary.
 * No HellHades API or automated access is implied by this module.
 * Call normalizeHellHadesSnapshot ONLY with data obtained through an authorized,
 * user-controlled export or documented integration.
 */
export const REQUIRED_STATS = Object.freeze(['hp','atk','def','spd','critRate','critDamage','res','acc']);
const number = value => value === null || value === undefined || value === '' ? null :
  (Number.isFinite(Number(value)) ? Number(value) : null);
const text = value => typeof value === 'string' ? value.trim() : '';
export function normalizeHellHadesSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('Account snapshot must be an object.');
  }
  if (!Array.isArray(snapshot.champions)) {
    throw new TypeError('Account snapshot must include a champions array.');
  }
  const seen = new Set();
  const champions = snapshot.champions.map((champion, index) => {
    if (!champion || typeof champion !== 'object' || !text(champion.name)) {
      throw new TypeError('Champion at index ' + index + ' is missing a name.');
    }
    // The unique per-copy identifier is essential for duplicate champions.
    const copyId = text(champion.copyId);
    if (!copyId) throw new TypeError('Champion ' + champion.name + ' has no copyId.');
    if (seen.has(copyId)) throw new TypeError('Duplicate champion copyId: ' + copyId);
    seen.add(copyId);
    const rawStats = champion.stats || {};
    const stats = Object.fromEntries(REQUIRED_STATS.map(key => [key, number(rawStats[key])]));
    return {
      copyId, name: text(champion.name), level: number(champion.level),
      rank: number(champion.rank), ascension: number(champion.ascension),
      books: champion.books || null, masteries: champion.masteries || null,
      stats
    };
  });
  return {
    source: text(snapshot.source) || 'user-authorized-import',
    extractedAt: text(snapshot.extractedAt) || null,
    champions,
    artifacts: Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [],
    relics: Array.isArray(snapshot.relics) ? snapshot.relics : [],
    teams: Array.isArray(snapshot.teams) ? snapshot.teams : [],
    counts: { champions: champions.length,
      artifacts: Array.isArray(snapshot.artifacts) ? snapshot.artifacts.length : 0,
      relics: Array.isArray(snapshot.relics) ? snapshot.relics.length : 0,
      teams: Array.isArray(snapshot.teams) ? snapshot.teams.length : 0 }
  };
}
