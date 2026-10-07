/* Restaurant Continuity Mode — operator interface. Server remains authority for inventory. */
const $ = q => document.querySelector(q);
const state = {
  token: sessionStorage.getItem('rcm-token') || '', user:null, data:null,
  view:'overview',date:'',focusTime:'18:30',search:'',statusFilter:'all',
  modal:null, modalTable:null, available:null, selectedTable:null, bookingSubmitting:false,
  csvText:'',csvSource:'',preview:null,reconcileCsv:'',reconcile:null,importTab:'csv'
};
const ico = (name,size=17) => {
 const paths = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 9v12"/>',
  upload:'<path d="M12 16V3m0 0-4 4m4-4 4 4M3 16v4h18v-4"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="m12 2 8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  alert:'<path d="m12 3 10 18H2z"/><path d="M12 9v5m0 3h.01"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  search:'<circle cx="10.8" cy="10.8" r="7.8"/><path d="m17 17 5 5"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  x:'<path d="M5 5 19 19M19 5 5 19"/>',
  file:'<path d="M6 3h9l5 5v13H6zM14 3v6h6M9 14h7M9 18h7"/>',
  chair:'<path d="M7 3v10h10V3M5 13h14v5H5zm2 5v3m10-3v3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5m5 5H9"/>',
  dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  coffee:'<path d="M4 8h13v7a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zm13 0h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/>',
  spark:'<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
 };
 return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.dots}</svg>`;
};
const h = val => String(val ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const statusText = {confirmed:'Confirmed',verified_existing:'Verified existing',imported_unverified:'Needs verification',requested:'Request received',pending_verification:'Pending review',checked_in:'Checked in',seated:'Seated',completed:'Completed',cancelled:'Cancelled',no_show:'No-show'};
const pill = key => `<span class="pill ${h(key)}">${h(statusText[key]||key)}</span>`;
const prettyDate = d => {try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}catch{return d}};
const prettyTime = t => {const [hh,mm]=(t||'00:00').split(':').map(Number);return `${(hh%12)||12}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`};
const mins = time=> {const [hh,mm]=String(time||'00:00').split(':').map(Number);return hh*60+mm};
const actualDuration=b=>b.party_size<=2?90:120;
const within = (start,end,point)=> mins(point)>=mins(start)&&mins(point)<mins(end);
const tableById = id=>state.data?.tables.find(t=>t.id===id);
const tbLabel = id=>tableById(id)?.label || 'Unassigned';
const isManager = ()=>state.user?.role==='manager';
const active = ()=>state.data?.incident?.state==='active';
const csrfToken = ()=>crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(36);

async function request(path,opts={}){
 const headers={...(opts.headers||{})};
 if(state.token)headers['Authorization']=`Bearer ${state.token}`;
 if(opts.body && typeof opts.body==='object' && !(opts.body instanceof FormData)){
  headers['Content-Type']='application/json';opts={...opts,body:JSON.stringify(opts.body)};
 }
 let response;
 try { response=await fetch(path,{...opts,headers,cache:'no-store'}); }
 catch { throw Error('Cannot reach the local app server. Start it with python run.py.'); }
 if(!response.ok){
  let body={};try{body=await response.json()}catch{}
  if(response.status===401){state.token='';sessionStorage.removeItem('rcm-token');state.data=null;render()}
  throw Error(typeof body.detail==='string'?body.detail:`Request failed (${response.status})`);
 }
 if(opts.download){ const b=await response.blob(), link=document.createElement('a');link.href=URL.createObjectURL(b);link.download=opts.filename||'export.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return null; }
 return response.json();
}
function toast(message,type='success'){
 const el=document.createElement('div');el.className='toast '+(type==='error'?'error':type);el.textContent=message;
 $('#toast-region').appendChild(el);setTimeout(()=>el.remove(),4500);
}
async function run(fn){try{await fn()}catch(e){toast(e.message||'Unable to complete action','error')}}
async function refresh(){let data=await request('/api/bootstrap?date='+encodeURIComponent(state.date));state.data=data;state.user=data.user;state.date=data.date;render();}

function shell(){
 const nav=[['overview','dashboard','Overview'],['reservations','calendar','Reservations'],['floor','grid','Floor & inventory'],['import','upload','Import backup'],['reconcile','refresh','Recovery & reconcile'],['audit','clipboard','Activity & audit']];
 const openCount=state.data.conflicts.filter(f=>f.state==='open').length;
 return `<div class="app-layout"><aside class="sidebar">
 <div class="sidebar-header"><div class="brand-mark">C<span>.</span></div><div class="sidebar-brand"><h2>continuity</h2><span>STAY IN SERVICE</span></div></div>
 <div class="nav-caption">WORKSPACE</div><nav aria-label="Service navigation">${nav.map(([id,icon,title])=>`<button class="nav-item ${state.view===id?'active':''}" data-action="nav" data-view="${id}">${ico(icon)}<span>${title}</span>${id==='reconcile'&&openCount?`<b class="alert-count">${openCount}</b>`:''}</button>`).join('')}</nav>
 <div class="sidebar-bottom"><div class="help-card"><span class="tiny">SERVICE PRINCIPLE</span><h4>Protect the promise.</h4><p>Never treat old records as live availability. Confirm only what your team has verified.</p><span class="badge-side">No Resy API required</span></div>
 <div class="sidebar-account"><div class="avatar">${h(state.user.display_name.split(' ').map(x=>x[0]).join(''))}</div><div style="flex:1;min-width:0"><strong>${h(state.user.display_name)}</strong><small>${isManager()?'Floor manager':'Front-of-house host'}</small></div><button class="logout" data-action="logout" title="Sign out">${ico('logout')}</button></div></div>
 </aside><div class="main-wrap"><header class="topbar"><div class="crumb">OPERATIONS <span>/</span> <strong>${h(({overview:'Overview',reservations:'Reservation ledger',floor:'Floor & inventory',import:'Import backup',reconcile:'Reconciliation',audit:'Activity log'})[state.view])}</strong></div>
 <div class="top-actions"><span class="demo-tag">FICTIONAL DEMO DATA</span><label for="service-date" class="tiny-muted">Service date</label><input id="service-date" class="date-input" type="date" value="${h(state.date)}" aria-label="Service date" /></div></header>
 <main class="content">${page()}</main></div></div>${state.modal?modalUI():''}`;
}
function heading(kicker,title,description,actions=''){
 return `<div class="page-head"><div><p class="eyebrow">${h(kicker)}</p><h1>${h(title)}</h1><p class="subtext">${h(description)}</p></div>${actions?`<div class="head-buttons">${actions}</div>`:''}</div>`;
}
function incidentBanner(){
 const i=state.data.incident;
 if(!i)return `<div class="incident-banner banner-closed"><div><span class="incident-top">${ico('shield',14)} Ready for contingency</span><h2>Continuity Mode is not active.</h2><p>Managers can activate an incident when your booking provider becomes unavailable.</p></div>${isManager()?`<button class="btn btn-dark" data-action="open-start">Activate mode ${ico('arrow')}</button>`:''}</div>`;
 const on=i.state==='active';
 return `<div class="incident-banner ${on?'':'banner-closed'}"><div><div class="incident-top"><span class="status-dot ${on?'live':''}"></span>${on?'CONTINUITY MODE · ACTIVE':'INCIDENT CLOSED · ARCHIVED'}</div><h2>${on?'Your restaurant is still in control.':'Service restored. Incident archived.'}</h2><p>${h(i.reason||'Independent operations active')} · ${h(prettyDate(i.service_date))} · ${on?'New bookings require verified inventory':'Previous actions remain in the audit log'}</p></div><div class="incident-meta"><span class="mini-pill">${on?'Provider-independent':'Reconciled'}</span>${on?`<button class="btn btn-primary" data-action="new-booking">${ico('plus')} New booking</button>`:''}</div></div>`;
}
function numStats(){
 const b=state.data.bookings,conf=state.data.conflicts,verified=b.filter(x=>x.verification==='verified').length,
  booked=b.filter(x=>!['cancelled','no_show'].includes(x.state)).length,
  seated=b.filter(x=>['seated','completed'].includes(x.state)).length,
  open=conf.filter(x=>x.state==='open').length;
 const items=[['Reservations on file',booked,'Verified & unverified commitments','calendar'],['Guest records verified',verified,`${Math.round(verified/Math.max(1,booked)*100)}% of active ledger`,'shield'],['Parties served',seated,'Seated or completed this shift','users'],['Items needing review',open,open?'Manager action required':'All clear','alert']];
 return `<div class="kpis">${items.map(([title,note,foot,icon])=>`<div class="kpi"><div class="kpi-top"><span class="kpi-label">${h(title)}</span><span class="kpi-icon">${ico(icon)}</span></div><div class="kpi-value">${h(note)}</div><div class="kpi-foot">${h(foot)}</div></div>`).join('')}</div>`;
}
function currentTableState(table,at=state.focusTime,party=null){
 const d=state.data;
 if(party!==null&&table.seats<party)return 'too_small';
 const start=mins(at), end=start+(party && party>2?120:90)+15;
 const booking=d.bookings.find(b=>b.table_id===table.id&&!['cancelled','no_show'].includes(b.state)&&start<mins(b.end_time)+15&&end>mins(b.time));
 if(booking)return 'occupied';
 const hold=d.holds.find(hold=>hold.table_id===table.id&&start<mins(hold.end_time)&&end>mins(hold.time));
 if(hold)return 'held';
 const verified=d.verifications.some(v=>v.table_id===table.id&&new Date(v.starts_utc).toISOString()<=localIsoToUtc(at).toISOString()&&new Date(v.ends_utc).toISOString()>=localIsoToUtcFromMin(end).toISOString());
 return verified?'available':'uncertain';
}
function localIsoToUtc(t){return new Date(state.date+'T'+t+':00-04:00')}
function localIsoToUtcFromMin(n){return localIsoToUtc(String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'))}
/* Render-only map confidence. The authoritative determination always comes from /api/availability. */
function mapState(table,at=state.focusTime){
 const start=mins(at),end=start+120+15;
 const booking=state.data.bookings.find(b=>b.table_id===table.id&&!['cancelled','no_show'].includes(b.state)&&start<mins(b.end_time)+15&&end>mins(b.time));
 if(booking)return 'occupied';
 if(state.data.holds.find(ho=>ho.table_id===table.id&&start<mins(ho.end_time)&&end>mins(ho.time)))return 'held';
 const verified=state.data.verifications.some(v=>v.table_id===table.id&&mins((new Date(v.starts_utc)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:state.data.venue.timezone}))<=start&&mins((new Date(v.ends_utc)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:state.data.venue.timezone}))>=end);
 return verified?'available':'uncertain';
}
function floorGrid(compact=false){
 const areas=['Main dining','Garden patio'];
 return `<div class="floor-groups">${areas.map(area=>`<div><div class="floor-area-label">${area}</div><div class="floor-row">${state.data.tables.filter(t=>t.area===area).map(t=>{
 const s=mapState(t);return `<button class="floor-tile ${s}" data-action="table-detail" data-id="${t.id}" title="Inspect ${h(t.label)}"><div class="tile-top"><strong>${h(t.label)}</strong>${ico(s==='available'?'checkcircle':s==='uncertain'?'alert':'chair',13)}</div><span>${t.seats} seats · ${s==='occupied'?'committed':s==='held'?'protected':s==='available'?'verified':'uncertain'}</span></button>`;
 }).join('')}</div></div>`).join('')}</div><div class="legend"><span><b class="available"></b>Verified free</span><span><b class="occupied"></b>Committed</span><span><b class="held"></b>Protected hold</span><span><b class="uncertain"></b>Uncertain</span></div>`;
}
function upcomingTable(limit=6){
 const list=state.data.bookings.filter(b=>b.state!=='cancelled').filter(b=>state.search?(`${b.guest_name} ${b.phone} ${b.time} ${b.source}`).toLowerCase().includes(state.search.toLowerCase()):true).filter(b=>state.statusFilter==='all'||b.state===state.statusFilter).slice(0,limit);
 return `<div class="table-wrap"><table class="ledger-table"><thead><tr><th>Arrival</th><th>Guest / party</th><th>Table</th><th>Reservation status</th><th>Next step</th></tr></thead><tbody>${list.map(b=>`<tr><td class="time-cell">${h(prettyTime(b.time))}</td><td><div class="guest-name">${h(b.guest_name)}</div><span class="guest-extra">Party of ${b.party_size} · ${h(b.source)}</span></td><td>${h(tbLabel(b.table_id))}</td><td>${pill(b.state)}</td><td>${quickAction(b)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No matching bookings. Try clearing your filters.</td></tr>'}</tbody></table></div>`;
}
function quickAction(b){
 const next=({confirmed:'checked_in',verified_existing:'checked_in',checked_in:'seated',seated:'completed'})[b.state];
 if(next)return `<button class="btn btn-sm" data-action="change-state" data-id="${b.id}" data-version="${b.version}" data-next="${next}">${h(({checked_in:'Check in',seated:'Seat',completed:'Complete'})[next])} ${ico('arrow',12)}</button>`;
 if(b.state==='imported_unverified')return `<button class="btn btn-sm btn-warn" data-action="review-booking" data-id="${b.id}">Review ${ico('arrow',12)}</button>`;
 return `<button class="btn btn-sm btn-ghost" data-action="review-booking" data-id="${b.id}">View details ${ico('arrow',12)}</button>`;
}
function pacePanel(){
 const times=['17:00','17:15','17:30','17:45','18:00','18:15','18:30','18:45','19:00','19:15','19:30','19:45','20:00','20:15'];
 const values=times.map(t=>state.data.bookings.filter(b=>!['cancelled','no_show'].includes(b.state)&&mins(b.time)>=mins(t)&&mins(b.time)<mins(t)+15).reduce((a,b)=>a+b.party_size,0));
 return `<div class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Kitchen arrival pacing</h3><p class="section-description">15-minute cover windows · advisory only</p></div><span class="pill verified_existing">Limit 16 covers</span></div><div class="pulse-bars">${values.map((v,i)=>`<div class="pulse-bar"><div data-value="${v}" class="${v>=12?'hot':''}" style="height:${Math.max(4,Math.round(100*v/16))}%"></div>${i%2===0?`<span>${h(prettyTime(times[i]))}</span>`:''}</div>`).join('')}</div><div class="pulse-note"><span>Used for host pacing, not an independent booking guarantee.</span><strong>16 / slot</strong></div></div>`;
}
function overview(){
 return `${heading('THE SERVICE CONTINUES','Good evening, '+state.user.display_name.split(' ')[0]+'.','Your contingency command center · '+prettyDate(state.date),`<button class="btn" data-action="print">${ico('print')} Print run-sheet</button><button class="btn btn-primary" data-action="new-booking">${ico('plus')} New reservation</button>`)}
 ${incidentBanner()}${numStats()}
 <div class="dashboard-grid"><section class="panel"><div class="panel-pad" style="padding-bottom:6px"><div class="panel-heading"><div><h3 class="section-title">Tonight's run-sheet</h3><p class="section-description">Pre-existing guests, requests and status changes in one place</p></div><button class="small-link" data-action="nav" data-view="reservations">Full ledger →</button></div></div>${upcomingTable(7)}</section>
 <section class="panel panel-pad"><div class="split-head"><div><h3 class="section-title">Live floor snapshot</h3><p class="section-description">Protected inventory & table commitment</p></div><select id="focus-time" class="slot-picker" aria-label="Preview floor time">${['17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(t=>`<option value="${t}" ${state.focusTime===t?'selected':''}>${prettyTime(t)}</option>`).join('')}</select></div>${floorGrid(true)}<div class="micro-stats"><div class="micro-stat"><strong>${state.data.tables.filter(t=>mapState(t)==='available').length}</strong><span>Verified free at ${h(prettyTime(state.focusTime))}</span></div><div class="micro-stat"><strong>${state.data.tables.filter(t=>mapState(t)==='uncertain').length}</strong><span>Uncertain inventory</span></div></div></section></div>
 <div class="dashboard-grid"><div>${pacePanel()}</div><section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Incident activity</h3><p class="section-description">Every material action leaves an audit record</p></div><button class="small-link" data-action="nav" data-view="audit">View all →</button></div><div class="activity">${state.data.events.slice(0,5).map(x=>`<div class="activity-row"><div class="activity-icon">${ico('checkcircle')}</div><div><strong>${h(x.action.replaceAll('_',' '))}</strong><p>${h(x.actor)} · ${h(x.detail||'')} · ${h(new Date(x.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))}</p></div></div>`).join('')||'<p class="empty">No activity yet.</p>'}</div></section></div>`;
}
function reservations(){
 const all=state.data.bookings;
 return `${heading('SERVICE LEDGER','Every guest. One source of truth.','Search, verify, check in, and seat without depending on a live reservation provider.',`<button class="btn" data-action="claim">${ico('alert')} Log guest claim</button><button class="btn btn-primary" data-action="new-booking">${ico('plus')} Add reservation</button>`)}
 <div class="notice" style="margin-bottom:20px">${ico('info')}<span>Imported records remain <strong>unverified</strong> until staff review evidence. A reservation is confirmed only when a specific table/time has been protected by the server.</span></div>
 <section class="panel"><div class="panel-pad" style="padding-bottom:8px"><div class="toolbar"><input id="search-reservations" class="search" placeholder="Search name, time, phone or source..." value="${h(state.search)}" aria-label="Search reservations"/><select id="status-filter" class="filter-select" aria-label="Filter by status">${[['all','All statuses'],...Object.entries(statusText)].map(([k,v])=>`<option value="${k}" ${state.statusFilter===k?'selected':''}>${h(v)}</option>`).join('')}</select><button class="btn btn-sm" data-action="export" data-kind="ledger">${ico('download')} Export CSV</button></div><p class="note-quiet">${all.length} total guest entries · ${all.filter(b=>b.verification==='verified').length} verified</p></div>${upcomingTable(1000)}</section>`;
}
function floor(){
 const date=state.date;
 return `${heading('INVENTORY CONFIDENCE','Know what you can promise.','Verification is a manager decision. Stale or missing data never means a table is free.',`<button class="btn" data-action="open-hold">${ico('lock')} Protect inventory</button><button class="btn btn-primary" data-action="new-booking">${ico('plus')} Find safe booking</button>`)}
 <div class="notice" style="margin-bottom:20px">${ico('shield')}<span>Booking protection is enforced in the backend. Each new confirmed booking locks a specific table and time window (90 minutes for ≤2, 120 minutes for larger parties, plus 15 minutes turnover). Separate manager holds protect uncertain demand.</span></div>
 <div class="dashboard-grid"><section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Table map</h3><p class="section-description">Select a table to inspect or verify inventory</p></div><select id="focus-time" class="slot-picker">${['17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(t=>`<option value="${t}" ${state.focusTime===t?'selected':''}>${prettyTime(t)}</option>`).join('')}</select></div>${floorGrid()}</section>
 <section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Protected capacity</h3><p class="section-description">Manager-placed holds for uncertain commitments</p></div><span class="pill open">${state.data.holds.length} holds</span></div>${state.data.holds.map(x=>`<div class="conflict-item"><div><h4>${h(x.label)} · ${h(prettyTime(x.time))}–${h(prettyTime(x.end_time))}</h4><p>${h(x.reason)}</p></div>${isManager()?`<button class="btn btn-sm" data-action="release-hold" data-id="${x.id}">Release</button>`:''}</div>`).join('')||'<p class="empty">No protected table holds for this date.</p>'}<div class="divider"></div><h3 class="section-title">Inventory rules</h3><div class="bullet-box"><ul><li>Every new booking must be assigned a table.</li><li>Bookings and manager holds cannot overlap.</li><li>Inventory is closed until independently verified.</li><li>Host accounts cannot approve table verification.</li></ul></div></section></div>
 <section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Evening table timeline</h3><p class="section-description">Half-hour snapshot of all 14 tables · ${h(prettyDate(date))}</p></div><span class="pill confirmed">Restaurant local time</span></div>${tableTimeline()}</section>`;
}
function tableTimeline(){
 const times=['17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
 return `<div class="timeline-wrap"><div class="timeline"><div class="timeline-head"><span>TABLE</span>${times.map(t=>`<span>${h(prettyTime(t))}</span>`).join('')}</div>${state.data.tables.map(t=>`<div class="timeline-line"><strong>${h(t.label)} <small style="font-weight:400;color:#9aa69e">${t.seats}</small></strong>${times.map(at=>{const stateVal=mapState(t,at);return `<div class="timeline-cell ${stateVal}" title="${h(t.label)}: ${stateVal} at ${at}"><span class="dot"></span></div>`}).join('')}</div>`).join('')}</div></div>`;
}
function importView(){
 const sample=`guest_name,party_size,date,time,table,phone\nDrew Bennett,2,${state.date},20:30,T01,\nAri Flores,4,${state.date},21:00,T04,`;
 return `${heading('BACKUP RECOVERY','Restore the ledger, not assumptions.','Import an approved restaurant CSV or paste a known-format shift digest; preview before committing.',`<button class="btn" data-action="download-template">${ico('download')} CSV template</button>`)}
 <div class="process-grid"><section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">1. Bring in reservation records</h3><p class="section-description">Restaurant-controlled source; never direct provider scraping</p></div></div><div class="subnav"><button class="tab ${state.importTab==='csv'?'active':''}" data-action="import-tab" data-tab="csv">Backup CSV</button><button class="tab ${state.importTab==='digest'?'active':''}" data-action="import-tab" data-tab="digest">Shift Digest text</button></div>
 ${state.importTab==='csv'?`<label class="upload-box"><strong>${ico('upload',17)} Choose a .csv file</strong>or paste CSV below<input type="file" id="csv-file" accept=".csv,text/csv" /></label>`:`<div class="notice good">${ico('info')}<span>For the demo, digest text supports one line per guest: <strong>6:30 PM | Guest Name | 2 | T01 | Phone</strong>. This is a sample parser, not a claim about any official email schema.</span></div>`}
 <div class="field" style="margin-top:17px"><label class="input-label" for="csv-content">${state.importTab==='csv'?'CSV contents':'Digest email text'}</label><textarea class="csvarea" id="csv-content" placeholder="${h(state.importTab==='csv'?sample:'6:30 PM | Guest Name | 2 | T01 | 555-0100')}">${h(state.csvText)}</textarea></div>
 <div class="field"><label class="input-label" for="csv-source">Source verified as of</label><input id="csv-source" type="text" value="${h(state.csvSource)}" placeholder="${h(state.date)} 14:00 (e.g. exported at 2 PM)" /></div>
 <div class="action-row"><button class="btn btn-dark" data-action="preview-import">${ico('eye')} Preview & validate</button><button class="btn btn-ghost" data-action="load-sample" data-sample="${h(sample)}">Use example CSV</button></div></section>
 <section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">2. Validation & human review</h3><p class="section-description">Invalid rows and probable duplicates are never quietly accepted</p></div></div>
 ${state.preview?`<div class="preview-summary"><span class="preview-chip">${state.preview.ready} ready</span><span class="preview-chip warn">${state.preview.flagged} flagged / rejected</span></div><div style="max-height:285px;overflow:auto">${state.preview.rows.map(r=>`<div class="preview-row"><div><strong>Row ${r.row}: ${h(r.data.guest_name||'Unknown')}</strong><small>${h(r.data.date||'')} · ${h(r.data.time||'')} · party ${r.data.party_size||'—'}</small>${r.errors.length?`<small style="color:#aa6b43">${h(r.errors.join(' · '))}</small>`:''}</div><span class="pill ${r.status==='ready'?'confirmed':'open'}">${r.status==='ready'?'Ready':'Flagged'}</span></div>`).join('')}</div><div class="divider"></div><button class="btn btn-primary btn-block" data-action="commit-import" ${state.preview.ready?'':'disabled'}>Commit ${state.preview.ready} reviewed rows ${ico('arrow')}</button>`:`<div class="bullet-box">Preview checks:<ul><li>Dates, times, names and party sizes</li><li>Potential duplicates against today's ledger</li><li>Unknown table references</li><li>Any existing table collision creates a review item, not hidden reallocation</li></ul></div><p class="note-quiet" style="margin-top:14px">Records are imported as <strong>unverified</strong>. Verification is a separate manager action.</p>`}
 </section></div><div class="panel panel-pad" style="margin-top:18px"><div class="panel-heading"><div><h3 class="section-title">Data provenance</h3><p class="section-description">Source timestamps matter when the booking platform is unavailable</p></div></div>
 ${state.data.imports.length?`<div class="table-wrap"><table class="ledger-table"><thead><tr><th>Source</th><th>Source as of</th><th>Accepted</th><th>Rejected</th><th>Imported by</th></tr></thead><tbody>${state.data.imports.map(i=>`<tr><td>${h(i.origin)}</td><td>${h(i.source_as_of||'Not provided')}</td><td>${i.rows_ok}</td><td>${i.rows_rejected}</td><td>${h(i.created_by)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No source imports yet.</p>'}</div>`;
}
function reconcileView(){
 const issues=state.data.conflicts;
 return `${heading('SAFE RESTORATION','Close the loop without losing a guest.','Compare restored provider data, resolve outstanding exceptions, and record a manager sign-off.',`<button class="btn" data-action="export" data-kind="reconciliation">${ico('download')} Recovery report</button>${isManager()?`<button class="btn btn-primary" data-action="open-close">${ico('checkcircle')} Close incident</button>`:''}`)}
 <div class="notice" style="margin-bottom:20px">${ico('alert')}<span><strong>No automatic Resy write-back.</strong> This tool previews differences; restaurant staff must resolve changes in the restored provider and document what they did. An unresolved critical conflict blocks routine closeout.</span></div>
 <div class="process-grid"><section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Compare current provider export</h3><p class="section-description">Use the same CSV template after provider restoration</p></div></div><div class="field"><label class="input-label">Provider's recovered CSV</label><textarea id="reconcile-csv" class="csvarea" placeholder="guest_name,party_size,date,time,table,phone">${h(state.reconcileCsv)}</textarea></div><label class="upload-box"><strong>Load recovered CSV from device</strong><input type="file" id="reconcile-file" accept=".csv,text/csv" /></label><div class="action-row"><button class="btn btn-dark" data-action="compare">${ico('refresh')} Compare records</button></div>${state.reconcile?reconcileResults():''}<div class="divider"></div><h3 class="section-title">Comparison history</h3>${state.data.reconciliations?.map(x=>`<div class="preview-row"><div><strong>Comparison #${x.id} · ${h(x.uploaded_by)}</strong><small>${x.matches} matched · ${x.provider_only+x.local_only+x.changed} differences</small></div><span class="tiny-muted">${h(x.uploaded_at.slice(0,16).replace('T',' '))} UTC</span></div>`).join('')||'<p class="note-quiet">No restored-provider comparisons have been recorded yet.</p>'}</section>
 <section class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Manager exception queue</h3><p class="section-description">Keep record histories; record how each issue was handled</p></div><span class="pill open">${issues.filter(f=>f.state==='open').length} open</span></div>
 ${issues.map(f=>`<div class="conflict-item"><div><h4>${h(f.guest_name||'Unassigned guest')} <span class="pill ${h(f.state)}">${h(f.state)}</span></h4><p>${h(f.description)}</p>${f.resolution?`<p style="margin-top:6px;color:#438269">Resolution: ${h(f.resolution)}</p>`:''}</div>${isManager()&&f.state==='open'?`<button class="btn btn-sm" data-action="resolve-conflict" data-id="${f.id}">Resolve</button>`:''}</div>`).join('')||'<div class="empty">No unresolved exceptions in this incident.</div>'}
 </section></div>`;
}
function reconcileResults(){
 const data=state.reconcile;
 const section=(label,rows,tone)=>`<h4 style="margin:17px 0 7px;font-size:12px">${h(label)} <span class="pill ${tone}">${rows.length}</span></h4>${rows.slice(0,10).map(r=>`<div class="preview-row"><strong>${h(r.guest_name)}</strong><small>${h(r.time||'')} ${r.party_size?'· party '+r.party_size:''}</small></div>`).join('')||'<p class="note-quiet">None</p>'}`;
 return `<div class="divider"></div><div class="preview-summary"><span class="preview-chip">${data.matches.length} matched</span><span class="preview-chip warn">${data.provider_only.length+data.local_only.length+data.changed.length} differences</span></div>${section('Only in restored provider',data.provider_only,'open')}${section('Only in local outage ledger',data.local_only,'open')}${section('Changed party size',data.changed,'open')}<p class="note-quiet">Review differences manually. Comparison does not mark conflicts resolved.</p>`;
}
function auditView(){
 return `${heading('ACCOUNTABILITY','A record of every decision.','Server-side event trail for imports, bookings, verifications, exceptions and recovery.',`<button class="btn" data-action="export" data-kind="audit">${ico('download')} Export audit log</button>`)}<div class="panel panel-pad"><div class="panel-heading"><div><h3 class="section-title">Recent audit events</h3><p class="section-description">No guest names, phone numbers, or emails are deliberately written to event details</p></div><span class="pill confirmed">${state.data.events.length} events</span></div><div class="table-wrap"><table class="ledger-table"><thead><tr><th>Event</th><th>Actor</th><th>Entity</th><th>Notes</th><th>Timestamp (UTC)</th></tr></thead><tbody>${state.data.events.map(x=>`<tr><td style="font-weight:800">${h(x.action.replaceAll('_',' '))}</td><td>${h(x.actor)}</td><td>${h(x.entity_type)} #${h(x.entity_id)}</td><td style="max-width:340px;white-space:normal">${h(x.detail)}</td><td>${h(x.created_at.slice(0,19).replace('T',' '))}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function page(){switch(state.view){case 'reservations':return reservations();case 'floor':return floor();case 'import':return importView();case 'reconcile':return reconcileView();case 'audit':return auditView();default:return overview()}}
function wrapModal(title,desc,body,footer='',wide=false){
 return `<div class="modal-layer" data-action="dismiss-modal"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${h(title)}"><div class="modal-header"><div><h2>${h(title)}</h2><p>${h(desc)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${ico('x')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`;
}
function modalUI(){
 const m=state.modal;let title,desc,body='',footer='';
 if(m==='book'){
  title='New reservation';desc='Verified space only. Unknown inventory cannot be automatically confirmed.';
  const selected=state.available?.tables.find(t=>t.id===state.selectedTable);
  const choices=state.available?.tables||[];
  body=`<div class="field-grid"><div class="field"><label class="input-label">Guest name</label><input id="book-name" placeholder="First and last name" maxlength="120" /></div><div class="field"><label class="input-label">Party size</label><select id="book-party">${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${(i+1)===2?'selected':''}>${i+1} ${i===0?'guest':'guests'}</option>`).join('')}</select></div></div>
  <div class="field-grid"><div class="field"><label class="input-label">Date</label><input id="book-date" type="date" value="${h(state.date)}" /></div><div class="field"><label class="input-label">Requested arrival time</label><input id="book-time" type="time" value="18:30" /></div></div>
  <div class="field"><label class="input-label">Guest phone (optional)</label><input id="book-phone" placeholder="Phone number" /></div>
  <div class="field"><label class="input-label">Special notes (optional)</label><input id="book-note" placeholder="Allergy, accessibility, high chair..." /></div>
  <div class="panel-heading"><div><h3 class="section-title">Verified table options</h3><p class="section-description">${state.available?'Server-checked · '+state.available.duration+'-minute dining window + 15-minute buffer':'Select check to inspect current inventory'}</p></div><button class="btn btn-sm" data-action="check-availability">${ico('search')} Check tables</button></div>
  ${state.available?`<div class="available-choices">${choices.map(t=>`<button class="choice ${h(t.state)} ${state.selectedTable===t.id?'selected':''}" data-action="pick-table" data-id="${t.id}" ${t.state==='available'?'':'disabled'} title="${h(t.reason)}"><strong>${h(t.label)} · ${t.seats} seats</strong><small>${h(t.state==='available'?'Verified free':t.state.replace('_',' '))}</small></button>`).join('')}</div><p class="note-quiet" style="margin-top:9px">${choices.filter(t=>t.state==='available').length} tables confirmed available at last check. The server rechecks on submit.</p>`:
  `<div class="notice">${ico('alert')}<span>Only a manager can verify inventory. You can save a guest request as pending when no safe table exists.</span></div>`}`;
  footer=`<button class="btn" data-action="book-request">Save as request</button><button class="btn btn-primary" data-action="book-confirm" ${selected&&active()?'':'disabled'}>${ico('checkcircle')} Confirm table ${selected?h(selected.label):''}</button>`;
 }
 else if(m==='claim'){
  title='Record unlisted guest';desc='Guest-provided evidence never automatically turns into a confirmed booking.';
  body=`<div class="field-grid"><div class="field"><label class="input-label">Guest name</label><input id="claim-name" placeholder="Guest name" /></div><div class="field"><label class="input-label">Party size</label><input type="number" min="1" max="14" id="claim-party" value="2" /></div></div><div class="field-grid"><div class="field"><label class="input-label">Service date</label><input id="claim-date" type="date" value="${state.date}" /></div><div class="field"><label class="input-label">Arrival time</label><input id="claim-time" type="time" value="18:30" /></div></div><div class="field"><label class="input-label">Phone (optional)</label><input id="claim-phone" /></div><div class="field"><label class="input-label">Evidence seen by host</label><textarea id="claim-evidence" placeholder="e.g. Guest displayed confirmation on phone; manager must review."></textarea></div><div class="notice">${ico('alert')}<span>We'll add a pending claim and manager exception. No table is automatically committed.</span></div>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="submit-claim">Record pending claim</button>`;
 }
 else if(m==='start'){
  title='Activate Continuity Mode';desc='The restaurant, not the booking provider, becomes the booking authority.';
  body=`<div class="field"><label class="input-label">Service date</label><input id="start-date" type="date" value="${state.date}" /></div><div class="field"><label class="input-label">Incident reason</label><textarea id="start-reason">Primary booking provider is currently unavailable. Hosts will verify independently before accepting new commitments.</textarea></div><div class="notice">${ico('shield')}<span>New booking capacity stays uncertain until a manager explicitly verifies a table and time window.</span></div>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="submit-start">Activate outage workspace</button>`;
 }
 else if(m==='table'){
  const t=tableById(state.modalTable);
  if(!t)return '';
  const s=mapState(t);
  title=`Table ${t.label}`;desc=`${t.area} · ${t.seats} seats · ${s} at ${prettyTime(state.focusTime)}`;
  const matches=state.data.bookings.filter(b=>b.table_id===t.id),held=state.data.holds.filter(ho=>ho.table_id===t.id);
  body=`<div class="preview-summary"><span class="preview-chip">${t.seats} seats</span><span class="preview-chip ${s==='held'||s==='uncertain'?'warn':''}">${s.toUpperCase()}</span></div><h4 style="font-size:12px">Table commitments</h4>${matches.map(b=>`<div class="preview-row"><div><strong>${h(b.guest_name)} · ${h(prettyTime(b.time))}</strong><small>${b.party_size} guests · ${h(b.state.replace('_',' '))}</small></div>${pill(b.state)}</div>`).join('')||'<p class="note-quiet">No assigned reservations in the ledger</p>'}<h4 style="font-size:12px">Protected holds</h4>${held.map(ho=>`<div class="preview-row"><strong>${h(prettyTime(ho.time))}–${h(prettyTime(ho.end_time))}</strong><small>${h(ho.reason)}</small></div>`).join('')||'<p class="note-quiet">No holds on this table.</p>'}<div class="divider"></div><p class="note-quiet">Floor snapshot is indicative. Booking confirmation always requests fresh server-side availability.</p>`;
  footer=`<button class="btn" data-action="close-modal">Close</button>${isManager()&&active()?`<button class="btn btn-dark" data-action="verify-table" data-id="${t.id}">${ico('shield')} Verify full evening</button><button class="btn btn-primary" data-action="open-hold" data-id="${t.id}">${ico('lock')} Add hold</button>`:''}`;
 }
 else if(m==='hold'){
  title='Protect uncertain inventory';desc='Manager hold blocks a specific table from new confirmed bookings.';
  body=`<div class="field"><label class="input-label">Table</label><select id="hold-table">${state.data.tables.map(t=>`<option value="${t.id}" ${t.id===state.modalTable?'selected':''}>${h(t.label)} · ${t.seats} seats</option>`).join('')}</select></div><div class="field-grid"><div class="field"><label class="input-label">Start</label><input type="time" id="hold-start" value="18:00" /></div><div class="field"><label class="input-label">End</label><input type="time" id="hold-end" value="20:00" /></div></div><div class="field"><label class="input-label">Why is this inventory protected?</label><textarea id="hold-reason">Unassigned existing reservation / uncertain demand buffer</textarea></div>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="submit-hold">Add protected hold</button>`;
 }
 else if(m==='review'){
  const b=state.data.bookings.find(b=>b.id===state.modalTable);
  if(!b)return '';
  title=`Reservation #${b.id}`;desc=`${b.guest_name} · party of ${b.party_size} · ${prettyTime(b.time)}`;
  body=`<div class="preview-row"><strong>Status</strong>${pill(b.state)}</div><div class="preview-row"><strong>Source</strong><span>${h(b.source)}</span></div><div class="preview-row"><strong>Verification</strong><span>${h(b.verification)}</span></div><div class="preview-row"><strong>Assigned table</strong><span>${h(tbLabel(b.table_id))}</span></div><div class="preview-row"><strong>Confirmation</strong><span>${h(b.confirmation_code||'Not confirmed')}</span></div><div class="preview-row"><strong>Contact</strong><span>${h(b.phone||'Not available')}</span></div><div class="preview-row"><strong>Host notes</strong><span style="max-width:240px;text-align:right">${h(b.note||'None')}</span></div>
  ${isManager()&&b.state==='imported_unverified'?`<div class="divider"></div><div class="field"><label class="input-label">Assign an unconflicted table (manager only)</label><select id="assign-table"><option value="">Choose a table</option>${state.data.tables.filter(t=>t.seats>=b.party_size).map(t=>`<option value="${t.id}" ${b.table_id===t.id?'selected':''}>${h(t.label)} · ${t.seats} seats</option>`).join('')}</select></div><div class="notice">${ico('alert')}<span>Assign a table only after inspecting evidence and protecting other known commitments. Then explicitly verify this guest.</span></div>`:''}`;
  footer=`<button class="btn" data-action="close-modal">Close</button>${isManager()&&b.state==='imported_unverified'?`<button class="btn btn-dark" data-action="assign-booking" data-id="${b.id}">Assign table</button><button class="btn btn-primary" data-action="verify-booking" data-id="${b.id}" ${b.table_id?'':'disabled'}>Mark verified</button>`:''}`;
 }
 else if(m==='resolve'){
  const conflict=state.data.conflicts.find(c=>c.id===state.modalTable);
  if(!conflict)return '';
  title='Resolve an exception';desc=`Incident conflict #${conflict.id} · manager authorization`;
  body=`<div class="notice" style="margin-bottom:14px">${ico('alert')}<span>${h(conflict.description)}</span></div><div class="field"><label class="input-label">Resolution performed and supporting rationale</label><textarea id="resolution-text" placeholder="Example: Called guest, reviewed confirmation, assigned T10 and protected capacity; synced with provider manually."></textarea></div><p class="note-quiet">Resolving this exception does not silently verify or confirm the underlying reservation.</p>`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="submit-resolution">Document & resolve</button>`;
 }
 else if(m==='close'){
  title='Manager reconciliation sign-off';desc='End Continuity Mode only after the restored provider has been reconciled.';
  const n=state.data.conflicts.filter(c=>c.state==='open').length;
  body=`${n?`<div class="notice">${ico('alert')}<span><strong>${n} conflicts remain open.</strong> Normal closeout is blocked. A manager may record a documented exception if appropriate.</span></div>`:`<div class="notice good">${ico('checkcircle')}<span>There are no open incident conflicts.</span></div>`}<div class="field" style="margin-top:17px"><label class="input-label">Reconciliation and recovery summary</label><textarea id="close-reason" placeholder="Records manually reconciled against restored provider export; guests contacted where necessary; all changes reviewed."></textarea></div>${n?`<label style="display:flex;align-items:start;gap:9px;font-size:12px"><input id="close-override" type="checkbox" style="margin-top:3px" /> Use documented manager exception for unresolved conflicts</label>`:''}`;
  footer=`<button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="submit-close">${ico('checkcircle')} Sign off & close</button>`;
 }
 return wrapModal(title,desc,body,footer,m==='book'||m==='table'||m==='review');
}
function loginUI(){
 return `<div class="login-page"><div class="login-visual"><div style="display:flex;align-items:center;gap:12px"><div class="brand-mark">C<span>.</span></div><strong style="font:800 21px Manrope,sans-serif;letter-spacing:-.6px">continuity</strong></div><div><span style="color:#e7a178;font-weight:800;font-size:11px;letter-spacing:2px">RESTAURANT OPERATIONS, RESILIENT BY DESIGN</span><h1>Every table.<br/>Every promise.<br/><span style="color:#ed9d76">Still yours.</span></h1><p>When your reservation platform goes down, your hospitality doesn't have to. Run service with verified inventory and a recoverable ledger.</p></div><footer>AN INDEPENDENT CONTINGENCY WORKSPACE · DEMO BUILD</footer></div><div class="login-right"><div class="login-card"><p class="eyebrow">YOUR SERVICE WORKSPACE</p><h2>Welcome back.</h2><p>Sign in to coordinate the floor, protect commitments and keep your guests moving.</p><form id="login-form"><div class="field"><label class="input-label" for="login-user">Username</label><input type="text" id="login-user" value="manager" autocomplete="username" required /></div><div class="field"><label class="input-label" for="login-pass">Password</label><input type="password" id="login-pass" value="demo123!" autocomplete="current-password" required /></div><button type="submit" class="btn btn-primary btn-block" style="padding:14px;font-size:13px">Sign in to workspace ${ico('arrow')}</button></form><div class="login-hint"><strong>Try the role-based demo</strong><div style="margin-top:6px">Manager: <code>manager</code> · Host: <code>host</code><br/>Password for both: <code>demo123!</code></div><div class="login-accounts"><button class="btn btn-sm" data-action="demo-login" data-role="manager">Manager view</button><button class="btn btn-sm" data-action="demo-login" data-role="host">Host view</button></div></div><p class="footer-inline">Sample guests and restaurant are fictional. Local prototype; not a live reservation network.</p></div></div></div>`;
}
function render(){
 const el=$('#app');if(!el)return;
 el.innerHTML=state.token&&state.data?shell():state.token?'<div class="boot-screen"><div class="brand-mark">C<span>.</span></div><p>Loading service ledger...</p></div>':loginUI();
}
async function availabilityCheck(){
 const d=$('#book-date')?.value || state.date, t=$('#book-time')?.value||'18:30', p=Number($('#book-party')?.value||2);
 state.available=await request('/api/availability?date='+encodeURIComponent(d)+'&time='+t+'&party_size='+p);
 state.selectedTable=null;
 // Preserve booking fields while re-rendering only table choices section, not the whole modal.
 const cache={name:$('#book-name')?.value,phone:$('#book-phone')?.value,note:$('#book-note')?.value,party:p,date:d,time:t};
 render();
 if(state.modal==='book'){
  $('#book-name').value=cache.name||'';$('#book-phone').value=cache.phone||'';$('#book-note').value=cache.note||'';
  $('#book-party').value=String(cache.party);$('#book-date').value=cache.date;$('#book-time').value=cache.time;
 }
}
async function submitBooking(confirm){
 const payload={guest_name:$('#book-name').value.trim(),party_size:Number($('#book-party').value),date:$('#book-date').value,
  time:$('#book-time').value,phone:$('#book-phone').value, note:$('#book-note').value,table_id:confirm?state.selectedTable:null,
  confirm,idempotency_key:csrfToken()};
 if(!payload.guest_name||payload.guest_name.length<2)throw Error('Enter a guest name first.');
 if(confirm&&!payload.table_id)throw Error('Choose a verified table.');
 if(confirm&&(!state.available||state.available.date!==payload.date||state.available.time!==payload.time||state.available.party_size!==payload.party_size))throw Error('Time or party size changed. Check inventory again.');
 if(state.bookingSubmitting)return;state.bookingSubmitting=true;
 try{
  const r=await request('/api/reservations',{method:'POST',body:payload});
  state.modal=null;state.available=null;state.selectedTable=null;
  await refresh();toast(confirm?`Confirmed · ${r.booking.confirmation_code} · ${tbLabel(r.booking.table_id)}`:'Guest request saved as unconfirmed pending');
 }finally{state.bookingSubmitting=false}
}
function csvEscape(x){return '"'+String(x??'').replaceAll('"','""')+'"'}
function digestToCSV(text){
 const result=['guest_name,party_size,date,time,table,phone'];const lines=text.split(/\r?\n/).filter(x=>x.trim());
 for(const line of lines){
  const parts=line.split('|').map(x=>x.trim());
  if(parts.length<3)continue;
  const match=parts[0].match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!match)continue;
  let hh=Number(match[1])%12;if(match[3].toUpperCase()==='PM')hh+=12;
  const t=String(hh).padStart(2,'0')+':'+match[2],party=Number(parts[2]);
  if(!Number.isInteger(party)||party<1)continue;
  result.push([parts[1],party,state.date,t,parts[3]||'',parts[4]||''].map(csvEscape).join(','));
 }
 if(result.length===1)throw Error('No guest lines matched sample digest format. Use "6:30 PM | Guest Name | 2 | T01 | Phone".');
 return result.join('\n');
}
function preserveImportInputs(){state.csvText=$('#csv-content')?.value??state.csvText;state.csvSource=$('#csv-source')?.value??state.csvSource}

async function handleAction(btn){
 const action=btn.dataset.action,id=Number(btn.dataset.id||0);
 if(action==='nav'){state.view=btn.dataset.view;state.search='';state.statusFilter='all';state.preview=null;render();window.scrollTo(0,0);return}
 if(action==='logout'){await request('/api/logout',{method:'POST'});state.token='';sessionStorage.removeItem('rcm-token');state.data=null;render();return}
 if(action==='demo-login'){state.token='';const out=await request('/api/login',{method:'POST',body:{username:btn.dataset.role,password:'demo123!'}});state.token=out.token;state.user=out.user;sessionStorage.setItem('rcm-token',out.token);state.date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await refresh();return}
 if(action==='new-booking'){state.modal='book';state.available=null;state.selectedTable=null;render();await availabilityCheck();return}
 if(action==='claim'){state.modal='claim';render();return}
 if(action==='open-start'){state.modal='start';render();return}
 if(action==='close-modal'){state.modal=null;render();return}
 if(action==='dismiss-modal'){if(btn.classList.contains('modal-layer')){state.modal=null;render()}return}
 if(action==='table-detail'){state.modal='table';state.modalTable=id;render();return}
 if(action==='open-hold'){state.modal='hold';state.modalTable=id||state.data.tables[0].id;render();return}
 if(action==='review-booking'){state.modal='review';state.modalTable=id;render();return}
 if(action==='resolve-conflict'){state.modal='resolve';state.modalTable=id;render();return}
 if(action==='open-close'){state.modal='close';render();return}
 if(action==='check-availability'){await availabilityCheck();return}
 if(action==='pick-table'){state.selectedTable=id;const cache={name:$('#book-name').value,phone:$('#book-phone').value,note:$('#book-note').value,party:$('#book-party').value,date:$('#book-date').value,time:$('#book-time').value};render();$('#book-name').value=cache.name;$('#book-phone').value=cache.phone;$('#book-note').value=cache.note;$('#book-party').value=cache.party;$('#book-date').value=cache.date;$('#book-time').value=cache.time;return}
 if(action==='book-confirm'||action==='book-request'){await submitBooking(action==='book-confirm');return}
 if(action==='submit-claim'){await request('/api/claims',{method:'POST',body:{date:$('#claim-date').value,time:$('#claim-time').value,guest_name:$('#claim-name').value,party_size:Number($('#claim-party').value),phone:$('#claim-phone').value,evidence:$('#claim-evidence').value}});state.modal=null;await refresh();toast('Guest claim recorded. Manager verification required.');return}
 if(action==='submit-start'){const d=$('#start-date').value;await request('/api/incident/start',{method:'POST',body:{date:d,reason:$('#start-reason').value}});state.date=d;state.modal=null;await refresh();toast('Continuity Mode active. Verify capacity before booking.');return}
 if(action==='verify-table'){const t=tableById(id);if(!window.confirm(`Confirm you have independently verified ${t.label} is safe for bookings from 5 PM through 11 PM, considering existing unassigned guests and safety buffers?`))return;await request('/api/tables/verify',{method:'POST',body:{date:state.date,table_id:id,start_time:'17:00',end_time:'23:00',note:'Manager independently reviewed and verified table inventory for evening service'}});state.modal=null;await refresh();toast(`${t.label} verified by manager`);return}
 if(action==='submit-hold'){await request('/api/holds',{method:'POST',body:{date:state.date,table_id:Number($('#hold-table').value),start_time:$('#hold-start').value,end_time:$('#hold-end').value,reason:$('#hold-reason').value}});state.modal=null;await refresh();toast('Protected hold created');return}
 if(action==='release-hold'){if(!window.confirm('Release this protected inventory hold? This does not cancel guest records.'))return;await request('/api/holds/'+id,{method:'DELETE'});await refresh();toast('Manager hold released');return}
 if(action==='change-state'){await request(`/api/reservations/${id}/state`,{method:'PATCH',body:{state:btn.dataset.next,version:Number(btn.dataset.version),reason:'Front-of-house service update'}});await refresh();toast('Guest status updated');return}
 if(action==='assign-booking'){const b=state.data.bookings.find(b=>b.id===id);const table_id=Number($('#assign-table').value);if(!table_id)throw Error('Select a table first.');await request(`/api/reservations/${id}/assign`,{method:'PATCH',body:{table_id,version:b.version,reason:'Manager reviewed guest evidence and table assignment'}});state.modal=null;await refresh();toast('Table assigned. Verify guest evidence before marking verified.');return}
 if(action==='verify-booking'){const b=state.data.bookings.find(b=>b.id===id);if(!window.confirm('Has the guest confirmation been independently verified and the table safely protected?'))return;await request(`/api/reservations/${id}/state`,{method:'PATCH',body:{state:'verified_existing',version:b.version,reason:'Manager independently inspected guest evidence'}});state.modal=null;await refresh();toast('Existing guest verified');return}
 if(action==='submit-resolution'){await request(`/api/conflicts/${state.modalTable}/resolve`,{method:'POST',body:{resolution:$('#resolution-text').value}});state.modal=null;await refresh();toast('Manager resolution recorded');return}
 if(action==='submit-close'){await request('/api/incident/close',{method:'POST',body:{date:state.date,reason:$('#close-reason').value,override:!!$('#close-override')?.checked}});state.modal=null;await refresh();toast('Manager sign-off saved. Incident closed.');return}
 if(action==='export'){const kind=btn.dataset.kind;await request(`/api/export/${kind}?date=${encodeURIComponent(state.date)}`,{download:true,filename:`rcm_${kind}_${state.date}.csv`});toast('UTF-8 CSV export prepared');return}
 if(action==='print'){window.print();return}
 if(action==='import-tab'){preserveImportInputs();state.importTab=btn.dataset.tab;state.csvText='';state.preview=null;render();return}
 if(action==='load-sample'){state.importTab='csv';state.csvText=btn.dataset.sample;state.csvSource=state.date+' 14:00';state.preview=null;render();return}
 if(action==='download-template'){
  const csv='guest_name,party_size,date,time,table,phone\nExample Guest,2,'+state.date+',18:00,T01,\n';
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='continuity_import_template.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return;
 }
 if(action==='preview-import'){
  preserveImportInputs();const raw=state.importTab==='digest'?digestToCSV(state.csvText):state.csvText;
  state.preview=await request('/api/imports/preview',{method:'POST',body:{csv_text:raw,origin:state.importTab==='digest'?'Pasted restaurant shift digest':'Approved restaurant backup CSV',source_as_of:state.csvSource}});
  render();toast('Import reviewed. Check flagged rows before committing.');return;
 }
 if(action==='commit-import'){
  preserveImportInputs();const raw=state.importTab==='digest'?digestToCSV(state.csvText):state.csvText;
  if(!window.confirm('Commit ready rows as imported-unverified guest records? Manager verification is still required.'))return;
  const r=await request('/api/imports/commit',{method:'POST',body:{csv_text:raw,origin:state.importTab==='digest'?'Pasted restaurant shift digest':'Approved restaurant backup CSV',source_as_of:state.csvSource}});
  state.preview=null;state.csvText='';await refresh();toast(`Imported ${r.accepted} unverified rows; flagged/rejected ${r.rejected}.`);return;
 }
 if(action==='compare'){
  state.reconcileCsv=$('#reconcile-csv').value;
  state.reconcile=await request('/api/reconcile/preview',{method:'POST',body:{date:state.date,csv_text:state.reconcileCsv}});
  render();toast('Comparison prepared; no provider write-back performed');return;
 }
}

document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 if(btn.dataset.action==='dismiss-modal'&&e.target!==btn)return;
 e.preventDefault();run(()=>handleAction(btn));
});
document.addEventListener('change',e=>{
 const el=e.target;
 run(async()=>{
  if(el.id==='service-date'){state.date=el.value;state.preview=null;state.reconcile=null;await refresh()}
  if(el.id==='focus-time'){state.focusTime=el.value;render()}
  if(el.id==='status-filter'){state.statusFilter=el.value;render()}
  if(el.id==='csv-file'||el.id==='reconcile-file'){
   const f=el.files?.[0];if(!f)return;
   if(f.size>1_000_000)throw Error('File exceeds 1 MB.');
   const txt=await f.text();
   if(el.id==='csv-file'){state.csvText=txt;state.preview=null;$('#csv-content').value=txt;toast('CSV loaded. Preview before committing.')}
   else{state.reconcileCsv=txt;$('#reconcile-csv').value=txt;toast('Recovered export loaded.')}
  }
  if(el.id==='book-party'||el.id==='book-date'||el.id==='book-time'){
   state.available=null;state.selectedTable=null;const f={name:$('#book-name').value,phone:$('#book-phone').value,note:$('#book-note').value,party:$('#book-party').value,date:$('#book-date').value,time:$('#book-time').value};
   render();$('#book-name').value=f.name;$('#book-phone').value=f.phone;$('#book-note').value=f.note;$('#book-party').value=f.party;$('#book-date').value=f.date;$('#book-time').value=f.time;
  }
 });
});
document.addEventListener('input',e=>{
 if(e.target.id==='search-reservations'){
  const start=e.target.selectionStart||0;state.search=e.target.value;render();
  const input=$('#search-reservations');if(input){input.focus();input.setSelectionRange(start,start)}
 }
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='login-form')return;e.preventDefault();run(async()=>{
  const creds={username:$('#login-user').value.trim(),password:$('#login-pass').value};
  const out=await request('/api/login',{method:'POST',body:creds});state.token=out.token;state.user=out.user;sessionStorage.setItem('rcm-token',out.token);
  state.date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await refresh();
 });
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal){state.modal=null;render()}});
async function boot(){
 state.date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(state.token){try{await refresh()}catch{state.token='';sessionStorage.removeItem('rcm-token');render()}}
 else render();
 setInterval(()=>{if(state.token&&state.data&&!state.modal)refresh().catch(()=>{})},15000);
}
boot();
