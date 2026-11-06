/* VALEN TERMINAL — native, dependency-free Canvas engines.
 * Financial observations stay immutable. Scenario assumptions never masquerade as live feeds.
 * Public API: MostroCanvas.{getState,render,setBrand,setMacroFeed,dispose,math}.
 */
(function (root) {
  'use strict';
  const doc = root.document, B = root.MOSTRO_BUNDLE, E = root.MostroEngine;
  const GOLD = '#FFB800', GREEN = '#00F5A0', RED = '#FF2E63', INK = '#071A17', MUTED = '#8AB3AD';
  const colors = [GREEN, RED, GOLD];
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const fmt = (n, digits = 2) => finite(n) ? n.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'N/D';
  const tickLabel = n => n !== 0 && Math.abs(n) < .01 ? n.toExponential(1) : new Intl.NumberFormat('en-US', {notation:'compact',maximumSignificantDigits:3}).format(n);
  const metric = (p, ...keys) => { for (const k of keys) { const n = p.metrics?.[k]?.value; if (finite(n)) return n; } return null; };
  const sector = p => p.category || 'Unclassified';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const axes = ['Fees', 'TVL', 'Value', 'Volume', 'Revenue', 'Distribution', 'Development', 'Funding'];
  function rank(value, values) {
    if (!finite(value)) return null;
    const xs = values.filter(finite); if (xs.length < 2) return 50;
    const below = xs.filter(n => n < value).length, equal = xs.filter(n => n === value).length;
    return 100 * (below + (equal - 1) / 2) / (xs.length - 1);
  }
  function arenaVerdict(entries) {
    const common = axes.map((_, i) => i).filter(i => entries.every(e => finite(e.axes[i])));
    if (entries.length < 2 || common.length < 4) return {common, scores: [], winners: [], reason: 'Insufficient comparable data (minimum 4 common axes).'};
    const scores = entries.map(e => ({id: e.id, score: mean(common.map(i => e.axes[i]))}));
    const max = Math.max(...scores.map(s => s.score));
    return {common, scores, winners: scores.filter(s => max - s.score <= 0.1).map(s => s.id), reason: 'Equal-weight percentile score on common axes.'};
  }
  // Gram matrix of independent factor exposures + asset-specific residual variance.
  // These exposures are explicit scenario assumptions; no historical correlation claim.
  const assetNames = ['BTC', 'ETH', 'DeFi', 'S&P 500', 'Gold', 'USD', 'UST'];
  const exposures = [[1,.1,1,-.1],[1.1,.6,1.1,-.3],[1.3,1.4,1.2,-1],[.7,.1,.3,-.1],[.2,0,-.4,0],[-.8,-.1,-.3,.1],[.3,0,-.6,0]];
  function correlation(shocks) {
    const variance = ['tvl','fees','derivatives','unlock'].map(k => 1 + Math.abs(Number(shocks[k]) || 0) / 25);
    const cov = exposures.map((a, i) => exposures.map((b, j) => a.reduce((s, x, k) => s + x * b[k] * variance[k], 0) + (i === j ? .6 : 0)));
    return cov.map((row, i) => row.map((v, j) => clamp(v / Math.sqrt(cov[i][i] * cov[j][j]), -1, 1)));
  }
  function tile(items, x, y, w, h, output = []) {
    if (!items.length) return output;
    if (items.length === 1) { output.push({...items[0], x, y, w, h}); return output; }
    const total = items.reduce((s, p) => s + p.weight, 0); let sum = 0, cut = 0;
    while (cut < items.length - 1 && sum < total / 2) sum += items[cut++].weight;
    const f = sum / total;
    if (w >= h) { tile(items.slice(0,cut), x,y,w*f,h,output); tile(items.slice(cut),x+w*f,y,w*(1-f),h,output); }
    else { tile(items.slice(0,cut),x,y,w,h*f,output); tile(items.slice(cut),x,y+h*f,w,h*(1-f),output); }
    return output;
  }
  const API = root.MostroCanvas = {ready: false, math: {rank, arenaVerdict, correlation, tile}};
  if (!doc || !B || !E) return;
  const $ = id => doc.getElementById(id), protocols = B.protocols, byId = new Map(protocols.map(p => [p.entity_id,p]));
  const snapshots = new Map(protocols.map(p => [p.entity_id,E.snapshot(p)]));
  const listeners = [], surfaces = new Map(), reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let state = {sector:'ALL', selected:B.canvas_config?.scatter_default||'aave', shocks:{}, points:[], missing:[], rectangles:[], matrix:[], arena:null, macro:null, frames:0};
  let hovered = null, pending = 0, animation = 0, stopped = false, disposed = false, lastSweep = 0, feed = null;
  let observer, resizeObserver;
  function on(node, event, fn) { if (node) { node.addEventListener(event,fn); listeners.push(() => node.removeEventListener(event,fn)); } }
  function makeSurface(id, height) {
    const canvas = $(id); if (!canvas) return null;
    let ctx; try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
    if (!ctx) { canvas.replaceWith(Object.assign(doc.createElement('p'),{textContent:'Canvas unavailable. Use the selectors and data tables.'})); return null; }
    const s = {canvas,ctx,w:0,h:height,height}; surfaces.set(id,s); return s;
  }
  function prepare(id) {
    const s = surfaces.get(id); if (!s || s.canvas.closest('[hidden]')) return null;
    const box = s.canvas.getBoundingClientRect(); s.w = Math.max(1,box.width || s.canvas.parentElement.clientWidth || 640); s.h = box.height || s.height;
    const dpr = clamp(root.devicePixelRatio || 1,1,3), pw = Math.round(s.w*dpr), ph = Math.round(s.h*dpr);
    if (s.canvas.width !== pw || s.canvas.height !== ph) { s.canvas.width=pw; s.canvas.height=ph; }
    s.ctx.setTransform(dpr,0,0,dpr,0,0); s.ctx.clearRect(0,0,s.w,s.h); s.ctx.fillStyle=INK;s.ctx.fillRect(0,0,s.w,s.h);
    s.ctx.font='11px monospace';s.ctx.textAlign='left';s.ctx.textBaseline='middle';return s;
  }
  function text(s, value, x, y, color=MUTED, align='left') { s.ctx.fillStyle=color;s.ctx.textAlign=align;s.ctx.fillText(String(value),x,y); }
  function line(s,x1,y1,x2,y2,color=MUTED,width=1) { const c=s.ctx;c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke(); }
  function cross(s,x,y) { s.ctx.setLineDash([4,4]);line(s,40,y,s.w-12,y,GOLD);line(s,x,16,x,s.h-36,GOLD);s.ctx.setLineDash([]); }
  function readShocks() { return Object.fromEntries(['tvl','fees','derivatives','unlock'].map(k=>[k,Number($('shock-'+k)?.value)||0])); }
  function result(p) { return E.simulate(snapshots.get(p.entity_id),state.shocks,10,false,B.audit.fee_p25); }
  function peers(p) {
    const base=snapshots.get(p.entity_id);
    return protocols.filter(q=>q.entity_id!==p.entity_id&&sector(q)===sector(p)).sort((a,b)=>{
      const distance=q=>{const n=snapshots.get(q.entity_id).fees;return finite(n)&&finite(base.fees)?Math.abs(Math.log1p(Math.max(0,n))-Math.log1p(Math.max(0,base.fees))):Infinity;};
      return distance(a)-distance(b)||String(a.name||a.ticker||a.entity_id).localeCompare(String(b.name||b.ticker||b.entity_id));
    }).slice(0,4);
  }
  function details(p) {
    const r=result(p), ps=peers(p), date=p.metrics?.commissioni_giornaliere?.as_of||p.metrics?.commissioni_24h?.as_of||'N/D';
    return `${p.name} (${p.ticker||'—'}) · ${sector(p)}\nFees: $${fmt(r.fees)} / day · MCAP/TVL: ${fmt(r.ratio)}× · as of ${date}\nSector peers (${ps.length}/4): ${ps.map(q=>`${q.ticker||q.name} [fees $${fmt(result(q).fees)}; MCAP/TVL ${fmt(result(q).ratio)}×]`).join(' · ') || 'none available'}${ps.length<4?' · fewer than four peers in this sector':''}`;
  }
  function selectProtocol(id) {
    if (!byId.has(id)) return;state.selected=id;
    const slot=$('arena-target').value; $('arena-select-'+slot).value=id;
    $('canvas-protocol').value=id;$('scatter-selection').textContent=details(byId.get(id));schedule();
  }
  function updateFilter() {
    state.sector=$('canvas-sector').value;const ps=protocols.filter(p=>state.sector==='ALL'||sector(p)===state.sector);
    $('canvas-protocol').innerHTML=ps.map(p=>`<option value="${esc(p.entity_id)}">${esc(p.ticker||'—')} · ${esc(p.name)}</option>`).join('');
    if(ps.some(p=>p.entity_id===state.selected))$('canvas-protocol').value=state.selected;
    hovered=null;$('scatter-tooltip').hidden=true;schedule();
  }
  function drawScatter() {
    const s=prepare('valen-scatter'), filtered=protocols.filter(p=>state.sector==='ALL'||sector(p)===state.sector);
    const rows=filtered.map(p=>({p,r:result(p)})), valid=rows.filter(({r})=>finite(r.fees)&&r.fees>=0&&finite(r.ratio)&&r.ratio>0);
    state.missing=rows.filter(row=>!valid.includes(row)).map(row=>row.p.entity_id);
    $('scatter-summary').textContent=`${valid.length} plotted + ${state.missing.length} without fees / positive MCAP/TVL = ${filtered.length} selected / ${protocols.length} total. X log10(1 + daily fees USD); Y log10(MCAP/TVL). Dividers: filtered medians.`;
    $('scatter-missing').innerHTML=state.missing.map(id=>`<button class="room-btn" data-protocol="${esc(id)}">${esc(byId.get(id).ticker||byId.get(id).name)} · N/D</button>`).join('');
    state.points=[];if(!s)return;
    const xs=valid.map(v=>Math.log10(1+v.r.fees)),ys=valid.map(v=>Math.log10(v.r.ratio));
    const bounds=values=>{let lo=Math.min(...values),hi=Math.max(...values);if(!values.length)return[0,1];if(lo===hi){lo-=.5;hi+=.5;}const pad=(hi-lo)*.08;return[lo-pad,hi+pad];};
    const [x0,x1]=bounds(xs),[y0,y1]=bounds(ys),left=70,right=s.w-24,top=32,bottom=s.h-48;
    const px=x=>left+(x-x0)/(x1-x0)*(right-left),py=y=>bottom-(y-y0)/(y1-y0)*(bottom-top);
    const median=ns=>{const x=ns.slice().sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;};
    for(let i=0;i<=4;i++){const x=x0+(x1-x0)*i/4,y=y0+(y1-y0)*i/4;line(s,px(x),top,px(x),bottom,'#163B33');line(s,left,py(y),right,py(y),'#163B33');text(s,tickLabel(Math.max(0,10**x-1)),px(x),bottom+14,MUTED,i===0?'left':i===4?'right':'center');text(s,tickLabel(10**y),left-5,py(y),MUTED,'right');}
    if(valid.length){const mx=px(median(xs)),my=py(median(ys));s.ctx.setLineDash([4,4]);line(s,mx,top,mx,bottom,GOLD);line(s,left,my,right,my,GOLD);s.ctx.setLineDash([]);}
    text(s,'HIGH MULTIPLE',left,15,RED);text(s,'HIGH FEES',right,15,GREEN,'right');text(s,'LOW FEES',left,bottom-10,MUTED);text(s,'LOW MULTIPLE',right,bottom-10,GOLD,'right');
    text(s,'Cash Flow / Fees · USD per day',s.w/2,s.h-10,GOLD,'center');
    s.ctx.save();s.ctx.translate(11,s.h/2);s.ctx.rotate(-Math.PI/2);text(s,'MCAP / TVL',0,0,GOLD,'center');s.ctx.restore();
    valid.forEach(({p,r},i)=>{const x=px(xs[i]),y=py(ys[i]),selected=p.entity_id===state.selected;circ(s,x,y,selected?6:3.5,selected?GOLD:finite(r.score)&&r.score>=50?GREEN:RED);state.points.push({id:p.entity_id,x,y,fees:r.fees,ratio:r.ratio});});
    const point=state.points.find(p=>p.id===hovered);if(point)cross(s,point.x,point.y);
  }
  function circ(s,x,y,r,color,fill=true) { const c=s.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.strokeStyle=color;fill?c.fill():c.stroke(); }
  function arenaRows() {
    const all=protocols.map(p=>{const r=result(p),share=metric(p,'quota_primi10_esclusi_contratti','quota_primi10');return {id:p.entity_id,raw:[r.fees,r.tvl,finite(r.ratio)&&r.ratio>0?1/r.ratio:null,metric(p,'volume_24h','volume_dex_24h'),metric(p,'ricavi_giornalieri','ricavi_24h'),finite(share)?1-share:null,metric(p,'commit_settimanali_entita','commit_settimanale'),finite(r.funding)?-Math.abs(r.funding):null]};});
    const populations=axes.map((_,i)=>all.map(r=>r.raw[i]));return all.map(r=>({...r,axes:r.raw.map((v,i)=>rank(v,populations[i]))}));
  }
  function drawArena() {
    const ids=[...new Set(['a','b','c'].map(k=>$('arena-select-'+k).value).filter(id=>byId.has(id)))];
    const all=arenaRows(),entries=ids.map(id=>all.find(r=>r.id===id)),verdict=arenaVerdict(entries);state.arena={entries,...verdict};
    const names=verdict.winners.map(id=>byId.get(id).name).join(' / ');
    $('arena-battle-output').textContent=(verdict.winners.length?`${verdict.winners.length>1?'TIE':'WINNER'}: ${names}. `:'SELECT COMPARABLE PROTOCOLS. ')+verdict.reason+' '+verdict.scores.map(v=>`${byId.get(v.id).ticker}: ${fmt(v.score)} / 100`).join(' · ')+` · ${verdict.common.length}/8 common axes.`;
    $('arena-values').innerHTML='<table><thead><tr><th>Percentile / 100</th>'+entries.map((e,i)=>`<th style="color:${colors[i]}">${esc(byId.get(e.id).name)}</th>`).join('')+'</tr></thead><tbody>'+axes.map((a,i)=>'<tr><th>'+a+'</th>'+entries.map(e=>'<td>'+fmt(e.axes[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    const s=prepare('valen-arena');if(!s)return;const cx=s.w/2,cy=s.h/2,r=Math.max(25,Math.min(s.w/2-64,s.h/2-48));
    const point=(i,f)=>[cx+Math.cos(i*Math.PI/4-Math.PI/2)*r*f,cy+Math.sin(i*Math.PI/4-Math.PI/2)*r*f];
    for(let ring=1;ring<=4;ring++){s.ctx.beginPath();for(let i=0;i<8;i++){const [x,y]=point(i,ring/4);i?s.ctx.lineTo(x,y):s.ctx.moveTo(x,y);}s.ctx.closePath();s.ctx.strokeStyle='#255247';s.ctx.stroke();}
    axes.forEach((a,i)=>{const [x,y]=point(i,1),[tx,ty]=point(i,1.22);line(s,cx,cy,x,y,'#255247');const half=s.ctx.measureText(a).width/2; text(s,a,clamp(tx,half+4,s.w-half-4),ty,MUTED,'center');});
    entries.forEach((e,index)=>{const c=s.ctx;c.strokeStyle=colors[index];c.lineWidth=2;
      if(e.axes.every(finite)){c.beginPath();e.axes.forEach((v,i)=>{const [x,y]=point(i,v/100);i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.fillStyle=colors[index]+'20';c.fill();c.stroke();}
      else e.axes.forEach((v,i)=>{const next=(i+1)%8;if(finite(v)&&finite(e.axes[next])){const a=point(i,v/100),b=point(next,e.axes[next]/100);line(s,...a,...b,colors[index],2);}});
      e.axes.forEach((v,i)=>{if(finite(v)){const [x,y]=point(i,v/100);circ(s,x,y,3,colors[index]);}});
      text(s,`${String.fromCharCode(65+index)} · ${byId.get(e.id).ticker||byId.get(e.id).name}`,8,16+index*15,colors[index]);
    });
  }
  function drawTreemap() {
    const s=prepare('valen-treemap');if(!s)return;
    const rows=protocols.map(p=>{const r=result(p);return{id:p.entity_id,weight:r.mcap,score:r.score};}),priced=rows.filter(r=>finite(r.weight)&&r.weight>0).sort((a,b)=>b.weight-a.weight),missing=rows.filter(r=>!finite(r.weight)||r.weight<=0);
    const reserve=missing.length?Math.min(s.h*.35,Math.max(65,Math.ceil(missing.length/12)*17)):0,mainHeight=s.h-reserve;
    const rects=tile(priced,0,0,s.w,mainHeight);if(missing.length)tile(missing.map(r=>({...r,weight:1,unpriced:true})),0,mainHeight+20,s.w,Math.max(1,reserve-20),rects);
    state.rectangles=rects;
    rects.forEach(r=>{const c=s.ctx,col=!finite(r.score)?MUTED:r.score>=50?GREEN:RED;c.fillStyle=col;c.globalAlpha=r.unpriced ? .25 : .18+Math.abs((r.score??50)-50)/100;c.fillRect(r.x+1,r.y+1,Math.max(0,r.w-2),Math.max(0,r.h-2));c.globalAlpha=1;c.strokeStyle='#255247';c.strokeRect(r.x,r.y,r.w,r.h);if(r.w>30&&r.h>17){c.save();c.beginPath();c.rect(r.x+2,r.y+2,r.w-4,r.h-4);c.clip();text(s,byId.get(r.id).ticker||byId.get(r.id).name,r.x+5,r.y+11,'#E6F4F1');if(r.h>38)text(s,fmt(r.score,0),r.x+5,r.y+27);c.restore();}});
    if(missing.length)text(s,`NO MCAP · ${missing.length} equal tiles, not market weight`,5,mainHeight+10,GOLD);
    $('treemap-summary').textContent=`${rects.length} protocols · ${priced.length} sized by MCAP · ${missing.length} unpriced in separate equal-cell strip. Green ≥50 / red <50 resilience; gray N/D. TVL ${state.shocks.tvl}%, fees ${state.shocks.fees}%, derivatives ${state.shocks.derivatives}%, unlock ${state.shocks.unlock}%.`;
  }
  function drawCorrelation() {
    state.matrix=correlation(state.shocks);const s=prepare('valen-correlation');
    $('correlation-summary').textContent='Illustrative factor correlation, NOT observed market correlation. All four gold stress rulers update factor covariance immediately. No cross-asset return history is present in this bundle.';
    $('correlation-values').innerHTML='<table><thead><tr><th>Asset</th>'+assetNames.map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>'+state.matrix.map((r,i)=>'<tr><th>'+assetNames[i]+'</th>'+r.map(v=>'<td>'+fmt(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    if(!s)return;const left=74,top=44,cell=Math.min((s.w-left-8)/7,(s.h-top-18)/7);
    state.matrix.forEach((row,i)=>{text(s,assetNames[i],left-6,top+(i+.5)*cell,MUTED,'right');row.forEach((v,j)=>{const x=left+j*cell,y=top+i*cell;s.ctx.fillStyle=v>=0?GREEN:RED;s.ctx.globalAlpha=.12+Math.abs(v)*.62;s.ctx.fillRect(x+1,y+1,cell-2,cell-2);s.ctx.globalAlpha=1;text(s,fmt(v),x+cell/2,y+cell/2,'#E6F4F1','center');});});
    assetNames.forEach((a,j)=>{s.ctx.save();s.ctx.translate(left+(j+.5)*cell,top-8);s.ctx.rotate(-.35);text(s,a,0,0,GOLD,'center');s.ctx.restore();});
  }
  function derivativeSeries(timeframe) {
    if(feed?.timeframe===timeframe) return feed.points;
    if(timeframe==='H4')return [];
    const observations=new Map(),seen=new Set();
    B.strategies.filter(s=>s.derivatives_invalidation).forEach(s=>s.kpis.filter(k=>/oi_reale|funding|taker_long|liquidazioni|basis|dvol/.test(k.field)).forEach(k=>k.points.forEach(p=>{
      if(!finite(p.value))return;const id=s.entity_id+'|'+k.field+'|'+p.day;if(seen.has(id))return;seen.add(id);
      if(!observations.has(p.day))observations.set(p.day,[]);observations.get(p.day).push(Math.tanh(p.value));
    })));
    return [...observations].sort(([a],[b])=>a.localeCompare(b)).map(([time,values])=>({time,value:mean(values),count:values.length}));
  }
  function macroState() {
    const rules=B.macro.rules,aggregate=B.macro.latest_score,timeframe=$('macro-timeframe').value,series=derivativeSeries(timeframe);
    const capacity=rules.reduce((s,r)=>s+Math.abs(Number(r.bias_valore)||0),0),score=Number(aggregate.punteggio);
    const liquidity=capacity&&finite(score)?clamp(50+50*score/capacity+state.shocks.tvl*.2+state.shocks.fees*.1-state.shocks.unlock*.15):null;
    const last=series.at(-1),observedFunding=protocols.map(p=>metric(p,'tasso_finanziamento')).filter(finite),fundingPressure=mean(observedFunding.map(v=>Math.tanh(v/.0001)));
    const risk=last?clamp(50+50*last.value+state.shocks.derivatives*.25+state.shocks.unlock*.15):finite(fundingPressure)?clamp(50+50*fundingPressure+state.shocks.derivatives*.25+state.shocks.unlock*.15):null;
    const missing=Number(aggregate.regole_mancanti),coverage=finite(missing)&&rules.length?clamp(100*(rules.length-missing)/rules.length):null;
    return{liquidity,risk,coverage,capacity,ruleCount:rules.length,triggered:aggregate.regole_scattate,date:aggregate.data,timeframe,series,feedSource:feed?.timeframe===timeframe?feed.source:'bundle derivative KPI daily deltas'};
  }
  function gauge(id,value,color,label) {
    const s=prepare(id);if(!s)return;const cx=s.w/2,cy=s.h*.48,r=Math.min(s.w*.34,s.h*.34),start=Math.PI*.75,sweep=Math.PI*1.5;
    const c=s.ctx;c.lineWidth=11;c.strokeStyle='#163B33';c.beginPath();c.arc(cx,cy,r,start,start+sweep);c.stroke();
    for(let i=0;i<=10;i++){const a=start+i*sweep/10;line(s,cx+Math.cos(a)*(r+10),cy+Math.sin(a)*(r+10),cx+Math.cos(a)*(r+15),cy+Math.sin(a)*(r+15),MUTED);}
    if(finite(value)){c.strokeStyle=color;c.lineWidth=11;c.beginPath();c.arc(cx,cy,r,start,start+sweep*value/100);c.stroke();const a=start+sweep*value/100;line(s,cx,cy,cx+Math.cos(a)*(r-12),cy+Math.sin(a)*(r-12),color,2);circ(s,cx,cy,4,color);}
    c.font=Math.min(20,s.w*.17)+'px monospace';text(s,finite(value)?fmt(value,1):'N/D',cx,cy+30,color,'center');c.font=Math.min(11,(s.w-10)/(label.length*.62))+'px monospace';text(s,label,cx,s.h-18,color,'center');
  }
  function drawScope(time=0) {
    const s=prepare('valen-oscilloscope');if(!s||!state.macro)return;const m=state.macro,c=s.ctx,cx=s.w/2,cy=s.h/2;
    for(let x=0;x<s.w;x+=30)line(s,x,0,x,s.h,'#163B33');for(let y=0;y<s.h;y+=30)line(s,0,y,s.w,y,'#163B33');
    [24,48,72].forEach(r=>circ(s,cx,cy,r,'#255247',false));line(s,cx-85,cy,cx+85,cy,GOLD);line(s,cx,cy-85,cx,cy+85,GOLD);
    if(m.series.length>1){const gain=clamp(1+state.shocks.derivatives/100,.1,2),offset=(state.shocks.tvl+state.shocks.fees-state.shocks.unlock)/500;
      c.beginPath();m.series.forEach((p,i)=>{const x=12+i/(m.series.length-1)*(s.w-24),y=cy-clamp(p.value*gain+offset,-1,1)*(s.h*.35);i?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle=GREEN;c.lineWidth=2;c.stroke();
      const baseline=cy-(m.liquidity-50)/50*s.h*.25;line(s,0,baseline,s.w,baseline,GOLD);
      text(s,m.series[0].time,8,s.h-12);text(s,m.series.at(-1).time,s.w-8,s.h-12,MUTED,'right');
    }else text(s,'NO '+m.timeframe+' OBSERVATIONS',cx,cy+100,GOLD,'center');
    const angle=time/1400;line(s,cx,cy,cx+Math.cos(angle)*72,cy+Math.sin(angle)*72,GOLD,2);
    text(s,'SNAPSHOT REPLAY · '+m.timeframe,8,16,GOLD);state.frames++;
  }
  function drawMacro() {
    state.macro=macroState();const m=state.macro;
    gauge('valen-gauge-liquidity',m.liquidity,GREEN,'MACRO LIQUIDITY');gauge('valen-gauge-risk',m.risk,RED,'DERIVATIVE PRESSURE');gauge('valen-gauge-confidence',m.coverage,GOLD,'RULE DATA COVERAGE');
    $('gauge-liquidity-value').textContent=`${fmt(m.liquidity,1)} / 100 · aggregate / absolute bias capacity of ${m.ruleCount} rules`;
    $('gauge-risk-value').textContent=`${fmt(m.risk,1)} / 100 · ${m.series.length?m.timeframe+' derivative KPI pressure':'protocol funding snapshot'}`;
    $('gauge-confidence-value').textContent=`${fmt(m.coverage,1)}% aggregate data coverage · ${m.triggered} triggered · ${m.date}`;
    $('scope-summary').textContent=`${m.ruleCount} source rules · macro snapshot ${m.date} · ${m.series.length} ${m.timeframe} observations${m.series.length?' ('+m.series[0].time+' → '+m.series.at(-1).time+')':''}. Source: ${m.feedSource}. Green: mean tanh of deduplicated derivative KPI deltas; gold: macro scenario level. Sweep replays the dated source observations.${!m.series.length?' No observations for this timeframe; no interpolation from D1.':''}`;
    root.MostroCockpit?.updateDials(m);
    drawScope(lastSweep);
  }
  function render() { if(disposed)return;state.shocks=readShocks();drawScatter();drawArena();drawTreemap();drawCorrelation();drawMacro(); if(byId.has(state.selected))$('scatter-selection').textContent=details(byId.get(state.selected)); }
  function schedule() { if(!pending&&!disposed)pending=root.requestAnimationFrame(()=>{pending=0;render();}); }
  function shouldAnimate() { return !disposed&&!stopped&&!reduced?.matches&&!doc.hidden&&!$('room-6').hidden; }
  function tick(t) { animation=0;if(!shouldAnimate())return;if(t-lastSweep>=50){lastSweep=t;drawScope(t);}animation=root.requestAnimationFrame(tick); }
  function syncAnimation() { if(animation)root.cancelAnimationFrame(animation);animation=0;if(shouldAnimate())animation=root.requestAnimationFrame(tick); }
  function pointer(s,event) { const box=s.canvas.getBoundingClientRect();return{x:(event.clientX-box.left)*s.w/(box.width||s.w),y:(event.clientY-box.top)*s.h/(box.height||s.h)}; }
  function setBrand(overrides={}) {
    const brand={...B.brand,...overrides};B.brand=brand;const title=brand.name+' // '+brand.tagline;
    doc.querySelectorAll('[data-brand-name]').forEach(n=>n.textContent=brand.name);doc.querySelectorAll('[data-brand-tagline]').forEach(n=>n.textContent=brand.tagline);doc.querySelectorAll('[data-brand-title]').forEach(n=>n.textContent=title);doc.querySelectorAll('[data-brand-subtitle]').forEach(n=>{n.textContent=brand.subtitle||'';n.hidden=brand.show_subtitle===false||!brand.subtitle;});
    doc.title=title;['og:title','twitter:title','description','og:description','twitter:description'].forEach(k=>doc.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.setAttribute('content',title));doc.querySelector('meta[property="og:site_name"]')?.setAttribute('content',brand.name);
    if(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(brand.domain)){const url='https://'+brand.domain+'/portfolio.html';doc.querySelector('link[rel="canonical"]')?.setAttribute('href',url);doc.querySelector('meta[property="og:url"]')?.setAttribute('content',url);}
    return {...brand};
  }
  function init() {
    if(API.ready||!$('valen-scatter'))return;
    ['scatter','arena','treemap','correlation','oscilloscope'].forEach((n,i)=>makeSurface('valen-'+n,[360,340,420,430,280][i]));['liquidity','risk','confidence'].forEach(n=>makeSurface('valen-gauge-'+n,220));
    setBrand();$('canvas-sector').innerHTML='<option value="ALL">All sectors · '+protocols.length+'</option>'+[...new Set(protocols.map(sector))].sort().map(s=>'<option>'+esc(s)+'</option>').join('');
    const options=protocols.map(p=>`<option value="${esc(p.entity_id)}">${esc(p.ticker||'—')} · ${esc(p.name)}</option>`).join('');
    ['a','b','c'].forEach((slot,i)=>{const node=$('arena-select-'+slot);node.innerHTML=(slot==='c'?'<option value="">No third protocol</option>':'')+options;if(i<2)node.value=(B.canvas_config?.arena_defaults||['aave','uniswap'])[i];on(node,'change',schedule);});
    on($('canvas-sector'),'change',updateFilter);on($('canvas-protocol'),'change',e=>selectProtocol(e.target.value));on($('scatter-missing'),'click',e=>{const b=e.target.closest('[data-protocol]');if(b)selectProtocol(b.dataset.protocol);});
    const scatter=surfaces.get('valen-scatter');if(scatter){
      const hit=e=>{const q=pointer(scatter,e);let best=null,distance=13;state.points.forEach(p=>{const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){best=p;distance=d;}});return best;};
      on(scatter.canvas,'pointermove',e=>{const p=hit(e);hovered=p?.id||null;$('scatter-tooltip').hidden=!p;if(p)$('scatter-tooltip').textContent=details(byId.get(p.id));drawScatter();});
      on(scatter.canvas,'pointerleave',()=>{hovered=null;$('scatter-tooltip').hidden=true;drawScatter();});on(scatter.canvas,'click',e=>{const p=hit(e);if(p)selectProtocol(p.id);});
      on(scatter.canvas,'keydown',e=>{const ids=state.points.map(p=>p.id);if(!ids.length)return;let i=ids.indexOf(state.selected);if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectProtocol(ids[(i+(e.key==='ArrowRight'?1:-1)+ids.length)%ids.length]);}if(e.key==='Enter')selectProtocol(state.selected);});
    }
    const tree=surfaces.get('valen-treemap');if(tree){const hit=e=>{const p=pointer(tree,e);return state.rectangles.find(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);};on(tree.canvas,'pointermove',e=>{const r=hit(e);$('treemap-tooltip').textContent=r?details(byId.get(r.id)):'';});on(tree.canvas,'pointerleave',()=>$('treemap-tooltip').textContent='');on(tree.canvas,'click',e=>{const r=hit(e);if(r)selectProtocol(r.id);});}
    ['tvl','fees','derivatives','unlock'].forEach(k=>on($('shock-'+k),'input',schedule));on($('shock-reset'),'click',schedule);
    on($('macro-timeframe'),'change',schedule);on($('scope-pause'),'click',()=>{stopped=!stopped;$('scope-pause').textContent=stopped?'RESUME SWEEP':'PAUSE SWEEP';$('scope-pause').setAttribute('aria-pressed',String(stopped));syncAnimation();});
    on(doc,'visibilitychange',syncAnimation);on(root,'resize',schedule);if(reduced?.addEventListener)on(reduced,'change',syncAnimation);
    doc.querySelectorAll('[data-room]').forEach(n=>on(n,'click',()=>{schedule();syncAnimation();}));
    if(root.ResizeObserver){resizeObserver=new root.ResizeObserver(schedule);surfaces.forEach(s=>resizeObserver.observe(s.canvas));}
    if(root.MutationObserver){observer=new root.MutationObserver(()=>{schedule();syncAnimation();});doc.querySelectorAll('.terminal-room[id]').forEach(n=>observer.observe(n,{attributes:true,attributeFilter:['hidden']}));}
    updateFilter();render();API.ready=true;syncAnimation();
  }
  API.getState=()=>state;API.render=render;API.setBrand=setBrand;
  // Optional upstream adapter: only explicitly timed observations, never synthesized H4.
  API.setMacroFeed=data=>{
    if(!data||!['H4','D1'].includes(data.timeframe)||typeof data.source!=='string'||!data.source.trim()||!Array.isArray(data.points)||data.points.length<2)throw new TypeError('Expected sourced H4/D1 observations.');
    let previous=-Infinity;const points=data.points.map(p=>{const t=Date.parse(p.time);if(!Number.isFinite(t)||t<=previous||!finite(p.value)||Math.abs(p.value)>1)throw new TypeError('Observations must be ordered, finite and normalized to [-1,1].');previous=t;return{time:p.time,value:p.value};});
    feed={timeframe:data.timeframe,source:data.source,points};schedule();
  };
  API.dispose=()=>{disposed=true;root.cancelAnimationFrame(pending);root.cancelAnimationFrame(animation);pending=animation=0;listeners.forEach(remove=>remove());resizeObserver?.disconnect();observer?.disconnect();};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
