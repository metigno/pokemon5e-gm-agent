import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const port = Number(process.env.PORT || 3000);
const html = await readFile(new URL('./index.html',root));
const sessions = new Map();
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
const readBody=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>50000)throw Error('Payload troppo grande');}return JSON.parse(s);};
export function summarizeLog(log){
 if(typeof log!=='string'||log.length>40000)throw Error('Log non valido');
 const lines=log.split(/\r?\n/), events=[];
 for(const line of lines){
  const p=line.split('|'); const turn=p[1]==='turn'?Number(p[2]):null;
  if(turn!==null&&Number.isFinite(turn))events.push({type:'turn',turn});
  if(['move','switch','faint','-mega','-dynamax','win'].includes(p[1]))events.push({type:p[1],actor:p[2]||'',detail:p[3]||''});
 }
 return {turns:events.filter(x=>x.type==='turn').length,winner:events.findLast(x=>x.type==='win')?.actor||null,events};
}
export function handler(req,res){
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;}
 if(req.method==='GET'&&url.pathname==='/api/status'){json(res,200,{app:'Pokémon Historia Web',aiConfigured:!!process.env.OPENAI_API_KEY,showdownIntegrated:false,persistence:'memory-demo'});return;}
 if(req.method==='POST'&&url.pathname==='/api/replay'){
  readBody(req).then(({log})=>json(res,200,summarizeLog(log))).catch(e=>json(res,400,{error:e.message}));return;
 }
 if(req.method==='POST'&&url.pathname==='/api/chat'){
  readBody(req).then(async ({message,sessionId='demo'})=>{
   if(typeof message!=='string'||!message.trim()||message.length>5000)throw Error('Messaggio non valido');
   if(!process.env.OPENAI_API_KEY){json(res,503,{error:'Master AI non configurato: impostare OPENAI_API_KEY sul server.'});return;}
   const history=sessions.get(sessionId)||[];
   const messages=[{role:'system',content:'Sei Pokémon Historia, Master narrativo dei Mondiali Pokémon. La lore storica arriva al 2056, il torneo successivo è il 2060. Non inventare esiti di battaglie o log Showdown. Mantieni atmosfera da Champions League, analisi tecnica prudente e distingui fatti da ipotesi.'},...history.slice(-16),{role:'user',content:message}];
   const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',messages})});
   const data=await response.json();
   if(!response.ok)throw Error('API OpenAI: '+(data.error?.message||response.status));
   const answer=data.choices?.[0]?.message?.content;
   if(typeof answer!=='string')throw Error('Risposta AI vuota');
   sessions.set(sessionId,[...history,{role:'user',content:message},{role:'assistant',content:answer}].slice(-20));
   json(res,200,{answer});
  }).catch(e=>json(res,400,{error:e.message}));return;
 }
 json(res,404,{error:'Non trovato'});
}
if(process.argv[1]===fileURLToPath(import.meta.url))http.createServer(handler).listen(port,()=>console.log('Historia Web su http://localhost:'+port));
