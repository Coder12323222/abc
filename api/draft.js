function safe(x=''){return String(x).slice(0,2000)}
function fallback(item){
  const title=safe(item.title||'Trending creator moment');
  const category=safe(item.category||'Creator');
  return `HOOK\n${safe(item.hook)||`Everyone is talking about this ${category.toLowerCase()} moment — but here is the part people missed.`}\n\nNARRATION ANGLE\nExplain what happened in your own words first, use only the minimum source footage needed, then add why the moment matters or what viewers are misunderstanding.\n\nSHORT SCRIPT\n“${title} is starting to get attention, but the real story is what happened around the clip. Here’s the context you need to know…”\n\nEDIT PLAN\n0–2s: Big on-screen hook.\n2–8s: Your narration + quick source visual.\n8–20s: Context and reaction.\n20–30s: Your takeaway/question.\nKeep captions large, cut dead air, avoid copyrighted music, and do not upload an unchanged source clip.\n\nTITLE\nThe Part Everyone Missed About This Moment\n\nCAPTION\nThe clip is going viral, but the context changes everything. What do you think? #shorts #creatornews #viral\n\nRISK NOTE\nUse this as commentary/transformative coverage, verify the original source, and do not assume fair use guarantees monetization.`
}
function authorized(req){const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();if(!expected)return true;return String(req.headers['x-hq-key']||'').trim()===expected}
function buildPrompt(item){return `You are the AI production assistant inside Clipping HQ. Turn this current story lead into an ORIGINAL, transformative vertical-video post pack. Do not encourage simple reposting. Keep source footage minimal and tell the creator to add original narration, context, criticism, analysis, or reaction. Avoid claiming fair use is guaranteed.\n\nStory title: ${safe(item.title)}\nCategory: ${safe(item.category)}\nWhy it may work: ${safe(item.why)}\nSuggested hook: ${safe(item.hook)}\nSource URL: ${safe(item.url)}\nRisk: ${safe(item.risk)}\n\nReturn these exact sections in plain text: HOOK, NARRATION ANGLE, SHORT SCRIPT, EDIT PLAN, TITLE, CAPTION, RISK NOTE. Keep the entire answer under 450 words.`}
function extractGemini(data){return (data?.candidates?.[0]?.content?.parts||[]).map(p=>typeof p?.text==='string'?p.text:'').join('\n').trim()}
async function fetchWithTimeout(url,options={},ms=12000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function tryGemini(prompt){
  if(!process.env.GEMINI_API_KEY)return null;
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const r=await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',
    headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.7,thinkingConfig:{thinkingBudget:0}}})
  },12000);
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error?.message||`Gemini error ${r.status}`);
  return extractGemini(data)
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const item=req.body||{};const prompt=buildPrompt(item);
  if(!process.env.GEMINI_API_KEY)return res.status(200).json({mode:'template',warning:'Gemini is not configured.',text:fallback(item)});
  try{
    const text=await tryGemini(prompt);
    if(text)return res.status(200).json({mode:'gemini',text});
    return res.status(200).json({mode:'template',warning:'Gemini returned no text.',text:fallback(item)});
  }catch(e){
    return res.status(200).json({mode:'template',warning:String(e?.message||e).slice(0,220),text:fallback(item)});
  }
}
