const $=(s)=>document.querySelector(s); const $$=(s)=>[...document.querySelectorAll(s)];
let opportunities=[]; let queue=JSON.parse(localStorage.getItem('clipQueue')||'[]'); let currentPack=''; let currentPackIndex=-1; let publishIndex=-1;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function switchView(id){$$('.view').forEach(v=>v.classList.remove('active-view'));$('#'+id).classList.add('active-view');$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('.nav').forEach(n=>n.onclick=()=>switchView(n.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));
function escapeHtml(s=''){return String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function safeUrl(u=''){try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}}
function hqKey(){return localStorage.getItem('clippingHqAccessKey')||''}
async function apiFetch(url,options={},attempt=0){
  const headers={...(options.headers||{})};
  const key=hqKey();if(key)headers['x-hq-key']=key;
  const r=await fetch(url,{...options,headers});
  if(r.status===401&&attempt<2){
    localStorage.removeItem('clippingHqAccessKey');
    const entered=prompt(attempt===0?'Enter your Clipping HQ access key. This is NOT an AI provider API key.':'That key did not match. Re-enter your Clipping HQ access key.');
    if(entered&&entered.trim()){
      localStorage.setItem('clippingHqAccessKey',entered.trim());
      return apiFetch(url,options,attempt+1);
    }
  }
  return r;
}
async function apiFetchTimed(url,options={},ms=16000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{return await apiFetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
function card(x,i){return `<article class="clip-card"><div class="clip-meta"><span>${escapeHtml(x.category)} • ${escapeHtml(x.age)}</span><span class="risk">${escapeHtml(x.risk)} risk</span></div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.why)}</p><p class="hook"><b>HOOK:</b> ${escapeHtml(x.hook)}</p><div class="clip-actions"><a href="${safeUrl(x.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a><button onclick="saveClip(${i})">+ Queue</button></div></article>`}
function render(){ $('#opportunityCount').textContent=opportunities.length||'0'; $('#dashboardFeed').innerHTML=opportunities.slice(0,3).map(card).join('')||'<div class="loader">No fresh items found yet.</div>'; $('#scoutFeed').innerHTML=opportunities.map(card).join('')||'<div class="loader">No fresh items found yet.</div>'; renderQueue(); }
function renderQueue(){if(!queue.length){$('#queueList').className='queue-empty';$('#queueList').innerHTML='<div class="big-icon">▣</div><h3>No posts queued yet</h3><p>Save one of today\'s scout opportunities.</p><button class="primary" onclick="switchView(\'scout\')">Open Daily Scout</button>';return} $('#queueList').className='feed full';$('#queueList').innerHTML=queue.map((x,i)=>`<article class="clip-card"><div class="clip-meta"><span>${x.pack?'AI PACK READY':'QUEUED'}</span><span class="risk">${escapeHtml(x.risk)} risk</span></div><h3>${escapeHtml(x.title)}</h3><p class="hook"><b>DRAFT HOOK:</b> ${escapeHtml(x.hook)}</p><div class="clip-actions queue-actions"><a href="${safeUrl(x.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a><button class="ai-pack" onclick="generatePack(${i})">✦ AI Pack</button><button class="yt-upload" onclick="openPublish(${i})">▶ YouTube</button><button onclick="removeClip(${i})">Remove</button></div></article>`).join('')}
window.saveClip=(i)=>{if(!queue.some(q=>q.url===opportunities[i].url)){queue.push(opportunities[i]);localStorage.setItem('clipQueue',JSON.stringify(queue));renderQueue();toast('Added to approval queue ✓')}else toast('Already in your queue')};
window.removeClip=(i)=>{queue.splice(i,1);localStorage.setItem('clipQueue',JSON.stringify(queue));renderQueue()};
async function loadScout(){['#dashboardFeed','#scoutFeed'].forEach(id=>$(id).innerHTML='<div class="loader">Scanning current creator, streaming, gaming and entertainment stories…</div>');try{const r=await apiFetch('/api/scout'); if(!r.ok)throw new Error(); const d=await r.json();opportunities=d.items||[];render();toast('Fresh scout complete ✦')}catch(e){opportunities=[{title:'Live scout preview',url:'https://news.google.com/',category:'Creators',age:'now',risk:'Medium',why:'The live server scout will fill this dashboard with current public story leads.',hook:'This creator moment is starting to blow up — here’s the part everyone missed.'}];render();toast('Using preview data until live API is available')}}
window.generatePack=async(i)=>{const item=queue[i];currentPackIndex=i;$('#packModal').classList.add('open');$('#packModal').setAttribute('aria-hidden','false');$('#packTitle').textContent=item.title;$('#packBody').textContent='Generating your hook, script, edit plan and caption…';currentPack='';try{const r=await apiFetchTimed('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)},16000);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Request failed ${r.status}`);currentPack=d.text||'Could not generate a post pack.';$('#packBody').textContent=currentPack;if(d.mode==='gemini'){queue[i].pack=currentPack;localStorage.setItem('clipQueue',JSON.stringify(queue));renderQueue();toast('Gemini post pack ready ✦')}else{toast('Template post pack ready');if(d.warning)console.warn('AI:',d.warning)}}catch(e){currentPack=e.name==='AbortError'?'Gemini took too long, so I stopped the request. Try again once.':'AI drafting is not available yet. '+(e.message||'Check your setup.');$('#packBody').textContent=currentPack}};
function closePack(){$('#packModal').classList.remove('open');$('#packModal').setAttribute('aria-hidden','true')}
$('#closePack').onclick=closePack;$('#closePack2').onclick=closePack;$('#copyPack').onclick=async()=>{if(!currentPack)return;try{await navigator.clipboard.writeText(currentPack);toast('Post pack copied ✓')}catch{toast('Select the text and copy it manually')}};
$('#packModal').onclick=e=>{if(e.target.id==='packModal')closePack()};
$('#refreshScout').onclick=loadScout;$('#refreshScout2').onclick=loadScout;

function section(pack,label){
  if(!pack)return '';
  const names=['HOOK','NARRATION ANGLE','SHORT SCRIPT','EDIT PLAN','TITLE','CAPTION','RISK NOTE'];
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const others=names.filter(n=>n!==label).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const m=pack.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\n([\\s\\S]*?)(?=\\n(?:${others})\\s*\\n|$)`,'i'));
  return (m?.[1]||'').trim();
}
window.openPublish=(i)=>{
  const item=queue[i];publishIndex=i;
  const title=section(item.pack,'TITLE')||item.title||'Clipping HQ Short';
  const caption=section(item.pack,'CAPTION')||section(item.pack,'SHORT SCRIPT')||item.hook||'';
  $('#publishTitle').value=title.slice(0,100);
  $('#publishDescription').value=caption.slice(0,5000);
  $('#publishVideo').value='';
  $('#publishProgress').textContent='Ready to upload.';
  $('#startPublish').disabled=false;
  $('#publishModal').classList.add('open');$('#publishModal').setAttribute('aria-hidden','false');
};
function closePublish(){$('#publishModal').classList.remove('open');$('#publishModal').setAttribute('aria-hidden','true');publishIndex=-1}
$('#closePublish').onclick=closePublish;$('#cancelPublish').onclick=closePublish;$('#publishModal').onclick=e=>{if(e.target.id==='publishModal')closePublish()};
$('#startPublish').onclick=async()=>{
  const file=$('#publishVideo').files?.[0];
  const title=$('#publishTitle').value.trim();
  const description=$('#publishDescription').value.trim();
  const progress=$('#publishProgress');
  if(!file){progress.textContent='Choose your finished video file first.';return}
  if(!title){progress.textContent='Add a title first.';return}
  const allowed=['video/mp4','video/quicktime','video/webm'];
  if(file.type&&!allowed.includes(file.type)){progress.textContent='Use an MP4, MOV, or WebM video.';return}
  $('#startPublish').disabled=true;
  try{
    progress.textContent='Creating secure YouTube upload session…';
    const r=await apiFetch('/api/youtube/upload-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,description,contentType:file.type||'video/mp4',contentLength:file.size})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||`Could not start upload (${r.status})`);
    progress.textContent='Uploading video to YouTube… keep this tab open.';
    const up=await fetch(d.uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${d.accessToken}`,'Content-Type':file.type||'video/mp4'},body:file});
    const ud=await up.json().catch(()=>({}));
    if(!up.ok)throw new Error(ud?.error?.message||`YouTube upload failed (${up.status})`);
    const id=ud?.id;
    progress.innerHTML=id?`Uploaded successfully ✓<br><span>Video ID: ${escapeHtml(id)} • Privacy: Private</span>`:'Uploaded successfully ✓';
    toast('YouTube upload complete ✓');
    if(publishIndex>=0){queue[publishIndex].youtubeVideoId=id||null;localStorage.setItem('clipQueue',JSON.stringify(queue));renderQueue()}
  }catch(e){progress.textContent='Upload failed: '+(e.message||'Unknown error.');$('#startPublish').disabled=false}
};

async function connectYouTube(){
  try{
    const r=await apiFetch('/api/youtube/connect');
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'YouTube setup is not finished yet.');
    location.href=d.url;
  }catch(e){toast(e.message||'YouTube connection is not ready yet')}
}
async function loadYouTubeStatus(){
  try{
    const r=await apiFetch('/api/youtube/status');
    const d=await r.json().catch(()=>({}));
    const buttons=$$('.connect[data-platform="YouTube"]');
    const cards=$$('.platform.yt .status');
    if(d.connected){
      buttons.forEach(b=>{b.textContent=`✓ ${d.channelTitle||'YouTube connected'}`;b.classList.add('connected')});
      cards.forEach(s=>{s.textContent='Connected';s.classList.remove('setup');s.classList.add('good')});
    } else if(d.configured===false){
      buttons.forEach(b=>b.textContent='Finish YouTube setup');
    }
  }catch{}
}

async function connectTikTok(){
  try{
    const r=await apiFetch('/api/tiktok/connect');
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'TikTok setup is not finished yet.');
    location.href=d.url;
  }catch(e){toast(e.message||'TikTok connection is not ready yet')}
}
async function loadTikTokStatus(){
  try{
    const r=await apiFetch('/api/tiktok/status');
    const d=await r.json().catch(()=>({}));
    const buttons=$$('.connect[data-platform="TikTok"]');
    const cards=$$('.platform.tt .status');
    if(d.connected){
      buttons.forEach(b=>{b.textContent=`✓ ${d.displayName||'TikTok connected'}`;b.classList.add('connected')});
      cards.forEach(s=>{s.textContent='Connected';s.classList.remove('setup');s.classList.add('good')});
    } else if(d.configured===false){
      buttons.forEach(b=>b.textContent='Finish TikTok setup');
    }
  }catch{}
}

$$('.connect').forEach(b=>b.onclick=()=>{
  if(b.dataset.platform==='YouTube') return connectYouTube();
  if(b.dataset.platform==='TikTok') return connectTikTok();
  toast('Instagram is paused for now — YouTube and TikTok are the focus.');
});
async function loadStatus(){try{const r=await fetch('/api/status');const s=await r.json();const a=$('#aiMode');if(s.aiConfigured&&s.accessKeyRequired&&!hqKey()){a.textContent='AI: access key needed';a.classList.remove('good')}else{a.textContent=s.aiConfigured?`AI: ${s.aiProvider||s.model||'connected'} connected`:'AI: template mode';a.classList.toggle('good',s.aiConfigured)}}catch{$('#aiMode').textContent='AI: template mode'}}
const qs=new URLSearchParams(location.search);
if(qs.get('youtube')==='connected'){history.replaceState({},'',location.pathname);toast('YouTube connected ✓')}
if(qs.get('tiktok')==='connected'){history.replaceState({},'',location.pathname);toast('TikTok connected ✓')}
if(qs.get('tiktok')==='error'){toast('TikTok authorization was not completed')}
loadStatus();loadYouTubeStatus();loadTikTokStatus();loadScout();