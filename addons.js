/* Cricket Match Manager v31 add-ons (loaded after the main script).
   Adds: My Day page, series progress, share/PDF/image schedule, operator payout,
   result sync (CricAPI), recycle bin, Telegram digest button, dark mode, Hindi toggle,
   equipment checklist UI, operator double-booking warning. */
(function(){
"use strict";
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:v;}catch(e){return d;}};
const put=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const act=rows=>rows.filter(r=>!INACTIVE.includes(effStatus(r)));
const dayName=iso=>{const [y,m,d]=String(iso).split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});};
const byTime=(a,b)=>String(a.match_date).localeCompare(String(b.match_date))||String(a.match_time||"99").localeCompare(String(b.match_time||"99"));
const myMail=()=>(typeof ME!=="undefined"&&ME&&ME.email)||"";

/* ---------------- styles ---------------- */
const css=`
.vx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:8px 0}
.vx-row label{display:flex;flex-direction:column;gap:3px;font-size:13px;margin:0}
.vx-det{border:1px solid var(--line);border-radius:10px;margin:10px 0;padding:0 12px}
.vx-det>summary{cursor:pointer;font-weight:700;padding:12px 0;font-size:16px}
.vx-det[open]>summary{border-bottom:1px solid var(--line);margin-bottom:10px}
.vx-note{font-size:13px;color:var(--muted);margin:6px 0}
.vx-card{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-left:5px solid var(--turf);border-radius:8px;padding:9px 12px;margin:6px 0}
.vx-card small{display:block;color:var(--muted)}
.vx-btns{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.vx-sp{margin:8px 0}.vx-sp .t{display:flex;justify-content:space-between;gap:8px;font-size:14px}
.vx-bar{height:12px;background:var(--mint);border-radius:6px;overflow:hidden;position:relative;margin-top:3px}
.vx-bar i{position:absolute;left:0;top:0;bottom:0;background:#9bc7a9}
.vx-bar b{position:absolute;left:0;top:0;bottom:0;background:var(--turf)}
.vx-tbl{width:100%;border-collapse:collapse;font-size:14px}.vx-tbl th,.vx-tbl td{border:1px solid var(--line);padding:6px 8px;text-align:left}
.vx-tbl input{width:84px}
.vx-hbtn{margin-left:6px}
#eqBox{margin:8px 0;padding-top:6px;border-top:1px dashed var(--line)}
#eqBox h4{margin:0 0 4px;font-size:14px}
html[data-theme="dark"]{--ink:#e6ede8;--muted:#9fb0a5;--chalk:#0f1511;--paper:#18211b;--line:#2c3a31;--field:#2f3f35;--mint:#1f3026;color-scheme:dark}
html[data-theme="dark"] body{background:#0f1511;color:var(--ink)}
html[data-theme="dark"] .card,html[data-theme="dark"] .kpi,html[data-theme="dark"] .modal .box,html[data-theme="dark"] .chart,html[data-theme="dark"] .vx-card,html[data-theme="dark"] .vx-det{background:#18211b;color:var(--ink)}
html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:#101712;color:var(--ink);border-color:#2f3f35}
html[data-theme="dark"] table,html[data-theme="dark"] th,html[data-theme="dark"] td{color:var(--ink)}
html[data-theme="dark"] tbody tr,html[data-theme="dark"] td{background:#18211b}
html[data-theme="dark"] th{background:#22332a;color:#fff}
html[data-theme="dark"] h1,html[data-theme="dark"] h2,html[data-theme="dark"] h3,html[data-theme="dark"] .modal h3{color:#cfe8d8}
html[data-theme="dark"] a{color:#7fd1a0}
html[data-theme="dark"] button:not(.primary):not(.danger):not(.month-download-btn){background:#22332a;color:var(--ink);border-color:#35503f}
html[data-theme="dark"] .notice{color:#16231b}

`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

