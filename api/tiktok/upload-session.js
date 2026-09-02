import {authorized,refreshIfNeeded} from '../../lib/tiktok.js';

function hasVideoUploadScope(scope=''){
  return String(scope).split(/[\s,]+/).filter(Boolean).includes('video.upload');
}

function hasVideoPublishScope(scope=''){
  return String(scope).split(/[\s,]+/).filter(Boolean).includes('video.publish');
}

async function creatorInfo(accessToken){
  const r=await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{
    method:'POST',
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json; charset=UTF-8'}
  });
  const d=await r.json();
  const err=d?.error;
  if(!r.ok||(err?.code&&err.code!=='ok')){
    const code=err?.code?' ['+err.code+']':'';
    throw new Error((err?.message||('TikTok creator info failed ('+r.status+')'))+code);
  }
  return d?.data||{};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(401).json({error:'TikTok is not connected. Reconnect TikTok first.'});
  const {contentType,contentLength,directPost,title,privacyLevel,disableComment,disableDuet,disableStitch}=req.body||{};
  const direct=directPost===true;
  if(direct){
    if(!hasVideoPublishScope(token.scope||''))return res.status(403).json({error:'TikTok Direct Post permission is missing. Reconnect TikTok and approve video.publish.'});
  }else if(!hasVideoUploadScope(token.scope||''))return res.status(403).json({error:'TikTok is connected for profile access, but video.upload permission is missing. Reconnect TikTok and approve video upload access. If TikTok does not offer that permission, enable Content Posting API + video.upload for the TikTok developer app first.'});
  const size=Number(contentLength||0);
  const allowed=['video/mp4','video/quicktime','video/webm'];
  const type=allowed.includes(contentType)?contentType:'video/mp4';
  if(!Number.isFinite(size)||size<=0)return res.status(400).json({error:'Invalid video size.'});
  if(size>64*1024*1024)return res.status(400).json({error:'For this first TikTok uploader, use a video 64 MB or smaller.'});
  try{
    let endpoint='https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
    let payload={source_info:{source:'FILE_UPLOAD',video_size:size,chunk_size:size,total_chunk_count:1}};
    if(direct){
      const creator=await creatorInfo(token.access_token);
      const privacyLevels=Array.isArray(creator.privacy_level_options)?creator.privacy_level_options:[];
      if(!privacyLevels.includes(privacyLevel))return res.status(400).json({error:'Choose one of the privacy options currently allowed by your TikTok account.'});
      endpoint='https://open.tiktokapis.com/v2/post/publish/video/init/';
      payload={
        post_info:{
          title:String(title||'').slice(0,2200),
          privacy_level:privacyLevel,
          disable_comment:Boolean(disableComment)||Boolean(creator.comment_disabled),
          disable_duet:Boolean(disableDuet)||Boolean(creator.duet_disabled),
          disable_stitch:Boolean(disableStitch)||Boolean(creator.stitch_disabled),
          video_cover_timestamp_ms:1000
        },
        source_info:{source:'FILE_UPLOAD',video_size:size,chunk_size:size,total_chunk_count:1}
      };
    }
    const r=await fetch(endpoint,{
      method:'POST',
      headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json; charset=UTF-8'},
      body:JSON.stringify(payload)
    });
    const d=await r.json();
    const err=d?.error;
    if(!r.ok||(err?.code&&err.code!=='ok')){
      const code=err?.code?` [${err.code}]`:'';
      throw new Error(`${err?.message||`TikTok upload init failed (${r.status})`}${code}`);
    }
    const uploadUrl=d?.data?.upload_url;
    const publishId=d?.data?.publish_id;
    if(!uploadUrl)throw new Error('TikTok did not return an upload URL. Make sure Content Posting API and video.upload are enabled, then reconnect TikTok.');
    return res.status(200).json({uploadUrl,publishId,contentType:type,size,mode:direct?'direct':'inbox'});
  }catch(e){
    return res.status(400).json({error:String(e?.message||e).slice(0,300)});
  }
}
