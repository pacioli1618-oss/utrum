import assert from 'node:assert/strict';
import {test} from 'node:test';
import {agreementBetween, evaluateRanking, expectedComparisons, summarizeResults, withComparison, type Comparison, type Method} from '../src/lib/ranking';

const ids = (count: number) => Array.from({length: count}, (_, index) => `item-${String(index).padStart(2, '0')}`);
/** The "truth" of a simulated person: lower index wins. */
const byIndex = (a: string, b: string) => (a < b ? a : b);

function answerAll(itemIds: string[], method: Method, seed: string, prefer = byIndex) {
  let comparisons: Comparison[] = [];
  let evaluation = evaluateRanking({itemIds, comparisons, method, seed});
  const asked = new Set<string>();
  while (!evaluation.isComplete) {
    const [left, right] = evaluation.nextPair!;
    const key = [left, right].sort().join('|');
    assert.ok(!asked.has(key), `pair asked twice: ${key}`);
    asked.add(key);
    comparisons = withComparison(comparisons, left, right, prefer(left, right));
    evaluation = evaluateRanking({itemIds, comparisons, method, seed});
  }
  return {evaluation, comparisons};
}

test('quick: sorts correctly within the expected number of answers', () => {
  for (const count of [2, 3, 7, 12, 30]) {
    const itemIds = ids(count);
    const {evaluation, comparisons} = answerAll(itemIds, 'quick', 'person-a');
    assert.deepEqual(evaluation.order, itemIds);
    assert.ok(comparisons.length <= expectedComparisons(count, 'quick'), `${count}: ${comparisons.length} answers`);
    assert.equal(evaluation.progress, 1);
  }
});

test('full: asks every pair once and ranks by wins', () => {
  const itemIds = ids(6);
  const {evaluation, comparisons} = answerAll(itemIds, 'full', 'person-a');
  assert.equal(comparisons.length, 15);
  assert.deepEqual(evaluation.order, itemIds);
  assert.equal(evaluation.wins![itemIds[0]], 5);
});

test('full: a cycle (A>B, B>C, C>A) ties on wins and is broken head to head', () => {
  const [a, b, c] = ids(3);
  const prefer = (x: string, y: string) => {
    const pair = [x, y].sort().join('|');
    return ({[`${a}|${b}`]: a, [`${b}|${c}`]: b, [`${a}|${c}`]: c} as Record<string, string>)[pair];
  };
  const {evaluation} = answerAll([a, b, c], 'full', 's', prefer);
  assert.deepEqual(evaluation.order.length, 3);
  assert.ok(Object.values(evaluation.wins!).every((wins) => wins === 1));
});

test('the order of questions depends on the person, the result does not', () => {
  const itemIds = ids(8);
  const first = evaluateRanking({itemIds, comparisons: [], method: 'quick', seed: 'ana'}).nextPair;
  const seeds = ['beto', 'carla', 'dani', 'edu', 'fabi'];
  assert.ok(seeds.some((seed) => evaluateRanking({itemIds, comparisons: [], method: 'quick', seed}).nextPair!.join() !== first!.join()));
  for (const seed of seeds) assert.deepEqual(answerAll(itemIds, 'quick', seed).evaluation.order, itemIds);
});

test('resumes from saved answers, survives undo, new and removed items', () => {
  const itemIds = ids(6);
  const {comparisons} = answerAll(itemIds, 'quick', 'p');
  // Undo the last answer: exactly one question again, the same pair.
  const undone = comparisons.slice(0, -1);
  const again = evaluateRanking({itemIds, comparisons: undone, method: 'quick', seed: 'p'});
  assert.equal(again.isComplete, false);
  const last = comparisons[comparisons.length - 1];
  assert.deepEqual([...again.nextPair!].sort(), [last.itemLowId, last.itemHighId]);
  // A new item: only the comparisons it needs, every old answer still used.
  const withNew = [...itemIds, 'item-99'];
  const {comparisons: more} = answerAll(withNew, 'quick', 'p', (a, b) => (a === 'item-99' ? b : b === 'item-99' ? a : byIndex(a, b)));
  assert.ok(more.length > comparisons.length);
  // A removed item: answers about it are ignored, the rest stays complete.
  const removed = evaluateRanking({itemIds: itemIds.slice(1), comparisons, method: 'full', seed: 'p'});
  assert.ok(removed.answeredCount > 0);
});

test('withComparison replaces an earlier answer to the same pair', () => {
  const once = withComparison([], 'b', 'a', 'a');
  assert.deepEqual(once, [{itemLowId: 'a', itemHighId: 'b', winnerId: 'a'}]);
  const twice = withComparison(once, 'a', 'b', 'b');
  assert.deepEqual(twice, [{itemLowId: 'a', itemHighId: 'b', winnerId: 'b'}]);
});

test('agreement: identical 1, reversed 0', () => {
  const itemIds = ids(5);
  assert.equal(agreementBetween(itemIds, itemIds, itemIds), 1);
  assert.equal(agreementBetween(itemIds, itemIds, [...itemIds].reverse()), 0);
});

test('summary: mean position, spread and only complete rankings', () => {
  const [a, b, c] = ids(3);
  const summary = summarizeResults(
    [a, b, c],
    [
      {id: 'ana', ranking: [a, b, c]},
      {id: 'beto', ranking: [b, a, c]},
      {id: 'old', ranking: [a, b]},
    ],
  );
  assert.deepEqual(
    summary.rows.map((row) => row.itemId),
    [a, b, c],
  );
  assert.equal(summary.rows[0].meanPosition, 1.5);
  assert.equal(summary.rows[2].spread, 0);
  assert.equal(summary.rows[0].spread, 1);
  assert.equal(summary.pairs.length, 1, 'the incomplete ranking is left out');
  assert.equal(summary.meanAgreement, 2 / 3);
});
