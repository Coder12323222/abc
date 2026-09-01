import {authorized,refreshIfNeeded} from './_lib.js';

function safe(x='',max=5000){return String(x).slice(0,max)}
function hasUploadScope(scope=''){
  const scopes=String(scope).split(/\s+/).filter(Boolean);
  return scopes.includes('https://www.googleapis.com/auth/youtube.upload')||
    scopes.includes('https://www.googleapis.com/auth/youtube')||
    scopes.includes('https://www.googleapis.com/auth/youtube.force-ssl');
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(401).json({error:'Reconnect YouTube before uploading.'});
  if(!hasUploadScope(token.scope||''))return res.status(403).json({error:'YouTube is connected for viewing, but the upload permission is missing. Reconnect YouTube in Clipping HQ and approve video upload access.'});
  const {title,description,contentType,contentLength}=req.body||{};
  if(!title)return res.status(400).json({error:'A video title is required.'});
  const length=Number(contentLength||0);
  if(!Number.isFinite(length)||length<=0)return res.status(400).json({error:'Invalid video file size.'});
  const type=safe(contentType||'video/mp4',120);
  try{
    const r=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${token.access_token}`,
        'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Length':String(length),
        'X-Upload-Content-Type':type
      },
      body:JSON.stringify({
        snippet:{title:safe(title,100),description:safe(description,5000),categoryId:'22'},
        status:{privacyStatus:'private',selfDeclaredMadeForKids:false}
      })
    });
    const text=await r.text();
    if(!r.ok){let msg=text;try{msg=JSON.parse(text)?.error?.message||text}catch{};throw new Error(msg||`YouTube error ${r.status}`)}
    const uploadUrl=r.headers.get('location');
    if(!uploadUrl)throw new Error('YouTube did not return an upload session URL.');
    return res.status(200).json({uploadUrl,accessToken:token.access_token,privacyStatus:'private'});
  }catch(e){return res.status(500).json({error:String(e?.message||e).slice(0,300)})}
}
