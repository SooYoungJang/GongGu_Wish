import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleTodayCalendar, kstDate, configuration, publicKey } from './today-calendar.mjs';
const instant = Date.parse('2026-10-15T00:00:00Z');
const data = { date:'2026-10-15', timezone:'Asia/Seoul', count:1, items:[{
  productName:'test', sellerName:'seller', startDate:'2026-10-15', endDate:null }] };
const env = {VERCEL_ENV:'preview', VITE_SUPABASE_URL:'https://xwblovggtvbpiusjfokq.supabase.co',
  VITE_SUPABASE_ANON_KEY:'sb_publishable_test', TODAY_CALENDAR_ENABLED:'true'};
const request = (init={}, query='')=>new Request('https://example.test/api/today-calendar'+query,init);
const deps = (value=data)=>({now:()=>instant, cache:new Map(), fetch:async()=>Response.json(value)});
test('KST day rollover',()=>{
 assert.equal(kstDate(Date.parse('2026-10-14T14:59:59Z')),'2026-10-14');
 assert.equal(kstDate(Date.parse('2026-10-14T15:00:00Z')),'2026-10-15');
});
test('reuse existing environment config with strict Preview/Production isolation',()=>{
 assert.ok(configuration(env));
 assert.equal(configuration({...env,VERCEL_ENV:'production'}),null);
 assert.equal(configuration({...env,TODAY_CALENDAR_SUPABASE_URL:'https://evil.example'}),null);
 assert.equal(configuration({...env,TODAY_CALENDAR_ENABLED:undefined}),null);
 assert.equal(configuration({...env,VITE_SUPABASE_ANON_KEY:'sb_secret_bad'}),null);
 assert.equal(publicKey(`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`),false);
 assert.equal(publicKey(`x.${Buffer.from('{"role":"anon"}').toString('base64url')}.x`),true);
});
test('public projection strips all private fields and forwards no user headers',async()=>{
 let forwarded;const d=deps({...data,admin:'private',items:[{...data.items[0],caption:'private'}]});
 d.fetch=async r=>{forwarded=r;return Response.json({...data,private:'x'});};
 const r=await handleTodayCalendar(request({headers:{Cookie:'user-session=x'}}),env,d);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),data);
 assert.equal(forwarded.headers.get('Cookie'),null);assert.equal(forwarded.headers.get('Authorization'),null);
 assert.equal(forwarded.headers.get('apikey'),'sb_publishable_test');
 for(const h of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.equal(r.headers.get(h),'no-store');
});
test('reject mutation, custom filters and caller auth',async()=>{
 for(const [init,q,status] of [[{method:'POST'},'',405],[{},'?date=2026-01-01',400],
  [{headers:{Authorization:'Bearer abc'}},'',400],[{headers:{apikey:'abc'}},'',400]])
  assert.equal((await handleTodayCalendar(request(init,q),env,deps())).status,status);
});
test('disabled feed fails closed without upstream',async()=>{
 const d=deps();d.fetch=async()=>{throw Error('must not call');};
 assert.equal((await handleTodayCalendar(request(),{},d)).status,503);
});
test('empty, unknown fields and more than 3 count handled',async()=>{
 for(const v of [{...data,count:0,items:[]},{...data,items:[{...data.items[0],productName:null,sellerName:null}]},
 {...data,count:5,items:Array(3).fill(data.items[0])}]) {
  const r=await handleTodayCalendar(request(),env,deps(v));assert.equal(r.status,200);assert.deepEqual(await r.json(),v);
 }
});
test('no upstream errors/private data or wrong date delivered',async()=>{
 for(const v of [{...data,date:'2026-10-14'},{...data,count:4},{...data,items:[{...data.items[0],endDate:'2026-10-14'}]}])
  assert.equal((await handleTodayCalendar(request(),env,deps(v))).status,502);
 const d=deps();d.fetch=async()=>new Response('private upstream details',{status:500});
 const r=await handleTodayCalendar(request(),env,d);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/private/);
});
test('per-instance cache expires on KST rollover and never caches errors',async()=>{
 let now=Date.parse('2026-10-14T14:59:58Z'), calls=0;
 const d={cache:new Map(),now:()=>now,fetch:async()=>{calls++;return Response.json({...data,date:kstDate(now),items:[{...data.items[0],startDate:kstDate(now)}]});}};
 assert.equal((await handleTodayCalendar(request(),env,d)).status,200);
 assert.equal((await handleTodayCalendar(request(),env,d)).status,200);assert.equal(calls,1);
 now+=2000;assert.equal((await handleTodayCalendar(request(),env,d)).status,200);assert.equal(calls,2);
});
