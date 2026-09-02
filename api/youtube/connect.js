import {authorized,REDIRECT_URI,signState} from '../../lib/youtube.js';

export default function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET){
    return res.status(409).json({error:'YouTube OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.'});
  }
  const p=new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID,
    redirect_uri:REDIRECT_URI,
    response_type:'code',
    scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload',
    access_type:'offline',
    include_granted_scopes:'true',
    prompt:'consent',
    state:signState()
  });
  res.status(200).json({url:`https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`});
}
