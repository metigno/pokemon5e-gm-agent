import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ArenaService} from './battle-service.mjs';
import {loadHistoricalSeeding} from '../historia/src/seeding.mjs';

const root=new URL('./',import.meta.url);
const port=Number(process.env.PORT||3000);
const html=await readFile(new URL('./index.html',root));
const dataDir=process.env.HISTORIA_DATA_DIR||fileURLToPath(new URL('./.data/',root));
const arena=new ArenaService(join(dataDir,'battles'));
const sessions=new Map(),replays=new Map(),sessionBattles=new Map();
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
const readBody=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>50000)throw Error('Payload troppo grande');}return JSON.parse(s);};
const validSession=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
const chatPath=id=>join(dataDir,'chat',createHash('sha256').update(id).digest('hex')+'.json');
async function loadChat(id) {
 if(sessions.has(id))return sessions.get(id);
 try{const messages=JSON.parse(await readFile(chatPath(id),'utf8'));if(Array.isArray(messages)){sessions.set(id,messages);return messages;}}
 catch(e){if(e.code!=='ENOENT')throw e;}
 return [];
}
async function saveChat(id,messages) {
 sessions.set(id,messages);await mkdir(join(dataDir,'chat'),{recursive:true});
 const target=chatPath(id),temp=target+'.tmp';
 await writeFile(temp,JSON.stringify(messages),'utf8');await rename(temp,target);
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
function routeAsync(res,fn){Promise.resolve().then(fn).catch(e=>json(res,/non valid|mancant|legale|obsolet|disponibil|troppo|contenere|Clause|livello|modalit|format|Packed|scelta|Tera/i.test(e.message)?400:500,{error:e.message}));}
export function handler(req,res){
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(req.method==='GET'&&path==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(html);return;}
 if(req.method==='GET'&&path==='/api/status'){json(res,200,{app:'Pokémon GPT Historia',aiConfigured:!!process.env.OPENAI_API_KEY,showdownIntegrated:true,format:'gen8customgame',persistence:'server-filesystem',canonical2060Roster:false});return;}
 if(req.method==='GET'&&path==='/api/competition'){
  const ranking=loadHistoricalSeeding();
  json(res,200,{year:2060,canonicalThrough:2056,qualifiersConfirmed:false,groups:null,schedule:null,rankingAsOf:ranking.asOf,ranking:ranking.ranking});return;
 }
 if(req.method==='GET'&&path==='/api/battles'){routeAsync(res,async()=>json(res,200,{battles:await arena.list()}));return;}
 if(req.method==='POST'&&path==='/api/battles'){
  routeAsync(res,async()=>{const body=await readBody(req),sessionId=body.sessionId||'demo';
   if(!validSession(sessionId))throw Error('Sessione non valida');
   const b=await arena.create(body);sessionBattles.set(sessionId,b.id);json(res,201,b);
  });return;
 }
 const battleRoute=path.match(/^\/api\/battles\/([0-9a-f-]{36})(?:\/(choice))?$/);
 if(battleRoute){
  const id=battleRoute[1],isChoice=!!battleRoute[2];
  if(req.method==='GET'&&!isChoice){routeAsync(res,async()=>{const b=await arena.load(id);json(res,b?200:404,b||{error:'Battaglia non trovata'});});return;}
  if(req.method==='POST'&&isChoice){routeAsync(res,async()=>json(res,200,await arena.choose(id,await readBody(req))));return;}
 }
 if(req.method==='GET'&&path==='/api/chat'){
  routeAsync(res,async()=>{const id=url.searchParams.get('sessionId')||'demo';if(!validSession(id))throw Error('Sessione non valida');json(res,200,{messages:await loadChat(id)});});return;
 }
 if(req.method==='POST'&&path==='/api/replay'){
  routeAsync(res,async()=>{const {log,sessionId='demo'}=await readBody(req);if(!validSession(sessionId))throw Error('Sessione non valida');
   const summary=summarizeLog(log);replays.set(sessionId,summary);json(res,200,{...summary,verified:false,source:'manual-untrusted'});
  });return;
 }
 if(req.method==='POST'&&path==='/api/chat'){
  routeAsync(res,async()=>{
   const {message,sessionId='demo'}=await readBody(req);
   if(typeof message!=='string'||!message.trim()||message.length>5000||!validSession(sessionId))throw Error('Messaggio o sessione non valida');
   if(!process.env.OPENAI_API_KEY){json(res,503,{error:'Master AI non configurato: impostare OPENAI_API_KEY sul server.'});return;}
   const history=await loadChat(sessionId),matchId=sessionBattles.get(sessionId);
   const actual=matchId?await arena.load(matchId):null;
   const technical=actual?.status==='complete'?summarizeLog(actual.publicLog||actual.log||''):null;
   const imported=replays.get(sessionId);
   const context=technical?'\nRisultato Showdown verificato dal server. Log pubblico completo: '+String(actual.publicLog||actual.log).slice(-20000):
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
