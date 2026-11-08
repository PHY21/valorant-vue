import test from "node:test";
import assert from "node:assert/strict";
import {
  headToHead,
  opponentCounts,
  teamRecord,
} from "../src/lib/teamResults.js";
import { readSaved } from "../src/lib/storage.js";
const matches = [
  {
    id: 1,
    date: "2024-05-31",
    team_a: 104,
    team_b: 310,
    score_a: 0,
    score_b: 2,
  },
  {
    id: 2,
    date: "2024-08-25",
    team_a: 104,
    team_b: 310,
    score_a: 3,
    score_b: 2,
  },
  {
    id: 3,
    date: "2025-01-01",
    team_a: 105,
    team_b: 104,
    score_a: 1,
    score_b: 2,
  },
];
test("pair scores follow the picker order, aggregate records include other opponents", () => {
  assert.deepEqual(
    headToHead(matches, 310, 104).map((m) => [m.id, m.leftScore, m.rightScore]),
    [
      [2, 2, 3],
      [1, 2, 0],
    ],
  );
  assert.deepEqual(headToHead(matches, 310, 105), []);
  assert.deepEqual(headToHead(matches, 104, 104), []);
  assert.equal(opponentCounts(matches, 104).get(310), 2);
  assert.deepEqual(teamRecord(matches, 104), {
    series: 3,
    wins: 2,
    mapsWon: 5,
    mapsLost: 5,
  });
});
test("player and team bookmarks with the same numeric ID remain independent", () => {
  assert.deepEqual(
    readSaved('{"favorites":[101],"teamFavorites":[101,101,"x"]}'),
    { favorites: [101], teamFavorites: [101], comments: [] },
  );
});
