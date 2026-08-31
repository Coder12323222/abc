(()=>{
  const videos=window.ClippingHQGeneratedVideos=new Map();
  const previewUrls=new Map();
  const queueEl=document.querySelector('#queueList');

  function itemKey(i){return queue?.[i]?.url||`item-${i}`}
  function getGenerated(i){return videos.get(itemKey(i))||null}
  function saveQueue(){localStorage.setItem('clipQueue',JSON.stringify(queue))}
  function sourceName(item){try{return new URL(item?.url||'').hostname.replace(/^www\./,'')}catch{return 'source lead'}}
  function cleanNarration(text=''){
    return String(text)
      .replace(/\((?:visual|on.?screen|b-roll|show)[^)]*\)/gi,' ')
      .replace(/\[(?:visual|on.?screen|b-roll|show)[^\]]*\]/gi,' ')
      .replace(/^[“”"']+|[“”"']+$/g,'')
      .replace(/\s+/g,' ').trim();
  }
  function splitPhrases(text){
    const parts=String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];
    const out=[];
    for(const p of parts){
      const words=p.trim().split(/\s+/);
      if(words.length<=13){if(p.trim())out.push(p.trim());continue}
      for(let i=0;i<words.length;i+=10)out.push(words.slice(i,i+10).join(' '));
    }
    return out.filter(Boolean);
  }
  function phraseAt(parts,p){
    if(!parts.length)return '';
    const weights=parts.map(x=>Math.max(1,x.length));const total=weights.reduce((a,b)=>a+b,0);let t=p*total,acc=0;
    for(let i=0;i<parts.length;i++){acc+=weights[i];if(t<=acc)return parts[i]}
    return parts[parts.length-1];
  }
  function wrapLines(ctx,text,maxWidth,maxLines=8){
    const words=String(text).split(/\s+/);const lines=[];let line='';
    for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;if(lines.length>=maxLines-1)break}else line=test}
    if(line&&lines.length<maxLines)lines.push(line);return lines;
  }
  function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function drawFrame(ctx,canvas,item,parts,p){
    const w=canvas.width,h=canvas.height,t=performance.now()/1000;
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#090b12');g.addColorStop(.48,'#17112d');g.addColorStop(1,'#071c24');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let n=0;n<4;n++){const x=w*(.15+.23*n)+Math.sin(t*.7+n)*45;const y=h*(.18+.19*n)+Math.cos(t*.55+n)*55;const rg=ctx.createRadialGradient(x,y,5,x,y,220);rg.addColorStop(0,n%2?'rgba(56,189,248,.19)':'rgba(139,92,246,.22)');rg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,w,h)}
    ctx.fillStyle='rgba(10,13,23,.76)';roundRect(ctx,44,48,w-88,74,24);ctx.fill();
    ctx.fillStyle='#bca7ff';ctx.font='800 25px Inter,Arial';ctx.fillText('CLIPPING HQ',72,94);
    ctx.fillStyle='#74e8bd';ctx.font='700 18px Inter,Arial';ctx.fillText('ORIGINAL COMMENTARY',w-272,92);

    ctx.font='800 48px Inter,Arial';ctx.fillStyle='#ffffff';const title=wrapLines(ctx,item?.title||'Today’s story',w-110,5);let ty=190;for(const line of title){ctx.fillText(line,55,ty);ty+=57}

    const phrase=phraseAt(parts,p);
    ctx.font='800 52px Inter,Arial';const lines=wrapLines(ctx,phrase,w-130,7);const boxH=Math.max(220,lines.length*66+90);const boxY=Math.min(h-430,Math.max(520,h*.48-boxH/2));ctx.fillStyle='rgba(9,11,18,.84)';roundRect(ctx,42,boxY,w-84,boxH,30);ctx.fill();ctx.strokeStyle='rgba(167,139,250,.42)';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#f8f9ff';let cy=boxY+74;for(const line of lines){ctx.fillText(line,66,cy);cy+=66}

    const src=`SOURCE LEAD: ${sourceName(item)}`.toUpperCase();ctx.fillStyle='#aab2c7';ctx.font='700 19px Inter,Arial';ctx.fillText(src,55,h-125);
    ctx.fillStyle='rgba(255,255,255,.13)';roundRect(ctx,55,h-82,w-110,12,6);ctx.fill();ctx.fillStyle='#8b5cf6';roundRect(ctx,55,h-82,(w-110)*Math.min(1,p),12,6);ctx.fill();
    ctx.fillStyle='#838da5';ctx.font='600 16px Inter,Arial';ctx.fillText('Context • narration • analysis — not a raw repost',55,h-45);
  }

  const modal=document.createElement('div');modal.id='videoMakerModal';modal.className='modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="modal-card publish-card"><div class="modal-head"><div><p class="eyebrow">AI VIDEO MAKER</p><h2>Build one video for both platforms</h2><p class="sub">Gemini narration + original motion graphics + timed captions.</p></div><button id="closeVideoMaker" class="icon-btn">×</button></div><div id="videoMakerBody" class="publish-form"><div id="videoMakerProgress" class="publish-progress">Ready.</div><div id="videoMakerPreview"></div><div class="notice"><b>Current testing flow:</b> the same generated file can be sent to YouTube as Private and TikTok as a Draft. Public auto-posting comes after each platform grants the required production approval.</div></div><div class="modal-actions"><button id="closeVideoMaker2" class="ghost">Close</button><button id="videoMakerBoth" class="primary" disabled>🚀 Send same video to both</button></div></div>`;
  document.body.insertBefore(modal,document.querySelector('#toast'));
  let activeIndex=-1;
  function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}
  document.querySelector('#closeVideoMaker').onclick=closeModal;document.querySelector('#closeVideoMaker2').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};

  function addButtons(){
    document.querySelectorAll('#queueList .clip-card').forEach((card,i)=>{
      const actions=card.querySelector('.queue-actions,.clip-actions');if(!actions)return;
      if(!actions.querySelector('.make-video')){const b=document.createElement('button');b.type='button';b.className='make-video';b.textContent='🎬 Make Video';b.onclick=()=>makeVideo(i);const yt=actions.querySelector('.yt-upload');actions.insertBefore(b,yt||null)}
      if(!actions.querySelector('.post-both')){const b=document.createElement('button');b.type='button';b.className='post-both';b.textContent='🚀 Both';b.onclick=()=>postBoth(i);const remove=[...actions.querySelectorAll('button')].find(x=>x.textContent.trim()==='Remove');actions.insertBefore(b,remove||null)}
      const ready=getGenerated(i);const both=actions.querySelector('.post-both');if(both){both.disabled=!ready;both.title=ready?'Send the generated file to YouTube and TikTok':'Make the video first'}
    })
  }
  if(queueEl)new MutationObserver(addButtons).observe(queueEl,{childList:true,subtree:true});

  async function fetchNarration(text){
    const c=new AbortController();const timer=setTimeout(()=>c.abort(),45000);
    try{const r=await apiFetch('/api/video/narration',{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||`Narration failed (${r.status})`)}return await r.arrayBuffer()}finally{clearTimeout(timer)}
  }
  async function renderVideo(item,narrationBuffer,progress){
    if(!window.MediaRecorder)throw new Error('This browser does not support video rendering. Use current Chrome or Edge.');
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Audio rendering is not supported in this browser.');
    const ac=new AC();await ac.resume();const audio=await ac.decodeAudioData(narrationBuffer.slice(0));
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const ctx=canvas.getContext('2d');
    const script=cleanNarration(section(item.pack,'SHORT SCRIPT')||item.hook||item.title);const parts=splitPhrases(script);
    const canvasStream=canvas.captureStream(30);const dest=ac.createMediaStreamDestination();const src=ac.createBufferSource();src.buffer=audio;src.connect(dest);
    const stream=new MediaStream([...canvasStream.getVideoTracks(),...dest.stream.getAudioTracks()]);
    const candidates=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];const mime=candidates.find(x=>MediaRecorder.isTypeSupported(x))||'';
    const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:2200000,audioBitsPerSecond:128000}:{videoBitsPerSecond:2200000});const chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    let raf=0,ended=false;const started=performance.now();
    function frame(){const p=Math.min(1,(performance.now()-started)/(audio.duration*1000));drawFrame(ctx,canvas,item,parts,p);if(!ended)raf=requestAnimationFrame(frame)}
    const done=new Promise((resolve,reject)=>{rec.onerror=e=>reject(e.error||new Error('Video recorder failed'));rec.onstop=()=>resolve(new Blob(chunks,{type:mime||'video/webm'}))});
    rec.start(1000);frame();src.start();progress.textContent=`Rendering ${Math.max(1,Math.round(audio.duration))} seconds of vertical video… keep this tab open.`;
    await new Promise(resolve=>{src.onended=()=>{ended=true;cancelAnimationFrame(raf);drawFrame(ctx,canvas,item,parts,1);setTimeout(()=>{try{rec.stop()}catch{}resolve()},250)}});
    const blob=await done;canvasStream.getTracks().forEach(t=>t.stop());dest.stream.getTracks().forEach(t=>t.stop());await ac.close();return blob
  }

  async function makeVideo(i){
    const item=queue[i];if(!item?.pack){toast('Generate the AI Pack first ✦');return}
    activeIndex=i;modal.classList.add('open');modal.setAttribute('aria-hidden','false');const progress=document.querySelector('#videoMakerProgress');const preview=document.querySelector('#videoMakerPreview');const both=document.querySelector('#videoMakerBoth');both.disabled=true;preview.innerHTML='';
    try{
      const spoken=cleanNarration(section(item.pack,'SHORT SCRIPT')||item.hook||item.title);if(spoken.split(/\s+/).length<20)throw new Error('The AI script is too short. Generate the AI Pack again first.');
      progress.textContent='Gemini is creating the narration voice…';const narration=await fetchNarration(spoken);progress.textContent='Narration ready. Building the 9:16 video…';const blob=await renderVideo(item,narration,progress);
      const base=(section(item.pack,'TITLE')||'clipping-hq-video').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,55)||'clipping-hq-video';const file=new File([blob],`${base}.webm`,{type:'video/webm'});const key=itemKey(i);videos.set(key,file);if(previewUrls.has(key))URL.revokeObjectURL(previewUrls.get(key));const url=URL.createObjectURL(file);previewUrls.set(key,url);item.videoReady=true;saveQueue();
      preview.innerHTML=`<video controls playsinline src="${url}" style="width:min(320px,100%);aspect-ratio:9/16;display:block;margin:4px auto 14px;border-radius:16px;background:#000"></video><div style="text-align:center"><a href="${url}" download="${file.name}" style="color:#c4b5fd;font-size:12px">Save generated video ↧</a></div>`;
      progress.innerHTML=`Video ready ✓<br><span>${Math.round(file.size/1024/1024*10)/10} MB • 720×1280 • same file for YouTube + TikTok</span>`;both.disabled=false;renderQueue();addButtons();toast('AI video ready 🎬')
    }catch(e){progress.textContent='Video maker error: '+(e?.message||'Unknown error.');both.disabled=true}
  }
  window.makeVideo=makeVideo;

  async function uploadYouTube(file,item){
    const title=(section(item.pack,'TITLE')||item.title||'Clipping HQ Short').slice(0,100);const description=(section(item.pack,'CAPTION')||section(item.pack,'SHORT SCRIPT')||item.hook||'').slice(0,5000);
    const r=await apiFetch('/api/youtube/upload-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,description,contentType:file.type||'video/webm',contentLength:file.size})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`YouTube session failed (${r.status})`);
    const up=await fetch(d.uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${d.accessToken}`,'Content-Type':file.type||'video/webm'},body:file});const ud=await up.json().catch(()=>({}));if(!up.ok)throw new Error(ud?.error?.message||`YouTube upload failed (${up.status})`);return ud?.id||null
  }
  async function uploadTikTok(file){
    const r=await apiFetch('/api/tiktok/upload-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentType:file.type||'video/webm',contentLength:file.size})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`TikTok session failed (${r.status})`);
    const up=await fetch(d.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'video/webm','Content-Range':`bytes 0-${file.size-1}/${file.size}`},body:file});if(!up.ok){const txt=await up.text().catch(()=>'');throw new Error(txt||`TikTok upload failed (${up.status})`)}return d.publishId||null
  }
  async function postBoth(i){
    const item=queue[i];const file=getGenerated(i);if(!file){toast('Make the video first 🎬');return}
    activeIndex=i;modal.classList.add('open');modal.setAttribute('aria-hidden','false');const progress=document.querySelector('#videoMakerProgress');const both=document.querySelector('#videoMakerBoth');both.disabled=true;progress.textContent='Sending the SAME video to YouTube and TikTok at the same time…';
    const [yt,tt]=await Promise.allSettled([uploadYouTube(file,item),uploadTikTok(file)]);const ytOk=yt.status==='fulfilled',ttOk=tt.status==='fulfilled';if(ytOk)item.youtubeVideoId=yt.value;if(ttOk)item.tiktokPublishId=tt.value;saveQueue();
    const ytMsg=ytOk?'YouTube: uploaded Private ✓':`YouTube: ${yt.reason?.message||'failed'}`;const ttMsg=ttOk?'TikTok: draft uploaded ✓':`TikTok: ${tt.reason?.message||'failed'}`;progress.innerHTML=`${escapeHtml(ytMsg)}<br>${escapeHtml(ttMsg)}<br><span>${ytOk&&ttOk?'Both received the exact same video file.':'Fix the failed platform and try again.'}</span>`;both.disabled=false;toast(ytOk&&ttOk?'Sent to both ✓':'One platform needs attention')
  }
  window.postBoth=postBoth;document.querySelector('#videoMakerBoth').onclick=()=>{if(activeIndex>=0)postBoth(activeIndex)};
  addButtons();
})();
