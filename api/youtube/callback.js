import {BASE_URL,REDIRECT_URI,setTokenCookie,verifyState} from './_lib.js';

export default async function handler(req,res){
  const {code,state,error}=req.query||{};
  if(error)return res.redirect(`${BASE_URL}/?youtube=error`);
  if(!code||!verifyState(state))return res.status(400).send('Invalid or expired YouTube authorization request.');
  try{
    const body=new URLSearchParams({
      code:String(code),
      client_id:process.env.GOOGLE_CLIENT_ID||'',
      client_secret:process.env.GOOGLE_CLIENT_SECRET||'',
      redirect_uri:REDIRECT_URI,
      grant_type:'authorization_code'
    });
    const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const td=await tr.json();
    if(!tr.ok)throw new Error(td?.error_description||td?.error||'Token exchange failed');
    const cr=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${td.access_token}`}});
    const cd=await cr.json();
    if(!cr.ok)throw new Error(cd?.error?.message||'Could not read YouTube channel');
    const channel=cd?.items?.[0];
    if(!channel)throw new Error('No YouTube channel was found on this Google account.');
    setTokenCookie(res,{
      access_token:td.access_token,
      refresh_token:td.refresh_token||null,
      expires_at:Date.now()+(td.expires_in||3600)*1000,
      channel_id:channel.id,
      channel_title:channel.snippet?.title||'YouTube'
    });
    return res.redirect(`${BASE_URL}/?youtube=connected`);
  }catch(e){
    return res.status(500).send(`YouTube connection failed: ${String(e?.message||e).slice(0,220)}`);
  }
}
