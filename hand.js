(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TeenPatti = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SUITS = [
    { id: "S", symbol: "♠", name: "Spades" },
    { id: "H", symbol: "♥", name: "Hearts" },
    { id: "D", symbol: "♦", name: "Diamonds" },
    { id: "C", symbol: "♣", name: "Clubs" }
  ];

  var RANK_LABELS = {
    2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
    10: "10", 11: "J", 12: "Q", 13: "K", 14: "A"
  };

  var CATEGORY = {
    HIGH_CARD: 1,
    PAIR: 2,
    TENS: 3,
    STRAIGHT: 4,
    TRIO: 5
  };

  var CATEGORY_NAMES = {
    1: "High card",
    2: "Pair",
    3: "Three tens",
    4: "Straight run",
    5: "Three of a kind"
  };

  var RULES_LADDER = [
    "Three of a kind (A-A-A is the strongest trio, three tens is the weakest)",
    "Straight run (A-K-Q, K-Q-A, A-2-3, 2-3-4 and every other run)",
    "Three tens, also called Teen",
    "Pair",
    "High card"
  ];

  function rankLabel(rank) {
    return RANK_LABELS[rank] || String(rank);
  }

  function suitById(id) {
    for (var i = 0; i < SUITS.length; i++) {
      if (SUITS[i].id === id) return SUITS[i];
    }
    return SUITS[0];
  }

  function cardLabel(card) {
    return rankLabel(card.rank) + suitById(card.suit).symbol;
  }

  function cardKey(card) {
    return card.rank + "-" + card.suit;
  }

  function cardsLabel(cards) {
    return cards.map(cardLabel).join(" ");
  }

  function makeDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 2; r <= 14; r++) {
        deck.push({ rank: r, suit: SUITS[s].id });
      }
    }
    return deck;
  }

  function rankName(rank) {
    if (rank === 14) return "Aces";
    if (rank === 13) return "Kings";
    if (rank === 12) return "Queens";
    if (rank === 11) return "Jacks";
    if (rank === 10) return "tens";
    return rank + "s";
  }

  function evaluate(cards) {
    var ranks = cards.map(function (c) { return c.rank; }).sort(function (a, b) { return b - a; });
    var high = ranks[0];
    var mid = ranks[1];
    var low = ranks[2];

    var category;
    var key1 = 0;
    var key2 = 0;
    var key3 = 0;
    var name = "";
    var detail = "";
    var phrase = "";

    if (high === low) {
      if (high === 10) {
        category = CATEGORY.TENS;
        key1 = 10;
        name = "Three tens (Teen)";
        detail = "10 10 10";
        phrase = "three tens";
      } else {
        category = CATEGORY.TRIO;
        key1 = high;
        name = "Three of a kind";
        detail = rankName(high);
        phrase = "trio of " + rankName(high);
      }
    } else if (mid === low + 1 && high === mid + 1) {
      category = CATEGORY.STRAIGHT;
      key1 = high;
      name = "Straight run";
      detail = cardsLabel(cards.slice().sort(function (a, b) { return b.rank - a.rank; }));
      phrase = "straight run of " + detail;
    } else if (high === 14 && mid === 3 && low === 2) {
      category = CATEGORY.STRAIGHT;
      key1 = 3;
      name = "Straight run";
      detail = "A 2 3";
      phrase = "straight run of A 2 3";
    } else if (high === mid || mid === low) {
      category = CATEGORY.PAIR;
      if (high === mid) {
        key1 = high;
        key2 = low;
      } else {
        key1 = low;
        key2 = high;
      }
      name = "Pair";
      detail = rankName(key1) + " with " + rankLabel(key2) + " kicker";
      phrase = "pair of " + detail;
    } else {
      category = CATEGORY.HIGH_CARD;
      key1 = high;
      key2 = mid;
      key3 = low;
      name = "High card";
      detail = rankLabel(high) + " " + rankLabel(mid) + " " + rankLabel(low) + " kickers";
      phrase = "high card " + rankLabel(high) + " " + rankLabel(mid);
    }

    var strength = [category, key1, key2, key3];

    return {
      cards: cards,
      ranks: ranks,
      category: category,
      categoryName: CATEGORY_NAMES[category],
      name: name,
      detail: detail,
      strength: strength,
      signature: strength.join(","),
      phrase: phrase
    };
  }

  function compareStrength(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] > b[i]) return 1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  function compareHands(handA, handB) {
    var a = evaluate(handA);
    var b = evaluate(handB);
    var cmp = compareStrength(a.strength, b.strength);
    return {
      result: cmp,
      winner: cmp > 0 ? "A" : cmp < 0 ? "B" : null,
      isTie: cmp === 0,
      a: a,
      b: b
    };
  }

  var CATEGORY_EXPLANATIONS = {
    1: "Ranks lowest, so it wins only when the other hand's cards are all lower.",
    2: "Beats every high card, loses to a sequence or a trio.",
    3: "Sits below a sequence but above every pair.",
    4: "Second strongest, only a trio of a kind beats it.",
    5: "Strongest hand in the game, nothing can beat it."
  };

  function duplicateLabels(cards) {
    var counts = {};
    var labels = [];
    cards.forEach(function (card) {
      var key = cardKey(card);
      counts[key] = (counts[key] || 0) + 1;
    });
    Object.keys(counts).forEach(function (key) {
      if (counts[key] > 1) {
        var parts = key.split("-");
        labels.push(rankLabel(Number(parts[0])) + suitById(parts[1]).symbol);
      }
    });
    return labels;
  }

  function explain(cards) {
    var ev = evaluate(cards);
    return {
      name: ev.name,
      detail: ev.detail,
      cards: cardsLabel(cards),
      category: ev.category,
      text: CATEGORY_EXPLANATIONS[ev.category],
      duplicates: duplicateLabels(cards)
    };
  }

  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    var result = 1;
    for (var i = 0; i < k; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
  }

  function rangeAgainst(myCards, tableCards) {
    var avail = {};
    var seen = {};
    var rank;
    var r1;
    var r2;
    var r3;

    for (rank = 2; rank <= 14; rank++) avail[rank] = 4;

    (tableCards || []).forEach(function (card) {
      var key = cardKey(card);
      if (seen[key]) return;
      seen[key] = true;
      avail[card.rank] -= 1;
    });

    var myStrength = evaluate(myCards).strength;
    var wins = 0;
    var losses = 0;
    var ties = 0;
    var total = 0;

    for (r1 = 2; r1 <= 14; r1++) {
      for (r2 = r1; r2 <= 14; r2++) {
        for (r3 = r2; r3 <= 14; r3++) {
          var ways;
          if (r1 === r3) {
            ways = choose(avail[r1], 3);
          } else if (r1 === r2) {
            ways = choose(avail[r1], 2) * avail[r3];
          } else if (r2 === r3) {
            ways = avail[r1] * choose(avail[r2], 2);
          } else {
            ways = avail[r1] * avail[r2] * avail[r3];
          }
          if (!ways) continue;

          var opponent = evaluate([
            { rank: r1, suit: "S" },
            { rank: r2, suit: "H" },
            { rank: r3, suit: "D" }
          ]).strength;
          var cmp = compareStrength(myStrength, opponent);
          total += ways;
          if (cmp > 0) wins += ways;
          else if (cmp < 0) losses += ways;
          else ties += ways;
        }
      }
    }

    return {
      wins: wins,
      losses: losses,
      ties: ties,
      total: total,
      pWin: total ? wins / total : 0,
      pLose: total ? losses / total : 0,
      pTie: total ? ties / total : 0
    };
  }

  function handStrength(cards) {
    if (cards.length !== 3) {
      return { valid: false, reason: "Pick 3 cards to see this hand's winning chance." };
    }
    var range = rangeAgainst(cards, cards);
    return {
      valid: true,
      wins: range.wins,
      losses: range.losses,
      ties: range.ties,
      total: range.total,
      pWin: range.pWin,
      pLose: range.pLose,
      pTie: range.pTie
    };
  }

  function probabilityFor(handA, handB) {
    var used = {};
    var seen = {};
    var hands = [handA, handB];
    var i;
    var j;
    var k;

    for (i = 0; i < hands.length; i++) {
      if (hands[i].length !== 3) {
        return { valid: false, reason: "Each player needs exactly 3 cards." };
      }
      for (j = 0; j < hands[i].length; j++) {
        var kk = cardKey(hands[i][j]);
        if (seen[kk]) {
          return { valid: false, reason: "Card " + cardLabel(hands[i][j]) + " is on the table twice, so no deck probability exists." };
        }
        seen[kk] = true;
        used[kk] = true;
      }
    }

    var range = rangeAgainst(handA, handA.concat(handB));

    return {
      valid: true,
      wins: range.wins,
      losses: range.losses,
      ties: range.ties,
      total: range.total,
      pA: range.pWin,
      pB: range.pLose,
      pTie: range.pTie
    };
  }

  return {
    SUITS: SUITS,
    CATEGORY: CATEGORY,
    RULES_LADDER: RULES_LADDER,
    rankLabel: rankLabel,
    suitById: suitById,
    cardLabel: cardLabel,
    cardKey: cardKey,
    cardsLabel: cardsLabel,
    makeDeck: makeDeck,
    evaluate: evaluate,
    compareStrength: compareStrength,
    compareHands: compareHands,
    rangeAgainst: rangeAgainst,
    handStrength: handStrength,
    explain: explain,
    duplicateLabels: duplicateLabels,
    probabilityFor: probabilityFor
  };
});
