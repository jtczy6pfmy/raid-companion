// Pure progression planning utilities. No champion is sacrificed automatically.
export const MAX_RANK = 6;
export function levelCap(rank) {
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK) throw new RangeError('Rank must be 1–6');
  return rank * 10;
}
export function foodRequirements(currentRank, targetRank) {
  if (![currentRank,targetRank].every(n => Number.isInteger(n) && n >= 1 && n <= MAX_RANK) || targetRank < currentRank)
    throw new RangeError('Invalid rank progression');
  const byRank = {};
  // To promote from rank r to r+1, consume r champions of rank r.
  // Every prepared food needs one promoted base plus rank-1 sacrifices.
  // Counts at different ranks describe the same production tree, not extra food.
  function ingredients(rank, count) {
    if (!count) return;
    byRank[rank] = (byRank[rank] || 0) + count;
    if (rank > 1) ingredients(rank - 1, count * rank);
  }
  for (let rank = currentRank; rank < targetRank; rank++) {
    ingredients(rank, rank);
  }
  return byRank;
}
export function planProgression(champion, { targetRank = champion.rank, targetLevel = levelCap(targetRank), targetAscension = champion.ascension || 0 } = {}) {
  const { rank, level } = champion;
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK || !Number.isInteger(level) || level < 1 || level > levelCap(rank))
    throw new RangeError('Invalid current champion progression');
  if (!Number.isInteger(targetRank) || targetRank < rank || targetRank > MAX_RANK ||
      !Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > levelCap(targetRank) ||
      (targetRank === rank && targetLevel < level))
    throw new RangeError('Invalid target rank or level');
  if (!Number.isInteger(targetAscension) || targetAscension < (champion.ascension || 0) || targetAscension > targetRank)
    throw new RangeError('Invalid target ascension');
  const steps = [];
  for (let r = rank; r < targetRank; r++) {
    const cap = levelCap(r);
    steps.push({ type: 'level', rank: r, from: r === rank ? level : 1, to: cap });
    steps.push({ type: 'promote', fromRank: r, toRank: r + 1, foodCount: r, foodRank: r });
  }
  const startLevel = targetRank === rank ? level : 1;
  if (targetLevel > startLevel) steps.push({ type: 'level', rank: targetRank, from: startLevel, to: targetLevel });
  if (targetAscension > (champion.ascension || 0))
    steps.push({ type: 'ascend', from: champion.ascension || 0, to: targetAscension, note: 'Potion amounts depend on champion affinity and rarity; verify before spending.' });
  return { championId: champion.cloudId || champion.id, name: champion.name, targetRank, targetLevel, targetAscension, foodByRank: foodRequirements(rank,targetRank), steps };
}
export function sortFoodCandidates(champions, scoreFn, protectedIds = []) {
  const protectedSet = new Set(protectedIds);
  return champions.filter(c => !protectedSet.has(c.cloudId || c.id) && !c.locked && !c.isFavorite && !c.inFusion)
    .map(c => ({ champion: c, score: Number(scoreFn(c)) }))
    .filter(x => Number.isFinite(x.score))
    .sort((a,b) => a.score - b.score || String(a.champion.name).localeCompare(String(b.champion.name)));
}
