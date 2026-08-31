import {authorized,refreshIfNeeded} from './_lib.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const configured=Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET);
  if(!configured)return res.status(200).json({configured:false,connected:false});
  const token=await refreshIfNeeded(req,res);
  if(!token)return res.status(200).json({configured:true,connected:false});
  return res.status(200).json({configured:true,connected:true,displayName:token.display_name||'TikTok'});
}
