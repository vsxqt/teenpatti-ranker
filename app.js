(function () {
  "use strict";

  var TP = window.TeenPatti;

  var KEY_HANDS = "tp.hands.v2";
  var KEY_HISTORY = "tp.history.v2";
  var KEY_SOUND = "tp.sound.v2";
  var HISTORY_LIMIT = 20;
  var FACE_RANKS = [14, 13, 12, 11];
  var NUM_RANKS = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  var RED_SUITS = { H: true, D: true };

  var state = {
    players: [
      { key: "p1", name: "Player 1", suit: "S", cards: [] },
      { key: "p2", name: "Player 2", suit: "H", cards: [] }
    ],
    sound: read(KEY_SOUND, true) === true,
    history: read(KEY_HISTORY, []) || [],
    lastCommitted: ""
  };

  var refs = { players: [], result: document.getElementById("result") };

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

  function buildPanel(player, index) {
    var panel = el("section", "panel player");
    panel.dataset.player = player.key;

    var head = el("div", "player-head");
    var name = el("input", "name-input");
    name.type = "text";
    name.value = player.name;
    name.maxLength = 18;
    name.setAttribute("aria-label", "Name of player " + (index + 1));
    name.addEventListener("input", function () {
      player.name = name.value;
      persistHands();
      renderResult();
    });

    var count = el("span", "count", "0/3");
    var reset = el("button", "ghost-btn", "Reset");
    reset.type = "button";
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
    var strengthRow = el("div", "odd-row " + player.key);
    var strengthName = el("span", "odd-name", "Beats a random hand");
    var strengthPct = el("span", "odd-pct", "—");
    var strengthBar = el("span", "bar");
    var strengthFill = el("span");
    strengthBar.appendChild(strengthFill);
    strengthRow.appendChild(strengthName);
    strengthRow.appendChild(strengthPct);
    strengthRow.appendChild(strengthBar);
    var strengthNote = el("p", "strength-note", "Pick 3 cards to see this hand's winning chance.");
    strength.appendChild(strengthTitle);
    strength.appendChild(strengthRow);
    strength.appendChild(strengthNote);

    var picker = el("div", "picker");
    picker.appendChild(el("span", "picker-label", "Face cards"));

    var ranks = el("div", "ranks");
    var rankNodes = {};
    FACE_RANKS.forEach(function (rank) {
      var btn = el("button", "rank-btn", TP.rankLabel(rank));
      btn.type = "button";
      btn.dataset.rank = rank;
      btn.setAttribute("aria-label", "Add " + TP.rankLabel(rank) + " of selected suit");
      btn.addEventListener("click", function () {
        addCard(index, rank);
      });
      ranks.appendChild(btn);
      rankNodes[rank] = btn;
    });
    picker.appendChild(ranks);

    var suitRow = el("div", "suit-row");
    suitRow.appendChild(el("span", "picker-label", "Suit"));
    var suitSelect = el("select", "suit-select");
    TP.SUITS.forEach(function (suit) {
      var opt = el("option", null, escapeHtml(suit.symbol + " " + suit.name));
      opt.value = suit.id;
      suitSelect.appendChild(opt);
    });
    suitSelect.value = player.suit;
    suitSelect.setAttribute("aria-label", "Suit for player " + (index + 1));
    suitSelect.addEventListener("change", function () {
      player.suit = suitSelect.value;
      persistHands();
      syncPanel(index);
    });
    suitRow.appendChild(suitSelect);
    picker.appendChild(suitRow);

    picker.appendChild(el("span", "picker-label", "Numbers"));
    var nums = el("div", "nums");
    var numNodes = [];
    NUM_RANKS.forEach(function (rank) {
      var btn = el("button", "num-btn", String(rank));
      btn.type = "button";
      btn.dataset.rank = rank;
      btn.setAttribute("aria-label", "Add " + rank + " of selected suit");
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
      name: name,
      count: count,
      slots: slotNodes,
      picker: picker,
      rankNodes: rankNodes,
      numNodes: numNodes,
      suitSelect: suitSelect,
      strength: strength,
      strengthRow: strengthRow,
      strengthPct: strengthPct,
      strengthFill: strengthFill,
      strengthNote: strengthNote
    };
  }

  function renderStrength(index) {
    var player = state.players[index];
    var ui = refs.players[index];

    if (player.cards.length < 3) {
      ui.strengthRow.style.display = "none";
      ui.strengthPct.textContent = "—";
      ui.strengthFill.style.width = "0%";
      ui.strengthNote.textContent = "Pick " + (3 - player.cards.length) +
        " more card" + (player.cards.length === 2 ? "" : "s") + " to see this hand's winning chance.";
      return;
    }

    var strength = TP.handStrength(player.cards);
    ui.strengthRow.style.display = "";
    ui.strengthPct.textContent = pct(strength.pWin);
    ui.strengthFill.style.width = (strength.pWin * 100).toFixed(2) + "%";
    ui.strengthNote.textContent = "of the " + strength.total.toLocaleString("en-US") +
      " hands an opponent could be dealt, plus a " + pct(strength.pTie) + " tie chance.";
  }

  function addCard(index, rank) {
    var player = state.players[index];
    if (player.cards.length >= 3) {
      pulse(player);
      return;
    }
    player.cards.push({ rank: rank, suit: player.suit });
    syncPanel(index);
    renderResult();
    if (player.cards.length === 3) {
      var next = state.players[index === 0 ? 1 : 0];
      if (next.cards.length === 0 && refs.players[index === 0 ? 1 : 0].panel.scrollIntoView) {
        refs.players[index === 0 ? 1 : 0].panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function pulse(player) {
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function syncPanel(index) {
    var player = state.players[index];
    var ui = refs.players[index];
    var full = player.cards.length >= 3;

    ui.slots.forEach(function (slot, slotIndex) {
      var card = player.cards[slotIndex];
      slot.className = "slot" + (card ? " filled" : " empty");
      if (!card) {
        slot.innerHTML = '<span class="plus">+</span><span class="slot-hint">empty</span>';
        slot.setAttribute("aria-label", "Empty card slot " + (slotIndex + 1));
        return;
      }
      var red = RED_SUITS[card.suit] ? " red" : "";
      slot.innerHTML =
        '<span class="card-rank">' + TP.rankLabel(card.rank) + "</span>" +
        '<span class="card-suit">' + escapeHtml(TP.suitById(card.suit).symbol) + "</span>" +
        '<span class="card-tap">tap to remove</span>';
      slot.className = "slot filled" + red;
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
    ui.suitSelect.disabled = full;

    renderStrength(index);
    persistHands();
  }

  function persistHands() {
    write(KEY_HANDS, state.players.map(function (p) {
      return { name: p.name, suit: p.suit, cards: p.cards };
    }));
  }

  function handSignature(player) {
    return player.cards.map(function (c) { return c.rank + c.suit; }).sort().join("|");
  }

  function renderResult() {
    var a = state.players[0];
    var b = state.players[1];
    var ready = a.cards.length === 3 && b.cards.length === 3;
    var compareBtn = document.getElementById("compareBtn");
    compareBtn.className = "primary-btn" + (ready ? "" : " needs");

    if (!ready) {
      var needA = Math.max(0, 3 - a.cards.length);
      var needB = Math.max(0, 3 - b.cards.length);
      refs.result.innerHTML =
        '<h2 class="section-title">Result</h2>' +
        '<p class="empty-state">Still picking. <strong>' +
        (a.name || "Player 1") + "</strong> needs <strong>" + needA +
        "</strong> more card" + (needA === 1 ? "" : "s") + ", <strong>" +
        (b.name || "Player 2") + "</strong> needs <strong>" + needB +
        "</strong> more.</p>";
      return;
    }

    var cmp = TP.compareHands(a.cards, b.cards);
    var prob = TP.probabilityFor(a.cards, b.cards);
    var evalA = cmp.a;
    var evalB = cmp.b;
    var nameA = escapeHtml(a.name || "Player 1");
    var nameB = escapeHtml(b.name || "Player 2");

    var verdictClass = cmp.isTie ? "tie" : cmp.winner === "A" ? "p1" : "p2";
    var winnerName = cmp.isTie ? "It's a tie" : cmp.winner === "A" ? nameA + " wins" : nameB + " wins";
    var tag = cmp.isTie ? "split pot" : "winner";

    var reason;
    if (cmp.isTie) {
      reason = "Both hands are a <b>" + escapeHtml(evalA.name.toLowerCase()) +
        "</b> on the same rank" + (evalA.category === TP.CATEGORY.PAIR || evalA.category === TP.CATEGORY.HIGH_CARD ? "s" : "") +
        ", and suits do not break a tie in Teen Patti.";
    } else {
      var winEval = cmp.winner === "A" ? evalA : evalB;
      var loseEval = cmp.winner === "A" ? evalB : evalA;
      reason = "<b>" + escapeHtml(winEval.phrase) + "</b> beats <b>" + escapeHtml(loseEval.phrase) + "</b>.";
    }

    var html =
      '<div class="verdict ' + verdictClass + '">' + winnerName + '<span class="tag">' + tag + "</span></div>" +
      '<div class="hands-line">' +
      '<span class="chip">' + nameA + " <b>" + TP.cardsLabel(a.cards) + "</b></span>" +
      '<span class="chip">' + nameB + " <b>" + TP.cardsLabel(b.cards) + "</b></span>" +
      "</div>" +
      '<p class="reason">' + reason + "</p>" +
      '<div class="odds">' +
      oddRow("p1", nameA + " win chance", pct(prob.valid ? prob.pA : 0)) +
      oddRow("p2", nameB + " win chance", pct(prob.valid ? prob.pB : 0)) +
      oddRow("tie", "Tie chance", pct(prob.valid ? prob.pTie : 0)) +
      "</div>";

    html += prob.valid
      ? '<p class="odds-note">Head to head: exact result over all <b>' + prob.total.toLocaleString("en-US") +
        "</b> hands the other player could be dealt from the remaining 46 cards.</p>"
      : '<p class="odds-note">Head-to-head odds need 6 different cards on the table — ' + escapeHtml(prob.reason) + "</p>";

    var strengthA = TP.handStrength(a.cards);
    var strengthB = TP.handStrength(b.cards);
    html += '<p class="odds-note">Hand strength on its own: <b>' + nameA + " " + pct(strengthA.pWin) +
      "</b> and <b>" + nameB + " " + pct(strengthB.pWin) + "</b> of all " +
      strengthA.total.toLocaleString("en-US") + " hands the opponent could hold.</p>";

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

  function playTone(ctx, freq, start, duration, peak, type) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.05);
  }

  function audioContext() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!playTone.ctx) playTone.ctx = new Ctor();
    if (playTone.ctx.state === "suspended") playTone.ctx.resume();
    return playTone.ctx;
  }

  function playSound(kind) {
    if (!state.sound) return;
    var ctx = audioContext();
    if (!ctx) return;
    if (kind === "win") {
      playTone(ctx, 523.25, 0, 0.16, 0.16);
      playTone(ctx, 659.25, 0.11, 0.16, 0.16);
      playTone(ctx, 783.99, 0.22, 0.3, 0.18);
    } else if (kind === "lose") {
      playTone(ctx, 392, 0, 0.2, 0.14, "sine");
      playTone(ctx, 293.66, 0.14, 0.34, 0.14, "sine");
    } else {
      playTone(ctx, 440, 0, 0.2, 0.13, "sine");
      playTone(ctx, 440, 0.16, 0.26, 0.13, "sine");
    }
  }

  function commitResult(play) {
    var a = state.players[0];
    var b = state.players[1];
    if (a.cards.length !== 3 || b.cards.length !== 3) {
      pulse(a);
      if (navigator.vibrate) navigator.vibrate(18);
      renderResult();
      return;
    }

    var signature = handSignature(a) + "::" + handSignature(b);
    var cmp = TP.compareHands(a.cards, b.cards);

    if (play) {
      playSound(cmp.isTie ? "tie" : cmp.winner === "A" ? "win" : "lose");
      if (navigator.vibrate) navigator.vibrate(cmp.isTie ? [12, 40, 12] : [18]);
      refs.result.classList.remove("flash");
      void refs.result.offsetWidth;
      refs.result.classList.add("flash");
      if (refs.result.scrollIntoView) {
        refs.result.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    if (signature === state.lastCommitted) return;
    state.lastCommitted = signature;

    var prob = TP.probabilityFor(a.cards, b.cards);
    state.history.unshift({
      ts: Date.now(),
      a: a.name || "Player 1",
      b: b.name || "Player 2",
      cardsA: TP.cardsLabel(a.cards),
      cardsB: TP.cardsLabel(b.cards),
      handA: cmp.a.name,
      handB: cmp.b.name,
      winner: cmp.isTie ? "tie" : cmp.winner,
      pA: prob.valid ? prob.pA : null,
      pB: prob.valid ? prob.pB : null
    });
    state.history = state.history.slice(0, HISTORY_LIMIT);
    write(KEY_HISTORY, state.history);
    renderHistory();
  }

  function renderHistory() {
    var list = document.getElementById("history");
    if (!state.history.length) {
      list.innerHTML = '<li class="none">No hands compared yet.</li>';
      return;
    }
    list.innerHTML = state.history.map(function (item) {
      var outcome = item.winner === "tie"
        ? "Tie"
        : escapeHtml(item.winner === "A" ? item.a : item.b) + " won";
      var odds = item.pA === null ? "" : " · " + pct(item.pA) + " / " + pct(item.pB);
      return "<li>" +
        '<span class="who">' + outcome + '<span class="meta"> · ' +
        escapeHtml(item.winner === "A" ? item.cardsA : item.cardsB) + "</span></span>" +
        '<span class="meta">' + escapeHtml(item.handA) + odds + "</span>" +
        "</li>";
    }).join("");
  }

  function clearAll() {
    state.players.forEach(function (player) {
      player.cards = [];
    });
    state.lastCommitted = "";
    refs.players.forEach(function (_, index) {
      syncPanel(index);
    });
    renderResult();
  }

  function init() {
    var mount = document.getElementById("players");
    state.players.forEach(function (player, index) {
      var ui = buildPanel(player, index);
      refs.players.push(ui);
      mount.appendChild(ui.panel);
    });

    var saved = read(KEY_HANDS, null);
    if (Array.isArray(saved) && saved.length === 2) {
      state.players.forEach(function (player, index) {
        var data = saved[index] || {};
        if (typeof data.name === "string" && data.name) {
          player.name = data.name;
          refs.players[index].name.value = data.name;
        }
        if (typeof data.suit === "string") {
          player.suit = data.suit;
          refs.players[index].suitSelect.value = data.suit;
        }
        if (Array.isArray(data.cards)) {
          player.cards = data.cards.filter(function (card) {
            return card && card.rank >= 2 && card.rank <= 14 &&
              TP.SUITS.some(function (suit) { return suit.id === card.suit; });
          }).slice(0, 3);
        }
        syncPanel(index);
      });
    } else {
      state.players.forEach(function (_, index) {
        syncPanel(index);
      });
    }

    var rulesList = document.getElementById("rulesList");
    rulesList.innerHTML = TP.RULES_LADDER.map(function (rule) {
      return "<li>" + escapeHtml(rule) + "</li>";
    }).join("");

    var soundBtn = document.getElementById("soundBtn");
    var syncSound = function () {
      soundBtn.textContent = state.sound ? "🔊" : "🔇";
      soundBtn.setAttribute("aria-pressed", state.sound ? "true" : "false");
    };
    soundBtn.addEventListener("click", function () {
      state.sound = !state.sound;
      write(KEY_SOUND, state.sound);
      syncSound();
      if (state.sound) playSound("win");
    });
    syncSound();

    document.getElementById("compareBtn").addEventListener("click", function () {
      commitResult(true);
    });

    document.getElementById("clearHistory").addEventListener("click", function () {
      state.history = [];
      state.lastCommitted = "";
      write(KEY_HISTORY, state.history);
      renderHistory();
    });

    var clearBtn = el("button", "ghost-btn", "Clear both");
    clearBtn.type = "button";
    clearBtn.style.width = "100%";
    clearBtn.style.marginTop = "14px";
    clearBtn.addEventListener("click", clearAll);
    document.getElementById("players").after(clearBtn);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target === document.body) commitResult(true);
    });

    renderHistory();
    renderResult();
  }

  init();
})();
