// The ranking engine. Framework-free, deterministic and unit-tested (tests/ranking.test.ts).
//
// A person's state is only their list of answers ("between A and B, A"). Everything else —
// the next pair to ask, the progress, the ranking — is recomputed from those answers, so a
// screen can be reloaded, an answer undone or an item added at any time.
//
// Two methods (lists.method):
//   quick — binary insertion sort: about n·log2(n) answers. Items are inserted one by one in an
//           order that depends on the person (seed), so different people see different pairs.
//   full  — every pair once, n·(n−1)/2 answers; items are ranked by wins, ties broken by the
//           head-to-head answer.

export type Method = 'quick' | 'full';

/** One answer, stored once per pair with itemLowId < itemHighId (as in the database). */
export type Comparison = {itemLowId: string; itemHighId: string; winnerId: string};

export type Evaluation = {
  isComplete: boolean;
  /** The pair to ask next, already in display order (left, right); null when complete. */
  nextPair: [string, string] | null;
  /** Ranked item ids, most to least. While incomplete (quick), only the items placed so far. */
  order: string[];
  /** Items not placed yet (quick, while incomplete). */
  unplaced: string[];
  /** Wins per item (full method only). */
  wins: Record<string, number> | null;
  /** Answers that count towards the current ranking. */
  answeredCount: number;
  /** Answers expected in total: exact for full, an upper estimate for quick. */
  expectedCount: number;
  /** 0 to 1. */
  progress: number;
};

/** FNV-1a, enough to shuffle deterministically per person. */
export function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function pairKey(a: string, b: string) {
  const [low, high] = sortPair(a, b);
  return `${low}|${high}`;
}

/** Answers that still apply (both items still on the list), by pair. */
function indexAnswers(itemIds: readonly string[], comparisons: readonly Comparison[]) {
  const present = new Set(itemIds);
  const winners = new Map<string, string>();
  for (const comparison of comparisons) {
    if (present.has(comparison.itemLowId) && present.has(comparison.itemHighId)) {
      winners.set(pairKey(comparison.itemLowId, comparison.itemHighId), comparison.winnerId);
    }
  }
  return winners;
}

/** Shows the two items left/right in an order that is stable for one person but not alphabetical. */
function displayOrder(seed: string, a: string, b: string): [string, string] {
  return hashText(`${seed}:side:${pairKey(a, b)}`) % 2 === 0 ? [a, b] : [b, a];
}

/** How many answers a list of n items takes: exact for full, the worst case for quick. */
export function expectedComparisons(itemCount: number, method: Method) {
  if (itemCount < 2) return 0;
  if (method === 'full') return (itemCount * (itemCount - 1)) / 2;
  let total = 0;
  for (let placed = 1; placed < itemCount; placed++) total += Math.ceil(Math.log2(placed + 1));
  return total;
}

export function evaluateRanking({
  itemIds,
  comparisons,
  method,
  seed,
}: {
  itemIds: readonly string[];
  comparisons: readonly Comparison[];
  method: Method;
  /** The participant's id: decides the order of the questions for this person. */
  seed: string;
}): Evaluation {
  const winners = indexAnswers(itemIds, comparisons);
  const count = itemIds.length;

  if (count < 2) {
    return {isComplete: true, nextPair: null, order: [...itemIds], unplaced: [], wins: null, answeredCount: 0, expectedCount: 0, progress: 1};
  }

  if (method === 'full') {
    const pairs: [string, string][] = [];
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) pairs.push([itemIds[i], itemIds[j]]);
    pairs.sort((x, y) => hashText(seed + pairKey(...x)) - hashText(seed + pairKey(...y)) || pairKey(...x).localeCompare(pairKey(...y)));

    let answeredCount = 0;
    let nextPair: [string, string] | null = null;
    for (const pair of pairs) {
      if (winners.has(pairKey(...pair))) answeredCount++;
      else nextPair ??= displayOrder(seed, ...pair);
    }

    const wins: Record<string, number> = Object.fromEntries(itemIds.map((id) => [id, 0]));
    winners.forEach((winner) => {
      if (winner in wins) wins[winner]++;
    });
    const order = [...itemIds].sort((a, b) => {
      if (wins[b] !== wins[a]) return wins[b] - wins[a];
      const headToHead = winners.get(pairKey(a, b));
      if (headToHead === a) return -1;
      if (headToHead === b) return 1;
      return itemIds.indexOf(a) - itemIds.indexOf(b);
    });

    return {
      isComplete: nextPair === null,
      nextPair,
      order,
      unplaced: [],
      wins,
      answeredCount,
      expectedCount: pairs.length,
      progress: answeredCount / pairs.length,
    };
  }

  // quick: replay the binary insertion sort over the known answers until one is missing.
  const insertionOrder = [...itemIds].sort((a, b) => hashText(seed + a) - hashText(seed + b) || a.localeCompare(b));
  const sorted: string[] = [];
  let used = 0;

  for (let index = 0; index < insertionOrder.length; index++) {
    const item = insertionOrder[index];
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const other = sorted[middle];
      const winner = winners.get(pairKey(item, other));
      if (winner === undefined) {
        // Remaining work: the rest of this search, plus a full search for every item still to insert.
        let remaining = Math.ceil(Math.log2(high - low + 1));
        for (let next = index + 1; next < insertionOrder.length; next++) {
          remaining += Math.ceil(Math.log2(sorted.length + 1 + (next - index)));
        }
        return {
          isComplete: false,
          nextPair: displayOrder(seed, item, other),
          order: [...sorted],
          unplaced: insertionOrder.slice(index),
          wins: null,
          answeredCount: used,
          expectedCount: used + remaining,
          progress: used / (used + remaining),
        };
      }
      used++;
      if (winner === item) high = middle;
      else low = middle + 1;
    }
    sorted.splice(low, 0, item);
  }

  return {isComplete: true, nextPair: null, order: sorted, unplaced: [], wins: null, answeredCount: used, expectedCount: used, progress: 1};
}

