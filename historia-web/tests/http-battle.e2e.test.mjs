import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {practiceTeams} from '../battle-service.mjs';
const {Teams}=createRequire(import.meta.url)('pokemon-showdown');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Web HTTP API starts and finishes a real manual Showdown match, publishes verified replay',{timeout:45000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'historia-http-'));
 process.env.HISTORIA_DATA_DIR=dir;
 const {handler}=await import('../server.mjs');
 const server=http.createServer(handler);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port,sessionId='c'.repeat(40);
 const api=async(path,body)=>{const headers={'x-historia-session':sessionId};const res=await fetch(base+path,body===undefined?{headers}:{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;};
 try{
  const status=await api('/api/status');assert.equal(status.showdownIntegrated,true);
  const comp=await api('/api/competition');assert.equal(comp.ranking.length,32);assert.equal(comp.qualifiersConfirmed,false);
  const blockedOfficial=await fetch(base+'/api/battles',{method:'POST',headers:{'x-historia-session':sessionId,'content-type':'application/json'},body:JSON.stringify({official:true,practice:true})});
  assert.equal(blockedOfficial.status,400,'An official match cannot start from unverified 2060 canon');
  assert.match((await blockedOfficial.json()).error,/Partite ufficiali non disponibili/);
  const local=practiceTeams(),luke=Teams.unpack(local.p1),mattew=Teams.unpack(local.p2);
  luke[0].item='Leftovers';mattew[0].item='Leftovers';
  const imported={p1team:Teams.export(luke),p2team:Teams.export(mattew),p2name:'Mattew'};
  const saved=await api('/api/teams',imported);
  assert.match(saved.teams.p1team,/Leftovers/);
  assert.match(saved.teams.p2team,/Leftovers/,'same item in separate teams is permitted');
  const preview=await api('/api/teams/preview',imported);
  assert.equal(preview.p1[0].item,'Leftovers');
  assert.equal(preview.p2[0].item,'Leftovers');
  const duplicated=Teams.unpack(local.p1);
  duplicated[0].item='Leftovers';duplicated[2].item='Leftovers';
  const rejected=await fetch(base+'/api/teams',{method:'POST',headers:{'x-historia-session':sessionId,'content-type':'application/json'},
   body:JSON.stringify({...imported,p1team:Teams.export(duplicated)})});
  assert.equal(rejected.status,400,'same-team duplicate is rejected');
  const diagnostic=(await rejected.json()).error;
  assert.match(diagnostic,/Item Clause \\(Luke\\)/);
  assert.match(diagnostic,/Leftovers/);
  assert.match(diagnostic,/Arcanine/);
  assert.match(diagnostic,/Kyurem-Black/);
  const started=await api('/api/battles',{practice:true,mode:'manual',sessionId,npcProfile:'daniel'});
  assert.deepEqual(started.aiProfiles,{p1:'luke',p2:'daniel'});
  assert.match(started.id,/^[a-f0-9-]{36}$/);
  const session=await api('/api/session');assert.equal(session.lastBattleId,started.id);
  const early=await fetch(base+'/api/battles/'+started.id+'/replay',{headers:{'x-historia-session':sessionId}});
  assert.equal(early.status,409,'The private in-progress battle cannot claim to have a verified replay');

  const unauthorized=await fetch(base+'/api/battles/'+started.id,{headers:{'x-historia-session':'d'.repeat(40)}});
  assert.equal(unauthorized.status,404,'Another session cannot read private move request');
  const unowned=await fetch(base+'/api/battles/'+started.id);
  assert.equal(unowned.status,400,'Missing session secret rejected');
  const illegalChoice=await fetch(base+'/api/battles/'+started.id+'/choice',{method:'POST',headers:{'content-type':'application/json','x-historia-session':'d'.repeat(40)},body:JSON.stringify({choice:'move 1',requestId:1})});
  assert.equal(illegalChoice.status,404,'Another session cannot control Luke');
  const others=await fetch(base+'/api/battles',{headers:{'x-historia-session':'d'.repeat(40)}});
  assert.deepEqual((await others.json()).battles,[],'Other sessions cannot enumerate replays');
  const end=Date.now()+30000;let done=null,choices=0;
  while(Date.now()<end){
   const current=await api('/api/battles/'+started.id);
   if(current.status==='complete'){done=current;break;}
   if(current.status==='error')throw Error(current.error);
   if(current.choices.length){
    const choice=current.choices.find(x=>/^move \d+$/.test(x))||current.choices[0];
    await api('/api/battles/'+started.id+'/choice',{requestId:current.requestId,choice});
    choices++;
   }
   await sleep(40);
  }
  assert.ok(done,'Official Showdown game did not finish');
  assert.ok(choices>0);
  assert.match(done.log,/\|win\|/);
  assert.ok(['Luke','NPC (allenamento)'].includes(done.winner));
  const privateReplay=await api('/api/battles/'+started.id+'/replay');
  assert.equal(privateReplay.verified,true);
  assert.equal(privateReplay.source,'showdown-spectator');
  assert.equal(privateReplay.timeline.winner,done.winner);
  assert.ok(privateReplay.timeline.frames.length>1);
  assert.ok(privateReplay.timeline.frames.some(f=>f.events.some(e=>e.type==='move')));
  assert.ok(privateReplay.timeline.frames.some(f=>f.events.some(e=>e.type==='faint')));
  assert.doesNotMatch(JSON.stringify(privateReplay.timeline),/\\\"request\\\"/);
  const analysis=await api('/api/battles/'+started.id+'/analysis');
  assert.equal(analysis.verified,true);
  assert.equal(analysis.report.status,'complete');
  assert.equal(analysis.report.turns,privateReplay.timeline.turns);
  assert.equal(analysis.report.result,'Vincitore Showdown: '+done.winner);
  const deniedReplay=await fetch(base+'/api/battles/'+started.id+'/replay',{headers:{'x-historia-session':'d'.repeat(40)}});
  assert.equal(deniedReplay.status,404,'Replay requires original owner');
  const deniedAnalysis=await fetch(base+'/api/battles/'+started.id+'/analysis',{headers:{'x-historia-session':'d'.repeat(40)}});
  assert.equal(deniedAnalysis.status,404,'Post-match analysis requires original owner');
  const history=await api('/api/battles');assert.equal(history.battles.length,1);
  assert.equal(history.battles[0].winner,done.winner);
 }finally{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
