import {authorized,clearTokenCookie,refreshIfNeeded} from '../../lib/youtube.js';

function hasUploadScope(scope=''){
  const scopes=String(scope).split(/\s+/).filter(Boolean);
  return scopes.includes('https://www.googleapis.com/auth/youtube.upload')||
    scopes.includes('https://www.googleapis.com/auth/youtube')||
    scopes.includes('https://www.googleapis.com/auth/youtube.force-ssl');
}

async function resolveScope(token){
  if(hasUploadScope(token?.scope||''))return token.scope||'';
  try{
    const r=await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token.access_token)}`,{headers:{'Cache-Control':'no-cache'}});
    const d=await r.json();
    if(r.ok&&d?.scope)return String(d.scope);
  }catch{}
  return token?.scope||'';
}

export default async function handler(req,res){
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  if(req.method==='DELETE'){
    const token=await refreshIfNeeded(req,res);
    const value=token?.refresh_token||token?.access_token||'';
    let revoked=false;
    if(value){
      try{
        const body=new URLSearchParams({token:value});
        const r=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
        revoked=r.ok;
      }catch{}
    }
    clearTokenCookie(res);
    return res.status(200).json({disconnected:true,revoked});
  }
  if(req.method!=='GET')return res.status(405).json({error:'GET or DELETE only'});
  const configured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
  if(!configured)return res.status(200).json({configured:false,connected:false,uploadAuthorized:false});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(200).json({configured:true,connected:false,uploadAuthorized:false});
  try{
    const r=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${token.access_token}`}});
    const d=await r.json();
    if(!r.ok)return res.status(200).json({configured:true,connected:false,uploadAuthorized:false});
    const channel=d?.items?.[0];
    if(!channel)return res.status(200).json({configured:true,connected:false,uploadAuthorized:false});
    const resolvedScope=await resolveScope(token);
    const uploadAuthorized=hasUploadScope(resolvedScope);
    return res.status(200).json({configured:true,connected:true,uploadAuthorized,channelId:channel.id,channelTitle:channel.snippet?.title||token.channel_title||'YouTube'});
  }catch{return res.status(200).json({configured:true,connected:false,uploadAuthorized:false})}
}
