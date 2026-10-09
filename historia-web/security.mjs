import {createHash} from 'node:crypto';

/**
 * Private-alpha perimeter. No user login exists: the unpredictable 160-bit
 * browser session code is still a bearer capability, NOT an account.
 */
const sha256=source=>"'sha256-"+createHash('sha256').update(source).digest('base64')+"'";
export function makeSecurityHeaders(html){
 const source=String(html);
 const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const style=source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
 if(!script||!style)throw Error('Inline assets missing for CSP');
 return Object.freeze({
  'content-security-policy':[
   "default-src 'none'",
   "script-src "+sha256(script),
   "style-src "+sha256(style),
   "img-src 'self' https://play.pokemonshowdown.com",
   "connect-src 'self'",
   "base-uri 'none'",
   "object-src 'none'",
   "frame-ancestors 'none'",
   "form-action 'self'"
  ].join('; '),
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'cross-origin-resource-policy':'same-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'cache-control':'no-store'
 });
}
export function isSameOriginMutation(req,{publicOrigin=process.env.HISTORIA_PUBLIC_ORIGIN}={}){
 const site=req.headers['sec-fetch-site'];
 if(site==='cross-site')return false;
 const origin=req.headers.origin;
 if(origin==null)return true; // non-browser, requires custom bearer header too
 if(typeof origin!=='string'||origin==='null')return false;
 const host=req.headers.host;
 if(!host&&!publicOrigin)return false;
 try{
  const trusted=new URL(publicOrigin||'http://'+host);
  return new URL(origin).origin===trusted.origin;
 }catch{return false;}
}
export function makeRateLimiter({windowMs=60000,clock=()=>Date.now(),maxKeys=8000}={}){
 const store=new Map();
 const limit=(key,capacity)=>{
  const now=clock();
  if(store.size>maxKeys){
   for(const [k,v] of store){if(now-v.started>=windowMs)store.delete(k);}
   if(store.size>maxKeys)store.delete(store.keys().next().value);
  }
  let hit=store.get(key);
  if(!hit||now-hit.started>=windowMs){hit={started:now,count:0};store.set(key,hit);}
  hit.count++;
  return {allowed:hit.count<=capacity,remaining:Math.max(0,capacity-hit.count),
   retryAfter:Math.max(1,Math.ceil((windowMs-(now-hit.started))/1000))};
 };
 return {
  check(req,path){
   // Never trust X-Forwarded-For: request IP comes from the actual socket.
   const ip=req.socket?.remoteAddress||'unknown';
   const general=limit('all:'+ip,1200);
   if(!general.allowed)return general;
   const method=req.method||'GET';
   const group=method==='POST'&&['/api/auth/login','/api/auth/register'].includes(path)?'auth':
    method==='POST'&&path==='/api/battles'?'create':
    method==='POST'&&path==='/api/chat'?'chat':
    method==='POST'&&path==='/api/replay'?'import':
    method==='POST'&&path.endsWith('/choice')?'choice':
    null;
   if(!group)return general;
   const capacities={auth:6,create:8,chat:8,import:20,choice:600};
   return limit(group+':'+ip,capacities[group]);
  }
 };
}
export function privateJsonHeaders(){
 return {'content-type':'application/json; charset=utf-8'};
}
