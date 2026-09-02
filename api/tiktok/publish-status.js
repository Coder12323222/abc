import {authorized,refreshIfNeeded} from './_lib.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const publishId=String(req.query?.publishId||'').trim();
  if(!publishId)return res.status(400).json({error:'A TikTok publish ID is required.'});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(401).json({error:'TikTok is not connected.'});
  try{
    const r=await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({publish_id:publishId})});
    const d=await r.json();const err=d?.error;
    if(!r.ok||(err?.code&&err.code!=='ok'))throw new Error(`${err?.message||`TikTok status failed (${r.status})`}${err?.code?` [${err.code}]`:''}`);
    return res.status(200).json({status:d?.data?.status||'PROCESSING_UPLOAD',failReason:d?.data?.fail_reason||'',uploadedBytes:d?.data?.uploaded_bytes||0});
  }catch(e){return res.status(400).json({error:String(e?.message||e).slice(0,300)})}
}
