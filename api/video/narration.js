function authorized(req){const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();if(!expected)return true;return String(req.headers['x-hq-key']||'').trim()===expected}
function findAudio(x){
  if(!x)return null;
  if(Array.isArray(x)){for(const v of x){const r=findAudio(v);if(r)return r}return null}
  if(typeof x==='object'){
    if(typeof x.data==='string'&&(x.type==='audio'||String(x.mime_type||x.mimeType||'').startsWith('audio')))return x.data;
    for(const k of Object.keys(x)){const r=findAudio(x[k]);if(r)return r}
  }
  return null
}
function wavFromPcm(pcm,rate=24000,channels=1,bits=16){
  const header=Buffer.alloc(44);const blockAlign=channels*bits/8;const byteRate=rate*blockAlign;
  header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(byteRate,28);header.writeUInt16LE(blockAlign,32);header.writeUInt16LE(bits,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm])
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const key=(process.env.GEMINI_API_KEY||'').trim();if(!key)return res.status(503).json({error:'Gemini is not configured.'});
  const text=String(req.body?.text||'').replace(/\s+/g,' ').trim().slice(0,5000);if(!text)return res.status(400).json({error:'Narration text is required.'});
  const prompt=`Create a clear, energetic social-video narration. Speak naturally, confidently, and conversationally at a brisk but understandable pace. Read ONLY the transcript after TRANSCRIPT. Do not read these directions aloud.\n\nTRANSCRIPT:\n${text}`;
  try{
    const c=new AbortController();const t=setTimeout(()=>c.abort(),40000);
    let r;try{r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',signal:c.signal,headers:{'x-goog-api-key':key,'Content-Type':'application/json','Api-Revision':'2026-05-20'},body:JSON.stringify({model:'gemini-3.1-flash-tts-preview',input:prompt,response_format:{type:'audio'},generation_config:{speech_config:[{voice:'Puck'}]}})})}finally{clearTimeout(t)}
    const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||`Gemini TTS error ${r.status}`);
    const b64=findAudio(d);if(!b64)throw new Error('Gemini TTS returned no audio.');
    const wav=wavFromPcm(Buffer.from(b64,'base64'));
    res.setHeader('Content-Type','audio/wav');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',String(wav.length));return res.status(200).end(wav)
  }catch(e){return res.status(500).json({error:String(e?.message||e).slice(0,280)})}
}
