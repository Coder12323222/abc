import crypto from 'node:crypto';

export const BASE_URL='https://clipping-hq.vercel.app';
export const REDIRECT_URI=`${BASE_URL}/api/youtube/callback`;

export function authorized(req){
  const expected=(process.env.CLIPPING_HQ_ACCESS_KEY||'').trim();
  if(!expected)return true;
  return String(req.headers['x-hq-key']||'').trim()===expected;
}

function secretMaterial(){
  return `${process.env.GOOGLE_CLIENT_SECRET||''}|${process.env.CLIPPING_HQ_ACCESS_KEY||''}`;
}
function key(){return crypto.createHash('sha256').update(secretMaterial()).digest()}

export function signState(){
  const payload=`${Date.now()}.${crypto.randomBytes(12).toString('hex')}`;
  const sig=crypto.createHmac('sha256',key()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyState(state=''){
  const parts=String(state).split('.');
  if(parts.length!==3)return false;
  const payload=`${parts[0]}.${parts[1]}`;
  const expected=crypto.createHmac('sha256',key()).update(payload).digest('base64url');
  const a=Buffer.from(parts[2]);const b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  const ts=Number(parts[0]);
  return Number.isFinite(ts)&&Date.now()-ts<10*60*1000;
}

export function encrypt(value){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const plaintext=Buffer.from(JSON.stringify(value));
  const enc=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,enc]).toString('base64url');
}
export function decrypt(value=''){
  try{
    const buf=Buffer.from(value,'base64url');
    const iv=buf.subarray(0,12),tag=buf.subarray(12,28),enc=buf.subarray(28);
    const decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc),decipher.final()]).toString('utf8'));
  }catch{return null}
}
export function cookies(req){
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')){
    const i=part.indexOf('=');if(i<0)continue;
    out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
export function setTokenCookie(res,tokens){
  const value=encodeURIComponent(encrypt(tokens));
  res.setHeader('Set-Cookie',`chq_youtube=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000`);
}
export function clearTokenCookie(res){
  res.setHeader('Set-Cookie','chq_youtube=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

export async function refreshIfNeeded(req,res){
  const data=decrypt(cookies(req).chq_youtube||'');
  if(!data)return null;
  if(data.expires_at&&Date.now()<data.expires_at-60000)return data;
  if(!data.refresh_token)return null;
  const body=new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID||'',
    client_secret:process.env.GOOGLE_CLIENT_SECRET||'',
    refresh_token:data.refresh_token,
    grant_type:'refresh_token'
  });
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const d=await r.json();
  if(!r.ok)return null;
  const next={...data,access_token:d.access_token,expires_at:Date.now()+(d.expires_in||3600)*1000};
  setTokenCookie(res,next);
  return next;
}
