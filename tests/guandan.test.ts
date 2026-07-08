import { describe, expect, it } from "vitest";
import {
  Card,
  canBeat,
  evaluatePlay,
  findPlayableCandidates,
  getRankPower,
} from "../shared/guandan";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit, deck: id.startsWith("1") ? 1 : 0 };
}

describe("guandan rules", () => {
  it("recognizes heart level cards as wild cards", () => {
    const combo = evaluatePlay(
      [
        card("0-5-spade", "5", "spade"),
        card("1-5-club", "5", "club"),
        card("0-2-heart", "2", "heart"),
      ],
      "2",
    );

    expect(combo?.type).toBe("trio");
    expect(combo?.rankLabel).toBe("5");
  });

  it("recognizes straight flush with a wild card", () => {
    const combo = evaluatePlay(
      [
        card("0-6-spade", "6", "spade"),
        card("0-7-spade", "7", "spade"),
        card("0-8-spade", "8", "spade"),
        card("0-9-spade", "9", "spade"),
        card("0-2-heart", "2", "heart"),
      ],
      "2",
    );

    expect(combo?.type).toBe("straightFlush");
  });

  it("allows bombs to beat normal combinations", () => {
    const pair = evaluatePlay([card("0-A-spade", "A", "spade"), card("1-A-club", "A", "club")], "2");
    const bomb = evaluatePlay(
      [
        card("0-3-spade", "3", "spade"),
        card("0-3-heart", "3", "heart"),
        card("0-3-club", "3", "club"),
        card("0-3-diamond", "3", "diamond"),
      ],
      "2",
    );

    expect(pair).not.toBeNull();
    expect(bomb).not.toBeNull();
    expect(canBeat(bomb!, pair!)).toBe(true);
  });

  it("keeps current level rank above normal ranks", () => {
    expect(getRankPower("5", "5")).toBeGreaterThan(getRankPower("2", "5"));
  });

  it("generates playable candidates against an existing pair", () => {
    const current = evaluatePlay([card("0-8-spade", "8", "spade"), card("1-8-club", "8", "club")], "2");
    const hand = [
      card("0-9-spade", "9", "spade"),
      card("1-9-club", "9", "club"),
      card("0-4-spade", "4", "spade"),
      card("0-4-heart", "4", "heart"),
      card("0-4-club", "4", "club"),
      card("0-4-diamond", "4", "diamond"),
    ];

    const candidates = findPlayableCandidates(hand, current, "2");
    expect(candidates.some((candidate) => candidate.combo.type === "pair" && candidate.combo.rankLabel === "9")).toBe(
      true,
    );
    expect(candidates.some((candidate) => candidate.combo.type === "bomb")).toBe(true);
  });
});