/** The answers with one more (an answer to a pair already answered replaces it). */
export function withComparison(comparisons: readonly Comparison[], itemAId: string, itemBId: string, winnerId: string): Comparison[] {
  const [itemLowId, itemHighId] = sortPair(itemAId, itemBId);
  return [...comparisons.filter((c) => c.itemLowId !== itemLowId || c.itemHighId !== itemHighId), {itemLowId, itemHighId, winnerId}];
}

// ---------------------------------------------------------------------------
// Comparing views
// ---------------------------------------------------------------------------

export type PersonRanking = {id: string; ranking: readonly string[]};

export type ResultRow = {
  itemId: string;
  /** Position (1 = top) in each person's ranking, by person id. */
  positions: Record<string, number>;
  /** Mean position: the consolidated order (lower is higher). */
  meanPosition: number;
  /** Worst position minus best position: how much people disagree on this item. */
  spread: number;
};

export type PairAgreement = {firstId: string; secondId: string; share: number};

export type ResultsSummary = {
  rows: ResultRow[];
  pairs: PairAgreement[];
  /** Mean of the pair agreements; null with fewer than two people. */
  meanAgreement: number | null;
};

/** Share of item pairs two people put in the same order (Kendall-style agreement, 0 to 1). */
export function agreementBetween(itemIds: readonly string[], first: readonly string[], second: readonly string[]) {
  const firstPosition = new Map(first.map((id, index) => [id, index]));
  const secondPosition = new Map(second.map((id, index) => [id, index]));
  const ids = itemIds.filter((id) => firstPosition.has(id) && secondPosition.has(id));
  let same = 0;
  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      total++;
      const a = firstPosition.get(ids[i])! - firstPosition.get(ids[j])!;
      const b = secondPosition.get(ids[i])! - secondPosition.get(ids[j])!;
      if (a * b > 0) same++;
    }
  }
  return total === 0 ? 1 : same / total;
}

/**
 * Consolidates complete rankings: mean position per item (Borda), spread per item and the
 * agreement of every pair of people. Only rankings that cover every current item count.
 */
export function summarizeResults(itemIds: readonly string[], people: readonly PersonRanking[]): ResultsSummary {
  const complete = people.filter((person) => itemIds.every((id) => person.ranking.includes(id)));
  const rows: ResultRow[] = itemIds.map((itemId, listIndex) => {
    const positions: Record<string, number> = {};
    for (const person of complete) {
      positions[person.id] = person.ranking.filter((id) => itemIds.includes(id)).indexOf(itemId) + 1;
    }
    const values = Object.values(positions);
    return {
      itemId,
      positions,
      meanPosition: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : listIndex + 1,
      spread: values.length ? Math.max(...values) - Math.min(...values) : 0,
    };
  });
  rows.sort((a, b) => a.meanPosition - b.meanPosition || a.spread - b.spread || itemIds.indexOf(a.itemId) - itemIds.indexOf(b.itemId));

  const pairs: PairAgreement[] = [];
  for (let i = 0; i < complete.length; i++) {
    for (let j = i + 1; j < complete.length; j++) {
      pairs.push({firstId: complete[i].id, secondId: complete[j].id, share: agreementBetween(itemIds, complete[i].ranking, complete[j].ranking)});
    }
  }
  const meanAgreement = pairs.length ? pairs.reduce((sum, pair) => sum + pair.share, 0) / pairs.length : null;
  return {rows, pairs, meanAgreement};
}
