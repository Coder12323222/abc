import {authorized,cookies,decrypt} from './_lib.js';

function clearTikTokCookie(res){
  res.setHeader('Set-Cookie','chq_tiktok=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});

  const token=decrypt(cookies(req).chq_tiktok||'');
  try{
    if(token?.access_token&&process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET){
      const body=new URLSearchParams({
        client_key:process.env.TIKTOK_CLIENT_KEY,
        client_secret:process.env.TIKTOK_CLIENT_SECRET,
        token:token.access_token
      });
      await fetch('https://open.tiktokapis.com/v2/oauth/revoke/',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','Cache-Control':'no-cache'},
        body
      });
    }
  }catch{}

  clearTikTokCookie(res);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ok:true,disconnected:true});
}
