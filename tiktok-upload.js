(()=>{
  function addTikTokButtons(){
    document.querySelectorAll('#queueList .clip-card').forEach((card,i)=>{
      const actions=card.querySelector('.queue-actions,.clip-actions');
      if(!actions||actions.querySelector('.tt-upload'))return;
      const b=document.createElement('button');
      b.className='tt-upload';b.textContent='♪ TikTok';b.type='button';
      b.onclick=()=>openTikTokUpload(i);
      const remove=[...actions.querySelectorAll('button')].find(x=>x.textContent.trim()==='Remove');
      actions.insertBefore(b,remove||null);
    });
  }

  const originalRenderQueue=window.renderQueue;
  if(typeof originalRenderQueue==='function'){
    window.renderQueue=function(){originalRenderQueue();addTikTokButtons()};
  }

  const modal=document.createElement('div');
  modal.id='ttPublishModal';modal.className='modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="modal-card publish-card"><div class="modal-head"><div><p class="eyebrow">TIKTOK UPLOAD</p><h2>Send finished video to TikTok</h2><p class="sub">Uploads as a TikTok draft so you can review it before posting.</p></div><button id="closeTtPublish" class="icon-btn">×</button></div><div class="publish-form"><label>Video file<input id="ttPublishVideo" type="file" accept="video/mp4,video/quicktime,video/webm,video/*"></label><label>Caption to use in TikTok<textarea id="ttPublishCaption" maxlength="2200" rows="6"></textarea></label><div class="notice"><b>Sandbox flow:</b> Clipping HQ sends the video to TikTok as a draft. TikTok will notify you in the app; open the notification, paste/review the caption, and finish posting.</div><div id="ttPublishProgress" class="publish-progress">Ready to upload.</div></div><div class="modal-actions"><button id="cancelTtPublish" class="ghost">Cancel</button><button id="startTtPublish" class="primary">♪ Upload draft to TikTok</button></div></div>`;
  document.body.insertBefore(modal,document.querySelector('#toast'));

  let ttIndex=-1;
  function closeTikTokUpload(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');ttIndex=-1}
  function openTikTokUpload(i){
    ttIndex=i;const item=queue[i]||{};
    const caption=(typeof section==='function'?(section(item.pack,'CAPTION')||section(item.pack,'HOOK')):'')||item.hook||item.title||'';
    document.querySelector('#ttPublishVideo').value='';
    document.querySelector('#ttPublishCaption').value=caption.slice(0,2200);
    document.querySelector('#ttPublishProgress').textContent='Ready to upload.';
    document.querySelector('#startTtPublish').disabled=false;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  }
  window.openTikTokUpload=openTikTokUpload;
  document.querySelector('#closeTtPublish').onclick=closeTikTokUpload;
  document.querySelector('#cancelTtPublish').onclick=closeTikTokUpload;
  modal.onclick=e=>{if(e.target===modal)closeTikTokUpload()};

  document.querySelector('#startTtPublish').onclick=async()=>{
    const file=document.querySelector('#ttPublishVideo').files?.[0];
    const progress=document.querySelector('#ttPublishProgress');
    const button=document.querySelector('#startTtPublish');
    if(!file){progress.textContent='Choose your finished video first.';return}
    const allowed=['video/mp4','video/quicktime','video/webm'];
    let type=file.type;
    if(!type){const n=file.name.toLowerCase();type=n.endsWith('.mov')?'video/quicktime':n.endsWith('.webm')?'video/webm':'video/mp4'}
    if(!allowed.includes(type)){progress.textContent='Use an MP4, MOV, or WebM video.';return}
    if(file.size>64*1024*1024){progress.textContent='For this first TikTok uploader, keep the video at 64 MB or less.';return}
    button.disabled=true;
    try{
      progress.textContent='Creating TikTok draft upload session…';
      const r=await apiFetch('/api/tiktok/upload-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentType:type,contentLength:file.size})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||`Could not start TikTok upload (${r.status})`);
      progress.textContent='Uploading video to TikTok… keep this tab open.';
      const up=await fetch(d.uploadUrl,{method:'PUT',headers:{'Content-Type':type,'Content-Range':`bytes 0-${file.size-1}/${file.size}`},body:file});
      if(!up.ok){const txt=await up.text().catch(()=>'');throw new Error(txt||`TikTok file upload failed (${up.status})`)}
      progress.innerHTML='TikTok draft uploaded ✓<br><span>Open TikTok → Inbox/notifications → review the uploaded video and finish posting.</span>';
      if(ttIndex>=0){queue[ttIndex].tiktokPublishId=d.publishId||null;localStorage.setItem('clipQueue',JSON.stringify(queue))}
      toast('TikTok draft upload complete ✓');
    }catch(e){
      const msg=e?.message||'Unknown error';
      progress.textContent='TikTok upload failed: '+msg;
      button.disabled=false;
    }
  };

  addTikTokButtons();
})();

// Force a real TikTok OAuth reset before reconnecting. This revokes the old
// TikTok token, clears Clipping HQ's TikTok cookie, then starts a brand-new
// authorization flow so TikTok can show the app + requested permissions again.
(()=>{
  const buttons=()=>[...document.querySelectorAll('.connect[data-platform="TikTok"]')];
  const statuses=()=>[...document.querySelectorAll('.platform.tt .status')];

  async function refreshTikTokConnectionUi(){
    try{
      const r=await apiFetch('/api/tiktok/status',{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(d.connected&&d.uploadAuthorized){
        buttons().forEach(b=>{b.textContent=`✓ ${d.displayName||'TikTok'} • upload ready`;b.classList.add('connected')});
        statuses().forEach(s=>{s.textContent='Upload ready';s.classList.remove('setup');s.classList.add('good')});
      }else if(d.connected){
        buttons().forEach(b=>{b.textContent='Reset + reconnect TikTok';b.classList.remove('connected')});
        statuses().forEach(s=>{s.textContent='Needs upload access';s.classList.add('setup');s.classList.remove('good')});
      }else if(d.configured===false){
        buttons().forEach(b=>{b.textContent='Finish TikTok setup';b.classList.remove('connected')});
        statuses().forEach(s=>{s.textContent='Setup';s.classList.add('setup');s.classList.remove('good')});
      }else{
        buttons().forEach(b=>{b.textContent='Connect TikTok';b.classList.remove('connected')});
        statuses().forEach(s=>{s.textContent='Not connected';s.classList.add('setup');s.classList.remove('good')});
      }
    }catch{}
  }

  async function resetAndReconnectTikTok(){
    const bs=buttons();
    bs.forEach(b=>{b.disabled=true;b.textContent='Resetting TikTok…'});
    try{
      const reset=await apiFetch('/api/tiktok/status',{method:'POST'});
      const rd=await reset.json().catch(()=>({}));
      if(!reset.ok)throw new Error(rd.error||`TikTok reset failed (${reset.status})`);
      toast('Old TikTok authorization cleared. Opening fresh TikTok consent…');
      const r=await apiFetch('/api/tiktok/connect',{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.url)throw new Error(d.error||'TikTok authorization could not start.');
      location.href=d.url;
    }catch(e){
      toast(e?.message||'TikTok reset failed');
      bs.forEach(b=>b.disabled=false);
      refreshTikTokConnectionUi();
    }
  }

  function wire(){buttons().forEach(b=>{b.onclick=resetAndReconnectTikTok;b.disabled=false})}
  wire();
  setTimeout(()=>{wire();refreshTikTokConnectionUi()},600);
  setTimeout(()=>{wire();refreshTikTokConnectionUi()},1800);
  window.resetAndReconnectTikTok=resetAndReconnectTikTok;
})();
