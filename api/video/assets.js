function authorized(req){
  const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();
  if(!expected)return true;
  return String(req.headers['x-hq-key']||'').trim()===expected;
}

function queryWords(value=''){
  const stop=new Set(['this','that','with','from','your','what','when','where','about','into','here','there','video','story','today','short']);
  return String(value).toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s-]/g,' ')
    .split(/\s+/).filter(x=>x.length>2&&!stop.has(x)).slice(0,7).join(' ')||'trending news';
}

async function pexelsAssets(query){
  const key=(process.env.PEXELS_API_KEY||'').trim();
  if(!key)return [];
  const url=`https://api.pexels.com/videos/search?orientation=portrait&size=medium&per_page=6&query=${encodeURIComponent(query)}`;
  const r=await fetch(url,{headers:{Authorization:key}});if(!r.ok)return [];
  const d=await r.json();
  return (d.videos||[]).map(v=>{
    const files=(v.video_files||[]).filter(f=>f.link&&f.width&&f.height).sort((a,b)=>Math.abs((a.width||720)-720)-Math.abs((b.width||720)-720));
    const file=files.find(f=>f.height>f.width&&f.quality!=='uhd')||files[0];
    if(!file)return null;
    return {type:'video',url:file.link,poster:v.image||'',sourceUrl:v.url||'',creator:v.user?.name||'Pexels creator',provider:'Pexels'};
  }).filter(Boolean).slice(0,4);
}

async function commonsAssets(query){
  // Commons search becomes overly strict when every narration keyword is used.
  // Two strong title words produce relevant, reusable fallback art much more reliably.
  const broad=query.split(/\s+/).slice(0,2).join(' ');
  const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:`${broad} filetype:bitmap`,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'900',format:'json',origin:'*'});
  const r=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'ClippingHQ/1.0'}});if(!r.ok)return [];
  const d=await r.json();
  return Object.values(d?.query?.pages||{}).map(p=>{
    const info=p.imageinfo?.[0]||{};const meta=info.extmetadata||{};const url=info.thumburl||info.url;
    if(!url)return null;
    return {type:'image',url,poster:url,sourceUrl:info.descriptionurl||'',creator:String(meta.Artist?.value||'Wikimedia Commons').replace(/<[^>]+>/g,'').slice(0,90),provider:'Wikimedia Commons'};
  }).filter(Boolean).slice(0,4);
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!authorized(req))return res.status(401).json({error:'Invalid Clipping HQ access key'});
  const query=queryWords(`${req.body?.title||''} ${req.body?.script||''}`);
  try{
    let assets=await pexelsAssets(query);
    if(!assets.length)assets=await commonsAssets(query);
    res.setHeader('Cache-Control','private, max-age=300');
    return res.status(200).json({query,assets,provider:assets[0]?.provider||'motion-graphics'});
  }catch(e){return res.status(200).json({query,assets:[],provider:'motion-graphics',warning:String(e?.message||e).slice(0,160)})}
}