/* ---------------- pages ---------------- */
const mk=(id,page,html)=>{const s=document.createElement("section");s.className="card pghide";s.id=id;s.dataset.page=page;s.innerHTML=html;return s;};
const host=document.getElementById("secAdmin2")||document.querySelector("section.card:last-of-type");
const secMine=mk("secMine","mine",`<h2>My Day</h2>
<div class="vx-row"><label>Show matches of<select id="mineWho"></select></label></div><div id="mineBox"></div>`);
const secX=mk("secExtras","extras",`<h2>Extras</h2>
<details class="vx-det" open><summary>Share schedule (WhatsApp, PDF, image)</summary>
 <div class="vx-row"><label>From<input type="date" id="shFrom"></label><label>To<input type="date" id="shTo"></label>
 <label>Matches<select id="shScope"><option value="all">All matches</option><option value="mine">Only mine</option></select></label></div>
 <div class="vx-row"><label>Default platform (fills blanks)<input id="shDefPlat" placeholder="e.g. YouTube"></label>
 <label style="flex-direction:row;align-items:center"><input type="checkbox" id="shExtra"> Add camera &amp; operator</label><button id="shMake">Make text</button></div>
 <label style="display:block;margin:6px 0">Message (you can edit it by hand before sending)<textarea id="shText" rows="10" style="width:100%" placeholder="Tap Make text, then change anything you want."></textarea></label>
 <div class="vx-row"><button id="shWa" class="primary">Send on WhatsApp</button><button id="shCopy">Copy text</button><button id="shPdf">PDF</button><button id="shPng">Image (PNG)</button></div>
 <p class="vx-note" id="shMsg"></p></details>
<details class="vx-det"><summary>Operator payout tracker</summary>
 <div class="vx-row"><label>Month<select id="payMonth"></select></label><label>T20 rate<input type="number" id="payT20" min="0"></label><label>ODI rate<input type="number" id="payOdi" min="0"></label>
 <label style="flex-direction:row;align-items:center"><input type="checkbox" id="payRec"> Count only recorded</label></div>
 <div style="overflow-x:auto"><div id="payBox"></div></div><div class="vx-row"><button id="payXls">Download payout Excel</button></div>
 <p class="vx-note">Rates are saved on this device only. A blank per-operator rate uses the T20/ODI rate above.</p></details>
<details class="vx-det"><summary>Sync results and time changes (CricAPI)</summary>
 <p class="vx-note">Checks upcoming and recent matches against CricAPI for abandoned, postponed or rescheduled matches. It uses several API hits (one per 25 matches in the API list). Enter your CricAPI key on the Fetch page first.</p>
 <div class="vx-row"><button id="syBtn">Check for changes</button><button id="syApply" class="primary hidden">Apply selected</button></div><div id="syBox"></div></details>
<details class="vx-det"><summary>Telegram digest</summary>
 <p class="vx-note">The daily Telegram message now lists today's matches, tomorrow's count and pending uploads (run supabase_sql/10_add_v31.sql once). Set the daily time in Admin tools.</p>
 <div class="vx-row"><button id="dgSend">Send digest to Telegram now</button><button id="dgCopy">Copy digest text</button></div><p class="vx-note" id="dgMsg"></p></details>
<details class="vx-det"><summary>Recycle bin (deleted matches, 30 days)</summary>
 <div class="vx-row"><button id="binRefresh">Refresh</button></div><div id="binBox"></div></details>
<details class="vx-det"><summary>Display</summary>
 <div class="vx-row"><button id="stTheme">Toggle dark mode</button><button id="stLang">English / हिन्दी</button></div></details>`);
host.insertAdjacentElement("afterend",secMine);secMine.insertAdjacentElement("afterend",secX);
/* series progress on the Stats page */
const stats=document.getElementById("secStats");
const spWrap=document.createElement("div");spWrap.innerHTML=`<h3 style="margin:16px 0 6px">Series progress</h3><div class="vx-row"><input id="spQ" placeholder="Filter series..."></div><div id="spBox"></div>`;
if(stats)stats.appendChild(spWrap);
if(typeof PAGES!=="undefined"){const i=PAGES.findIndex(p=>p[0]==="users");PAGES.splice(i<0?PAGES.length:i,0,["mine","My Day"],["extras","Extras"]);if(typeof buildNav==="function")buildNav();}

const $x=id=>document.getElementById(id);

