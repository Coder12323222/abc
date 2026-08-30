export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({aiConfigured:Boolean(process.env.OPENAI_API_KEY),youtubeConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),tiktokConfigured:Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET),instagramConfigured:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET)});
}
