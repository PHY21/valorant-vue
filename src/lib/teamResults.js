export function headToHead(matches, left, right) {
  if (left === right) return [];
  return matches
    .flatMap((m) => {
      const direct = m.team_a === left && m.team_b === right;
      if (!direct && !(m.team_a === right && m.team_b === left)) return [];
      return [
        {
          ...m,
          leftScore: direct ? m.score_a : m.score_b,
          rightScore: direct ? m.score_b : m.score_a,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export function opponentCounts(matches, team) {
  const counts = new Map();
  for (const m of matches) {
    const opponent =
      m.team_a === team ? m.team_b : m.team_b === team ? m.team_a : null;
    if (opponent !== null)
      counts.set(opponent, (counts.get(opponent) || 0) + 1);
  }
  return counts;
}

export function teamRecord(matches, id) {
  let series = 0,
    wins = 0,
    mapsWon = 0,
    mapsLost = 0;
  for (const m of matches) {
    if (m.team_a !== id && m.team_b !== id) continue;
    const [won, lost] =
      m.team_a === id ? [m.score_a, m.score_b] : [m.score_b, m.score_a];
    series++;
    wins += Number(won > lost);
    mapsWon += won;
    mapsLost += lost;
  }
  return { series, wins, mapsWon, mapsLost };
}
