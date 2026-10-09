import http from 'node:http';
import {readFile,mkdir,writeFile,rename,chmod,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {makeSecurityHeaders,isSameOriginMutation,makeRateLimiter} from './security.mjs';
import {ArenaService} from './battle-service.mjs';
import {buildReplayTimeline,renderTechnicalReport} from './replay-timeline.mjs';
import {loadHistoricalSeeding} from '../historia/src/seeding.mjs';

const root=new URL('./',import.meta.url);
const port=Number(process.env.PORT||3000);
const html=await readFile(new URL('./index.html',root));
const securityHeaders=makeSecurityHeaders(html);const limiter=makeRateLimiter();
const dataDir=process.env.HISTORIA_DATA_DIR||fileURLToPath(new URL('./.data/',root));
const arena=new ArenaService(join(dataDir,'battles'));
const sessions=new Map(),replays=new Map(),sessionBattles=new Map();
const cachePut=(map,key,value)=>{
 map.delete(key);map.set(key,value);
 if(map.size>512)map.delete(map.keys().next().value);
};
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const readBody=async req=>{
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(String(req.headers['content-type']||''))){
  const e=Error('Content-Type application/json richiesto');e.httpStatus=415;throw e;
 }
 let bytes=0,s='';
 for await(const chunk of req){bytes+=chunk.length;if(bytes>50000){const e=Error('Payload troppo grande');e.httpStatus=413;throw e;}s+=chunk;}
 let parsed;
 try{parsed=JSON.parse(s);}catch{const e=Error('JSON non valido');e.httpStatus=400;throw e;}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){const e=Error('Oggetto JSON richiesto');e.httpStatus=400;throw e;}
 return parsed;
};
const validSession=id=>typeof id==='string'&&/^[a-f0-9]{40}$/.test(id);
const readSession=req=>{const id=req.headers['x-historia-session'];if(!validSession(id))throw Error('Sessione privata non valida');return id;};
const digestId=id=>createHash('sha256').update(id).digest('hex');
const chatPath=id=>join(dataDir,'chat',digestId(id)+'.json');
const sessionPath=id=>join(dataDir,'sessions',digestId(id)+'.json');
async function privateWrite(dir,dest,value){
 await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
 const tmp=dest+'.'+randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(value),{encoding:'utf8',mode:0o600,flag:'wx'});await rename(tmp,dest);}
 catch(e){await unlink(tmp).catch(()=>{});throw e;}
}
async function rememberBattle(id,battleId){await privateWrite(join(dataDir,'sessions'),sessionPath(id),{battleId});}
async function lastBattle(id){if(sessionBattles.has(id))return sessionBattles.get(id);try{const obj=JSON.parse(await readFile(sessionPath(id),'utf8'));if(/^[0-9a-f-]{36}$/.test(obj.battleId)){cachePut(sessionBattles,id,obj.battleId);return obj.battleId;}}catch(e){if(e.code!=='ENOENT')throw e;}return null;}
async function loadChat(id) {
 if(sessions.has(id))return sessions.get(id);
 try{const messages=JSON.parse(await readFile(chatPath(id),'utf8'));if(Array.isArray(messages)){cachePut(sessions,id,messages);return messages;}}
 catch(e){if(e.code!=='ENOENT')throw e;}
 return [];
}
async function saveChat(id,messages) {
 await privateWrite(join(dataDir,'chat'),chatPath(id),messages);
 cachePut(sessions,id,messages);
}
export function summarizeLog(log){
 if(typeof log!=='string'||log.length>40000)throw Error('Log non valido');
 const lines=log.split(/\r?\n/),events=[];let turn=0;
 for(const line of lines){
  const p=line.split('|');
  if(p[1]==='turn'&&Number.isFinite(Number(p[2]))){turn=Number(p[2]);events.push({type:'turn',turn});}
  if(['move','switch','faint','-mega','-dynamax','win'].includes(p[1]))
   events.push({type:p[1],turn,actor:p[2]||'',detail:p[3]||''});
 }
 return {turns:events.filter(x=>x.type==='turn').length,winner:events.findLast(x=>x.type==='win')?.actor||null,events};
}
function routeAsync(res,fn){Promise.resolve().then(fn).catch(e=>{
 const expected=e.httpStatus||(/non valid|mancant|legale|obsolet|disponibil|troppo|contenere|Clause|livello|modalit|format|Packed|scelta|Tera|sessione|limite/i.test(e.message)?400:null);
 if(expected){json(res,expected,{error:e.message});return;}
 console.error('Historia request failure:',e?.name||'Error');
 json(res,500,{error:'Errore interno del server'});
});}
export function handler(req,res){
 for(const [key,value] of Object.entries(securityHeaders))res.setHeader(key,value);
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 const rate=limiter.check(req,path);
 if(!rate.allowed){res.setHeader('retry-after',String(rate.retryAfter));json(res,429,{error:'Troppe richieste; riprovare più tardi'});return;}
 if(req.method==='POST'&&!isSameOriginMutation(req)){json(res,403,{error:'Origine della richiesta non autorizzata'});return;}
 if(req.method==='OPTIONS'){json(res,405,{error:'Metodo non disponibile'});return;}
 if(req.method==='GET'&&path==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;}
 if(req.method==='GET'&&path==='/api/status'){json(res,200,{app:'Pokémon GPT Historia',aiConfigured:!!process.env.OPENAI_API_KEY,showdownIntegrated:true,format:'gen8customgame',persistence:'server-filesystem',canonical2060Roster:false});return;}
 if(req.method==='GET'&&path==='/api/competition'){
  const ranking=loadHistoricalSeeding();
  json(res,200,{year:2060,canonicalThrough:2056,qualifiersConfirmed:false,groups:null,schedule:null,rankingAsOf:ranking.asOf,ranking:ranking.ranking});return;
 }
 if(req.method==='GET'&&path==='/api/session'){routeAsync(res,async()=>{const id=readSession(req);json(res,200,{lastBattleId:await lastBattle(id)});});return;}
 if(req.method==='GET'&&path==='/api/battles'){routeAsync(res,async()=>json(res,200,{battles:await arena.list(readSession(req))}));return;}
 if(req.method==='POST'&&path==='/api/battles'){
  routeAsync(res,async()=>{const body=await readBody(req),sessionId=readSession(req);
   const b=await arena.create({...body,sessionId});cachePut(sessionBattles,sessionId,b.id);await rememberBattle(sessionId,b.id);json(res,201,b);
  });return;
 }
 const replayRoute=path.match(/^\/api\/battles\/([0-9a-f-]{36})\/(replay|analysis)$/);
 if(req.method==='GET'&&replayRoute){
  routeAsync(res,async()=>{
   const id=replayRoute[1],section=replayRoute[2];
   if(!await arena.ownsBattle(id,readSession(req))){json(res,404,{error:'Battaglia non trovata'});return;}
   const battle=await arena.load(id);
   if(!battle||!['complete','tie'].includes(battle.status)){
    json(res,409,{error:'Replay disponibile soltanto dopo il risultato Showdown verificato'});return;
   }
   const timeline=buildReplayTimeline(battle.publicLog||battle.log||'');
   if(battle.status==='complete'&&timeline.winner!==battle.winner)throw Error('Replay non coerente con il vincitore Showdown');
   if(battle.status==='tie'&&!timeline.tie)throw Error('Pareggio senza prova nel log Showdown');
   const report=renderTechnicalReport(timeline,{p1name:battle.p1name,p2name:battle.p2name});
   const basic={id,verified:true,source:'showdown-spectator',p1name:battle.p1name,p2name:battle.p2name,status:battle.status,report};
   json(res,200,section==='analysis'?basic:{...basic,timeline});
  });return;
 }
 const battleRoute=path.match(/^\/api\/battles\/([0-9a-f-]{36})(?:\/(choice))?$/);
 if(battleRoute){
  const id=battleRoute[1],isChoice=!!battleRoute[2];
  if(req.method==='GET'&&!isChoice){routeAsync(res,async()=>{if(!await arena.ownsBattle(id,readSession(req))){json(res,404,{error:'Battaglia non trovata'});return;}const b=await arena.load(id);json(res,b?200:404,b||{error:'Battaglia non trovata'});});return;}
  if(req.method==='POST'&&isChoice){routeAsync(res,async()=>{if(!await arena.ownsBattle(id,readSession(req))){json(res,404,{error:'Battaglia non trovata'});return;}json(res,200,await arena.choose(id,await readBody(req)));});return;}
 }
 if(req.method==='GET'&&path==='/api/chat'){
  routeAsync(res,async()=>{const id=readSession(req);json(res,200,{messages:await loadChat(id)});});return;
 }
 if(req.method==='POST'&&path==='/api/replay'){
  routeAsync(res,async()=>{const {log}=await readBody(req),sessionId=readSession(req);
   const summary=summarizeLog(log);cachePut(replays,sessionId,summary);json(res,200,{...summary,verified:false,source:'manual-untrusted'});
  });return;
 }
 if(req.method==='POST'&&path==='/api/chat'){
  routeAsync(res,async()=>{
   const {message}=await readBody(req),sessionId=readSession(req);
   if(typeof message!=='string'||!message.trim()||message.length>5000)throw Error('Messaggio non valido');
   if(!process.env.OPENAI_API_KEY){json(res,503,{error:'Master AI non configurato: impostare OPENAI_API_KEY sul server.'});return;}
   const history=await loadChat(sessionId),matchId=await lastBattle(sessionId);
   const actual=matchId?await arena.load(matchId):null;
   const technical=['complete','tie'].includes(actual?.status)?renderTechnicalReport(buildReplayTimeline(actual.publicLog||actual.log||''),{p1name:actual.p1name,p2name:actual.p2name}):null;
   const imported=replays.get(sessionId);
   const context=technical?'\nRapporto tecnico deterministico (solo fatti osservati): '+JSON.stringify(technical).slice(0,8000)+'\nLog pubblico Showdown verificato (estratto): '+String(actual.publicLog||actual.log).slice(-20000):
     imported?'\nLog importato da utente: NON verificato dal simulatore; non trattarlo come risultato ufficiale. '+JSON.stringify(imported).slice(0,12000):
     '\nNessuna battaglia terminata e verificata associata.';
   const messages=[{role:'system',content:'Sei il Master narrativo del Mondiale Pokémon GPT Historia 2060. Lore canonica fino al 2056, quadriennale. Il GDR esiste solo durante i Mondiali e fuori dalla battaglia. Non inventare roster ufficiali, sorteggi, risultati o statistiche. Il simulatore ha autorità esclusiva. Nelle analisi tecniche usa solo il log allegato, cita i turni e separa fatti da interpretazioni. Atmosfera da Champions League.'+context},...history.slice(-16),{role:'user',content:message}];
   const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',messages})});
   const data=await response.json();
   if(!response.ok)throw Error('API OpenAI: '+(data.error?.message||response.status));
   const answer=data.choices?.[0]?.message?.content;
   if(typeof answer!=='string')throw Error('Risposta AI vuota');
   await saveChat(sessionId,[...history,{role:'user',content:message},{role:'assistant',content:answer}].slice(-50));
   json(res,200,{answer});
  });return;
 }
 json(res,404,{error:'Non trovato'});
}
if(process.argv[1]===fileURLToPath(import.meta.url))http.createServer(handler).listen(port,()=>console.log('Historia Web su http://localhost:'+port));
