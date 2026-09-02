import {authorized,clearTokenCookie,cookies,decrypt,refreshIfNeeded} from '../../lib/tiktok.js';

function hasVideoUploadScope(scope=''){
  return String(scope).split(/[\s,]+/).filter(Boolean).includes('video.upload');
}

function hasVideoPublishScope(scope=''){
  return String(scope).split(/[\s,]+/).filter(Boolean).includes('video.publish');
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
  if(!configured)return res.status(200).json({configured:false,connected:false,uploadAuthorized:false,directPostAuthorized:false});
  const token=await refreshIfNeeded(req,res);
  if(!token)return res.status(200).json({configured:true,connected:false,uploadAuthorized:false,directPostAuthorized:false});
  const uploadAuthorized=hasVideoUploadScope(token.scope||'');
  const directPostAuthorized=hasVideoPublishScope(token.scope||'');
  if(req.query?.creator==='1'){
    if(!directPostAuthorized)return res.status(403).json({error:'TikTok Direct Post permission is missing. Reconnect TikTok and approve video.publish.',configured:true,connected:true,uploadAuthorized,directPostAuthorized:false});
    try{
      const r=await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{
        method:'POST',
        headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json; charset=UTF-8'}
      });
      const d=await r.json();
      const err=d?.error;
      if(!r.ok||(err?.code&&err.code!=='ok')){
        const code=err?.code?' ['+err.code+']':'';
        throw new Error((err?.message||('TikTok creator info failed ('+r.status+')'))+code);
      }
      const creator=d?.data||{};
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json({
        configured:true,
        connected:true,
        uploadAuthorized,
        directPostAuthorized:true,
        displayName:creator.creator_nickname||token.display_name||'TikTok',
        creator:{
          username:creator.creator_username||'',
          privacyLevels:Array.isArray(creator.privacy_level_options)?creator.privacy_level_options:[],
          commentDisabled:Boolean(creator.comment_disabled),
          duetDisabled:Boolean(creator.duet_disabled),
          stitchDisabled:Boolean(creator.stitch_disabled),
          maxDuration:Number(creator.max_video_post_duration_sec||0)
        }
      });
    }catch(e){
      return res.status(400).json({error:String(e?.message||e).slice(0,300),configured:true,connected:true,uploadAuthorized,directPostAuthorized:true});
    }
  }
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    configured:true,
    connected:true,
    uploadAuthorized,
    directPostAuthorized,
    displayName:token.display_name||'TikTok'
  });
}