/* ---------------- My Day ---------------- */
function mineSelect(){
  const sel=$x("mineWho"),cur=sel.value||"__me",key=(typeof TEAM!=="undefined"?TEAM:[]).join("|");
  if(sel.dataset.k===key&&sel.options.length)return; sel.dataset.k=key;
  sel.innerHTML='<option value="__me">Me</option>'+(typeof TEAM!=="undefined"?TEAM:[]).map(e=>`<option value="${esc(e)}">${esc(dispName(e))}</option>`).join("");
  sel.value=[...sel.options].some(o=>o.value===cur)?cur:"__me";
}
function mineCard(r,canSt){
  const cur=effStatus(r),btn=["Recording","Recorded","Uploaded"].filter(v=>v!==cur).map(v=>`<button class="small-btn" onclick="setStatus('${r.id}','${v}')">${v}</button>`).join("");
  return `<div class="vx-card"><div><b>${esc(fmtTime(r.match_time))}</b> ${esc(r.match)}<small>${esc(r.series||"")} ${r.odi_t20?"· "+esc(r.odi_t20):""}${r.camera?" · "+esc(r.camera):""}${r.stream_platforms?" · Live: "+esc(r.stream_platforms):""}</small></div><div class="vx-btns"><span class="pill ${cur==="Uploaded"?"done":"pending"}">${esc(cur)}</span>${canSt?btn:""}</div></div>`;
}
function renderMine(){
  mineSelect();
  const who=$x("mineWho").value||"__me",em=who==="__me"?myMail():who,t0=todayISO(),t1=addDays(t0,1);
  const mine=act(allMatches).filter(r=>r.operator&&r.operator===em).sort(byTime),cs=can("status");
  const sec=(t,l)=>`<h3 style="margin:14px 0 4px">${t} (${l.length})</h3>`+(l.length?l.map(r=>mineCard(r,cs)).join(""):'<p class="empty">Nothing here.</p>');
  $x("mineBox").innerHTML=sec("Today",mine.filter(r=>String(r.match_date)===t0))+sec("Tomorrow",mine.filter(r=>String(r.match_date)===t1))+sec("Upload pending (past matches)",mine.filter(r=>String(r.match_date)<t0&&effStatus(r)!=="Uploaded").reverse());
}
$x("mineWho").addEventListener("change",renderMine);

/* ---------------- Series progress ---------------- */
function renderSeries(rows){
  const q=$x("spQ").value.toLowerCase().trim(),m={};
  act(rows).forEach(r=>{const k=r.series||"(no series)",o=m[k]||(m[k]={t:0,r:0,u:0});o.t++;const s=effStatus(r);if(r.recorded==="Done"||["Recorded","Editing","Uploaded"].includes(s))o.r++;if(r.uploaded==="Done"||s==="Uploaded")o.u++;});
  const list=Object.entries(m).filter(([k])=>!q||k.toLowerCase().includes(q)).sort((a,b)=>b[1].t-a[1].t);
  $x("spBox").innerHTML=list.map(([k,o])=>`<div class="vx-sp"><div class="t"><span>${esc(k)}</span><b>${o.u} / ${o.r} / ${o.t}</b></div><div class="vx-bar"><i style="width:${o.r/o.t*100}%"></i><b style="width:${o.u/o.t*100}%"></b></div></div>`).join("")+(list.length?'<p class="vx-note">Dark = uploaded, light = recorded. Numbers: uploaded / recorded / total.</p>':'<p class="empty">No series.</p>');
}
$x("spQ").addEventListener("input",()=>renderSeries(allMatches));

/* ---------------- Share schedule ---------------- */
function shareRows(){
  const f=$x("shFrom").value||todayISO(),t=$x("shTo").value||f,mine=$x("shScope").value==="mine"&&myMail();
  return act(allMatches).filter(r=>String(r.match_date)>=f&&String(r.match_date)<=t&&(!mine||r.operator===myMail())).sort(byTime);
}
function shareText(rows){
  const def=($x("shDefPlat").value||"").trim(),extra=$x("shExtra").checked;
  let out="*Cricket Schedule*",d="";
  rows.forEach(r=>{if(r.match_date!==d){d=r.match_date;out+="\n\n📅 *"+dayName(d)+"*";}
    out+="\n"+fmtTime(r.match_time)+" - "+r.match+(r.series?" ("+r.series+")":"")+" | Platform: "+(r.stream_platforms||def||"________")
      +(extra?(r.camera?" | "+r.camera:"")+(r.operator?" | "+dispName(r.operator):""):"");});
  return out;
}
function msgText(){const r=shareRows();if(!r.length){$x("shMsg").textContent="No matches in this range.";return "";}
  if(!$x("shText").value.trim()){$x("shText").value=shareText(r);}
  $x("shMsg").textContent=r.length+" match(es).";return $x("shText").value;}
