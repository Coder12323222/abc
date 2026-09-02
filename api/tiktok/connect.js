import {authorized,REDIRECT_URI,signState} from '../../lib/tiktok.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const clientKey=(process.env.TIKTOK_CLIENT_KEY||'').trim();
  if(!clientKey||!process.env.TIKTOK_CLIENT_SECRET)return res.status(503).json({error:'TikTok credentials have not been added to Vercel yet.'});

  // Always request the two permissions Clipping HQ actually needs, even if an
  // older TIKTOK_SCOPES environment variable was saved without video.upload.
  const requested=new Set(
    String(process.env.TIKTOK_SCOPES||'')
      .split(/[\s,]+/)
      .map(x=>x.trim())
      .filter(Boolean)
  );
  requested.add('user.info.basic');
  requested.add('video.upload');
  const scopes=[...requested].join(',');

  const q=new URLSearchParams({
    client_key:clientKey,
    response_type:'code',
    scope:scopes,
    redirect_uri:REDIRECT_URI,
    state:signState()
  });
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({url:`https://www.tiktok.com/v2/auth/authorize/?${q.toString()}`,scopes:[...requested]});
}
