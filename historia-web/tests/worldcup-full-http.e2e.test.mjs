import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('HTTP World Cup: 63 unchanged-roster real Showdown battles, verified replays, server restart and champion',{timeout:180000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-http-full-'));let child,base;
 const owner='d'.repeat(40);
 const boot=async()=>{
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HISTORIA_DATA_DIR:dir,HISTORIA_AUTH_MODE:'capability',NODE_ENV:'test',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
  // Port 0 is selected by the OS; obtain it from the actual listening server log.
  let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);
  for(let i=0;i<100;i++){const m=output.match(/http:\/\/localhost:(\d+)/);if(m&&Number(m[1])>0){base='http://127.0.0.1:'+m[1];return;}if(child.exitCode!==null)throw Error(output);await wait(20);}
  throw Error('Actual listening port not reported');
 };
 const stop=async()=>{if(child&&child.exitCode===null){await new Promise(r=>{child.once('exit',r);child.kill();});}};
 const call=async(path,body)=>{
  const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'x-historia-session':owner,origin:base,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();assert.ok(res.ok,`${path}: ${res.status} ${JSON.stringify(data)}`);return data;
 };
 try{
  await boot();let {cup}=await call('/api/worldcup/slots/1/new-historical-hypothesis',{acknowledgeProvisional:true});const seed=cup.seed;
  const play=async game=>{
   const npc=![game.homeId,game.awayId].includes('Luke'),root='/api/worldcup/slots/1/fixtures/'+game.id;
   const started=await call(root+(npc?'/npc-start':'/start'),npc?{}:{mode:'auto'});
   let done;
   for(let i=0;i<1500;i++){done=await call('/api/battles/'+started.battle.id);if(done.status==='complete')break;assert.equal(done.status,'active',done.error);await wait(5);}
   assert.equal(done.status,'complete');
   const replay=await call('/api/battles/'+started.battle.id+'/replay');assert.equal(replay.verified,true);
   cup=(await call(root+(npc?'/npc-finalize':'/finalize'),{})).cup;
  };
  for(const game of cup.schedule)await play(game);
  await stop();await boot();cup=(await call('/api/worldcup/slots/1')).cup;assert.equal(cup.seed,seed);assert.equal(cup.results.length,48);
  let opened=await call('/api/worldcup/slots/1/knockout/open',{});
  while(opened.playoffsPending){cup=opened.cup;for(const g of cup.playoffs.filter(g=>g.status==='scheduled'))await play(g);opened=await call('/api/worldcup/slots/1/knockout/open',{});}
  cup=opened.cup;
  for(const stage of ['round-of-16','quarterfinal','semifinal','final']){
   for(const game of cup.knockout.filter(g=>g.stage===stage))await play(game);
   if(stage!=='final')cup=(await call('/api/worldcup/slots/1/knockout/advance',{})).cup;
  }
  assert.equal(cup.results.length,63);assert.equal(new Set(cup.results.map(r=>r.battleId)).size,63);assert.ok(cup.champion);
  console.log('HTTP REAL WORLD CUP CHAMPION:',cup.champion,'seed:',cup.seed,'playoffs:',cup.playoffs?.length||0);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
