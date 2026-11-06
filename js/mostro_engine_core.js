/* VALEN TERMINAL: offline-first snapshot terminal. No network calls or dependencies. */
(function (root) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numberFormats = new Map();
  const fmt = (n, digits = 2) => {
    if (!finite(n)) return 'N/D';
    if (!numberFormats.has(digits)) numberFormats.set(digits, new Intl.NumberFormat('en-US', {maximumFractionDigits:digits,minimumFractionDigits:digits}));
    return numberFormats.get(digits).format(n);
  };
  const metric = (p, ...keys) => {
    for (const key of keys) { const value = p?.metrics?.[key]?.value; if (finite(value)) return value; }
    return null;
  };
  const canonical = value => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  };
  // SHA-256 (FIPS 180-4), UTF-8 bytes. Used when SubtleCrypto is absent or rejects file://.
  function sha256Fallback(message) {
    const bytes = new TextEncoder().encode(message);
    const size = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(size); padded.set(bytes); padded[bytes.length] = 128;
    const view = new DataView(padded.buffer);
    view.setUint32(size - 8, Math.floor(bytes.length / 0x20000000));
    view.setUint32(size - 4, (bytes.length * 8) >>> 0);
    const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Uint32Array(64), rotr = (x,n) => (x >>> n) | (x << (32-n));
    for (let offset = 0; offset < size; offset += 64) {
      for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
      for (let i=16;i<64;i++) { const x=w[i-15],y=w[i-2]; w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0; }
      let [a,b,c,d,e,f,g,z]=h;
      for (let i=0;i<64;i++) { const t1=(z+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0; const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0; z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
      [a,b,c,d,e,f,g,z].forEach((v,i)=>{h[i]=(h[i]+v)>>>0;});
    }
    return h.map(n=>n.toString(16).padStart(8,'0')).join('');
  }
  async function sha256(message) {
    try {
      if (root.crypto?.subtle) {
        const hash = await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(message));
        return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      }
    } catch (_) { /* File origin or unavailable crypto provider: use real SHA-256 below. */ }
    return sha256Fallback(message);
  }
  async function verifyThesis(strategy, preimage) {
    if (!preimage || !/^[a-f0-9]{64}$/i.test(strategy.sha256 || '')) return {ok:false,reason:'Missing proof'};
    const payload = {...strategy}; delete payload.sha256;
    const payloadBefore = canonical(payload), expectedDigest = strategy.sha256.toLowerCase();
    // Prevent a correct old preimage from approving a modified current thesis.
    try { if (payloadBefore !== canonical(JSON.parse(preimage))) return {ok:false,reason:'Payload changed'}; }
    catch (_) { return {ok:false,reason:'Malformed proof'}; }
    const digest = await sha256(preimage);
    const unchanged = payloadBefore === canonical((({sha256: ignored, ...rest}) => rest)(strategy)) && expectedDigest === strategy.sha256.toLowerCase();
    return {ok: unchanged && digest === expectedDigest, digest, reason:unchanged ? 'Digest comparison' : 'Payload changed during verification'};
  }
  function snapshot(p) {
    return {tvl:metric(p,'tvl'),mcap:metric(p,'capitalizzazione','capitalizzazione_mercato'),
      fees:metric(p,'commissioni_giornaliere','commissioni_24h'),volume:metric(p,'volume_24h','volume_dex_24h'),
      oi:metric(p,'apertura_interesse'),funding:metric(p,'tasso_finanziamento')};
  }
  // Transparent resilience proxy, not a reconstruction of the upstream model's performance.
  function simulate(base, shocks = {}, margin = 10, derivatives = false, p25 = 697) {
    const tvlShock=clamp(Number(shocks.tvl)||0,-60,100)/100;
    const feeShock=clamp(Number(shocks.fees)||0,-100,100)/100;
    const derShock=clamp(Number(shocks.derivatives)||0,-100,100)/100;
    const unlock=clamp(Number(shocks.unlock)||0,0,100)/100;
    const scaled=(v,f)=>finite(v)?v*f:null;
    const tvl=scaled(base.tvl,1+tvlShock),mcap=scaled(base.mcap,1+unlock),fees=scaled(base.fees,1+feeShock);
    const oi=scaled(base.oi,1+derShock),funding=finite(base.funding)?base.funding+derShock*0.0001:null;
    const ratio=finite(mcap)&&finite(tvl)&&tvl>0?mcap/tvl:null;
    const parts=[{value:finite(ratio)&&ratio>0?clamp(1/ratio,0,1):null,weight:35},
      {value:finite(fees)&&p25>0?clamp(fees/p25,0,1):null,weight:25},
      {value:finite(base.volume)?clamp(base.volume/1e6,0,1):null,weight:20},
      {value:finite(funding)?clamp(1-Math.max(0,funding)/0.0001,0,1):finite(fees)&&finite(mcap)&&mcap>0?clamp(fees*365/mcap,0,1):null,weight:20}];
    const present=parts.filter(p=>finite(p.value)),weight=present.reduce((sum,p)=>sum+p.weight,0);
    const score=weight?clamp(present.reduce((sum,p)=>sum+p.value*p.weight,0)/weight*100-unlock*25,0,100):null;
    const buffer=finite(score)?score-(50-clamp(Number(margin)||0,0,30)):null;
    const derivativeBreach=derivatives&&((finite(funding)&&funding>0.0001)||(finite(base.oi)&&base.oi>0&&derShock<=-0.2));
    const incomplete=present.length<4||(derivatives&&!finite(oi));
    const state=derivativeBreach||(finite(buffer)&&buffer<0)?'INVALIDATED':incomplete||!finite(buffer)||buffer<10?'MONITOR':'ACTIVE';
    return {score,ratio,buffer,state,tvl,mcap,fees,volume:finite(base.volume)?base.volume:null,oi,funding,incomplete,coverage:present.length,derivativeBreach,components:parts.map(p=>p.value),fourthComponent:finite(funding)?'Funding balance':'Annual fees / MCAP',feeYield:finite(fees)&&finite(mcap)&&mcap>0?fees*365/mcap:null};
  }
  // Stable score ranking in ticker rounds: all theses remain accessible.
  function diversified(items, results) {
    const sorted=[...items].sort((a,b)=>(results.get(b.thesis_id)?.score??-Infinity)-(results.get(a.thesis_id)?.score??-Infinity)||a.thesis_code.localeCompare(b.thesis_code,'en',{numeric:true}));
    const groups=new Map();for(const s of sorted){const key=s.token.toUpperCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
    const ordered=[];while([...groups.values()].some(g=>g.length)){
      const round=[...groups.values()].filter(g=>g.length).map(g=>g.shift()).sort((a,b)=>sorted.indexOf(a)-sorted.indexOf(b));
      if(ordered.length&&round.length>1&&round[0].token===ordered[ordered.length-1].token)round.push(round.shift());
      ordered.push(...round);
    }return ordered;
  }
  function screenerTelemetry(items, results) {
    const rows=items.map(s=>results.get(s.thesis_id)).filter(Boolean),buffers=rows.map(r=>r.buffer).filter(finite).sort((a,b)=>a-b);
    const unique=[...new Map(items.map(s=>[s.entity_id,results.get(s.thesis_id)])).values()];
    const depth=unique.map(r=>r?.volume).filter(finite).map(v=>clamp(Math.log1p(Math.max(0,v)/1e6)/Math.log1p(1000),0,1));
    return {active:rows.length?100*rows.filter(r=>r.state==='ACTIVE').length/rows.length:null,
      buffer:buffers.length?(buffers[Math.floor((buffers.length-1)/2)]+buffers[Math.floor(buffers.length/2)])/2:null,
      liquidity:depth.length?100*depth.reduce((a,b)=>a+b,0)/depth.length:null,count:rows.length,depthCount:depth.length};
  }
  function paintProof(seal,result) {
    seal.textContent=result.ok?'✓ SHA-256 VERIFIED':'✗ PROOF MISMATCH';
    seal.className='proof-seal '+(result.ok?'verified':'failed');seal.title=result.digest||result.reason;
    let digest=seal.parentElement.querySelector('.computed-digest');
    if(!digest){digest=doc.createElement('span');digest.className='hash-output computed-digest';seal.after(digest);}
    digest.textContent=result.digest?'COMPUTED SHA-256 · '+result.digest:'Verification failed · '+result.reason;
  }
  const API={sha256Fallback,sha256,verifyThesis,simulate,snapshot,canonical,diversified,screenerTelemetry,paintProof};
  root.MostroEngine=API;
  if (!root.document) return;
  const doc=root.document, $=id=>doc.getElementById(id);
  function init() {
    const bundle=root.MOSTRO_BUNDLE;
    const required=['mostro-ticker-track','gold-15-tbody','stress-results','audit-ledger-body','macro-43-grid','live-pipeline','room-1','room-3','room-5','room-6','room-7'];
    if (!bundle || !Array.isArray(bundle.strategies) || !Array.isArray(bundle.protocols) || required.some(id=>!$(id))) {
      $('bundle-status-indicator').textContent='ENGINE UNAVAILABLE · missing bundle or room anchors'; return;
    }
    const protocols=bundle.protocols,strategies=bundle.strategies,rules=bundle.macro.rules;
    const assets=[...protocols,...(bundle.strategy_assets||[])];
    const byId=new Map(assets.map(p=>[p.entity_id,p]));
    const bases=new Map(assets.map(p=>[p.entity_id,snapshot(p)]));
    const margins=new Map(strategies.map(s=>[s.thesis_id,10]));
    const shocks={tvl:0,fees:0,derivatives:0,unlock:0};
    let sortKey='score',sortDir=-1,diversify=true,selected=strategies.find(s=>s.is_tier1_gold)?.thesis_id;
    let results=new Map(),protocolResults=new Map(),visible=[],pending=false,lastFrameMs=0;
    const p25=bundle.audit.fee_p25;
    const block=s=>s.thesis_code.startsWith('TRAP_')?'TRAP':s.derivatives_invalidation?'DERIVATIVES':'FUNDAMENTALS';
    const badge=state=>'<span class="room-badge '+(state==='INVALIDATED'?'badge-alert':state==='MONITOR'?'badge-gold':'')+'">'+state+'</span>';
    const status=$('bundle-status-indicator').querySelector('span:last-child');
    status.textContent=`SNAPSHOT ${bundle.snapshot_dates?.at(-1)||bundle.source_inventory_timestamp.slice(0,10)} · ${protocols.length} PROTOCOLS · ${strategies.length} STRATEGIES · ${rules.length} RULES`;status.title=status.textContent;
    $('source-gate-summary').textContent=`SOURCE DAILY FEE P25: $${fmt(p25)} · ${bundle.audit.gold_count} GOLD THESES`;
    // Publish only complete measured quotes; keep the comparison universe intact.
    const quotedProtocols=protocols.filter(p=>p.ticker&&p.ticker!=='XTZ'&&metric(p,'prezzo')>0&&finite(metric(p,'variazione_prezzo_24h_pct'))&&['tvl','mcap','fees','volume'].every(k=>finite(snapshot(p)[k])));
    $('mostro-ticker-track').parentNode.setAttribute('aria-label',quotedProtocols.length+' complete protocol snapshot quotes');
    const tickerItems=quotedProtocols.map(p=>{
      const price=metric(p,'prezzo'),change=metric(p,'variazione_prezzo_24h_pct'),date=p.metrics?.prezzo?.as_of||'date unavailable';
      return '<span class="ticker-item" title="'+esc(p.name+' · '+date)+'"><span class="ticker-symbol">'+esc(p.ticker||p.name)+'</span> $'+fmt(price,price!==null&&price<1?6:2)+' <span class="'+(change<0?'ticker-down':'ticker-up')+'">'+(change===null?'Δ N/D':fmt(change)+'%')+'</span></span>';
    }).join('');
    $('mostro-ticker-track').innerHTML='<div class="ticker-group">'+tickerItems+'</div><div class="ticker-group" aria-hidden="true">'+tickerItems+'</div>';
    $('mostro-ticker-track').style.animationDuration=(quotedProtocols.length*4)+'s';
    const pause=doc.createElement('button');pause.type='button';pause.className='room-btn';pause.textContent='PAUSE TICKER';pause.setAttribute('aria-pressed','false');
    $('mostro-ticker-track').parentNode.before(pause);
    pause.addEventListener('click',()=>{const stopped=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(stopped));pause.textContent=stopped?'RESUME TICKER':'PAUSE TICKER';$('mostro-ticker-track').style.animationPlayState=stopped?'paused':'running';});
    const nav=[...doc.querySelectorAll('.room-btn[data-room]')];
    nav.forEach(button=>{
      button.setAttribute('aria-pressed',button.classList.contains('active')?'true':'false');button.removeAttribute('aria-selected');
      button.addEventListener('click',()=>{
        nav.forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
        doc.querySelectorAll('.terminal-room[id^="room-"]').forEach(room=>{room.hidden=room.id!==button.dataset.room;});
      });
    });
    const stressNodes=[];
    function makeStressRow(id,label,kind) {
      const tr=doc.createElement('tr');tr.dataset.kind=kind;tr.dataset.id=id;
      tr.innerHTML='<td>'+esc(kind+' / '+id)+'</td><td>'+esc(label)+'</td><td></td><td></td><td></td><td></td>';
      $('stress-results').append(tr);stressNodes.push({id,kind,cells:tr.cells});
    }
    strategies.forEach(s=>makeStressRow(s.thesis_id,s.token+' · '+s.title_en,'STRATEGY'));
    protocols.forEach(p=>makeStressRow(p.entity_id,p.ticker+' · '+p.name,'PROTOCOL'));
    function recalculate() {
      protocolResults=new Map(protocols.map(p=>[p.entity_id,simulate(bases.get(p.entity_id),shocks,10,false,p25)]));
      results=new Map(strategies.map(s=>[s.thesis_id,simulate(bases.get(s.entity_id)||{},shocks,margins.get(s.thesis_id),!!s.derivatives_invalidation,p25)]));
    }
    function renderQuickStats() {
      const s=strategies.find(x=>x.thesis_id===selected);if(!s)return;
      const r=results.get(selected),p=byId.get(s.entity_id),base=bases.get(s.entity_id)||{};
      const aggregate=visible.map(x=>results.get(x.thesis_id));
      const scored=aggregate.filter(x=>finite(x.score));
      const mean=scored.length?scored.reduce((sum,x)=>sum+x.score,0)/scored.length:null;
      $('quick-stats-content').innerHTML='<strong>'+esc(s.token+' · '+s.thesis_code)+'</strong><p>'+esc(s.title_en)+'</p>'+badge(r.state)+
        '<dl><dt>Scenario score</dt><dd>'+fmt(r.score)+'/100</dd><dt>MCAP/TVL</dt><dd>'+fmt(r.ratio)+'×</dd><dt>Invalidation buffer</dt><dd>'+fmt(r.buffer)+' pp</dd><dt>Margin</dt><dd>'+margins.get(selected)+' pp</dd><dt>Daily fees · stressed</dt><dd>$'+fmt(r.fees)+'</dd><dt>24h volume · source</dt><dd>$'+fmt(base.volume)+'</dd><dt>'+r.fourthComponent+'</dt><dd>'+ (finite(r.funding)?fmt(r.funding,6):fmt(r.feeYield*100)+'%') +'</dd><dt>Coverage</dt><dd>'+r.coverage+'/4 components</dd><dt>Visible basket score</dt><dd>'+fmt(mean)+'</dd><dt>Visible invalidated</dt><dd>'+aggregate.filter(x=>x.state==='INVALIDATED').length+'/'+visible.length+'</dd></dl>'+
        '<p class="source-note">'+esc(p?.metrics?.tvl?.as_of||p?.metrics?.prezzo?.as_of||bundle.source_inventory_timestamp.slice(0,10))+'</p>';
    }
    function renderScreener() {
      const query=$('screener-search').value.trim().toLowerCase(),tier=$('screener-tier').value,family=$('strategy-family').value;
      visible=strategies.filter(s=>(tier!=='GOLD'||s.is_tier1_gold)&&(family==='ALL'||block(s)===family)&&[s.token,s.title_en,s.thesis_code,s.model,byId.get(s.entity_id)?.name].join(' ').toLowerCase().includes(query));
      const val=s=>sortKey==='code'?s.thesis_code:sortKey==='token'?s.token:sortKey==='title'?s.title_en:results.get(s.thesis_id)[sortKey];
      visible.sort((a,b)=>{const x=val(a),y=val(b);if(x==null)return y==null?0:1;if(y==null)return -1;return sortDir*(typeof x==='number'?x-y:String(x).localeCompare(String(y),'en',{numeric:true}));});
      if(diversify)visible=diversified(visible,results);
      $('gold-15-tbody').innerHTML=visible.map(s=>{
        const r=results.get(s.thesis_id),index=strategies.indexOf(s),horizon=s.derivatives_invalidation?'H4/D1':'30D';
        return '<tr data-thesis="'+esc(s.thesis_id)+'" data-tier="'+(s.is_tier1_gold?'GOLD':'STANDARD')+'"><td>'+esc(s.thesis_code)+'</td><td>'+esc(s.token)+(s.is_tier1_gold?' <span class="gold-mark">GOLD</span>':'')+'</td><td><button class="thesis-select" data-select="'+esc(s.thesis_id)+'">'+esc(s.title_en)+'</button></td><td>'+fmt(r.score)+'</td><td>'+fmt(r.ratio)+'</td><td>'+fmt(r.buffer)+'</td><td>'+badge(r.state)+'</td><td><span class="room-badge '+(s.derivatives_invalidation?'badge-alert':'badge-gold')+'" title="'+esc(s.derivatives_invalidation||'Fundamental review window; scenario threshold is not a market stop order')+'">STOP '+horizon+'</span></td><td><label for="margin-'+index+'" class="sr-only">Margin Adjuster '+esc(s.thesis_code)+'</label><input id="margin-'+index+'" class="gold-slider margin-slider" type="range" min="0" max="30" step="1" value="'+margins.get(s.thesis_id)+'" data-margin="'+esc(s.thesis_id)+'"><output>'+margins.get(s.thesis_id)+' pp</output></td></tr>';
      }).join('')||'<tr><td colspan="9">No strategies match these filters.</td></tr>';
      $('screener-count').textContent=visible.length+' / '+strategies.length+' strategies'+(diversify?' · TICKER ROUNDS / SCORE ↓':'');
      doc.querySelectorAll('[data-sort]').forEach(b=>b.parentElement.setAttribute('aria-sort',!diversify&&b.dataset.sort===sortKey?(sortDir===1?'ascending':'descending'):'none'));
      renderQuickStats();
      root.MostroCockpit?.refresh(true);
    }
    function updateScreenerCells() {
      // Keep slider nodes stable while dragging, avoiding focus loss and pointer interruption.
      $('gold-15-tbody').querySelectorAll('tr[data-thesis]').forEach(row=>{const r=results.get(row.dataset.thesis);row.cells[3].textContent=fmt(r.score);row.cells[4].textContent=fmt(r.ratio);row.cells[5].textContent=fmt(r.buffer);row.cells[6].firstElementChild.textContent=r.state;row.cells[6].firstElementChild.className='room-badge '+(r.state==='INVALIDATED'?'badge-alert':r.state==='MONITOR'?'badge-gold':'');});
      renderQuickStats();
      root.MostroCockpit?.refresh(false);
    }
    function updateStress() {
      let invalid=0;
      stressNodes.forEach(({id,kind,cells})=>{const r=(kind==='STRATEGY'?results:protocolResults).get(id);if(r.state==='INVALIDATED')invalid++;
        [fmt(r.score),fmt(r.ratio),fmt(r.buffer),r.state].forEach((text,i)=>{if(cells[i+2].textContent!==text)cells[i+2].textContent=text;});cells[5].className='state-'+r.state.toLowerCase();
      });
      $('stress-summary').textContent=`${strategies.length} strategies + ${protocols.length} protocols · ${invalid} invalidated · snapshot scenario`;
      root.MostroCockpit?.refreshStress();
    }
    function schedule() {
      if(pending)return;pending=true;
      root.requestAnimationFrame(()=>{const start=root.performance.now();pending=false;recalculate();updateStress();updateScreenerCells();lastFrameMs=root.performance.now()-start;});
    }
    API.getState=()=>({selected,shocks:{...shocks},results,protocolResults,margins,visible:visible.map(s=>s.thesis_id),lastFrameMs,pending});
    ['screener-search','screener-tier','strategy-family'].forEach(id=>$(id).addEventListener(id==='screener-search'?'input':'change',renderScreener));
    $('screener-all').addEventListener('click',()=>{$('screener-tier').value='ALL';$('strategy-family').value='ALL';$('screener-search').value='';renderScreener();});
    doc.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{diversify=false;if(sortKey===button.dataset.sort)sortDir*=-1;else{sortKey=button.dataset.sort;sortDir=1;}renderScreener();}));
    $('gold-15-tbody').addEventListener('click',event=>{const button=event.target.closest('[data-select]');if(button){selected=button.dataset.select;renderQuickStats();root.MostroCockpit?.refresh(false);}});
    $('gold-15-tbody').addEventListener('input',event=>{const input=event.target;if(!input.dataset.margin)return;selected=input.dataset.margin;margins.set(selected,Number(input.value));input.nextElementSibling.textContent=input.value+' pp';schedule();});
    $('gold-15-tbody').addEventListener('change',()=>{recalculate();renderScreener();});
    Object.keys(shocks).forEach(key=>$('shock-'+key).addEventListener('input',event=>{shocks[key]=Number(event.target.value);$('shock-'+key+'-value').textContent=(shocks[key]>0?'+':'')+shocks[key]+'%';schedule();}));
    Object.keys(shocks).forEach(key=>$('shock-'+key).addEventListener('change',()=>{recalculate();renderScreener();}));
    $('shock-reset').addEventListener('click',()=>{Object.keys(shocks).forEach(key=>{shocks[key]=0;$('shock-'+key).value='0';$('shock-'+key+'-value').textContent='0%';});recalculate();renderScreener();schedule();});
    $('strategies-64-grid').innerHTML=strategies.map(s=>'<details class="macro-rule-card"><summary>'+esc(s.thesis_code+' · '+s.token+' · '+s.title_en)+'</summary><p>'+esc(s.model+' · '+s.date+' · '+block(s))+'</p><p>'+esc(s.requested.join(' · '))+'</p></details>').join('');
    $('audit-ledger-body').innerHTML=strategies.map((s,i)=>'<tr data-audit="'+i+'"><td>'+esc(s.thesis_code+' · '+s.token)+'</td><td class="hash-output">'+esc(s.sha256)+'</td><td><button type="button" class="room-btn" data-verify="'+i+'">VERIFY SHA-256 PROOF</button><output class="proof-seal" aria-live="polite">NOT VERIFIED</output></td></tr>').join('');
    $('audit-ledger-body').addEventListener('click',async event=>{const button=event.target.closest('[data-verify]');if(!button)return;const s=strategies[Number(button.dataset.verify)],seal=button.nextElementSibling;button.disabled=true;seal.className='proof-seal';seal.textContent='VERIFYING…';
      try {const result=await verifyThesis(s,root.MOSTRO_PROOFS?.[s.thesis_id]);paintProof(seal,result);}
      catch(error){seal.textContent='VERIFICATION ERROR';seal.className='proof-seal failed';}finally{button.disabled=false;}
    });
    $('sha256-verify-btn').addEventListener('click',async()=>{$('sha256-digest-output').textContent=await sha256($('sha256-input').value);});
    const families=[...new Set(rules.map(r=>r.famiglia))].sort();
    $('macro-family').innerHTML='<option value="ALL">All families</option>'+families.map(f=>'<option>'+esc(f)+'</option>').join('');
    const macro=bundle.macro.latest_score;
    $('macro-snapshot').textContent=`Snapshot ${macro.data}: score ${macro.punteggio}, regime ${macro.fascia}, ${macro.regole_scattate} triggered rules (aggregate).`;
    function renderMacro() {
      const q=$('macro-search').value.trim().toLowerCase(),family=$('macro-family').value,bias=$('macro-filter').value;
      const filtered=rules.filter(r=>{const direction=r.bias_valore>0?'BULLISH':r.bias_valore<0?'DEFENSIVE':'CAUTION';return(family==='ALL'||r.famiglia===family)&&(bias==='ALL'||bias===direction)&&[r.id,r.nome,r.condizione_testo,r.lettura].join(' ').toLowerCase().includes(q);});
      $('macro-43-grid').innerHTML=filtered.map(r=>'<details class="macro-rule-card"><summary>'+esc(r.id+' · '+r.nome)+'</summary><p>'+esc(r.condizione_testo)+'</p><p>Bias: '+esc(r.bias)+' · '+esc(r.famiglia)+'</p><p>'+esc(r.lettura)+'</p><p>Invalidation: '+esc(r.cosa_cambierebbe)+'</p><p>Data: '+esc(r.dato_richiesto)+'</p><p>Updated: '+esc(r.aggiornata_il)+(r.provvisoria?' · Provisional':'')+'</p></details>').join('')||'<p>No rules match.</p>';
      $('macro-count').textContent=filtered.length+' / '+rules.length;
    }
    ['macro-filter','macro-family','macro-search'].forEach(id=>$(id).addEventListener(id==='macro-search'?'input':'change',renderMacro));
    const stages=[['SQLite','Read-only upstream archive · '+bundle.macro.rules_table+' · snapshot '+bundle.source_inventory_timestamp],['199 Protocols',protocols.length+' protocol snapshots with metric timestamps and provider attribution.'],['43 Macro Rules',rules.length+' source definitions; latest aggregate regime: '+macro.fascia],['64 Quant Models',strategies.length+' exported thesis payloads; '+bundle.audit.gold_count+' Tier-1 Gold. Source calculations are upstream.'],['SHA-256 Proofs','64 packaged payload digests, automatically verified at startup and recheckable in Room 05.'],['Browser Scenarios','Four stress inputs, per-thesis margin budgets, 263 result rows. No live SQLite connection.']];
    $('live-pipeline').innerHTML=stages.map((s,i)=>'<button type="button" class="room-btn" data-stage="'+i+'" aria-pressed="'+(i===0)+'">'+esc(s[0])+'</button>'+(i<stages.length-1?'<span aria-hidden="true">→</span>':'')).join('');
    $('pipeline-detail').textContent=stages[0][1];
    $('live-pipeline').addEventListener('click',event=>{const button=event.target.closest('[data-stage]');if(!button)return;$('pipeline-detail').textContent=stages[Number(button.dataset.stage)][1];$('live-pipeline').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
    recalculate();renderScreener();updateStress();renderMacro();
    API.ready=true;
    API.proofsReady=Promise.all(strategies.map(async(s,i)=>{
      const seal=$('audit-ledger-body').querySelector(`[data-audit="${i}"] .proof-seal`);
      try{paintProof(seal,await verifyThesis(s,root.MOSTRO_PROOFS?.[s.thesis_id]));}
      catch(_){paintProof(seal,{ok:false,reason:'Verification error'});}
    }));
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
