const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const suits = [
  { key: "spade", label: "♠", color: "black" },
  { key: "heart", label: "♥", color: "red" },
  { key: "club", label: "♣", color: "black" },
  { key: "diamond", label: "♦", color: "red" },
];
const groupNames = {
  bomb: "炸弹",
  straightFlush: "同花顺",
  trioPair: "三带二",
  straight: "顺子",
  pairs: "连对",
  control: "控牌",
  loose: "散牌",
};

let hand = [];
let groups = [];
let selected = new Set();
let startedAt = Date.now();
let timerId = null;

const handEl = document.querySelector("#hand");
const groupsEl = document.querySelector("#groups");
const scoreValueEl = document.querySelector("#scoreValue");
const handCountEl = document.querySelector("#handCount");
const groupCountEl = document.querySelector("#groupCount");
const timerValueEl = document.querySelector("#timerValue");
const feedbackEl = document.querySelector("#feedback");
const referenceEl = document.querySelector("#reference");

function buildDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy += 1) {
    for (const rank of ranks) {
      for (const suit of suits) {
        deck.push({
          id: `${rank}-${suit.key}-${copy}`,
          rank,
          value: ranks.indexOf(rank),
          suit: suit.key,
          suitLabel: suit.label,
          color: suit.color,
          joker: false,
        });
      }
    }
    deck.push({
      id: `SJ-${copy}`,
      rank: "小王",
      value: 13,
      suit: "joker",
      suitLabel: "J",
      color: "black",
      joker: true,
    });
    deck.push({
      id: `BJ-${copy}`,
      rank: "大王",
      value: 14,
      suit: "joker",
      suitLabel: "J",
      color: "red",
      joker: true,
    });
  }
  return deck;
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cardSort(a, b) {
  if (a.value !== b.value) return a.value - b.value;
  return a.suit.localeCompare(b.suit);
}

function sortBySuit(a, b) {
  const suitOrder = { spade: 0, heart: 1, club: 2, diamond: 3, joker: 4 };
  if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
  return a.value - b.value;
}

function deal() {
  hand = shuffle(buildDeck()).slice(0, 27).sort(cardSort);
  groups = [];
  selected.clear();
  scoreValueEl.textContent = "--";
  feedbackEl.textContent = "点击牌面选中，再用右侧按钮组成牌型。先按点数排，再抓炸弹，最后扫同花顺。";
  referenceEl.textContent = "提交后显示。";
  startedAt = Date.now();
  render();
  startTimer();
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    timerValueEl.textContent = `${Math.floor((Date.now() - startedAt) / 1000)}s`;
  }, 250);
}

function render() {
  handEl.innerHTML = "";
  for (const card of hand) {
    const el = document.createElement("button");
    el.className = `playing-card ${card.color} ${card.joker ? "joker" : ""} ${selected.has(card.id) ? "selected" : ""}`;
    el.type = "button";
    el.setAttribute("aria-pressed", selected.has(card.id) ? "true" : "false");
    el.innerHTML = `
      <span class="corner">${card.rank}</span>
      <span><span class="rank">${card.rank}</span><br><span class="suit">${card.suitLabel}</span></span>
      <span class="corner bottom">${card.rank}</span>
    `;
    el.addEventListener("click", () => toggleCard(card.id));
    handEl.appendChild(el);
  }

  groupsEl.innerHTML = "";
  groups.forEach((group, index) => {
    const el = document.createElement("div");
    el.className = "group";
    el.innerHTML = `
      <div class="group-head">
        <span class="group-name">${index + 1}. ${groupNames[group.type]}</span>
        <button type="button" data-restore="${index}">还原</button>
      </div>
      <div class="mini-cards">${group.cards
        .slice()
        .sort(cardSort)
        .map((card) => `<span class="mini-card ${card.color}">${card.rank}${card.suitLabel}</span>`)
        .join("")}</div>
    `;
    groupsEl.appendChild(el);
  });
  groupsEl.querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", () => restoreGroup(Number(button.dataset.restore)));
  });

  handCountEl.textContent = `${hand.length} 张`;
  groupCountEl.textContent = `${groups.length} 组`;
}

function toggleCard(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  render();
}

function makeGroup(type) {
  const cards = hand.filter((card) => selected.has(card.id));
  if (!cards.length) return;
  groups.push({ type, cards: cards.sort(cardSort) });
  hand = hand.filter((card) => !selected.has(card.id));
  selected.clear();
  render();
}

function restoreGroup(index) {
  const [group] = groups.splice(index, 1);
  if (group) hand = [...hand, ...group.cards].sort(cardSort);
  render();
}

