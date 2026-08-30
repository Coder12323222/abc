import {authorized,refreshIfNeeded} from './_lib.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const configured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
  if(!configured)return res.status(200).json({configured:false,connected:false});
  const token=await refreshIfNeeded(req,res);
  if(!token?.access_token)return res.status(200).json({configured:true,connected:false});
  try{
    const r=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${token.access_token}`}});
    const d=await r.json();
    if(!r.ok)return res.status(200).json({configured:true,connected:false});
    const channel=d?.items?.[0];
    if(!channel)return res.status(200).json({configured:true,connected:false});
    return res.status(200).json({configured:true,connected:true,channelId:channel.id,channelTitle:channel.snippet?.title||token.channel_title||'YouTube'});
  }catch{return res.status(200).json({configured:true,connected:false})}
}
