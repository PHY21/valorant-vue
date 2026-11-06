import test from "node:test";
import assert from "node:assert/strict";
import {
  filterPlayers,
  rankPlayers,
  compareStats,
  catalogRows,
} from "../src/lib/domain.js";
import { readSaved } from "../src/lib/storage.js";
const players = [
  {
    player_id: 1,
    ign: "Alpha",
    team_tag: "EDG",
    region_code: "CN",
    player_role: "决斗",
  },
  {
    player_id: 2,
    ign: "Beta",
    team_tag: "FNC",
    region_code: "EMEA",
    player_role: "控场",
  },
];
test("unknown and prototype category names return a safe empty collection", () => {
  for (const kind of [
    "constructor",
    "toString",
    "__proto__",
    "user",
    "missing",
  ])
    assert.deepEqual(catalogRows({ player: players }, kind), []);
  assert.equal(catalogRows({ player: players }, "player"), players);
});
test("search combines case-insensitive name/team with region and role", () => {
  assert.deepEqual(
    filterPlayers(players, { q: " edg ", region: "CN", role: "决斗" }).map(
      (x) => x.player_id,
    ),
    [1],
  );
  assert.equal(
    filterPlayers(players, { q: "Alpha", region: "EMEA" }).length,
    0,
  );
  assert.equal(filterPlayers(players, { q: "missing" }).length, 0);
});
test("ranking excludes small samples, aggregates each player, and honors tournament", () => {
  const stats = [
    {
      player_id: 1,
      tournament_id: 1,
      matches_played: 3,
      rating: "1.2",
      acs: "250",
      kd: "1.3",
    },
    { player_id: 2, tournament_id: 1, matches_played: 1, rating: 2 },
    { player_id: 1, tournament_id: 2, matches_played: 9, rating: 3 },
  ];
  assert.equal(
    rankPlayers(players, stats, { tournament: 1, metric: "rating" })[0].value,
    1.2,
  );
  assert.equal(
    rankPlayers(players, stats, { tournament: 1, metric: "rating" }).length,
    1,
  );
});
test("missing stats stay unavailable instead of invented zero", () =>
  assert.equal(compareStats([], 1), null));
test("corrupt or wrong-shaped saved state recovers to defaults", () => {
  assert.deepEqual(readSaved("{broken"), { favorites: [], comments: [] });
  assert.deepEqual(readSaved('{"favorites":null,"comments":"x"}'), {
    favorites: [],
    comments: [],
  });
  assert.deepEqual(readSaved('{"favorites":[1,"bad"],"comments":[null]}'), {
    favorites: [1],
    comments: [],
  });
});
