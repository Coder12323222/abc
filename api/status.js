export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({
    ok:true,
    aiConfigured:Boolean(process.env.OPENAI_API_KEY),
    accessKeyRequired:Boolean(process.env.CLIPPING_HQ_ACCESS_KEY),
    model:process.env.OPENAI_API_KEY?(process.env.OPENAI_MODEL||'gpt-5-mini'):null,
    youtubeConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),
    tiktokConfigured:Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET),
    instagramConfigured:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET)
  });
}
