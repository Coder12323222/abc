import {authorized,clearTokenCookie,cookies,decrypt,refreshIfNeeded} from '../../lib/tiktok.js';

function hasVideoUploadScope(scope=''){
  return String(scope).split(/[\s,]+/).filter(Boolean).includes('video.upload');
}

export default async function handler(req,res){
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  if(req.method==='POST'||req.method==='DELETE'){
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
    clearTokenCookie(res);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,disconnected:true});
  }
  if(req.method!=='GET')return res.status(405).json({error:'GET, POST, or DELETE only'});
  const configured=Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET);
  if(!configured)return res.status(200).json({configured:false,connected:false,uploadAuthorized:false});
  const token=await refreshIfNeeded(req,res);
  if(!token)return res.status(200).json({configured:true,connected:false,uploadAuthorized:false});
  return res.status(200).json({
    configured:true,
    connected:true,
    uploadAuthorized:hasVideoUploadScope(token.scope||''),
    displayName:token.display_name||'TikTok'
  });
}
