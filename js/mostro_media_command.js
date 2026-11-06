/* VALEN TERMINAL — portable media vault, sealed print views and keyboard command desk.
 * Source observations are dated snapshots. Live means local scenario recalculation.
 * No network requests, third-party UI dependencies or external audio files.
 */
(function (root) {
  'use strict';
  const doc = root.document, B = root.MOSTRO_BUNDLE, E = root.MostroEngine;
  const API = root.MostroMedia = {ready:false};
  if (!doc || !B || !E) return;
  const $ = id => doc.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (n, digits=2) => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:digits}) : 'N/D';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const strategies = B.strategies, protocols = new Map(B.protocols.map(p=>[p.entity_id,p]));
  const commands = ['GOLD','STRESS','COMPARE','VERIFY ALL','VAULT','MACRO'];
  const index = [
    ...commands.map(id=>({kind:'COMMAND',id,label:id,search:norm(id)})),
    ...strategies.map(s=>({kind:'STRATEGY',id:s.thesis_id,label:`${s.thesis_code} · ${s.token} · ${s.title_en}`,search:norm([s.thesis_id,s.thesis_code,s.token,s.title_en,s.model,s.is_tier1_gold?'GOLD':'',...s.requested].join(' '))})),
    ...B.protocols.map(p=>({kind:'PROTOCOL',id:p.entity_id,label:`${p.ticker||'—'} · ${p.name||p.entity_id}`,search:norm([p.entity_id,p.name,p.ticker,p.category].join(' '))})),
    ...B.macro.rules.map(r=>({kind:'MACRO RULE',id:r.id,label:`${r.id} · ${r.nome}`,search:norm([r.id,r.nome,r.famiglia,r.condizione_testo,r.lettura].join(' '))}))
  ];
  let selected=0, mode=null, activeDialog=null, returnFocus=null, savedInert=[], savedOverflow='';
  let matches=[], activeResult=0, frame=0, generation=0, disposed=false, verifying=false;
  let audio=null, sound=false, lastTone=-Infinity, preview=null, printPayload=null;
  const listeners=[];
  function on(node,event,fn,options) { if(node){node.addEventListener(event,fn,options);listeners.push(()=>node.removeEventListener(event,fn,options));} }
  function status(text) { if($('media-status')) $('media-status').textContent=text; }
  function safeAsset(value,type) {
    const folder=type==='png'?'cards':'videos';
    return typeof value==='string' && new RegExp('^assets/'+folder+'/[A-Za-z0-9_.-]+\\.'+type+'$').test(value) ? value : '';
  }
  function stopPreview() {
    if(preview){preview.pause();preview.closest('.vault-card')?.classList.remove('previewing');preview=null;}
  }
  function startPreview(video) {
    if(!video || doc.hidden) return;
    stopPreview();preview=video;
    if(!video.getAttribute('src')) video.src=video.dataset.src;
    video.muted=true;video.closest('.vault-card')?.classList.add('previewing');
    try { const play=video.play();if(play?.catch)play.catch(()=>{if(preview===video)stopPreview();status('Preview unavailable or playback blocked. Open the card or retry Play.');}); }
    catch (_) {stopPreview();status('Video preview is unavailable. The PNG card remains accessible.');}
  }
  function showDialog(node) {
    const origin=activeDialog?returnFocus:doc.activeElement;
    if(activeDialog) closeDialog(false);
    returnFocus=origin;savedOverflow=doc.body.style.overflow;
    savedInert=[...doc.body.children].filter(el=>el!==node&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.hasAttribute('inert')]);
    for(const [el] of savedInert)el.setAttribute('inert','');
    activeDialog=node;node.hidden=false;doc.body.style.overflow='hidden';
    (node.querySelector('[autofocus],button,input')||node).focus();
  }
  function closeDialog(restore=true) {
    generation++;stopPreview();
    if(activeDialog){for(const v of activeDialog.querySelectorAll('video'))v.pause();activeDialog.hidden=true;}
    for(const [el,wasInert] of savedInert)if(!wasInert)el.removeAttribute('inert');
    savedInert=[];doc.body.style.overflow=savedOverflow;activeDialog=null;mode=null;doc.body.classList.remove('printing-tearsheet');
    if(restore&&returnFocus?.isConnected)returnFocus.focus();
  }
  function room(id) {closeDialog();stopPreview();doc.querySelector(`.room-selector [data-room="${id}"]`)?.click();$(id)?.scrollIntoView?.({block:'start',behavior:'auto'});}
  function setInput(id,value,type='change') {const el=$(id);if(el){el.value=value;el.dispatchEvent(new root.Event(type,{bubbles:true}));}}
  function peers(strategy) {
    const p=protocols.get(strategy.entity_id);if(!p?.category)return [];
    return B.protocols.filter(q=>q.entity_id!==p.entity_id&&q.category===p.category).sort((a,b)=>String(a.name||a.ticker||a.entity_id).localeCompare(String(b.name||b.ticker||b.entity_id)));
  }
  function scenario(s) {
    const state=E.getState?.(),p=protocols.get(s.entity_id),margin=state?.margins.get(s.thesis_id)??10;
    return {margin,shocks:{...(state?.shocks||{})},result:E.simulate(E.snapshot(p||{}),state?.shocks||{},margin,!!s.derivatives_invalidation,B.audit.fee_p25)};
  }
  function metricsHTML(s, frozen=false) {
    const {result:r,margin}=scenario(s);
    return `<p class="media-state">${esc(r.state)} · ${frozen?'FROZEN':'LIVE'} LOCAL SCENARIO</p><dl class="media-kpis"><div><dt>Score</dt><dd>${fmt(r.score)} /100</dd></div><div><dt>MCAP / TVL</dt><dd>${fmt(r.ratio)}×</dd></div><div><dt>Invalidation buffer</dt><dd>${fmt(r.buffer)} pp</dd></div><div><dt>Daily fees · scenario</dt><dd>$${fmt(r.fees)}</dd></div><div><dt>${esc(r.fourthComponent)}</dt><dd>${r.funding!==null?fmt(r.funding,6):fmt(r.feeYield*100)+'%'}</dd></div><div><dt>Margin / coverage</dt><dd>${margin} pp · ${r.coverage}/4</dd></div></dl><p>Snapshot: ${esc(B.source_inventory_timestamp)}. No streaming market feed.</p><p><strong>Invalidation ${s.derivatives_invalidation?'H4/D1':'30D'}:</strong> ${esc(s.derivatives_invalidation||'30D fundamental review window. Reassess the thesis against its source KPIs.')}</p><p>Scenario threshold: score &lt; ${50-margin}; ${s.derivatives_invalidation?'funding &gt; 0.0001 or OI shock ≤ −20% also invalidates. ':''}Scenario thresholds are computed from the dated source observations.</p>`;
  }
  function renderVault(query='') {
    const terms=norm(query).trim().split(/\s+/).filter(Boolean);
    stopPreview();
    const entries=strategies.map((s,i)=>({s,i})).filter(({s})=>terms.every(t=>norm(`${s.thesis_code} ${s.token} ${s.title_en}`).includes(t)));
    $('vault-count').textContent=`${entries.length} / ${strategies.length} strategies`;
    $('vault-grid').innerHTML=entries.map(({s,i})=>`<article class="vault-card" data-vault="${i}"><div class="vault-poster"><img loading="lazy" decoding="async" src="${esc(safeAsset(s.card_png,'png'))}" alt="${esc(s.thesis_code+' '+s.title_en)}"><video muted loop playsinline preload="none" data-src="${esc(safeAsset(s.video_mp4,'mp4'))}" aria-label="Neon preview ${esc(s.thesis_code)}"></video></div><p class="vault-code">${esc(s.thesis_code)} / ${esc(s.token)} ${s.is_tier1_gold?'· GOLD':''}</p><h3>${esc(s.title_en)}</h3><div class="controls-row"><button class="room-btn" type="button" data-preview="${i}" aria-label="Play preview ${esc(s.thesis_code)}">▶ PREVIEW</button><button class="room-btn" type="button" data-open="${i}">OPEN VAULT ↗</button></div><p class="source-note">${esc(s.date)} · ${s.derivatives_invalidation?'H4/D1':'30D'}</p></article>`).join('')||'<p>No matching strategies.</p>';
    root.MostroCockpit?.observeMedia();
  }
  function openVault(value=0) {
    const i=typeof value==='string'?strategies.findIndex(s=>s.thesis_id===value):value;
    if(!Number.isInteger(i)||i<0||i>=strategies.length)return false;
    selected=i;stopPreview();
    if(activeDialog!==$('media-dialog'))showDialog($('media-dialog'));
    mode='vault';generation++;printPayload=null;
    for(const v of $('media-dialog').querySelectorAll('video'))v.pause();
    const s=strategies[i];$('media-title').textContent=`${i+1} / ${strategies.length} · ${s.thesis_code} · ${s.token}`;
    $('media-body').innerHTML=`<div class="cinema-layout"><div class="cinema-screen"><video id="vault-player" controls playsinline preload="metadata" poster="${esc(safeAsset(s.card_png,'png'))}" src="${esc(safeAsset(s.video_mp4,'mp4'))}" aria-label="${esc(s.title_en)}"></video><img class="vault-full-card" src="${esc(safeAsset(s.card_png,'png'))}" alt="Full resolution ${esc(s.title_en)}"></div><aside><h2>${esc(s.title_en)}</h2><h3>Latest source KPIs</h3><dl>${s.kpis.map(k=>{const point=k.points?.[k.points.length-1];return `<dt>${esc(k.field)}</dt><dd>${fmt(point?.value,6)} · ${esc(point?.day||'N/D')}</dd>`;}).join('')}</dl><div id="vault-live" aria-live="polite">${metricsHTML(s)}</div><button class="tearsheet-gold" id="open-tearsheet" type="button">OPEN / PRINT INSTITUTIONAL TEARSHEET [PDF]</button><p>Source-dated research · Native-resolution media · ← / → navigate · Esc closes</p></aside></div>`;
    $('media-prev').hidden=false;$('media-next').hidden=false;
    if(!activeDialog.contains(doc.activeElement))$('media-close').focus();
    $('open-tearsheet').addEventListener('click',()=>{openTearsheet().catch(e=>status('Tearsheet unavailable: '+e.message));});
    const player=$('vault-player');player.muted=true;player.autoplay=true;
    const playback=player.play();if(playback?.catch)playback.catch(()=>status('Tap Play to start the video.'));
    return true;
  }
  function navigate(delta) {if(mode==='vault')openVault((selected+delta+strategies.length)%strategies.length);}
  function sourceMetrics(s) {
    const p=protocols.get(s.entity_id);
    return Object.entries(p?.metrics||{}).map(([name,m])=>({name,value:m.value,unit:m.unit,date:m.as_of,source:m.source}));
  }
  async function openTearsheet() {
    const s=strategies[selected],ticket=++generation,context=scenario(s),peerList=peers(s);
    const proof=await E.verifyThesis(s,root.MOSTRO_PROOFS?.[s.thesis_id]);
    const payload={thesis_id:s.thesis_id,title:s.title_en,token:s.token,model:s.model,sourceDate:s.date,generatedAt:new Date().toISOString(),sourceInventory:B.source_inventory_timestamp,thesisSeal:s.sha256,thesisVerified:proof.ok,kpis:s.kpis.map(k=>({field:k.field,first:k.points?.[0]||null,last:k.points?.[k.points.length-1]||null,observations:k.points?.length||0})),sourceMetrics:sourceMetrics(s),scenario:context,invalidation:s.derivatives_invalidation||'30D fundamental review',peerRationale:'All other protocols in the same source category; no invented peers.',peers:peerList.map(p=>({entity_id:p.entity_id,name:p.name,category:p.category,metrics:p.metrics}))};
    const preimage=E.canonical(payload),digest=await E.sha256(preimage);
    if(ticket!==generation||disposed||mode!=='vault')return false;
    printPayload={payload,preimage,digest};mode='tearsheet';for(const v of $('media-body').querySelectorAll('video'))v.pause();
    $('media-title').textContent=`INSTITUTIONAL TEARSHEET · ${s.thesis_code} · ${s.token}`;
    $('media-prev').hidden=true;$('media-next').hidden=true;
    const rows=payload.kpis.map(k=>`<tr><td>${esc(k.field)}</td><td>${fmt(k.first?.value,6)}<br>${esc(k.first?.day)}</td><td>${fmt(k.last?.value,6)}<br>${esc(k.last?.day)}</td><td>${k.observations}</td></tr>`).join('');
    const metricRows=payload.sourceMetrics.map(m=>`<tr><td>${esc(m.name)}</td><td>${fmt(m.value,6)}</td><td>${esc(m.unit)}</td><td>${esc(m.date)}<br>${esc(m.source)}</td></tr>`).join('');
    const peerRows=peerList.map(p=>{const b=E.snapshot(p);return `<tr><td>${esc(p.name+' / '+p.ticker)}</td><td>$${fmt(b.fees)}</td><td>$${fmt(b.tvl)}</td><td>${fmt(b.tvl>0&&b.mcap!==null?b.mcap/b.tvl:null)}×</td><td>${esc(p.metrics?.commissioni_giornaliere?.as_of||p.metrics?.commissioni_24h?.as_of||'N/D')}</td></tr>`;}).join('');
    $('media-body').innerHTML=`<div class="tearsheet-actions"><button type="button" class="room-btn" id="back-vault">← BACK TO VAULT</button><button type="button" class="tearsheet-gold" id="print-tearsheet">PRINT / SAVE AS PDF</button></div><article id="institutional-tearsheet"><header><p>VALEN TERMINAL // INSTITUTIONAL RESEARCH</p><h1>${esc(s.title_en)}</h1><p>${esc(s.thesis_code+' · '+s.token+' · '+s.model)} · ${s.is_tier1_gold?'TIER-1 GOLD':'RESEARCH'} · SOURCE ${esc(s.date)}</p><p>Generated ${esc(payload.generatedAt)} · Scenario frozen at generation</p></header><img class="tearsheet-card" src="${esc(safeAsset(s.card_png,'png'))}" alt="${esc(s.title_en)}"><h2>Investment thesis &amp; model</h2><p>${esc(s.title_en)}. Source model ${esc(s.model)} evaluates ${esc(s.requested.join(', '))}. The supplied payload contains quantitative observations, not a separate analyst narrative.</p><h2>Source KPI evidence</h2><table><thead><tr><th>KPI</th><th>First observation</th><th>Latest observation</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table><h2>Scenario &amp; invalidation ${s.derivatives_invalidation?'H4/D1':'30D'}</h2>${metricsHTML(s,true)}<p>Shocks: ${esc(Object.entries(context.shocks).map(([k,v])=>k+' '+v+'%').join(' · '))}</p><h2>Protocol observations &amp; provenance</h2><table><thead><tr><th>Metric</th><th>Value</th><th>Unit</th><th>As of / source</th></tr></thead><tbody>${metricRows||'<tr><td colspan="4">No protocol observations supplied.</td></tr>'}</tbody></table><h2>Peer group · ${esc(protocols.get(s.entity_id)?.category||'Unclassified')}</h2><p>${esc(payload.peerRationale)} ${peerList.length} peers. Dates can differ; values are source snapshots.</p><table><thead><tr><th>Protocol</th><th>Daily fees</th><th>TVL</th><th>MCAP/TVL</th><th>Fee date</th></tr></thead><tbody>${peerRows||'<tr><td colspan="5">No other same-category peers available.</td></tr>'}</tbody></table><h2>SHA-256 integrity seals</h2><p class="seal-result ${proof.ok?'verified':'failed'}">PACKAGED THESIS: ${proof.ok?'VERIFIED':'MISMATCH / UNVERIFIED'}</p><p class="hash-output">${esc(s.sha256)}</p><p>Tearsheet snapshot SHA-256 (canonical payload):</p><p class="hash-output">${digest}</p><p>Integrity of this local bundle, not an external signature or certification of market data. Scenario results are sensitivity estimates, not forecasts or backtested returns.</p><footer>LUCA VALENTE · VALEN TERMINAL · Research only · Not financial advice</footer></article>`;
    $('back-vault').addEventListener('click',()=>openVault(selected));
    $('print-tearsheet').addEventListener('click',()=>{printTearsheet().catch(e=>status('Print unavailable: '+e.message));});
    $('print-tearsheet').focus();return true;
  }
  async function printTearsheet() {
    if(mode!=='tearsheet'||!printPayload)return false;
    const ticket=generation,img=$('institutional-tearsheet').querySelector('img');
    if(img?.decode)try{await img.decode();}catch(_){status('Card image could not be decoded; the text tearsheet can still be printed.');}
    if(ticket!==generation||disposed)return false;
    doc.body.classList.add('printing-tearsheet');
    try{root.print();return true;}finally{doc.body.classList.remove('printing-tearsheet');}
  }
  function search(query='') {
    const terms=norm(query).trim().split(/\s+/).filter(Boolean);
    return index.filter(item=>terms.every(t=>item.search.includes(t))).sort((a,b)=>Number(b.search===norm(query).trim())-Number(a.search===norm(query).trim()));
  }
  function renderResults() {
    matches=search($('command-input').value);activeResult=0;
    $('command-results').innerHTML=matches.map((m,i)=>`<div role="option" id="command-option-${i}" data-result="${i}" aria-selected="false"><span>${esc(m.kind)}</span> ${esc(m.label)}</div>`).join('')||'<p role="status">No matching commands, strategies, protocols or rules.</p>';
    $('command-count').textContent=`${matches.length} results · 64 strategies / 199 protocols / 43 macro rules`;
    selectResult(0);
  }
  function selectResult(i) {
    activeResult=matches.length?(i+matches.length)%matches.length:0;
    for(const el of $('command-results').querySelectorAll('[data-result]'))el.setAttribute('aria-selected',String(Number(el.dataset.result)===activeResult));
    const el=$('command-option-'+activeResult);
    if(el){$('command-input').setAttribute('aria-activedescendant',el.id);el.scrollIntoView?.({block:'nearest'});}else $('command-input').removeAttribute('aria-activedescendant');
  }
  function openPalette(query='') {
    if(activeDialog!==$('command-dialog'))showDialog($('command-dialog'));
    mode='command';$('command-input').value=query;renderResults();$('command-input').focus();
  }
  async function verifyAll() {
    if(verifying)return null;verifying=true;status('VERIFY ALL · checking 64 packaged thesis seals…');
    let good=0;
    try {
      for(let i=0;i<strategies.length;i++){
        const s=strategies[i];let result;
        try{result=await E.verifyThesis(s,root.MOSTRO_PROOFS?.[s.thesis_id]);}catch(_){result={ok:false,reason:'Verification error'};}
        if(result.ok)good++;
        const seal=doc.querySelector(`[data-audit="${i}"] .proof-seal`);
        if(seal){seal.textContent=result.ok?'✓ SHA-256 VERIFIED':'✗ PROOF MISMATCH';seal.className='proof-seal '+(result.ok?'verified':'failed');seal.title=result.digest||result.reason;}
      }
      status(`VERIFY ALL · ${good} / ${strategies.length} verified · ${strategies.length-good} mismatches`);return {verified:good,total:strategies.length};
    }finally{verifying=false;}
  }
  async function execute(item) {
    if(typeof item==='string')item=index.find(x=>x.kind==='COMMAND'&&x.id===item.toUpperCase());
    if(!item)return false;
    closeDialog();
    if(item.kind==='STRATEGY'){room('room-4');return openVault(item.id);}
    if(item.kind==='PROTOCOL'){room('room-2');setInput('canvas-sector','ALL');setInput('canvas-protocol',item.id);return true;}
    if(item.kind==='MACRO RULE'){
      room('room-6');setInput('macro-family','ALL');setInput('macro-filter','ALL');setInput('macro-search',item.id,'input');
      for(const detail of $('macro-43-grid').querySelectorAll('details'))detail.open=true;return true;
    }
    switch(item.id){
      case 'GOLD':room('room-1');setInput('screener-search','','input');setInput('strategy-family','ALL');setInput('screener-tier','GOLD');break;
      case 'STRESS':room('room-3');$('shock-tvl')?.focus();break;
      case 'COMPARE':room('room-2');$('arena-select-a')?.focus();break;
      case 'VERIFY ALL':room('room-5');await verifyAll();break;
      case 'VAULT':room('room-4');$('vault-search')?.focus();break;
      case 'MACRO':room('room-6');setInput('macro-family','ALL');setInput('macro-filter','ALL');setInput('macro-search','','input');break;
      default:return false;
    }
    return true;
  }
  function soundLabel() {if($('sound-hud')){$('sound-hud').textContent=`[SOUND HUD: ${sound?'ON':'OFF'}]`;$('sound-hud').setAttribute('aria-pressed',String(sound));}}
  async function toggleSound() {
    if(sound){sound=false;soundLabel();if(audio?.state==='running')try{await audio.suspend();}catch(_){status('Audio suspension unavailable; HUD feedback is disabled.');}return false;}
    const Audio=root.AudioContext||root.webkitAudioContext;
    if(!Audio){status('Web Audio is unavailable in this browser.');return false;}
    try{if(!audio||audio.state==='closed')audio=new Audio();await audio.resume();if(disposed){await audio.close();return false;}sound=true;soundLabel();tone(50);return true;}
    catch(_){sound=false;soundLabel();status('Audio blocked. Tap SOUND HUD to retry from a user gesture.');return false;}
  }
  function tone(value=50) {
    if(!sound||!audio||audio.state!=='running'||doc.hidden)return false;
    const now=root.performance.now();if(now-lastTone<45)return false;lastTone=now;
    try {
      const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(280+Math.max(0,Math.min(100,Number(value)||0))*6,t);
      gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(0.025,t+.006);gain.gain.exponentialRampToValueAtTime(0.0001,t+.045);
      osc.connect(gain);gain.connect(audio.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+.05);return true;
    }catch(_){sound=false;soundLabel();status('Audio feedback unavailable; HUD switched off.');return false;}
  }
  function refreshLive() {
    if(frame)return;frame=root.requestAnimationFrame(()=>{frame=0;if(mode==='vault'&&$('vault-live'))$('vault-live').innerHTML=metricsHTML(strategies[selected]);});
  }
  function keydown(event) {
    if(event.isComposing||event.defaultPrevented)return;
    const editing=event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if(((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k')||(event.key==='/'&&!editing&&!event.metaKey&&!event.ctrlKey&&!event.altKey)){
      event.preventDefault();if(event.repeat)return;if(mode==='command')closeDialog();else openPalette();return;
    }
    if(!activeDialog)return;
    if(event.key==='Escape'){event.preventDefault();closeDialog();return;}
    if(event.key==='Tab'){
      const focusable=[...activeDialog.querySelectorAll('button:not(:disabled),input,a[href],video[controls],[tabindex="0"]')].filter(el=>!el.hidden&&!el.closest('[hidden]'));
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(doc.activeElement===first||!activeDialog.contains(doc.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(doc.activeElement===last||!activeDialog.contains(doc.activeElement))){event.preventDefault();first?.focus();}return;
    }
    if(mode==='command'){
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectResult(activeResult+(event.key==='ArrowDown'?1:-1));}
      if(event.key==='Enter'&&event.target===$('command-input')){event.preventDefault();execute(matches[activeResult]).catch(e=>status(e.message));}
    }else if(mode==='vault'&&!editing&&event.target.tagName!=='VIDEO'&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
  }
  function init() {
    if(API.ready||disposed||!$('vault-grid'))return;
    const dialogs=doc.createElement('div');
    dialogs.innerHTML=`<section id="media-dialog" class="media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-title" hidden tabindex="-1"><header class="media-dialog-bar"><h2 id="media-title">VAULT</h2><div><button type="button" class="room-btn" id="media-prev" aria-label="Previous strategy">←</button><button type="button" class="room-btn" id="media-next" aria-label="Next strategy">→</button><button type="button" class="room-btn" id="media-close" aria-label="Close vault">ESC / CLOSE ×</button></div></header><div id="media-body"></div></section><section id="command-dialog" class="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title" hidden><div class="command-panel"><header><h2 id="command-title">VALEN / COMMAND DESK</h2><button type="button" class="room-btn" id="command-close">ESC / CLOSE ×</button></header><label for="command-input">Search commands, strategies, protocols and macro rules</label><input id="command-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-results" autocomplete="off" spellcheck="false"><p id="command-count" role="status"></p><div id="command-results" role="listbox" aria-label="Command results"></div><p>↑ ↓ select · Enter execute · Esc close</p></div></section>`;
    while(dialogs.firstElementChild)doc.body.append(dialogs.firstElementChild);
    renderVault();soundLabel();
    on($('vault-search'),'input',e=>renderVault(e.target.value));
    on($('vault-grid'),'pointerover',e=>{const card=e.target.closest('[data-vault]');if(card&&!card.contains(e.relatedTarget)&&e.pointerType!=='touch'&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)startPreview(card.querySelector('video'));});
    on($('vault-grid'),'pointerout',e=>{const card=e.target.closest('[data-vault]');if(card&&!card.contains(e.relatedTarget))stopPreview();});
    on($('vault-grid'),'click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.open!==undefined)openVault(Number(button.dataset.open));if(button.dataset.preview!==undefined){const v=button.closest('[data-vault]').querySelector('video');if(preview===v)stopPreview();else startPreview(v);}});
    on($('vault-grid'),'error',e=>{if(e.target.tagName==='VIDEO'){stopPreview();status('Video could not be loaded; open its PNG card.');}else if(e.target.tagName==='IMG')status('A card could not be loaded. Check the assets directory.');},true);
    on($('media-dialog'),'error',e=>{if(e.target.tagName==='VIDEO'||e.target.tagName==='IMG')status('A Vault asset could not be loaded. Text and metrics remain available.');},true);
    on($('media-prev'),'click',()=>navigate(-1));on($('media-next'),'click',()=>navigate(1));
    on($('media-close'),'click',()=>closeDialog());on($('command-close'),'click',()=>closeDialog());
    on($('command-open'),'click',()=>openPalette());on($('command-input'),'input',renderResults);
    on($('command-results'),'click',e=>{const row=e.target.closest('[data-result]');if(row)execute(matches[Number(row.dataset.result)]).catch(error=>status(error.message));});
    on($('command-dialog'),'click',e=>{if(e.target===$('command-dialog'))closeDialog();});
    on($('sound-hud'),'click',()=>{toggleSound();});on(doc,'keydown',keydown);
    on(doc,'input',e=>{if(e.target.matches('.gold-slider')){const n=Number(e.target.value),min=Number(e.target.min),max=Number(e.target.max);tone(max>min?(n-min)/(max-min)*100:50);refreshLive();}});
    on(doc,'change',e=>{if(e.target.matches('.gold-slider'))refreshLive();});
    on(doc,'pointermove',e=>{if(e.target.matches('canvas[id^="valen-"]')){const box=e.target.getBoundingClientRect();tone(box.width?(e.clientX-box.left)/box.width*100:50);}});
    on(doc,'click',e=>{if(e.target.closest('.room-selector [data-room]'))stopPreview();if(e.target.closest('#shock-reset'))refreshLive();});
    on(doc,'visibilitychange',()=>{if(doc.hidden){stopPreview();for(const v of $('media-dialog').querySelectorAll('video'))v.pause();}});
    on(root,'beforeprint',()=>{if(mode==='tearsheet')doc.body.classList.add('printing-tearsheet');});on(root,'afterprint',()=>doc.body.classList.remove('printing-tearsheet'));
    API.ready=true;
  }
  Object.assign(API,{search,execute,openVault,close:closeDialog,navigate,openPalette,openTearsheet,printTearsheet,verifyAll,toggleSound,tone,peers,safeAsset,
    getState:()=>({selected,mode,sound,verifying,results:matches.length,printPayload}),
    dispose:()=>{disposed=true;closeDialog();stopPreview();root.cancelAnimationFrame(frame);listeners.forEach(remove=>remove());if(audio&&audio.state!=='closed')audio.close().catch(()=>status('Audio context could not be closed.'));sound=false;soundLabel();API.ready=false;}
  });
  if(doc.readyState==='loading')on(doc,'DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
