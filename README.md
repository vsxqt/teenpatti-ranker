# Teen Patti Judge

Pick 3 cards for each of two players and see who won, plus the exact probability of every outcome.

**Live site:** https://teenpatti-ranker.vercel.app

Mobile-first, dark mode, no build step and no dependencies — 4 static files totalling 44 KB.

## How to use it

- Face cards (A K Q J) sit at the top, a suit dropdown picks spade/heart/diamond/club, and the number grid below adds 2-10.
- Tap a card in the hand to remove it. Duplicate picks are allowed, so mistaps never block you.
- A **Hand strength** box under each hand shows that hand's winning chance as soon as those 3 cards are picked, with no second player needed.
- The **Who won?** button reveals the verdict, both players' odds, and plays a short sound. Results are kept in local history.

## Rules used

Strongest to weakest:

1. Three of a kind (A-A-A is the strongest trio, three tens the weakest)
2. Straight run (A-K-Q, K-Q-A, A-2-3, 2-3-4 and every other run)
3. Three tens, also called Teen
4. Pair
5. High card

Suits never decide the main pot in Teen Patti — they only split the side pot (Rani) — so suits are display only and cannot break a tie. Two hands with the same ranks are a tie.

## Probability engine

Both numbers are exact, not sampled:

- **Head-to-head** checks all 15,180 hands the other player could be dealt from the 46 cards left once both hands are known.
- **Single hand strength** checks all 18,424 hands an opponent could be dealt from the remaining 49 cards.

Suits do not affect strength, so instead of dealing every card combination the engine enumerates the 455 possible rank multisets and weights each by how many suit combinations produce it. That is roughly 20x faster than brute force and returns identical results — it was cross-checked against brute-force enumeration over every possible deal for hundreds of random hands.

## Run locally

```sh
python3 -m http.server 8765
```

Then open http://localhost:8765 — or http://<your-lan-ip>:8765 from a phone on the same network (use `--bind 0.0.0.0` and allow the port in your firewall if it does not load).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and element structure |
| `styles.css` | Dark theme, mobile layout, card styling |
| `hand.js` | Card ranking and probability engine, no DOM access |
| `app.js` | UI wiring, hand strength, history, sound |

`hand.js` is pure logic and loads in Node, so the ranking and odds can be tested without a browser.