["shFrom","shTo","shScope"].forEach(i=>$x(i).addEventListener("change",()=>{$x("shText").value="";}));
$x("shMake").addEventListener("click",()=>{const r=shareRows();if(!r.length){$x("shMsg").textContent="No matches in this range.";return;}$x("shText").value=shareText(r);$x("shMsg").textContent=r.length+" match(es). Edit the text if needed, then send.";});
const needRows=()=>{const r=shareRows();if(!r.length){$x("shMsg").textContent="No matches in this range.";return null;}$x("shMsg").textContent=r.length+" match(es).";return r;};
$x("shWa").addEventListener("click",()=>{const t=msgText();if(t)window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank");});
$x("shCopy").addEventListener("click",async()=>{const t=msgText();if(!t)return;try{await navigator.clipboard.writeText(t);$x("shMsg").textContent="Text copied.";}catch(e){prompt("Copy this text:",t);}});
$x("shPdf").addEventListener("click",()=>{
  const r=needRows();if(!r)return;const w=window.open("","_blank");if(!w){alert("Allow pop-ups to create the PDF.");return;}
  let d="",rows="";r.forEach(x=>{if(x.match_date!==d){d=x.match_date;rows+=`<tr><td colspan="6" class="d">${esc(dayName(d))}</td></tr>`;}
    rows+=`<tr><td>${esc(fmtTime(x.match_time))}</td><td>${esc(x.match)}</td><td>${esc(x.series||"")}</td><td>${esc(x.camera||"")}</td><td>${esc(dispName(x.operator))}</td><td>${esc(x.stream_platforms||"")}</td></tr>`;});
  w.document.write(`<!doctype html><title>Cricket Schedule</title><style>body{font-family:Arial,sans-serif;margin:16px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #444;padding:5px 7px;text-align:left}th{background:#FFC000}.d{background:#e8e8e8;font-weight:bold}</style><h2>Cricket Schedule</h2><table><tr><th>Time</th><th>Match</th><th>Series</th><th>Camera</th><th>Operator</th><th>Live on</th></tr>${rows}</table>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
});
$x("shPng").addEventListener("click",()=>{
  const r=needRows();if(!r)return;const W=1100,RH=34,lines=[];let d="";
  r.forEach(x=>{if(x.match_date!==d){d=x.match_date;lines.push({h:dayName(d)});}lines.push({t:fmtTime(x.match_time),m:x.match,s:(x.series||"")+(x.camera?" | "+x.camera:"")+(x.operator?" | "+dispName(x.operator):"")+(x.stream_platforms?" | Live: "+x.stream_platforms:"")});});
  const c=document.createElement("canvas");c.width=W;c.height=70+lines.length*RH+20;const g=c.getContext("2d");
  g.fillStyle="#fff";g.fillRect(0,0,W,c.height);g.fillStyle="#1d5a38";g.fillRect(0,0,W,52);g.fillStyle="#fff";g.font="bold 26px Arial";g.fillText("Cricket Schedule",18,35);
  const fit=(s,mw)=>{s=String(s);while(g.measureText(s).width>mw&&s.length>3)s=s.slice(0,-2);return s;};
  lines.forEach((l,i)=>{const y=70+i*RH;if(l.h){g.fillStyle="#FFD600";g.fillRect(0,y,W,RH-2);g.fillStyle="#000";g.font="bold 18px Arial";g.fillText(l.h,18,y+23);}
    else{g.fillStyle="#000";g.font="bold 17px Arial";g.fillText(l.t,18,y+23);g.font="17px Arial";g.fillText(fit(l.m,520),120,y+23);g.fillStyle="#555";g.font="15px Arial";g.fillText(fit(l.s,430),650,y+23);}});
  c.toBlob(b=>downloadBlob(b,"Cricket_Schedule_"+($x("shFrom").value||todayISO())+".png"));
});

/* ---------------- Operator payout ---------------- */
const rates=()=>{try{return Object.assign({t20:0,odi:0,ops:{},rec:false},JSON.parse(get("cmm_rates","{}")));}catch(e){return {t20:0,odi:0,ops:{},rec:false};}};
let payRows=[];
function renderPay(){
  const R=rates(),months=[...new Set(act(allMatches).map(r=>monthKey(r.match_date)).filter(Boolean))].sort().reverse(),sel=$x("payMonth"),cur=sel.value;
  if(sel.dataset.k!==months.join(",")){sel.dataset.k=months.join(",");sel.innerHTML=months.map(k=>`<option value="${k}">${esc(monthLabel(k))}</option>`).join("");}
  sel.value=months.includes(cur)?cur:(months.includes(todayISO().slice(0,7))?todayISO().slice(0,7):(months[0]||""));
  if(document.activeElement!==$x("payT20"))$x("payT20").value=R.t20||"";if(document.activeElement!==$x("payOdi"))$x("payOdi").value=R.odi||"";$x("payRec").checked=!!R.rec;
  const rows=act(allMatches).filter(r=>monthKey(r.match_date)===sel.value&&r.operator&&(!R.rec||r.recorded==="Done"||["Recorded","Editing","Uploaded"].includes(effStatus(r))));
  const m={};rows.forEach(r=>{const o=m[r.operator]||(m[r.operator]={t:0,o:0});if(r.odi_t20==="ODI")o.o++;else o.t++;});
  payRows=Object.entries(m).map(([e,o])=>{const ov=R.ops[e];const has=ov!==undefined&&ov!=="";const amt=has?(o.t+o.o)*Number(ov):o.t*Number(R.t20||0)+o.o*Number(R.odi||0);return {e,t:o.t,o:o.o,ov:has?ov:"",amt};}).sort((a,b)=>b.amt-a.amt);
  const tot=payRows.reduce((s,x)=>s+x.amt,0);
  $x("payBox").innerHTML=payRows.length?`<table class="vx-tbl"><tr><th>Operator</th><th>T20</th><th>ODI</th><th>Matches</th><th>Own rate</th><th>Amount</th></tr>${payRows.map(x=>`<tr><td>${esc(dispName(x.e))}</td><td>${x.t}</td><td>${x.o}</td><td>${x.t+x.o}</td><td><input type="number" min="0" data-op="${esc(x.e)}" value="${esc(x.ov)}"></td><td><b>${x.amt}</b></td></tr>`).join("")}<tr><td colspan="5"><b>Total</b></td><td><b>${tot}</b></td></tr></table>`:'<p class="empty">No assigned matches in this month.</p>';
}
const saveRates=()=>{const R=rates();R.t20=Number($x("payT20").value)||0;R.odi=Number($x("payOdi").value)||0;R.rec=$x("payRec").checked;put("cmm_rates",JSON.stringify(R));renderPay();};
["payT20","payOdi"].forEach(i=>$x(i).addEventListener("change",saveRates));$x("payRec").addEventListener("change",saveRates);$x("payMonth").addEventListener("change",renderPay);
$x("payBox").addEventListener("change",e=>{const i=e.target.closest("input[data-op]");if(!i)return;const R=rates();R.ops[i.dataset.op]=i.value;put("cmm_rates",JSON.stringify(R));renderPay();});
$x("payXls").addEventListener("click",()=>{
  if(!payRows.length){alert("Nothing to download.");return;}
  const aoa=[["Operator","T20","ODI","Matches","Own rate","Amount"],...payRows.map(x=>[dispName(x.e),x.t,x.o,x.t+x.o,x.ov===""?"":Number(x.ov),x.amt]),["Total","","","","",payRows.reduce((s,x)=>s+x.amt,0)]];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),"Payout");
  downloadBlob(new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}),"Operator_Payout_"+$x("payMonth").value+".xlsx");
});

/* ---------------- Result / time sync (CricAPI) ---------------- */
let syProps=[];
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const dayDiff=(a,b)=>Math.abs((Date.parse(a+"T00:00:00Z")-Date.parse(b+"T00:00:00Z"))/864e5);
$x("syBtn").addEventListener("click",async()=>{
  if(!can("add")){alert("You do not have permission.");return;}
  const box=$x("syBox"),k=$x("afKey");if(k&&!k.value)k.value=get("cricapi_key","");
  const t0=todayISO(),cand=act(allMatches).filter(r=>effStatus(r)!=="Uploaded"&&String(r.match_date)>=addDays(t0,-3)&&String(r.match_date)<=addDays(t0,21));
  if(!cand.length){box.innerHTML='<p class="empty">No upcoming or recent matches to check.</p>';return;}
  syProps=[];$x("syApply").classList.add("hidden");
  try{
    const api=[];let off=0,total=1e9,pg=0;
    while(off<total&&pg<30){box.innerHTML=`<p class="vx-note">Reading CricAPI page ${pg+1}...</p>`;const j=await afCall("matches",{offset:off});const a=j.data||[];total=(j.info&&j.info.totalRows)||0;api.push(...a);if(!a.length)break;off+=a.length;pg++;}
    cand.forEach(r=>{
      const ours=norm(r.match);
      const m=api.find(x=>{const tm=(x.teams||[]).map(norm).filter(Boolean);if(tm.length<2)return false;const loc=afIST(x.dateTimeGMT);if(!loc||dayDiff(loc.date,String(r.match_date))>2)return false;return tm.every(t=>ours.includes(t)||(t.split(" ")[0].length>3&&ours.includes(t.split(" ")[0])));});
      if(!m)return;
      const s=String(m.status||"").toLowerCase(),loc=afIST(m.dateTimeGMT);let to=null;
      if(/abandon|no result|washed/.test(s))to="Abandoned";else if(/postpone/.test(s))to="Postponed";else if(/cancel/.test(s))to="Cancelled";
      if(to&&effStatus(r)!==to){syProps.push({id:r.id,r,kind:"status",to,txt:`${r.match}: API says "${m.status}" -> set ${to}`});return;}
      if(!to&&loc&&!m.matchEnded){const oldT=String(r.match_time||"").slice(0,5),newT=loc.time.slice(0,5);
        if(loc.date!==String(r.match_date)||oldT!==newT)syProps.push({id:r.id,r,kind:"time",loc,txt:`${r.match}: ${fmtDate(r.match_date)} ${fmtTime(r.match_time)} -> ${fmtDate(loc.date)} ${fmtTime(loc.time)}`});}
    });
    box.innerHTML=syProps.length?syProps.map((p,i)=>`<label class="vx-card" style="margin:6px 0"><span><input type="checkbox" class="sy-c" data-i="${i}" checked> ${esc(p.txt)}</span></label>`).join(""):`<p class="empty">Checked ${cand.length} match(es) against ${api.length} API matches. No changes found.</p>`;
    if(syProps.length)$x("syApply").classList.remove("hidden");
  }catch(e){box.innerHTML=`<p class="vx-note">Error: ${esc(e.message||e)}</p>`;}
});
$x("syApply").addEventListener("click",async()=>{
  const pick=[...document.querySelectorAll(".sy-c:checked")].map(c=>syProps[+c.dataset.i]);if(!pick.length)return;
  if(!confirm("Apply "+pick.length+" change(s)?"))return;let bad=0;
  for(const p of pick){
    if(p.kind==="status"){const upd=typeof deriveFlags==="function"?deriveFlags(p.to):{};if(hasStatus!==false)upd.status=p.to;const {error}=await client.from("matches").update(upd).eq("id",p.id);if(error)bad++;}
    else{await client.from("match_reschedule_history").insert({match_id:p.id,old_date:p.r.match_date,old_time:p.r.match_time,new_date:p.loc.date,new_time:p.loc.time,series:p.r.series,match_name:p.r.match,changed_at:new Date().toISOString()});
      const {error}=await client.from("matches").update({match_date:p.loc.date,match_time:p.loc.time}).eq("id",p.id);if(error)bad++;}
  }
  $x("syBox").innerHTML=`<p class="vx-note">${pick.length-bad} applied${bad?", "+bad+" failed (permission?)":""}.</p>`;$x("syApply").classList.add("hidden");syProps=[];await render();
});

/* ---------------- Telegram digest ---------------- */
function digestText(){
  const t0=todayISO(),rows=act(allMatches),today=rows.filter(r=>String(r.match_date)===t0).sort(byTime),tom=rows.filter(r=>String(r.match_date)===addDays(t0,1)).length;
  const pend=rows.filter(r=>String(r.match_date)<t0&&effStatus(r)!=="Uploaded"&&r.uploaded!=="Done").sort(byTime);
  let o="Matches today ("+fmtDate(t0)+")\n"+(today.length?today.map(r=>fmtTime(r.match_time)+" - "+r.match+(r.camera?" | "+r.camera:"")+(r.operator?" | "+dispName(r.operator):"")).join("\n"):"No matches today.");
  o+="\n\nTomorrow: "+tom+" match(es)\nUpload pending: "+pend.length+(pend.length?"\n"+pend.slice(-10).map(r=>"- "+fmtDate(r.match_date)+" "+r.match).join("\n"):"");return o;
}
$x("dgCopy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(digestText());$x("dgMsg").textContent="Digest copied.";}catch(e){prompt("Copy:",digestText());}});
$x("dgSend").addEventListener("click",async()=>{
  if(!isAdmin()){alert("Admin only.");return;}
  const {data,error}=await client.rpc("send_telegram_test");$x("dgMsg").textContent=error?"Error: "+error.message+" (set up Telegram in Admin tools first)":(data||"Sent.");
});

/* ---------------- Recycle bin ---------------- */
const _dr=deleteRows;
deleteRows=async function(rows,label){
  try{if(rows&&rows.length){const ins=rows.map(r=>({match_id:String(r.id),series:r.series||"",match_name:r.match||"",match_date:r.match_date||null,data:r}));for(let i=0;i<ins.length;i+=100)await client.from("deleted_matches").insert(ins.slice(i,i+100));}}catch(e){}
  return _dr(rows,label);
};
async function renderBin(){
  const box=$x("binBox");if(!isAdmin()){box.innerHTML='<p class="empty">Only the admin can restore deleted matches.</p>';return;}
  box.innerHTML='<p class="vx-note">Loading...</p>';
  try{await client.from("deleted_matches").delete().lt("deleted_at",new Date(Date.now()-30*864e5).toISOString());}catch(e){}
  const {data,error}=await client.from("deleted_matches").select("*").order("deleted_at",{ascending:false}).limit(200);
  if(error){box.innerHTML='<p class="vx-note">Run supabase_sql/10_add_v31.sql in Supabase first ('+esc(error.message)+').</p>';return;}
  const live=new Set(allMatches.map(r=>String(r.id))),list=(data||[]).filter(x=>!live.has(String(x.match_id)));
  box.innerHTML=list.length?list.map(x=>`<div class="vx-card"><div><b>${esc(x.match_name)}</b><small>${esc(x.series)} · ${esc(fmtDate(x.match_date))} · deleted ${esc(new Date(x.deleted_at).toLocaleString("en-IN"))}</small></div><div class="vx-btns"><button class="small-btn" data-restore="${x.id}">Restore</button><button class="small-btn delete" data-purge="${x.id}">Delete forever</button></div></div>`).join(""):'<p class="empty">Recycle bin is empty.</p>';
  box._list=list;
}
$x("binRefresh").addEventListener("click",renderBin);
$x("binBox").addEventListener("click",async e=>{
  const rb=e.target.closest("[data-restore]"),pb=e.target.closest("[data-purge]"),list=$x("binBox")._list||[];
  if(rb){const x=list.find(v=>String(v.id)===rb.dataset.restore);if(!x)return;const row={...x.data};delete row.seq;delete row.user_id;
    const {error}=await client.from("matches").insert(row);if(error){alert(error.message);return;}await client.from("deleted_matches").delete().eq("id",x.id);await render();renderBin();}
  if(pb){if(!confirm("Delete this match forever?"))return;await client.from("deleted_matches").delete().eq("id",pb.dataset.purge);renderBin();}
});

/* ---------------- Operator double-booking warning ---------------- */
const _so=window.setOperator;
if(typeof _so==="function")window.setOperator=async function(id,val){
  const r=allMatches.find(x=>x.id===id);
  if(val&&r){const c=allMatches.filter(o=>o.id!==id&&o.operator===val&&!INACTIVE.includes(effStatus(o))&&startOf(o)<endOf(r)&&startOf(r)<endOf(o));
    if(c.length&&!confirm(dispName(val)+" is already on an overlapping match:\n"+c.slice(0,4).map(o=>"- "+fmtTime(o.match_time)+" "+o.match).join("\n")+"\n\nAssign anyway?")){render();return;}}
  return _so(id,val);
};

/* ---------------- Dark mode ---------------- */
const setTheme=t=>{document.documentElement.dataset.theme=t==="dark"?"dark":"";put("cmm_theme",t);const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#0f1511":"#1d5a38";const b=$x("vxTheme");if(b)b.textContent=t==="dark"?"☀":"🌙";};

/* ---------------- Hindi / English ---------------- */
const HI={"Home":"होम","Alerts":"अलर्ट","Matches":"मैच","Add":"जोड़ें","Bulk":"बल्क","Fetch":"फ़ेच","Calendar":"कैलेंडर","Planner":"प्लानर","Stats":"आँकड़े","Users":"यूज़र","Admin":"एडमिन","My Day":"मेरा दिन","Extras":"एक्स्ट्रा",
"Date":"तारीख","Time":"समय","Series":"सीरीज़","Match":"मैच","Expected":"अपेक्षित","Recorded":"रिकॉर्डेड","Uploaded":"अपलोडेड","Status":"स्थिति","Remarks":"टिप्पणी","Action":"एक्शन","Edit":"बदलें","Delete":"हटाएँ","History":"इतिहास","Camera":"कैमरा","Operator":"ऑपरेटर","Live on":"लाइव","Checklist":"चेकलिस्ट",
"Save":"सेव","Cancel":"रद्द करें","Logout":"लॉगआउट","Pending":"बाकी","Done":"हो गया","Scheduled":"निर्धारित","Recording":"रिकॉर्डिंग","Editing":"एडिटिंग","Postponed":"स्थगित","Abandoned":"रद्द (अधूरा)","Cancelled":"निरस्त","Today":"आज","Tomorrow":"कल","Series progress":"सीरीज़ प्रगति",
"Share schedule (WhatsApp, PDF, image)":"शेड्यूल शेयर (WhatsApp, PDF, इमेज)","Operator payout tracker":"ऑपरेटर भुगतान","Telegram digest":"टेलीग्राम डाइजेस्ट","Display":"डिस्प्ले","Send on WhatsApp":"WhatsApp पर भेजें","Copy text":"टेक्स्ट कॉपी","Image (PNG)":"इमेज (PNG)","Check for changes":"बदलाव जाँचें","Apply selected":"चुने हुए लागू करें","Refresh":"रीफ़्रेश","Restore":"वापस लाएँ","Delete forever":"हमेशा के लिए हटाएँ","Camera Planner":"कैमरा प्लानर","Analytics":"विश्लेषण","Admin tools":"एडमिन टूल्स","Equipment":"उपकरण","Total":"कुल","Operator":"ऑपरेटर","Matches":"मैच","Download Excel":"एक्सेल डाउनलोड","Import Excel":"एक्सेल इम्पोर्ट","Backup JSON":"बैकअप JSON","Search":"खोजें","Month":"महीना","From":"से","To":"तक","Me":"मैं","Upload pending (past matches)":"अपलोड बाकी (पुराने मैच)","Matches of":"किसके मैच"};
let lang=get("cmm_lang","en"),orig=new Map(),obs=null,busy=false;
const walk=root=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentNode&&n.parentNode.nodeName;return(p==="SCRIPT"||p==="STYLE"||p==="TEXTAREA")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});const a=[];let n;while((n=w.nextNode()))a.push(n);return a;};
function toHindi(root){busy=true;try{walk(root).forEach(n=>{const t=n.nodeValue.trim();if(HI[t]&&!orig.has(n)){orig.set(n,n.nodeValue);n.nodeValue=n.nodeValue.replace(t,HI[t]);}});}finally{busy=false;}}
function setLang(l){
  lang=l;put("cmm_lang",l);
  if(l==="hi"){toHindi(document.body);if(!obs){let tm=0;obs=new MutationObserver(()=>{if(busy||lang!=="hi")return;clearTimeout(tm);tm=setTimeout(()=>toHindi(document.body),120);});obs.observe(document.body,{childList:true,subtree:true,characterData:true});}}
  else{busy=true;try{orig.forEach((v,n)=>{if(n.isConnected)n.nodeValue=v;});orig=new Map();}finally{busy=false;}}
  const b=$x("vxLang");if(b)b.textContent=l==="hi"?"EN":"हिं";
}

/* header buttons */
const ub=document.querySelector("header .userbar");
if(ub){ub.insertAdjacentHTML("afterbegin",'<button id="vxTheme" class="vx-hbtn" title="Dark / light mode">🌙</button><button id="vxLang" class="vx-hbtn" title="हिन्दी / English">हिं</button>');
  $x("vxTheme").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
  $x("vxLang").addEventListener("click",()=>setLang(lang==="hi"?"en":"hi"));}
$x("stTheme").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
$x("stLang").addEventListener("click",()=>setLang(lang==="hi"?"en":"hi"));
setTheme(get("cmm_theme","light"));if(lang==="hi")setLang("hi");

/* defaults for share dates */
$x("shFrom").value=todayISO();$x("shTo").value=todayISO();

/* ---------------- refresh hook ---------------- */
function refreshAll(rows){
  try{renderMine();}catch(e){console.error(e);}
  try{renderSeries(rows);}catch(e){console.error(e);}
  try{renderPay();}catch(e){console.error(e);}
}
const _rs=renderStats;
renderStats=function(rows){_rs(rows);refreshAll(rows);};
document.querySelectorAll('[data-page="extras"] details').forEach(d=>d.addEventListener("toggle",()=>{if(d.open&&d.textContent.includes("Recycle bin")&&d.querySelector("#binBox"))renderBin();}));
if(typeof allMatches!=="undefined"&&allMatches.length)refreshAll(allMatches);
})();
