const searches=[
  ['Creators','YouTube creator viral OR streamer viral'],
  ['Streaming','Twitch streamer viral OR Kick streamer viral'],
  ['Gaming','gaming creator viral OR esports streamer'],
  ['Entertainment','celebrity interview viral OR podcast viral'],
  ['News','internet culture creator news viral']
];
function decode(s=''){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function between(txt,a,b){const s=txt.indexOf(a);if(s<0)return'';const e=txt.indexOf(b,s+a.length);return e<0?'':txt.slice(s+a.length,e)}
function age(pub){const d=new Date(pub);if(Number.isNaN(d.getTime()))return 'fresh';const h=Math.max(1,Math.round((Date.now()-d.getTime())/36e5));return h<24?`${h}h ago`:`${Math.round(h/24)}d ago`}
function hook(title){const clean=title.replace(/\s+-\s+[^-]+$/,'').trim();return `Everyone's talking about this: ${clean.length>82?clean.slice(0,79)+'…':clean}`}
export default async function handler(req,res){
  try{
    const batches=await Promise.all(searches.map(async([category,q])=>{
      const url=`https://news.google.com/rss/search?q=${encodeURIComponent(q+' when:2d')}&hl=en-US&gl=US&ceid=US:en`;
      const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 ClippingHQ/1.0'}});const xml=await r.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,4).map(m=>{const item=m[1];const title=decode(between(item,'<title>','</title>'));const link=decode(between(item,'<link>','</link>'));const pub=between(item,'<pubDate>','</pubDate>');return {title,url:link,category,age:age(pub),risk:category==='News'?'Medium':'Medium',why:'Fresh public story lead with strong short-form commentary potential. Verify the original source and add your own narration/context before posting.',hook:hook(title)}})
    }));
    const seen=new Set();const items=batches.flat().filter(x=>x.title&&x.url&&!seen.has(x.title)&&(seen.add(x.title),true)).slice(0,15);
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');res.status(200).json({generatedAt:new Date().toISOString(),items});
  }catch(e){res.status(500).json({error:'Scout unavailable',items:[]})}
}
