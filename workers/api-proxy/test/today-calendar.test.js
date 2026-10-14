import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { isPublicReadKey, kstDay } from '../src/today-calendar.js';
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const originalCaches = globalThis.caches;
afterEach(() => { globalThis.fetch = originalFetch; Date.now = originalNow; globalThis.caches = originalCaches; });
const anon = `x.${btoa(JSON.stringify({role:'anon'}))}.x`;
const payload = () => ({date: kstDay(), timezone:'Asia/Seoul', count:1,
  items:[{productName:'실제 상품명', sellerName:'seller', startDate:kstDay(), endDate:null}]});
const env = () => ({APP_ENV:'production', CF_VERSION_METADATA:{tag:'a'.repeat(40)},
  SUPABASE_ORIGIN:'https://iosdoheblabfimkjnvfj.supabase.co',
  ALLOWED_ORIGINS:'https://gongguwish.com', TODAY_CALENDAR_ANON_KEY:anon,
  TODAY_CALENDAR_RATE_LIMITER:{limit:async () => ({success:true})}});
const req = (path='', init={}, settings=env(), ctx) => worker.fetch(new Request(
  'https://api.gongguwish.com/public/v1/group-buys/today'+path,init),settings,ctx);

test('KST midnight boundary independent of server timezone', () => {
  assert.equal(kstDay(Date.parse('2026-10-14T14:59:59Z')), '2026-10-14');
  assert.equal(kstDay(Date.parse('2026-10-14T15:00:00Z')), '2026-10-15');
});
test('only public keys accepted, service-role fails closed', async () => {
  assert.equal(isPublicReadKey(anon),true);
  assert.equal(isPublicReadKey('sb_publishable_test'),true);
  assert.equal(isPublicReadKey('sb_secret_test'),false);
  assert.equal(isPublicReadKey(`x.${btoa(JSON.stringify({role:'service_role'}))}.x`),false);
  const settings=env();settings.TODAY_CALENDAR_ANON_KEY='sb_secret_test';
  assert.equal((await req('',{},settings)).status,503);
});
test('keyless GET uses fixed anonymous upstream and minimal fields', async () => {
  let called;globalThis.fetch=async r=>{called=r;return Response.json({...payload(),admin:'private',
    items:payload().items.map(i=>({...i,caption:'private',id:'internal'}))});};
  const result=await req();assert.equal(result.status,200);
  assert.equal(called.url,'https://iosdoheblabfimkjnvfj.supabase.co/rest/v1/rpc/get_today_group_buy_calendar');
  assert.equal(called.method,'GET');assert.equal(called.headers.get('apikey'),anon);
  assert.equal(called.headers.get('authorization'),null);
  assert.deepEqual(await result.json(),payload());
  assert.match(result.headers.get('cache-control'),/public, max-age=\d+, must-revalidate/);
  assert.ok(result.headers.get('x-request-id'));
});
test('zero listings is a valid response, unknown dates stay null', async () => {
  globalThis.fetch=async()=>Response.json({...payload(),count:0,items:[]});
  assert.equal((await req()).status,200);
});
test('rejects query, mutation, caller credentials and disallowed Origin before upstream',async()=>{
  globalThis.fetch=async()=>{throw Error('must not call');};
  for(const [path,init,status] of [ ['?date=2026-10-01',{},400], ['?select=*',{},400],
    ['',{method:'POST'},405], ['',{method:'OPTIONS'},405],
    ['',{headers:{apikey:'caller-key'}},400], ['',{headers:{Authorization:'Bearer user'}},400],
    ['',{headers:{Origin:'https://evil.example'}},403] ])
    assert.equal((await req(path,init)).status,status);
});
test('rate limiting, missing binding and missing key fail closed',async()=>{
  let settings=env();settings.TODAY_CALENDAR_RATE_LIMITER.limit=async()=>({success:false});
  let result=await req('',{},settings);assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'60');
  settings=env();delete settings.TODAY_CALENDAR_RATE_LIMITER;assert.equal((await req('',{},settings)).status,503);
  settings=env();delete settings.TODAY_CALENDAR_ANON_KEY;assert.equal((await req('',{},settings)).status,503);
});
test('generic error hides upstream content; malformed or wrong-day data never ships', async()=>{
  for(const value of [{...payload(),date:'1999-01-01'}, {...payload(),count:4},
    {...payload(),items:[{...payload().items[0],endDate:'1999-01-01'}]}]) {
    globalThis.fetch=async()=>Response.json(value);const result=await req();assert.equal(result.status,502);
    assert.equal(result.headers.get('cache-control'),'no-store');
  }
  globalThis.fetch=async()=>new Response('database password private',{status:500});
  assert.equal((await req()).status,502);
  globalThis.fetch=async()=>{throw Error('private database error');};
  assert.equal((await req()).status,502);
});
test('cache hit reprojects output and applies the current Origin/request ID',async()=>{
  let cacheKey;globalThis.caches={default:{match:async key=>{
    cacheKey=key;return Response.json({...payload(),secret:'bad'});}}};
  globalThis.fetch=async()=>{throw Error('cache should answer');};
  const result=await req('',{headers:{Origin:'https://gongguwish.com','CF-Ray':'new-id'}});
  assert.equal(result.status,200);assert.deepEqual(await result.json(),payload());
  assert.equal(result.headers.get('access-control-allow-origin'),'https://gongguwish.com');
  assert.equal(result.headers.get('x-request-id'),'new-id');
  assert.match(cacheKey.url,new RegExp(`kst-day=${kstDay()}`));
});
test('cache is date-keyed and lifetime capped at midnight',async()=>{
  Date.now=()=>Date.parse('2026-10-14T14:59:58Z');
  let written,waiting;globalThis.caches={default:{match:async()=>undefined,put:async(key,value)=>{written={key,value};}}};
  globalThis.fetch=async()=>Response.json(payload());
  const result=await req('',{},env(),{waitUntil:p=>{waiting=p;}});await waiting;
  assert.equal(result.headers.get('cache-control'),'public, max-age=2, must-revalidate');
  assert.match(written.key.url,/kst-day=2026-10-14/);
});
test('migration preserves approval, manual-review, minimal schema, RLS and invoker guards',()=>{
  const sql=readFileSync(new URL('../../../supabase/migrations/20261015000001_add_today_group_buy_calendar.sql',import.meta.url),'utf8');
  assert.match(sql,/SECURITY INVOKER/);assert.doesNotMatch(sql,/SECURITY DEFINER/);
  assert.match(sql,/gb.status = 'APPROVED'/);assert.match(sql,/gb.collection_review_status = 'APPROVED'/);
  assert.match(sql,/NOT c.relrowsecurity/);assert.match(sql,/LIMIT 3/);
  assert.match(sql,/AT TIME ZONE 'UTC'/);assert.match(sql,/AT TIME ZONE 'Asia\/Seoul'/);
  assert.match(sql,/REVOKE ALL.*FROM PUBLIC/);assert.match(sql,/TO anon;/);
  for(const field of ['caption','purchase_url','profile_image_url','confidence','reviewed_by'])
    assert.doesNotMatch(sql,new RegExp(field));
});
