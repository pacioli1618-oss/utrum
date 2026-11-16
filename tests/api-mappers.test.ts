import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {toHostListView, toParticipantView, type RawHostListView, type RawParticipantView} from '../src/lib/api-mappers';

// Real responses captured from the ut_* RPCs (tests/fixtures/). Refresh them when an RPC changes.
const load = <T>(name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as T;

test('host view: items with who suggested them, everyone with progress and ranking', () => {
  const view = toHostListView(load<RawHostListView>('ut_get_list_as_host'));
  assert.equal(view.title, 'Prioridades');
  assert.equal(view.criterion, 'Qual é mais crítico?');
  assert.equal(view.criterionDetail, null);
  assert.equal(view.method, 'quick');
  assert.deepEqual(
    view.items.map((item) => item.label),
    ['Login lento', 'Relatório quebrado', 'Tela de login no celular', 'Nota fiscal'],
  );
  assert.equal(view.items[2].addedByName, 'Ana');
  assert.equal(view.items[0].addedByName, null);
  const [luca, ana] = view.results;
  assert.equal(luca.name, 'Luca');
  assert.deepEqual(luca.ranking, [view.items[0].id, view.items[1].id, view.items[2].id, view.items[3].id]);
  assert.equal(typeof luca.comparisonCount, 'number');
  assert.equal(ana.ranking, null);
  assert.equal(ana.hasCompleted, true);
});

test('participant view: own comparisons agree with the ranking the server stored', () => {
  const view = toParticipantView(load<RawParticipantView>('ut_open_participant'));
  assert.equal(view.me.name, 'Luca');
  assert.equal(view.hasCompleted, true);
  assert.equal(view.list.locale, 'pt-BR');
  assert.ok(view.results);
  const ranking = view.results.find((person) => person.id === view.me.id)!.ranking!;
  assert.ok(view.comparisons.length > 0);
  for (const comparison of view.comparisons) {
    const loser = comparison.winnerId === comparison.itemLowId ? comparison.itemHighId : comparison.itemLowId;
    assert.ok(ranking.indexOf(comparison.winnerId) < ranking.indexOf(loser));
  }
});
