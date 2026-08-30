function safe(x=''){return String(x).slice(0,2000)}
function fallback(item){
  const title=safe(item.title||'Trending creator moment');
  const category=safe(item.category||'Creator');
  return `HOOK\n${safe(item.hook)||`Everyone is talking about this ${category.toLowerCase()} moment — but here is the part people missed.`}\n\nNARRATION ANGLE\nExplain what happened in your own words first, use only the minimum source footage needed, then add why the moment matters or what viewers are misunderstanding.\n\nSHORT SCRIPT\n“${title} is starting to get attention, but the real story is what happened around the clip. Here’s the context you need to know…”\n\nEDIT PLAN\n0–2s: Big on-screen hook.\n2–8s: Your narration + quick source visual.\n8–20s: Context and reaction.\n20–30s: Your takeaway/question.\nKeep captions large, cut dead air, avoid copyrighted music, and do not upload an unchanged source clip.\n\nTITLE\nThe Part Everyone Missed About This Moment\n\nCAPTION\nThe clip is going viral, but the context changes everything. What do you think? #shorts #creatornews #viral\n\nRISK NOTE\nUse this as commentary/transformative coverage, verify the original source, and do not assume fair use guarantees monetization.`
}

function extractText(data){
  if(data?.output_text) return data.output_text;
  const out=data?.output||[];
  const parts=[];
  for(const item of out){
    for(const c of item?.content||[]){if(c?.type==='output_text'&&c?.text)parts.push(c.text)}
  }
  return parts.join('\n').trim();
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  const item=req.body||{};
  if(!process.env.OPENAI_API_KEY){return res.status(200).json({mode:'template',text:fallback(item)})}
  try{
    const prompt=`You are the AI production assistant inside Clipping HQ. Turn this current story lead into an ORIGINAL, transformative vertical-video post pack. Do not encourage simple reposting. Keep source footage minimal and tell the creator to add original narration, context, criticism, analysis, or reaction. Avoid claiming fair use is guaranteed.\n\nStory title: ${safe(item.title)}\nCategory: ${safe(item.category)}\nWhy it may work: ${safe(item.why)}\nSuggested hook: ${safe(item.hook)}\nSource URL: ${safe(item.url)}\nRisk: ${safe(item.risk)}\n\nReturn these exact sections in plain text: HOOK, NARRATION ANGLE, SHORT SCRIPT, EDIT PLAN, TITLE, CAPTION, RISK NOTE. Keep the entire answer under 500 words.`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:prompt,store:false})});
    if(!r.ok){const detail=await r.text();throw new Error(detail.slice(0,500))}
    const data=await r.json();
    const text=extractText(data)||fallback(item);
    res.status(200).json({mode:'openai',text});
  }catch(e){res.status(200).json({mode:'template',warning:'AI API unavailable; used template mode.',text:fallback(item)})}
}
