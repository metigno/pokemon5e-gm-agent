import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { GmSession } from './session.mjs';

function authorized(req, token) {
 const provided = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
 const a = Buffer.from(provided), b = Buffer.from(token);
 return a.length === b.length && timingSafeEqual(a,b);
}
async function jsonBody(req) {
 let raw = '';
 for await (const chunk of req) {
  raw += chunk;
  if (raw.length > 128 * 1024) throw Object.assign(new Error('Body too large'),{status:413});
 }
 return JSON.parse(raw || '{}');
}
function reply(res, status, payload) {
 res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify(payload));
}
export function createGmServer({ root, token }) {
 if (!token || token.length < 24) throw new Error('GM_API_TOKEN must have at least 24 characters');
 const gm = new GmSession(root);
 return createServer(async (req,res) => {
  if (!authorized(req,token)) return reply(res,401,{error:'Unauthorized'});
  try {
   const url = new URL(req.url,'http://localhost');
   if (req.method === 'POST' && url.pathname === '/api/gm/campaigns') {
    const { protagonist, campaignId } = await jsonBody(req);
    return reply(res,201,await gm.start(protagonist,campaignId));
   }
   const match = /^\/api\/gm\/campaigns\/([a-zA-Z0-9_-]{1,64})(?:\/actions)?$/.exec(url.pathname);
   if (!match) return reply(res,404,{error:'Not found'});
   if (req.method === 'GET' && !url.pathname.endsWith('/actions')) {
    const saved = await gm.get(match[1]);
    return reply(res,saved ? 200 : 404,saved ?? {error:'Campaign not found'});
   }
   if (req.method === 'POST' && url.pathname.endsWith('/actions')) {
    const { expectedRevision, ...action } = await jsonBody(req);
    if (!Number.isSafeInteger(expectedRevision)) return reply(res,400,{error:'expectedRevision required'});
    return reply(res,200,await gm.record(match[1],expectedRevision,action));
   }
   return reply(res,405,{error:'Method not allowed'});
  } catch(error) {
   const status = error.status ?? (/conflict/i.test(error.message) ? 409 : /not found/i.test(error.message) ? 404 : 400);
   return reply(res,status,{error:error.message});
  }
 });
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
 const port = Number(process.env.GM_PORT || 8787);
 const host = process.env.GM_HOST || '127.0.0.1';
 createGmServer({root:process.env.GM_SAVE_DIR || './.gm-live-saves',token:process.env.GM_API_TOKEN})
  .listen(port,host,()=>console.log('GM API listening on '+host+':'+port));
}
