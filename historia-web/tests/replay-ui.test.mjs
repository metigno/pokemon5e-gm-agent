import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Responsive arena wires accessible replay transport, slider, HP bars and visual status',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['replayPanel','replayPlay','replayPrev','replayNext','replaySeek','replayClose','replayEvents','replayInfo','analysisSummary','p1hp','p2hp','openAnalysis','openReplay']){
  assert.match(html,new RegExp('id="'+id+'"'),id+' missing');
 }
 assert.match(html,/type="range" min="0" max="0"/);
 assert.match(html,/aria-label="Scorri/); // accessible label
 assert.match(html,/@media\(max-width:800px\)/);
 assert.match(html,/prefers-reduced-motion/);
});
test('Replay controls use server-verified sessions, no external parser or user-authored victory',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/data\.verified!==true/);
 assert.match(html,/data\.source!=='showdown-spectator'/);
 assert.match(html,/\/replay'/);
 assert.match(html,/\/analysis'/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'client script exists');
 assert.doesNotThrow(()=>new vm.Script(script),'browser JavaScript parses');
 assert.match(script,/function renderFrame\(index\)/);
 assert.match(script,/function renderVerifiedReport\(report\)/);
});
