import {BASE_URL,REDIRECT_URI,setTokenCookie,verifyState} from '../../lib/tiktok.js';

export default async function handler(req,res){
  const {code,state,error,error_description}=req.query||{};
  if(error)return res.redirect(`${BASE_URL}/?tiktok=error&reason=${encodeURIComponent(String(error_description||error))}`);
  if(!code||!verifyState(state))return res.status(400).send('Invalid or expired TikTok authorization request.');
  try{
    const body=new URLSearchParams({
      client_key:process.env.TIKTOK_CLIENT_KEY||'',
      client_secret:process.env.TIKTOK_CLIENT_SECRET||'',
      code:String(code),
      grant_type:'authorization_code',
      redirect_uri:REDIRECT_URI
    });
    const tr=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const td=await tr.json();
    if(!tr.ok||td?.error)throw new Error(td?.error_description||td?.error?.message||td?.error||'TikTok token exchange failed');
    const accessToken=td.access_token;
    const ur=await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',{headers:{Authorization:`Bearer ${accessToken}`}});
    const ud=await ur.json();
    if(!ur.ok||ud?.error?.code&&ud.error.code!=='ok')throw new Error(ud?.error?.message||'Could not read TikTok profile');
    const user=ud?.data?.user||{};
    setTokenCookie(res,{
      access_token:accessToken,
      refresh_token:td.refresh_token||null,
      expires_at:Date.now()+(td.expires_in||86400)*1000,
      refresh_expires_at:Date.now()+(td.refresh_expires_in||31536000)*1000,
      scope:td.scope||'',
      open_id:td.open_id||user.open_id||null,
      display_name:user.display_name||'TikTok'
    });
    return res.redirect(`${BASE_URL}/?tiktok=connected`);
  }catch(e){
    return res.status(500).send(`TikTok connection failed: ${String(e?.message||e).slice(0,220)}`);
  }
}
