import {authorized,refreshIfNeeded} from './_lib.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(401).json({error:'TikTok is not connected. Reconnect TikTok first.'});
  const {contentType,contentLength}=req.body||{};
  const size=Number(contentLength||0);
  const allowed=['video/mp4','video/quicktime','video/webm'];
  const type=allowed.includes(contentType)?contentType:'video/mp4';
  if(!Number.isFinite(size)||size<=0)return res.status(400).json({error:'Invalid video size.'});
  if(size>64*1024*1024)return res.status(400).json({error:'For this first TikTok uploader, use a video 64 MB or smaller.'});
  try{
    const r=await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',{
      method:'POST',
      headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json; charset=UTF-8'},
      body:JSON.stringify({source_info:{source:'FILE_UPLOAD',video_size:size,chunk_size:size,total_chunk_count:1}})
    });
    const d=await r.json();
    const err=d?.error;
    if(!r.ok||(err?.code&&err.code!=='ok'))throw new Error(err?.message||`TikTok upload init failed (${r.status})`);
    const uploadUrl=d?.data?.upload_url;
    const publishId=d?.data?.publish_id;
    if(!uploadUrl)throw new Error('TikTok did not return an upload URL. Make sure Content Posting API and video.upload are enabled, then reconnect TikTok.');
    return res.status(200).json({uploadUrl,publishId,contentType:type,size});
  }catch(e){
    return res.status(400).json({error:String(e?.message||e).slice(0,300)});
  }
}
