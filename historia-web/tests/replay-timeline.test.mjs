import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplayTimeline,renderTechnicalReport} from '../replay-timeline.mjs';

const publicLog=[
 '|player|p1|Luke|',
 '|player|p2|Rivale|',
 '|switch|p1a: Arcanine|Arcanine-Hisui, L100|100/100',
 '|switch|p2a: Swampert|Swampert, L100|100/100',
 '|turn|1',
 '|move|p1a: Arcanine|Head Smash|p2a: Swampert',
 '|-damage|p2a: Swampert|55/100',
 '|-crit|p2a: Swampert',
 '|move|p2a: Swampert|Earthquake|p1a: Arcanine',
 '|-damage|p1a: Arcanine|0 fnt',
 '|faint|p1a: Arcanine',
 '|switch|p1a: Venusaur|Venusaur, L100|100/100',
 '|turn|2',
 '|-mega|p1a: Venusaur|Venusaur|Venusaurite',
 '|detailschange|p1a: Venusaur|Venusaur-Mega, L100',
 '|move|p1a: Venusaur|Giga Drain|p2a: Swampert',
 '|-supereffective|p2a: Swampert',
 '|-damage|p2a: Swampert|0 fnt',
 '|faint|p2a: Swampert',
 '|win|Luke'
].join('\n');

test('Replay frames reconstruct public field species and observed HP in correct turn order',()=>{
 const replay=buildReplayTimeline(publicLog);
 assert.equal(replay.winner,'Luke');
 assert.equal(replay.turns,2);
 assert.deepEqual(replay.frames.map(x=>x.turn),[0,1,2]);
 assert.equal(replay.frames[0].field.p1.species,'Arcanine-Hisui');
 assert.equal(replay.frames[0].field.p2.hp,100);
 assert.equal(replay.frames[1].field.p1.species,'Venusaur');
 assert.equal(replay.frames[1].field.p2.hp,55);
 assert.equal(replay.frames[2].field.p1.mega,true);
 assert.equal(replay.frames[2].field.p1.species,'Venusaur-Mega');
 assert.equal(replay.frames[2].field.p2.fainted,true);
 assert.equal(replay.frames[2].field.p2.hp,0);
 assert.equal(replay.stats.p1.moves,2);
 assert.equal(replay.stats.p2.moves,1);
 assert.equal(replay.stats.p1.faints,1);
 assert.equal(replay.stats.p2.faints,1);
});
test('Technical report cites observed turn and event, but makes no prediction claims',()=>{
 const replay=buildReplayTimeline(publicLog);
 const report=renderTechnicalReport(replay,{p1name:'Luke',p2name:'Rivale'});
 assert.equal(report.result,'Vincitore Showdown: Luke');
 assert.equal(report.trainers[0].mega,1);
 assert.ok(report.keyMoments.some(e=>e.turn===2&&e.type==='mega'&&e.actor.includes('Venusaur')));
 assert.ok(report.keyMoments.some(e=>e.turn===1&&e.type==='faint'));
 assert.match(report.caveat,/prediction/);
 assert.doesNotMatch(JSON.stringify(report),/Luke ha previsto/);
});
test('Private request packets cannot appear as replay events',()=>{
 const polluted=publicLog+'\n|request|{"side":{"pokemon":[{"item":"secret"}]}}\n|split|p1\n|error|private';
 const r=buildReplayTimeline(polluted);
 assert.equal(r.winner,'Luke');
 assert.ok(r.frames.every(f=>f.events.every(e=>!['request','split','error'].includes(e.type))));
 assert.doesNotMatch(JSON.stringify(r),/secret/);
});
test('Faint and status are grounded in public conditions, missing HP stays unknown',()=>{
 const log='|switch|p2a: Gengar|Gengar, L100|\n|turn|1\n|-status|p2a: Gengar|brn\n|-damage|p2a: Gengar|66/100 brn\n';
 const r=buildReplayTimeline(log);
 assert.equal(r.frames[0].field.p2.hp,null);
 assert.equal(r.frames[1].field.p2.hp,66);
 assert.equal(r.frames[1].field.p2.status,'brn');
 assert.equal(r.frames[1].field.p2.fainted,false);
 assert.equal(r.winner,null);
});
test('Unsupported and giant logs rejected rather than misreported as verified',()=>{
 assert.throws(()=>buildReplayTimeline(null),/Log pubblico/);
 assert.throws(()=>buildReplayTimeline('x'.repeat(1800001)),/Log pubblico/);
 assert.throws(()=>buildReplayTimeline('|\n'.repeat(10001)),/oltre limite/);
});
test('A tie is represented as a tie, not as a fabricated victory',()=>{
 const r=buildReplayTimeline('|turn|1\n|tie|\n');
 assert.equal(r.tie,true);
 assert.equal(r.winner,null);
 assert.equal(renderTechnicalReport(r).result,'Pareggio Showdown');
});

test('Dynamax activation remains one event when simulator emits two synonymous public markers',()=>{
 const r=buildReplayTimeline([
  '|switch|p2a: Arcanine|Arcanine, L100|100/100',
  '|turn|1',
  '|-start|p2a: Arcanine|Dynamax',
  '|-dynamax|p2a: Arcanine',
  '|-end|p2a: Arcanine|Dynamax',
  '|win|Luke'
 ].join('\n'));
 assert.equal(r.stats.p2.dynamax,1);
 assert.equal(r.frames[1].field.p2.dynamax,false);
 assert.equal(r.frames[1].events.filter(x=>x.type==='dynamax').length,1);
});
