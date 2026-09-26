(function () {
  "use strict";

  var TP = window.TeenPatti;

  var KEY_HANDS = "tp.hands.v3";
  var KEY_HISTORY = "tp.history.v3";
  var HISTORY_LIMIT = 30;
  var FACE_RANKS = [14, 13, 12, 11];
  var NUM_RANKS = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  var RED_SUITS = { H: true, D: true };
  var SUIT_CYCLE = ["S", "H", "D", "C"];
  var COLOR_CYCLE = ["p1", "p2", "p3", "p4"];

  var state = {
    players: [],
    history: read(KEY_HISTORY, []) || [],
    lastCommitted: "",
    lastStrengthSig: {},
    ready: false
  };

  var refs = {
    players: [],
    result: document.getElementById("result"),
    mount: document.getElementById("players"),
    clearBtn: null
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      return;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pct(value) {
    var p = value * 100;
    if (p >= 100) return "100%";
    if (p < 0.05) return "0%";
    if (p < 0.1) return "<0.1%";
    if (p > 99) return p.toFixed(2) + "%";
    return p.toFixed(1) + "%";
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function displayName(player, index) {
    return player.name || "Player " + (index + 1);
  }

  function buildPanel(player, index) {
    var color = COLOR_CYCLE[index % COLOR_CYCLE.length];
    var panel = el("section", "panel player " + color);
    panel.dataset.player = String(index);

    var head = el("div", "player-head");
    var name = el("input", "name-input");
    name.type = "text";
    name.value = player.name;
    name.maxLength = 18;
    name.placeholder = "Player " + (index + 1);
    name.setAttribute("aria-label", "Name of player " + (index + 1));
    name.addEventListener("input", function () {
      player.name = name.value;
      persistHands();
      renderResult();
      renderHistory();
    });

    var count = el("span", "count", "0/3");
    var reset = el("button", "reset-btn", "Reset");
    reset.type = "button";
    reset.setAttribute("aria-label", "Clear " + displayName(player, index) + "'s cards");
    reset.addEventListener("click", function () {
      player.cards = [];
      syncPanel(index);
      renderResult();
    });

    head.appendChild(name);
    head.appendChild(count);
    head.appendChild(reset);

    var slots = el("div", "slots");
    var slotNodes = [];
    for (var i = 0; i < 3; i++) {
      (function (slotIndex) {
        var slot = el("button", "slot empty");
        slot.type = "button";
        slot.addEventListener("click", function () {
          if (!player.cards[slotIndex]) return;
          player.cards.splice(slotIndex, 1);
          syncPanel(index);
          renderResult();
        });
        slots.appendChild(slot);
        slotNodes.push(slot);
      })(i);
    }

    var strength = el("div", "strength");
    var strengthTitle = el("span", "strength-title", "Hand strength");
    var strengthRow = el("div", "odd-row " + color);
    var strengthName = el("span", "odd-name", "Beats a random hand");
    var strengthPct = el("span", "odd-pct", "—");
    var strengthBar = el("span", "bar");
    var strengthFill = el("span");
    strengthBar.appendChild(strengthFill);
    strengthRow.appendChild(strengthName);
    strengthRow.appendChild(strengthPct);
    strengthRow.appendChild(strengthBar);
    var strengthReason = el("p", "strength-reason", "");
    var strengthNote = el("p", "strength-note", "Pick 3 cards to see this hand's winning chance.");
    var strengthWarn = el("p", "strength-warn", "");
    strength.appendChild(strengthTitle);
    strength.appendChild(strengthRow);
    strength.appendChild(strengthReason);
    strength.appendChild(strengthNote);
    strength.appendChild(strengthWarn);

    var picker = el("div", "picker");
    picker.appendChild(el("span", "picker-label", "Face cards"));

    var ranks = el("div", "ranks");
    var rankNodes = {};
    FACE_RANKS.forEach(function (rank) {
      var btn = el("button", "rank-btn", TP.rankLabel(rank));
      btn.type = "button";
      btn.dataset.rank = rank;
      btn.setAttribute("aria-label", "Add " + TP.rankLabel(rank) + " of the selected suit");
      btn.addEventListener("click", function () {
        addCard(index, rank);
      });
      ranks.appendChild(btn);
      rankNodes[rank] = btn;
    });
    picker.appendChild(ranks);

    var suitRow = el("div", "suit-row");
    suitRow.appendChild(el("span", "picker-label", "Suit"));
    var suitGroup = el("div", "suits");
    suitGroup.setAttribute("role", "group");
    suitGroup.setAttribute("aria-label", "Suit for player " + (index + 1));
    var suitNodes = {};
    TP.SUITS.forEach(function (suit) {
      var btn = el("button", "suit-btn" + (RED_SUITS[suit.id] ? " red" : ""), escapeHtml(suit.symbol));
      btn.type = "button";
      btn.dataset.suit = suit.id;
      btn.setAttribute("aria-label", suit.name);
      btn.addEventListener("click", function () {
        player.suit = suit.id;
        syncPanel(index);
      });
      suitGroup.appendChild(btn);
      suitNodes[suit.id] = btn;
    });
    suitRow.appendChild(suitGroup);
    picker.appendChild(suitRow);

    picker.appendChild(el("span", "picker-label", "Numbers"));
    var nums = el("div", "nums");
    var numNodes = [];
    NUM_RANKS.forEach(function (rank) {
      var btn = el("button", "num-btn", String(rank));
      btn.type = "button";
      btn.dataset.rank = rank;
      btn.setAttribute("aria-label", "Add " + rank + " of the selected suit");
      btn.addEventListener("click", function () {
        addCard(index, rank);
      });
      nums.appendChild(btn);
      numNodes.push(btn);
    });
    picker.appendChild(nums);

    panel.appendChild(head);
    panel.appendChild(slots);
    panel.appendChild(strength);
    panel.appendChild(picker);

    return {
      panel: panel,
      color: color,
      name: name,
      count: count,
      slots: slotNodes,
      picker: picker,
      rankNodes: rankNodes,
      numNodes: numNodes,
      suitNodes: suitNodes,
      strengthRow: strengthRow,
      strengthPct: strengthPct,
      strengthFill: strengthFill,
      strengthReason: strengthReason,
      strengthNote: strengthNote,
      strengthWarn: strengthWarn
    };
  }

  function addPlayer(scroll) {
    var index = state.players.length;
    var player = {
      key: COLOR_CYCLE[index % COLOR_CYCLE.length],
      name: "Player " + (index + 1),
      suit: SUIT_CYCLE[index % SUIT_CYCLE.length],
      cards: []
    };
    state.players.push(player);

    var ui = buildPanel(player, index);
    refs.players.push(ui);
    refs.mount.insertBefore(ui.panel, refs.clearBtn);
    syncPanel(index);
    renderResult();

    if (scroll && ui.panel.scrollIntoView) {
      ui.panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return ui;
  }

  function addCard(index, rank) {
    var player = state.players[index];
    if (player.cards.length >= 3) {
      flash(index);
      return;
    }
    player.cards.push({ rank: rank, suit: player.suit });
    syncPanel(index);
    renderResult();
  }

  function flash(index) {
    var ui = refs.players[index];
    if (!ui) return;
    ui.count.classList.add("bump");
    window.setTimeout(function () {
      ui.count.classList.remove("bump");
    }, 220);
  }

  function syncPanel(index) {
    var player = state.players[index];
    var ui = refs.players[index];
    var full = player.cards.length >= 3;

    ui.slots.forEach(function (slot, slotIndex) {
      var card = player.cards[slotIndex];
      if (!card) {
        slot.className = "slot empty";
        slot.innerHTML = '<span class="plus">+</span><span class="slot-hint">empty</span>';
        slot.setAttribute("aria-label", "Empty card slot " + (slotIndex + 1));
        return;
      }
      var red = RED_SUITS[card.suit] ? " red" : "";
      slot.className = "slot filled" + red;
      slot.innerHTML =
        '<span class="card-rank">' + TP.rankLabel(card.rank) + "</span>" +
        '<span class="card-suit">' + escapeHtml(TP.suitById(card.suit).symbol) + "</span>" +
        '<span class="card-tap">tap to remove</span>';
      slot.setAttribute("aria-label", TP.cardLabel(card) + ", tap to remove");
    });

    ui.count.textContent = player.cards.length + "/3";
    ui.count.className = "count" + (full ? " full" : "");
    ui.picker.className = "picker" + (full ? " locked" : "");
    Object.keys(ui.rankNodes).forEach(function (rank) {
      ui.rankNodes[rank].disabled = full;
    });
    ui.numNodes.forEach(function (btn) {
      btn.disabled = full;
    });
    Object.keys(ui.suitNodes).forEach(function (id) {
      var active = player.suit === id;
      ui.suitNodes[id].disabled = full;
      ui.suitNodes[id].className = "suit-btn" + (RED_SUITS[id] ? " red" : "") + (active ? " active" : "");
      ui.suitNodes[id].setAttribute("aria-pressed", active ? "true" : "false");
    });

    renderStrength(index);
    logStrength(index);
    persistHands();
  }

  function persistHands() {
    write(KEY_HANDS, state.players.map(function (player) {
      return { name: player.name, suit: player.suit, cards: player.cards };
    }));
  }

  function handSignature(player) {
    return player.cards.map(function (card) { return card.rank + card.suit; }).sort().join("|");
  }

  function renderStrength(index) {
    var player = state.players[index];
    var ui = refs.players[index];

    if (player.cards.length < 3) {
      ui.strengthRow.style.display = "none";
      ui.strengthPct.textContent = "—";
      ui.strengthFill.style.width = "0%";
      ui.strengthReason.textContent = "";
      ui.strengthWarn.textContent = "";
      ui.strengthNote.textContent = "Pick " + (3 - player.cards.length) +
        " more card" + (player.cards.length === 2 ? "" : "s") + " to see this hand's winning chance.";
      return;
    }

    var strength = TP.handStrength(player.cards);
    var why = TP.explain(player.cards);
    ui.strengthRow.style.display = "";
    ui.strengthPct.textContent = pct(strength.pWin);
    ui.strengthFill.style.width = (strength.pWin * 100).toFixed(2) + "%";
    ui.strengthReason.textContent = why.name + " · " + why.detail + " — " + why.text;
    ui.strengthNote.textContent = "of the " + strength.total.toLocaleString("en-US") +
      " hands an opponent could be dealt, plus a " + pct(strength.pTie) + " tie chance.";
    ui.strengthWarn.textContent = why.duplicates.length
      ? "You picked " + why.duplicates.join(" and ") +
        " more than once, so this counts from a smaller deck."
      : "";
  }

  function logStrength(index) {
    if (!state.ready) return;
    var player = state.players[index];
    if (player.cards.length !== 3) {
      delete state.lastStrengthSig[index];
      return;
    }

    var sig = handSignature(player);
    if (state.lastStrengthSig[index] === sig) return;

    var newest = state.history[0];
    if (newest && newest.type === "hand" && newest.sig === sig) {
      state.lastStrengthSig[index] = sig;
      return;
    }

    state.lastStrengthSig[index] = sig;
    state.history.unshift({
      type: "hand",
      ts: Date.now(),
      name: displayName(player, index),
      sig: sig,
      cards: TP.cardsLabel(player.cards),
      hand: TP.explain(player.cards).name,
      pWin: TP.handStrength(player.cards).pWin
    });
    trimHistory();
  }

  function trimHistory() {
    state.history = state.history.slice(0, HISTORY_LIMIT);
    write(KEY_HISTORY, state.history);
    renderHistory();
  }

  function ranking() {
    var ready = [];
    var waiting = [];
    state.players.forEach(function (player, index) {
      if (player.cards.length === 3) ready.push({ player: player, index: index });
      else waiting.push({ player: player, index: index });
    });

    ready.sort(function (a, b) {
      return TP.compareStrength(TP.evaluate(b.player.cards).strength, TP.evaluate(a.player.cards).strength);
    });

    var rows = [];
    var previous = null;
    var place = 0;
    ready.forEach(function (item, position) {
      var sig = TP.evaluate(item.player.cards).signature;
      if (sig !== previous) {
        place = position + 1;
        previous = sig;
      }
      rows.push({
        player: item.player,
        index: item.index,
        place: place,
        why: TP.explain(item.player.cards),
        strength: TP.handStrength(item.player.cards)
      });
    });

    return { rows: rows, waiting: waiting };
  }

  function renderResult() {
    var board = ranking();
    var rows = board.rows;
    var compareBtn = document.getElementById("compareBtn");
    compareBtn.className = "primary-btn" + (rows.length >= 2 ? "" : " needs");

    if (rows.length === 0) {
      var needs = board.waiting.map(function (item) {
        var left = 3 - item.player.cards.length;
        return "<strong>" + escapeHtml(displayName(item.player, item.index)) + "</strong> needs <strong>" +
          left + "</strong> more card" + (left === 1 ? "" : "s");
      }).join(", ");
      refs.result.innerHTML =
        '<h2 class="section-title">Result</h2>' +
        '<p class="empty-state">Still picking. ' + (needs || "Add a player to get started.") + ".</p>";
      return;
    }

    if (rows.length === 1) {
      var only = rows[0];
      refs.result.innerHTML =
        '<h2 class="section-title">Result</h2>' +
        '<p class="empty-state"><strong>' + escapeHtml(displayName(only.player, only.index)) +
        "</strong> is ready with <strong>" + TP.cardsLabel(only.player.cards) + "</strong> (" +
        escapeHtml(only.why.name) + "). Add another player to compare.</p>";
      return;
    }

    var top = rows[0];
    var second = rows[1];
    var tiedAtTop = rows.filter(function (row) { return row.place === 1; }).length > 1;
    var nameA = escapeHtml(displayName(top.player, top.index));
    var nameB = escapeHtml(displayName(second.player, second.index));
    var cmp = TP.compareHands(top.player.cards, second.player.cards);
    var prob = TP.probabilityFor(top.player.cards, second.player.cards);

    var winnerName = tiedAtTop ? "It's a tie" : nameA + " wins";
    var tag = tiedAtTop ? "split pot" : "winner";
    var reason;
    if (tiedAtTop) {
      reason = "Both top hands are a <b>" + escapeHtml(top.why.name.toLowerCase()) +
        "</b> on the same rank" + (top.why.category === TP.CATEGORY.PAIR || top.why.category === TP.CATEGORY.HIGH_CARD ? "s" : "") +
        ", and suits do not break a tie in Teen Patti.";
    } else {
      reason = "<b>" + escapeHtml(top.why.text) + "</b>";
    }

    var html =
      '<h2 class="section-title">Result</h2>' +
      '<div class="verdict ' + (tiedAtTop ? "tie" : top.color) + '">' + winnerName +
      '<span class="tag">' + tag + "</span></div>" +
      '<p class="reason">' + reason + "</p>" +
      '<ol class="rank">' +
      rows.map(function (row) {
        var cls = row.place === 1 ? " first" : "";
        return '<li class="' + cls.slice(1) + '">' +
          '<span class="rank-no">' + row.place + "</span>" +
          '<span class="rank-who">' + escapeHtml(displayName(row.player, row.index)) + "</span>" +
          '<span class="rank-cards">' + TP.cardsLabel(row.player.cards) + "</span>" +
          '<span class="rank-hand">' + escapeHtml(row.why.name) + "</span>" +
          '<span class="rank-pct">' + pct(row.strength.pWin) + "</span>" +
          "</li>";
      }).join("") +
      "</ol>";

    if (board.waiting.length) {
      html += '<p class="odds-note">Waiting on ' + board.waiting.map(function (item) {
        return escapeHtml(displayName(item.player, item.index)) + " (" +
          (3 - item.player.cards.length) + " more)";
      }).join(", ") + ".</p>";
    }

    html += '<div class="odds">' +
      '<p class="odds-title">' + nameA + " vs " + nameB + " &mdash; head to head</p>" +
      oddRow(top.color, nameA + " win chance", pct(prob.valid ? prob.pA : 0)) +
      oddRow(second.color, nameB + " win chance", pct(prob.valid ? prob.pB : 0)) +
      oddRow("tie", "Tie chance", pct(prob.valid ? prob.pTie : 0)) +
      "</div>";

    html += prob.valid
      ? '<p class="odds-note">Exact over all <b>' + prob.total.toLocaleString("en-US") +
        "</b> hands " + nameB + " could be dealt from the remaining 46 cards.</p>"
      : '<p class="odds-note">Head-to-head odds need 6 different cards on the table — ' +
        escapeHtml(prob.reason) + "</p>";

    refs.result.innerHTML = html;

    if (prob.valid) {
      var bars = refs.result.querySelectorAll(".bar span");
      var values = [prob.pA, prob.pB, prob.pTie];
      for (var i = 0; i < bars.length; i++) {
        bars[i].style.width = (values[i] * 100).toFixed(2) + "%";
      }
    }
  }

  function oddRow(kind, label, value) {
    return '<div class="odd-row ' + kind + '">' +
      '<span class="odd-name">' + label + "</span>" +
      '<span class="odd-pct">' + value + "</span>" +
      '<span class="bar"><span></span></span>' +
      "</div>";
  }

  function commitResult() {
    var board = ranking();
    if (board.rows.length < 2) {
      if (board.waiting.length) flash(board.waiting[0].index);
      renderResult();
      return;
    }

    var top = board.rows[0];
    var second = board.rows[1];
    var signature = state.players.map(handSignature).join("::");
    if (signature === state.lastCommitted) return;
    state.lastCommitted = signature;

    var cmp = TP.compareHands(top.player.cards, second.player.cards);
    var tiedAtTop = board.rows.filter(function (row) { return row.place === 1; }).length > 1;
    var prob = TP.probabilityFor(top.player.cards, second.player.cards);

    state.history.unshift({
      type: "match",
      ts: Date.now(),
      a: displayName(top.player, top.index),
      b: displayName(second.player, second.index),
      cardsA: TP.cardsLabel(top.player.cards),
      cardsB: TP.cardsLabel(second.player.cards),
      handA: top.why.name,
      handB: second.why.name,
      winner: tiedAtTop ? "tie" : "A",
      pA: prob.valid ? prob.pA : null,
      pB: prob.valid ? prob.pB : null
    });
    trimHistory();

    refs.result.classList.remove("flash");
    void refs.result.offsetWidth;
    refs.result.classList.add("flash");
    if (refs.result.scrollIntoView) {
      refs.result.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    void cmp;
  }

  function renderHistory() {
    var list = document.getElementById("history");
    if (!state.history.length) {
      list.innerHTML = '<li class="none">Nothing yet. Pick 3 cards to start a record.</li>';
      return;
    }

    list.innerHTML = state.history.map(function (item) {
      if (item.type === "hand") {
        return "<li>" +
          '<span class="who"><span class="kind strength">strength</span> ' +
          escapeHtml(item.name) + ' <span class="meta">' + escapeHtml(item.cards) + "</span></span>" +
          '<span class="meta">' + escapeHtml(item.hand) + " · " + pct(item.pWin) + "</span>" +
          "</li>";
      }
      var outcome = item.winner === "tie"
        ? "Tie"
        : escapeHtml(item.winner === "A" ? item.a : item.b) + " won";
      var odds = item.pA === null ? "" : " · " + pct(item.pA) + " / " + pct(item.pB);
      return "<li>" +
        '<span class="who"><span class="kind match">match</span> ' + outcome +
        '<span class="meta"> · ' + escapeHtml(item.winner === "A" ? item.cardsA : item.cardsB) + "</span></span>" +
        '<span class="meta">' + escapeHtml(item.handA) + odds + "</span>" +
        "</li>";
    }).join("");
  }

  function clearAll() {
    state.players.forEach(function (player) {
      player.cards = [];
    });
    state.lastCommitted = "";
    state.lastStrengthSig = {};
    refs.players.forEach(function (_, index) {
      syncPanel(index);
    });
    renderResult();
  }

  function scrollTo(target) {
    if (!window.scrollTo) return;
    try {
      window.scrollTo(target);
    } catch (e) {
      return;
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function scrollPastHeader() {
    var header = document.querySelector(".topbar");
    if (!header) return;
    var offset = Math.round(header.getBoundingClientRect().height) + 4;
    window.setTimeout(function () {
      if (prefersReducedMotion()) {
        scrollTo(0, offset);
      } else {
        scrollTo({ top: offset, behavior: "smooth" });
      }
    }, 260);
  }

  function init() {
    refs.clearBtn = el("button", "ghost-btn clear-all", "Clear all hands");
    refs.clearBtn.type = "button";
    refs.clearBtn.addEventListener("click", clearAll);
    refs.mount.appendChild(refs.clearBtn);

    var saved = read(KEY_HANDS, null);
    var loaded = 0;
    if (Array.isArray(saved)) {
      saved.forEach(function (data) {
        if (loaded >= 8) return;
        var index = loaded;
        var ui = addPlayer(false);
        var player = state.players[index];
        if (data && typeof data.name === "string" && data.name) {
          player.name = data.name;
          ui.name.value = data.name;
        }
        if (data && typeof data.suit === "string" && TP.suitById(data.suit)) {
          player.suit = data.suit;
        }
        if (data && Array.isArray(data.cards)) {
          player.cards = data.cards.filter(function (card) {
            return card && card.rank >= 2 && card.rank <= 14 &&
              TP.SUITS.some(function (suit) { return suit.id === card.suit; });
          }).slice(0, 3);
        }
        loaded++;
        syncPanel(index);
      });
    }
    if (!loaded) addPlayer(false);

    var rulesList = document.getElementById("rulesList");
    rulesList.innerHTML = TP.RULES_LADDER.map(function (rule) {
      return "<li>" + escapeHtml(rule) + "</li>";
    }).join("");

    var addBtn = document.getElementById("addPlayerBtn");
    addBtn.addEventListener("click", function () {
      addPlayer(true);
    });

    document.getElementById("compareBtn").addEventListener("click", commitResult);

    document.getElementById("clearHistory").addEventListener("click", function () {
      state.history = [];
      state.lastCommitted = "";
      state.lastStrengthSig = {};
      write(KEY_HISTORY, state.history);
      renderHistory();
    });

    state.ready = true;
    renderHistory();
    renderResult();
    scrollPastHeader();
  }

  init();
})();
