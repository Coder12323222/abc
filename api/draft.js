function safe(x=''){return String(x).slice(0,2000)}
function fallback(item){
  const title=safe(item.title||'Trending creator moment');
  return `HOOK\n${safe(item.hook)||'Here is the part everyone missed.'}\n\nNARRATION ANGLE\nExplain what happened in your own words, add context and your own reaction, and use only the minimum source footage needed.\n\nSHORT SCRIPT\n“${title} is getting attention, but the real story is the context around the clip. Here’s what you need to know…”\n\nEDIT PLAN\n0–2s: Big on-screen hook.\n2–8s: Your narration + quick source visual.\n8–20s: Context and reaction.\n20–30s: Your takeaway/question.\n\nTITLE\nThe Part Everyone Missed About This Moment\n\nCAPTION\nThe clip is going viral, but the context changes everything. What do you think? #shorts #creatornews #viral\n\nRISK NOTE\nVerify the source, add substantial original commentary, and do not assume fair use guarantees monetization.`
}
function authorized(req){const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();if(!expected)return true;return String(req.headers['x-hq-key']||'').trim()===expected}
function buildPrompt(item){return `Create an ORIGINAL transformative short-form video post pack from this story lead. Do not encourage simple reposting. Add narration, context, analysis or reaction. Return exactly these sections: HOOK, NARRATION ANGLE, SHORT SCRIPT, EDIT PLAN, TITLE, CAPTION, RISK NOTE. Keep it under 450 words.\n\nTitle: ${safe(item.title)}\nCategory: ${safe(item.category)}\nWhy it may work: ${safe(item.why)}\nSuggested hook: ${safe(item.hook)}\nSource: ${safe(item.url)}\nRisk: ${safe(item.risk)}`}
function extractText(data){const parts=[];for(const step of data?.steps||[]){if(step?.type==='model_output'){for(const c of step?.content||[]){if(c?.type==='text'&&typeof c?.text==='string')parts.push(c.text)}}}return parts.join('\n').trim()}
async function fetchWithTimeout(url,options={},ms=14000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function tryGemini(prompt){
  const key=process.env.GEMINI_API_KEY;if(!key)return null;
  const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
  const r=await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
    body:JSON.stringify({model,input:prompt})
  });
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error?.message||`Gemini error ${r.status}`);
  const text=extractText(data);
  if(!text)throw new Error(`Gemini returned no text (status: ${data?.status||'unknown'})`);
  return text
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const item=req.body||{};
  if(!process.env.GEMINI_API_KEY)return res.status(200).json({mode:'template',warning:'Gemini is not configured.',text:fallback(item)});
  try{const text=await tryGemini(buildPrompt(item));return res.status(200).json({mode:'gemini',text})}
  catch(e){const warning=String(e?.message||e).slice(0,240);return res.status(200).json({mode:'template',warning,text:fallback(item)})}
}
