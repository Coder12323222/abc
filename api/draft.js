function safe(x=''){return String(x).slice(0,2000)}
function fallback(item){
  const title=safe(item.title||'Trending creator moment');
  const category=safe(item.category||'Creator');
  return `HOOK\n${safe(item.hook)||`Everyone is talking about this ${category.toLowerCase()} moment — but here is the part people missed.`}\n\nNARRATION ANGLE\nExplain what happened in your own words first, use only the minimum source footage needed, then add why the moment matters or what viewers are misunderstanding.\n\nSHORT SCRIPT\n“${title} is starting to get attention, but the real story is what happened around the clip. Here’s the context you need to know…”\n\nEDIT PLAN\n0–2s: Big on-screen hook.\n2–8s: Your narration + quick source visual.\n8–20s: Context and reaction.\n20–30s: Your takeaway/question.\nKeep captions large, cut dead air, avoid copyrighted music, and do not upload an unchanged source clip.\n\nTITLE\nThe Part Everyone Missed About This Moment\n\nCAPTION\nThe clip is going viral, but the context changes everything. What do you think? #shorts #creatornews #viral\n\nRISK NOTE\nUse this as commentary/transformative coverage, verify the original source, and do not assume fair use guarantees monetization.`
}
function authorized(req){const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();if(!expected)return true;return String(req.headers['x-hq-key']||'').trim()===expected}
function buildPrompt(item){return `You are the AI production assistant inside Clipping HQ. Turn this current story lead into an ORIGINAL, transformative vertical-video post pack. Do not encourage simple reposting. Keep source footage minimal and tell the creator to add original narration, context, criticism, analysis, or reaction. Avoid claiming fair use is guaranteed.\n\nStory title: ${safe(item.title)}\nCategory: ${safe(item.category)}\nWhy it may work: ${safe(item.why)}\nSuggested hook: ${safe(item.hook)}\nSource URL: ${safe(item.url)}\nRisk: ${safe(item.risk)}\n\nReturn these exact sections in plain text: HOOK, NARRATION ANGLE, SHORT SCRIPT, EDIT PLAN, TITLE, CAPTION, RISK NOTE. Keep the entire answer under 500 words.`}
function extractOpenAI(data){if(typeof data?.output_text==='string')return data.output_text;const parts=[];for(const item of data?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
function extractGemini(data){
  if(typeof data?.output_text==='string') return data.output_text;
  const parts=[];
  for(const step of data?.steps||[]){
    if(step?.type==='model_output'){
      for(const c of step?.content||[]){if(c?.type==='text'&&typeof c?.text==='string')parts.push(c.text)}
    }
  }
  return parts.join('\n').trim();
}
async function tryGemini(prompt){
  if(!process.env.GEMINI_API_KEY)return null;
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.GEMINI_MODEL||'gemini-3.7-flash',input:prompt,generation_config:{thinking_level:'low'}})
  });
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error?.message||`Gemini error ${r.status}`);
  return extractGemini(data)
}
async function tryOpenAI(prompt){
  if(!process.env.OPENAI_API_KEY)return null;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',input:prompt})});
  const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||`OpenAI error ${r.status}`);return extractOpenAI(data)
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const item=req.body||{};const prompt=buildPrompt(item);
  if(!process.env.GEMINI_API_KEY&&!process.env.OPENAI_API_KEY)return res.status(200).json({mode:'template',text:fallback(item)});
  let geminiError='';let openaiError='';
  if(process.env.GEMINI_API_KEY){try{const text=await tryGemini(prompt);if(text)return res.status(200).json({mode:'gemini',text})}catch(e){geminiError=String(e.message||e).slice(0,240)}}
  if(process.env.OPENAI_API_KEY){try{const text=await tryOpenAI(prompt);if(text)return res.status(200).json({mode:'openai',text})}catch(e){openaiError=String(e.message||e).slice(0,240)}}
  return res.status(200).json({mode:'template',warning:'AI providers unavailable; used template mode.',providerErrors:{gemini:geminiError||null,openai:openaiError||null},text:fallback(item)})
}
