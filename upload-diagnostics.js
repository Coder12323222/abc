(()=>{
  const STORAGE_KEY='clippingHqLastDeliveryResult';

  function esc(v=''){
    return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function hqFetch(url){
    if(typeof window.apiFetch==='function')return window.apiFetch(url);
    const headers={};
    const key=localStorage.getItem('clippingHqAccessKey')||'';
    if(key)headers['x-hq-key']=key;
    return fetch(url,{headers});
  }

  function panel(){
    let el=document.querySelector('#deliveryDiagnostics');
    if(el)return el;
    const queue=document.querySelector('#queue');
    const head=queue?.querySelector('.section-head');
    if(!queue||!head)return null;
    el=document.createElement('div');
    el.id='deliveryDiagnostics';
    el.style.cssText='margin:0 0 18px;padding:16px 18px;border:1px solid rgba(167,139,250,.32);border-radius:16px;background:rgba(12,15,27,.82);color:#eef0f8;font-size:13px;line-height:1.6';
    head.insertAdjacentElement('afterend',el);
    return el;
  }

  function renderConnectionState(yt,tt){
    const el=panel();if(!el)return;
    const last=readLast();
    const ytConnected=!!yt?.connected;
    const ttConnected=!!tt?.connected;
    const ytUpload=!!yt?.uploadAuthorized;
    const ttUpload=!!tt?.uploadAuthorized;
    const ytLabel=!ytConnected?'Not connected':ytUpload?'Connected + upload permission ✓':'Connected, upload permission missing';
    const ttLabel=!ttConnected?'Not connected':ttUpload?'Connected + upload permission ✓':'Connected, video.upload missing';
    const warn=(!ytConnected||!ttConnected||!ytUpload||!ttUpload)
      ?'<div style="margin-top:10px;color:#f7c96f">Reconnect any platform showing a missing upload permission before pressing Both.</div>'
      :'<div style="margin-top:10px;color:#7ee2b8">Both connections report upload permission. If an upload fails, the exact API error will stay here.</div>';
    const lastHtml=last?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1)"><b>Last delivery attempt</b><div>${esc(last.youtube||'YouTube: no result')}</div><div>${esc(last.tiktok||'TikTok: no result')}</div><small style="color:#9ca6bd">${esc(last.when||'')}</small></div>`:'';
    el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b>Upload diagnostics</b><button id="refreshDeliveryDiagnostics" type="button" style="border:0;background:transparent;color:#c4b5fd;cursor:pointer">Refresh</button></div><div>YouTube: ${esc(ytLabel)}</div><div>TikTok: ${esc(ttLabel)}</div>${warn}${lastHtml}`;
    el.querySelector('#refreshDeliveryDiagnostics')?.addEventListener('click',refresh);
  }

  function readLast(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}
  }

  function saveLast(youtube,tiktok){
    const value={youtube,tiktok,when:new Date().toLocaleString()};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
  }

  async function refresh(){
    const el=panel();
    if(el)el.innerHTML='<b>Upload diagnostics</b><div>Checking YouTube and TikTok permissions…</div>';
    try{
      const [yr,tr]=await Promise.all([hqFetch('/api/youtube/status'),hqFetch('/api/tiktok/status')]);
      const [yt,tt]=await Promise.all([yr.json().catch(()=>({})),tr.json().catch(()=>({}))]);
      renderConnectionState(yt,tt);
    }catch(e){
      if(el)el.innerHTML=`<b>Upload diagnostics</b><div>Could not check connection status: ${esc(e?.message||'unknown error')}</div>`;
    }
  }

  function captureProgress(){
    const p=document.querySelector('#videoMakerProgress');
    if(!p)return;
    const inspect=()=>{
      const text=(p.innerText||p.textContent||'').trim();
      if(!text.includes('YouTube:')||!text.includes('TikTok:'))return;
      const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
      const yt=lines.find(x=>x.startsWith('YouTube:'))||'YouTube: result unavailable';
      const tt=lines.find(x=>x.startsWith('TikTok:'))||'TikTok: result unavailable';
      saveLast(yt,tt);
      refresh();
    };
    new MutationObserver(inspect).observe(p,{childList:true,subtree:true,characterData:true});
    inspect();
  }

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('.post-both,#videoMakerBoth');
    if(!b)return;
    const el=panel();
    if(el)el.innerHTML='<b>Upload diagnostics</b><div>Sending to both platforms… the exact result will stay here.</div>';
  },true);

  const start=()=>{panel();captureProgress();refresh()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
