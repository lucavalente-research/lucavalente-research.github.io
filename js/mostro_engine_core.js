/* VALEN TERMINAL V5. Source observations remain immutable. */
(function(root){
'use strict';
const finite=Number.isFinite,clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metric=(p,...keys)=>{for(const k of keys){const v=p?.metrics?.[k]?.value;if(finite(v))return v;}return null;};
const money=n=>!finite(n)?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const fmt=n=>finite(n)?n.toFixed(1):'N/A';
function assess(p,margin=10){
 const fees=metric(p,'commissioni_giornaliere','commissioni_24h'),revenue=metric(p,'ricavi_giornalieri','ricavi_24h'),tvl=metric(p,'tvl'),cap=metric(p,'capitalizzazione','capitalizzazione_mercato');
 const ratio=finite(cap)&&tvl>0?cap/tvl:null,volume=metric(p,'volume_24h','volume_dex_24h'),funding=metric(p,'tasso_finanziamento');
 const whale=metric(p,'quota_primi10_esclusi_contratti','quota_primi10'),circ=metric(p,'offerta_circolante'),total=metric(p,'offerta_massima','offerta_totale');
 const dilution=finite(circ)&&total>0?clamp(100*(1-circ/total)):null;
 const riskParts=[finite(whale)?clamp(whale*100):null,dilution].filter(finite),risk=riskParts.length?Math.max(...riskParts):null;
 const components=[finite(ratio)&&ratio>0?clamp(100/ratio):null,finite(revenue)&&revenue>=0?clamp(Math.log1p(revenue)/Math.log1p(1e6)*100):null,finite(volume)&&volume>=0?clamp(Math.log1p(volume)/Math.log1p(1e9)*100):null,finite(risk)?100-risk:null];
 const present=components.filter(finite),score=present.length===4?present.reduce((a,b)=>a+b,0)/4:null;
 return{fees,revenue,tvl,cap,ratio,volume,funding,risk,dilution,whale,score,components,buffer:finite(score)?score-(50-clamp(margin,0,30)):null,cash:finite(revenue)&&revenue>0&&finite(ratio)&&ratio<1};
}
const API={assess,metric,money};root.MostroApp=API;
if(!root.document)return;
const $=id=>document.getElementById(id),d=root.MOSTRO_BUNDLE;if(!d){$('market-verdict').textContent='Research data is unavailable. Please try again later.';return;}
const named=p=>({...p,ticker:p.ticker||p.name.toUpperCase().slice(0,12)});
const protocols=d.protocols.map(named),strategies=d.strategies,all=new Map([...protocols,...(d.strategy_assets||[]).map(named)].map(p=>[p.entity_id,p]));
let basket='gold',block='all',activeEntity='aave',activeStrategy=null,margin=10,mapEntity='aave',radarMode=false;
const green='#3bffb1',pink='#ff4498',gold='#eec76a';
const logoSymbols=new Set(["usdt", "eth", "avax", "algo", "nexo", "ape", "fun", "doge", "zrx", "tel", "uni", "grt", "xrp", "rep", "sand", "btc", "comp", "aave"]);
const logo=p=>`<span class="coin-logo" aria-label="${esc(p?.name||'Token')} logo"><span>${esc(p?.ticker?.slice(0,3)||'?')}</span>${logoSymbols.has(p?.ticker?.toLowerCase())?`<img loading="lazy" src="assets/token-logos/${esc(p.ticker.toLowerCase())}.svg" alt="" onerror="this.remove()">`:""}</span>`;
function ring(label,value,color,sub,needle=false){const v=finite(value)?clamp(value):0;return `<div class="ring"><svg viewBox="0 0 160 160" role="img" aria-label="${label} ${fmt(value)}"><g stroke="#49604e">${Array.from({length:50},(_,i)=>`<path transform="rotate(${i*7.2} 80 80)" d="M80 7V${i%5?11:16}" stroke-width="${i%5?1:1.5}"/>`).join('')}</g><circle cx="80" cy="80" r="57" fill="none" stroke="#233f32" stroke-width="5"/><circle cx="80" cy="80" r="57" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${v*3.58} 358" transform="rotate(-90 80 80)" style="filter:drop-shadow(0 0 4px ${color}66)"/><circle cx="80" cy="80" r="48" fill="none" stroke="${color}44"/>${needle&&finite(value)?`<g transform="rotate(${v*2.7-135} 80 80)"><path d="M77 82L80 26L83 82Z" fill="${gold}"/><circle cx="80" cy="80" r="5" fill="${gold}"/></g>`:''}<text x="80" y="${needle?112:86}" text-anchor="middle" fill="#e4eee8" font-family="monospace" font-size="${needle?19:29}">${finite(value)?Math.round(value):'N/A'}</text><text x="80" y="${needle?127:105}" text-anchor="middle" fill="#8fa89b" font-family="monospace" font-size="7">${finite(value)?'OUT OF 100':'NO OBSERVATION'}</text></svg><strong>${label}</strong><small>${sub||''}</small></div>`;}
function poly(values,w=900,h=180){const valid=values.filter(finite);if(valid.length<2)return '';const lo=Math.min(...valid),range=Math.max(...valid)-lo||1;return values.map((v,i)=>finite(v)?`${20+i/(values.length-1)*(w-40)},${h-15-(v-lo)/range*(h-30)}`:null).filter(Boolean).join(' ');}
function wave(s){const a=s.kpis.find(k=>/commissioni.*delta/.test(k.field))||s.kpis[1],b=s.kpis[0];const av=a.points.map(p=>p.value),bv=b.points.map(p=>p.value);return `<svg viewBox="0 0 900 180" preserveAspectRatio="none" role="img" aria-label="${esc(s.token)} fee growth and fee multiple, separately normalized"><g stroke="#274c39" stroke-width=".5">${Array.from({length:19},(_,i)=>`<path d="M${i*50} 0V180"/>`).join('')}${[0,30,60,90,120,150,180].map(y=>`<path d="M0 ${y}H900"/>`).join('')}</g><polyline points="${poly(bv)}" fill="none" stroke="${pink}" stroke-width="2"/><polyline points="${poly(av)}" fill="none" stroke="${green}" stroke-width="2.4" style="filter:drop-shadow(0 0 3px ${green}55)"/><g stroke="${gold}" fill="none"><path d="M675 0V180M0 90H900" stroke-dasharray="3 5" opacity=".5"/><circle cx="675" cy="90" r="18"/><circle cx="675" cy="90" r="4"/><path d="M648 90H659M691 90H702M675 63V74M675 106V117"/></g></svg>`;}
function initPulse(){
 const measured=protocols.map(p=>assess(p));
 const lev=measured.filter(p=>finite(p.funding)),flow=measured.filter(p=>finite(p.revenue));
 // No global money-supply observations exist in the supplied archive.
 const leverage=lev.length?100*lev.filter(p=>p.funding>.0001).length/lev.length:null;
 const health=flow.length?100*flow.filter(p=>p.revenue>0).length/flow.length:null;
 $('market-rings').innerHTML=ring('GLOBAL LIQUIDITY',null,green,'GLOBAL MONEY DATA UNAVAILABLE')+ring('LEVERAGE RISK',leverage,pink,'SHARE WITH HIGH FUNDING')+ring('CASH FLOW HEALTH',health,gold,'SHARE WITH POSITIVE REVENUE');
 $('ring-note').textContent=`Funding: ${lev.length}/199 observed · Revenue: ${flow.length}/199 observed · Global liquidity is not inferred from token volume.`;
 $('market-verdict').textContent='The market is mixed; favour proven revenue and keep leverage low.';
 $('regimes').innerHTML=[['MARKET BIAS','MIXED',gold],['LIQUIDITY','UNKNOWN',gold],['FUNDING',leverage<25?'CALM':'ELEVATED',leverage<25?green:pink],['CASH FLOW',health>=50?'POSITIVE':'WEAK',health>=50?green:pink]].map(([a,b,c])=>`<div class="regime"><span class="status-light" style="background:${c};box-shadow:0 0 7px ${c}66"></span><span>${a}</span><strong style="color:${c}">${b}</strong></div>`).join('');
 const s=strategies.find(s=>s.thesis_code==='1_1');$('market-wave').innerHTML=wave(s);$('wave-source').textContent=`${s.token} / 05 OCT–04 NOV 2026 · SEPARATE SCALES`;
}
const isTrap=s=>/trap|risk|stress|divergence|euphoria|abandonment|apathy/i.test(s.title_en);
function selectedStrategies(){return strategies.filter(s=>basket==='gold'?s.is_tier1_gold:basket==='cash'?!isTrap(s)&&assess(all.get(s.entity_id)).cash:isTrap(s)).filter(s=>block==='all'||s.thesis_code.replace(/^TRAP_/,'').split('_')[0]===block);}
function tokenChips(items,current){return items.map(p=>`<button class="token-chip" data-entity="${esc(p.entity_id)}" aria-pressed="${p.entity_id===current}">${logo(p)}<span>${esc(p.ticker)}</span></button>`).join('');}
function renderSelection(){
 const ss=selectedStrategies(),ps=[...new Set(ss.map(s=>s.entity_id))].map(id=>all.get(id)).filter(Boolean);
 if(!ps.some(p=>p.entity_id===activeEntity))activeEntity=ps[0]?.entity_id;
 $('match-count').textContent=`${ss.length} IDEAS`;
 $('token-carousel').innerHTML=tokenChips(ps,activeEntity);
 $('token-cockpit').hidden=!ps.length;$('empty-state').hidden=!!ps.length;
 if(!ps.length){activeStrategy=null;return;}
 const candidates=ss.filter(s=>s.entity_id===activeEntity);
 if(!candidates.some(s=>s.thesis_id===activeStrategy?.thesis_id))activeStrategy=candidates[0];
 $('strategy-select').innerHTML=candidates.map(s=>`<option value="${esc(s.thesis_id)}" ${s===activeStrategy?'selected':''}>${esc(s.thesis_code+' / '+s.title_en)}</option>`).join('');renderToken();
}
function meter(label,value,level,color){return `<div class="meter"><div class="meter-label"><span>${label}</span><b style="color:${color}">${value}</b></div><div class="led-bricks" style="--led:${color}" role="img" aria-label="${label}: ${value}">${Array.from({length:20},(_,i)=>`<i class="${finite(level)&&i<Math.round(clamp(level)/5)?'on':''}"></i>`).join('')}</div></div>`;}
function cashChart(p,r){
 const vals=[r.revenue,r.fees].filter(finite),max=Math.max(...vals,1),y=n=>112-90*(n/max);
 // A single dated observation is shown as a level, never invented history.
 return `<svg viewBox="0 0 300 145" role="img" aria-label="Observed daily revenue ${money(r.revenue)} and fees ${money(r.fees)}; one day, not a time series"><g stroke="#294534">${[22,52,82,112].map(y=>`<path d="M12 ${y}H288"/>`).join('')}</g>${finite(r.fees)?`<rect x="193" y="${y(r.fees)}" width="45" height="${112-y(r.fees)}" fill="${pink}88" stroke="${pink}"/>`:''}${finite(r.revenue)?`<path d="M22 ${y(r.revenue)}Q82 ${y(r.revenue)} 145 ${y(r.revenue)}T278 ${y(r.revenue)}" fill="none" stroke="${green}" stroke-width="2.5"/><circle cx="88" cy="${y(r.revenue)}" r="4" fill="${green}"/>`:''}<text x="75" y="132" text-anchor="middle" fill="${green}" font-size="10">${money(r.revenue)} REVENUE</text><text x="220" y="132" text-anchor="middle" fill="${pink}" font-size="10">${money(r.fees)} FEES</text></svg>`;
}
function renderToken(){
 const s=activeStrategy,p=all.get(activeEntity),r=assess(p,margin),trap=isTrap(s),cash=!trap&&r.cash;
 $('active-logo').innerHTML=logo(p);$('active-token').textContent=p.ticker;
 $('token-badge').textContent=trap?'● TRAP / RISK':cash?'● CASH COW':'● WATCHLIST';$('token-badge').className='badge'+(trap?' trap':'');
 $('token-verdict').textContent=trap?`${p.ticker} faces ${s.title_en.toLowerCase()}; wait for stronger evidence.`:cash?`${p.ticker} earns revenue at a low valuation; watch supply and large holders.`:`${p.ticker} is a research idea; confirm cash flow and risk before entry.`;
 $('token-gauge').innerHTML=ring('',r.score,gold,'',true).replace('class="ring"','class="ring" style="width:100%"');
 $('token-chart').innerHTML=cashChart(p,r);$('cash-date').textContent='11–12 OCT';$('cash-chart-note').textContent='One-day revenue level / fees bar. No daily history supplied.';
 $('token-meters').innerHTML=meter('Daily Cash Flow',money(r.revenue),r.components[1],green)+meter('Valuation MCAP/TVL',finite(r.ratio)?r.ratio.toFixed(2)+'×':'N/A',r.components[0],gold)+meter('Whale & Dilution Risk',finite(r.risk)?fmt(r.risk)+'%':'N/A',r.risk,pink)+meter('Safety Cushion to Stop',finite(r.buffer)?(r.buffer>=0?'+':'')+fmt(r.buffer)+' pts':'N/A',finite(r.buffer)?r.buffer+50:null,r.buffer<0?pink:green);
 $('risk-value').textContent=margin+' points';$('token-date').textContent=`MARKET: 11–12 OCT 2026 · THESIS: ${s.date} · ${s.thesis_code}`;
 $('tearsheet').href=`assets/tearsheets/${s.thesis_code}.pdf`;$('watch-video').disabled=!s.video_mp4;
}
function mapData(){return protocols.map(p=>({p,r:assess(p)})).filter(x=>finite(x.r.fees)&&x.r.fees>=0&&finite(x.r.ratio)&&x.r.ratio>0);}
function renderMap(){
 const p=all.get(mapEntity),r=assess(p),data=mapData(),mobile=innerWidth<768,W=mobile?390:1000,H=mobile?490:520,left=mobile?30:70,right=W-30,top=60,bottom=H-55;
 $('scatter').setAttribute('viewBox',`0 0 ${W} ${H}`);$('radar').setAttribute('viewBox',`0 0 ${W} ${H}`);
 const logs=data.map(x=>Math.log10(1+x.r.fees)),ys=data.map(x=>Math.log10(x.r.ratio)),xmin=0,xmax=Math.max(...logs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const x=v=>left+Math.log10(1+v)/xmax*(right-left),y=v=>top+(Math.log10(v)-ymin)/(ymax-ymin)*(bottom-top),midX=(left+right)/2,midY=(top+bottom)/2;
 let svg=`<g fill="none" stroke="#254e3a">${Array.from({length:9},(_,i)=>`<path d="M${left+i*(right-left)/8} ${top}V${bottom}"/>`).join('')}${Array.from({length:7},(_,i)=>`<path d="M${left} ${top+i*(bottom-top)/6}H${right}"/>`).join('')}</g><path d="M${midX} ${top}V${bottom}M${left} ${midY}H${right}" stroke="${gold}" opacity=".4" stroke-dasharray="4 5"/>`;
 svg+=`<g font-family="monospace" font-size="${mobile?8:12}" font-weight="bold"><text x="${left}" y="25" fill="${green}">HIDDEN GEMS</text><text x="${right}" y="25" text-anchor="end" fill="${green}">CASH COW LEADERS</text><text x="${left}" y="${H-20}" fill="${pink}">OVERPRICED / LOW FEES</text><text x="${right}" y="${H-20}" text-anchor="end" fill="${gold}">EARLY STAGE</text></g>`;
 svg+=data.map(({p,r})=>`<circle class="plot-dot" data-map-id="${esc(p.entity_id)}" cx="${x(r.fees)}" cy="${y(r.ratio)}" r="${mobile?3.5:4.5}" fill="${r.cash?green:pink}" opacity=".8"><title>${esc(p.name)} · ${money(r.fees)} fees · ${r.ratio.toFixed(2)}×</title></circle>`).join('');
 if(finite(r.fees)&&finite(r.ratio)&&r.ratio>0){const xx=x(r.fees),yy=y(r.ratio);svg+=`<g stroke="${gold}" fill="none" stroke-width="1.5"><path d="M${xx} ${top}V${bottom}M${left} ${yy}H${right}" stroke-dasharray="3 6" opacity=".45"/><rect x="${xx-11}" y="${yy-11}" width="22" height="22"/><path d="M${xx-18} ${yy}H${xx+18}M${xx} ${yy-18}V${yy+18}"/></g>`;}
 svg+=`<text x="${midX}" y="${H-3}" fill="#8fa89b" text-anchor="middle" font-size="${mobile?7:10}">DAILY FEES → · LOG SCALE · LOW VALUATION AT TOP</text>`;
 $('scatter').innerHTML=svg;$('scatter').toggleAttribute('hidden',radarMode);$('radar').toggleAttribute('hidden',!radarMode);$('compare-select').hidden=!radarMode;
 $('map-hud').textContent=`${p.ticker} / FEES ${money(r.fees)} / MCAP/TVL ${finite(r.ratio)?r.ratio.toFixed(2)+'×':'N/A'}`;
 $('map-coverage').textContent=`${data.length} plotted · ${199-data.length} missing fees or TVL`;
 $('map-note').textContent='Map zones are relative, not trade signals. All 199 names remain selectable; missing values are not plotted.';
 $('map-select').value=mapEntity;$('map-carousel').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entity===mapEntity)));
 if(radarMode)renderRadar(p,W,H);
}
function renderRadar(p,W,H){
 const q=all.get($('compare-select').value),a=assess(p),b=assess(q),cx=W/2,cy=H/2,rr=Math.min(W*.29,H*.34),labels=['VALUE','REVENUE','VOLUME','SUPPLY SAFETY'];
 const xy=(i,v)=>[cx+Math.sin(i*Math.PI/2)*rr*v/100,cy-Math.cos(i*Math.PI/2)*rr*v/100];
 let svg=[25,50,75,100].map(n=>`<polygon points="${labels.map((_,i)=>xy(i,n).join(',')).join(' ')}" fill="none" stroke="#31563f"/>`).join('');
 svg+=labels.map((l,i)=>{const [x,y]=xy(i,120);return `<text x="${x}" y="${y}" text-anchor="middle" fill="#8fa89b" font-size="${W<500?8:12}">${l}</text>`;}).join('');
 for(const [r,c] of [[a,green],[b,pink]]){const vs=r.components;if(vs.every(finite))svg+=`<polygon points="${vs.map((v,i)=>xy(i,v).join(',')).join(' ')}" fill="${c}15" stroke="${c}" stroke-width="2"/>`;vs.forEach((v,i)=>{if(finite(v)){const [x,y]=xy(i,v);svg+=`<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`;}});}
 $('radar').innerHTML=svg;$('map-hud').textContent=`${p.ticker} (GREEN) vs ${q.ticker} (PINK) · ${a.components.filter(finite).length}/4 vs ${b.components.filter(finite).length}/4 observed`;
 $('map-note').textContent='Equal-scale research scores: value, revenue, trading volume and supply safety. Missing values remain open; no winner is forced.';
}
function closeVideo(){const v=$('strategy-video');v.pause();v.removeAttribute('src');v.load();$('video-dialog').close();$('watch-video').focus();}
$('watch-video').addEventListener('click',()=>{if(!activeStrategy)return;const v=$('strategy-video');$('video-title').textContent=activeStrategy.token+' / '+activeStrategy.thesis_code;v.src=activeStrategy.video_mp4;$('video-status').textContent='Six-second research clip. Press Escape or close to return.';$('video-dialog').showModal();v.currentTime=0;v.play().catch(()=>{$('video-status').textContent='This video could not play. Close and use the PDF tearsheet.';});});
$('strategy-video').addEventListener('timeupdate',()=>{if($('strategy-video').currentTime>=6)$('strategy-video').pause();});
$('close-video').addEventListener('click',closeVideo);$('video-dialog').addEventListener('cancel',e=>{e.preventDefault();closeVideo();});
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!=='screen-'+b.dataset.screen);document.querySelectorAll('[data-screen]').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','page');if(b.dataset.screen==='3')renderMap();document.title='VALEN TERMINAL | '+b.textContent.trim();}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{basket=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderSelection();}));
$('block-select').addEventListener('change',e=>{block=e.target.value;renderSelection();});
$('token-carousel').addEventListener('click',e=>{const b=e.target.closest('[data-entity]');if(b){activeEntity=b.dataset.entity;renderSelection();}});
$('strategy-select').addEventListener('change',e=>{activeStrategy=strategies.find(s=>s.thesis_id===e.target.value);renderToken();});
$('risk-ruler').addEventListener('input',e=>{margin=Number(e.target.value);renderToken();});
$('map-select').innerHTML=protocols.map(p=>`<option value="${esc(p.entity_id)}">${esc(p.ticker+' / '+p.name)}</option>`).join('');$('compare-select').innerHTML=$('map-select').innerHTML;$('compare-select').value='uniswap';
$('map-carousel').innerHTML=tokenChips(protocols,mapEntity);
$('map-select').addEventListener('change',e=>{mapEntity=e.target.value;renderMap();});$('compare-select').addEventListener('change',renderMap);
$('map-carousel').addEventListener('click',e=>{const b=e.target.closest('[data-entity]');if(b){mapEntity=b.dataset.entity;renderMap();}});
$('scatter').addEventListener('click',e=>{const b=e.target.closest('[data-map-id]');if(b){mapEntity=b.dataset.mapId;renderMap();}});
$('map-mode').addEventListener('click',()=>{radarMode=!radarMode;$('map-mode').setAttribute('aria-pressed',String(radarMode));$('map-mode').textContent=radarMode?'← Protocols map':'Radar Head-to-Head ↗';$('map-label').textContent=radarMode?'HEAD-TO-HEAD / FOUR FACTORS':'DAILY FEES × MCAP / TVL';renderMap();});
root.addEventListener('resize',()=>{if(!$('screen-3').hidden)renderMap();});
initPulse();renderSelection();renderMap();API.ready=true;API.state=()=>({basket,block,activeEntity,thesis:activeStrategy?.thesis_code,margin,mapEntity,radarMode});
})(typeof window!=='undefined'?window:globalThis);