function undo() {
  if (!groups.length) return;
  restoreGroup(groups.length - 1);
}

function countBy(cards, key) {
  return cards.reduce((map, card) => {
    const value = card[key];
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());
}

function isBomb(cards) {
  if (cards.length < 4) return false;
  const jokers = cards.filter((card) => card.joker);
  if (cards.length === 4 && jokers.length === 4) return true;
  return cards.every((card) => !card.joker && card.rank === cards[0].rank);
}

function isStraight(cards) {
  if (cards.length < 5 || cards.some((card) => card.joker || card.rank === "2")) return false;
  const unique = [...new Set(cards.map((card) => card.value))].sort((a, b) => a - b);
  if (unique.length !== cards.length) return false;
  return unique.every((value, index) => index === 0 || value === unique[index - 1] + 1);
}

function isStraightFlush(cards) {
  if (!isStraight(cards)) return false;
  return cards.every((card) => card.suit === cards[0].suit);
}

function isTrioPair(cards) {
  if (cards.length !== 5) return false;
  const counts = [...countBy(cards, "rank").values()].sort((a, b) => a - b);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function isPairRun(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
  if (cards.some((card) => card.joker || card.rank === "2")) return false;
  const rankCounts = countBy(cards, "rank");
  if ([...rankCounts.values()].some((count) => count !== 2)) return false;
  const values = [...new Set(cards.map((card) => card.value))].sort((a, b) => a - b);
  return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

function isControl(cards) {
  return cards.length <= 4 && cards.every((card) => card.value >= ranks.indexOf("A") || card.joker);
}

function validateGroup(group) {
  const validators = {
    bomb: isBomb,
    straightFlush: isStraightFlush,
    trioPair: isTrioPair,
    straight: isStraight,
    pairs: isPairRun,
    control: isControl,
    loose: () => true,
  };
  return validators[group.type](group.cards);
}

function originalCards() {
  return [...hand, ...groups.flatMap((group) => group.cards)];
}

function findBombRanks(cards) {
  const rankCounts = countBy(cards.filter((card) => !card.joker), "rank");
  const bombs = [...rankCounts.entries()].filter(([, count]) => count >= 4).map(([rank]) => rank);
  const jokerCount = cards.filter((card) => card.joker).length;
  if (jokerCount === 4) bombs.push("四王");
  return bombs;
}

function findStraightFlushes(cards) {
  const found = [];
  for (const suit of suits) {
    const byValue = new Map();
    cards
      .filter((card) => card.suit === suit.key && card.rank !== "2")
      .forEach((card) => {
        if (!byValue.has(card.value)) byValue.set(card.value, card);
      });
    const values = [...byValue.keys()].sort((a, b) => a - b);
    for (let i = 0; i <= values.length - 5; i += 1) {
      const run = values.slice(i, i + 5);
      if (run.every((value, index) => index === 0 || value === run[index - 1] + 1)) {
        found.push(run.map((value) => byValue.get(value)));
      }
    }
  }
  return found;
}

function findSimpleSets(cards) {
  const remaining = [...cards].sort(cardSort);
  const picked = [];
  const take = (predicate) => {
    const cardsToTake = remaining.filter(predicate);
    for (const card of cardsToTake) {
      const index = remaining.findIndex((item) => item.id === card.id);
      if (index >= 0) remaining.splice(index, 1);
    }
    return cardsToTake;
  };

  for (const rank of findBombRanks(remaining)) {
    if (rank === "四王") picked.push({ type: "bomb", cards: take((card) => card.joker) });
    else picked.push({ type: "bomb", cards: take((card) => card.rank === rank).slice(0, 8) });
  }

  for (;;) {
    const tripRank = [...countBy(remaining, "rank").entries()].find(([, count]) => count >= 3)?.[0];
    const pairRank = [...countBy(remaining, "rank").entries()].find(([rank, count]) => count >= 2 && rank !== tripRank)?.[0];
    if (!tripRank || !pairRank) break;
    const trio = take((card) => card.rank === tripRank).slice(0, 3);
    const pair = take((card) => card.rank === pairRank).slice(0, 2);
    picked.push({ type: "trioPair", cards: [...trio, ...pair] });
  }

  return { picked, remaining };
}

function score() {
  clearInterval(timerId);
  const allCards = originalCards();
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const validGroups = groups.filter(validateGroup);
  const invalidGroups = groups.filter((group) => !validateGroup(group));
  const bombs = findBombRanks(allCards);
  const straightFlushes = findStraightFlushes(allCards);
  const userBombs = groups.filter((group) => group.type === "bomb" && isBomb(group.cards)).length;
  const userStraightFlushes = groups.filter((group) => group.type === "straightFlush" && isStraightFlush(group.cards)).length;
  const groupedCards = groups.reduce((sum, group) => sum + group.cards.length, 0);
  const looseCards = groups
    .filter((group) => group.type === "loose")
    .reduce((sum, group) => sum + group.cards.length, 0);

  let value = 30;
  value += validGroups.length * 8;
  value += userBombs * 15;
  value += userStraightFlushes * 14;
  value += groups.filter((group) => group.type === "trioPair" && isTrioPair(group.cards)).length * 8;
  value += groups.filter((group) => group.type === "straight" && isStraight(group.cards)).length * 6;
  value += groups.filter((group) => group.type === "pairs" && isPairRun(group.cards)).length * 6;
  value += Math.min(16, groupedCards);
  value -= invalidGroups.length * 12;
  value -= looseCards > 5 ? (looseCards - 5) * 2 : 0;
  value -= hand.length * 2;
  if (elapsed <= 20) value += 10;
  else if (elapsed <= 35) value += 5;
  if (bombs.length && userBombs === 0) value -= 18;
  if (straightFlushes.length && userStraightFlushes === 0) value -= 10;
  value = Math.max(0, Math.min(100, Math.round(value)));
  scoreValueEl.textContent = value;

  const tags = [];
  tags.push(`<span class="tag ${elapsed <= 20 ? "good" : elapsed <= 35 ? "warn" : "bad"}">用时 ${elapsed}s</span>`);
  tags.push(`<span class="tag ${invalidGroups.length ? "bad" : "good"}">有效牌组 ${validGroups.length}/${groups.length}</span>`);
  tags.push(`<span class="tag ${userBombs >= bombs.length ? "good" : "warn"}">炸弹 ${userBombs}/${bombs.length}</span>`);
  tags.push(`<span class="tag ${userStraightFlushes >= straightFlushes.length ? "good" : "warn"}">同花顺 ${userStraightFlushes}/${straightFlushes.length}</span>`);

  const notes = [];
  if (invalidGroups.length) notes.push(`有 ${invalidGroups.length} 组牌型不成立，先按点数确认张数和连续性。`);
  if (bombs.length && userBombs < bombs.length) notes.push("这手牌里有炸弹没单独保出来，实战里容易把控场牌拆散。");
  if (straightFlushes.length && userStraightFlushes < straightFlushes.length) notes.push("存在同花顺机会，炸弹和三带二理完后要按花色扫一眼。");
  if (hand.length) notes.push(`还有 ${hand.length} 张没归类，最后至少放进控牌或散牌区，眼睛会更轻松。`);
  if (!notes.length) notes.push("这手理得稳：关键牌保住了，主要组合也能一眼看见。");
  feedbackEl.innerHTML = `${tags.join(" ")}<br>${notes.map((note) => `<strong>提示：</strong>${note}`).join("<br>")}`;

  renderReference(allCards);
}

function renderReference(cards) {
  const { picked, remaining } = findSimpleSets(cards);
  const straightFlushes = findStraightFlushes(remaining);
  for (const sf of straightFlushes.slice(0, 2)) {
    picked.push({ type: "straightFlush", cards: sf });
    for (const card of sf) {
      const index = remaining.findIndex((item) => item.id === card.id);
      if (index >= 0) remaining.splice(index, 1);
    }
  }
  const control = remaining.filter((card) => card.value >= ranks.indexOf("A") || card.joker);
  const loose = remaining.filter((card) => !control.some((item) => item.id === card.id));
  if (control.length) picked.push({ type: "control", cards: control });
  if (loose.length) picked.push({ type: "loose", cards: loose });

  referenceEl.innerHTML = picked
    .map(
      (group) =>
        `<div><strong>${groupNames[group.type]}：</strong>${group.cards
          .slice()
          .sort(cardSort)
          .map((card) => `${card.rank}${card.suitLabel}`)
          .join(" ")}</div>`,
    )
    .join("");
}

document.querySelector("#newDealBtn").addEventListener("click", deal);
document.querySelector("#sortRankBtn").addEventListener("click", () => {
  hand.sort(cardSort);
  render();
});
document.querySelector("#sortSuitBtn").addEventListener("click", () => {
  hand.sort(sortBySuit);
  render();
});
document.querySelector("#undoBtn").addEventListener("click", undo);
document.querySelector("#scoreBtn").addEventListener("click", score);
document.querySelectorAll("[data-type]").forEach((button) => {
  button.addEventListener("click", () => makeGroup(button.dataset.type));
});

deal();
