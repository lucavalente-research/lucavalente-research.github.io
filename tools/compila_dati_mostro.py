#!/usr/bin/env python3
"""Compile the local, read-only research snapshot for the Pages site."""
import hashlib
import json
import os
import shutil
import sqlite3
from pathlib import Path

ROOT = Path('/Users/ben/kreil-macro-engine')
SOURCE = ROOT / 'xseo_argon_puro_13'
SITE = Path('/Users/ben/NOTE CRYPTO/03_SITO_UFFICIALE')
DB = ROOT / 'x_economico_v3/notte_motore_20261013/integration/archivio.sqlite'
VIDEO = Path('/Users/ben/Desktop/VIDEO_MP4_NEON_X')
TARGET = SITE / 'data/mostro_data_bundle.json'
CHECKPOINT = SOURCE / 'mostro_compiler_checkpoint.json'
GOLD = {'8_1','TRAP_8_1','2_2','8_2','7_1','TRAP_7_1','8_3','4_1',
        'TRAP_7_8','7_3','1_5','5_3','8_5','4_5','2_3'}
INVALIDATION = 'H4/D1: Funding > 0.0001 oppure breakdown Real OI nelle 24–48h'

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str) + '\n', encoding='utf-8')
    os.replace(tmp, path)

def checkpoint(phase, index, total):
    save_json(CHECKPOINT, {'phase': phase, 'completed': index, 'total': total})

def thesis_code(thesis_id):
    bits = thesis_id.split('_')
    return '_'.join(bits[:3] if bits[0] == 'TRAP' else bits[:2])

def metric_snapshot(con, entity):
    # Indexed by (oggetto, metrica); preserve the most recent dated observation.
    rows = con.execute('SELECT metrica, valore, unita, riferito_a, preso_il, fonte FROM fatti WHERE oggetto=?', (entity,))
    latest = {}
    for metric, value, unit, date, fetched, source in rows:
        if value is None:
            continue
        key = str(metric)
        stamp = (date or '', fetched or '')
        if key not in latest or stamp > latest[key]['_stamp']:
            latest[key] = {'value': value, 'unit': unit, 'as_of': date, 'source': source, '_stamp': stamp}
    for item in latest.values():
        item.pop('_stamp')
    return latest

def numeric(metrics, names):
    for name in names:
        if name in metrics:
            try:
                return float(metrics[name]['value'])
            except (TypeError, ValueError):
                pass
    return None

def main():
    inventory = json.loads((SOURCE / 'INVENTARIO_IL_MOSTRO.json').read_text(encoding='utf-8'))
    payload = json.loads((SOURCE / 'output_64_strategie/payload_64_certificato.json').read_text(encoding='utf-8'))
    cards = payload['cards']
    assert len(cards) == 64
    con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    schema = [dict(r) for r in con.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")]
    root_names = sorted(n for n in os.listdir(ROOT) if 'tradingview' not in n.lower() and 'pine' not in n.lower())
    protocols = []
    entities = [dict(r) for r in con.execute("SELECT * FROM anagrafica WHERE tipo='protocollo' ORDER BY entita_id")]
    for i, row in enumerate(entities, 1):
        metrics = metric_snapshot(con, row['entita_id'])
        protocols.append({'entity_id': row['entita_id'], 'name': row['nome'], 'ticker': row['simbolo'],
                          'category': row['categoria'], 'metrics': metrics})
        checkpoint('protocols', i, len(entities))
    fee_values = sorted(v for p in protocols if (v := numeric(p['metrics'], ['commissioni_30g','commissioni_giornaliere','commissioni_24h'])) is not None)
    fee_p25 = fee_values[int((len(fee_values)-1)*0.25)] if fee_values else None
    by_id = {p['entity_id']: p for p in protocols}
    all_entities = {r['entita_id']: dict(r) for r in con.execute('SELECT entita_id, tipo, nome, simbolo, categoria FROM anagrafica')}
    liquid = [p for p in protocols if p['category'] != 'Stablecoin Issuer' and ((fee_p25 is not None and (v := numeric(p['metrics'], ['commissioni_30g','commissioni_giornaliere','commissioni_24h'])) is not None and v >= fee_p25)
              or (numeric(p['metrics'], ['volume_24h','volume_dex_24h']) or 0) > 1_000_000)]
    # Deterministic liquidity ranking: eligible protocols with measured activity first.
    liquid.sort(key=lambda p: (-(numeric(p['metrics'], ['volume_24h','volume_dex_24h']) or 0),
                               -(numeric(p['metrics'], ['commissioni_30g','commissioni_giornaliere','commissioni_24h']) or 0),p['entity_id']))
    assets = SITE / 'data/mostro_assets'
    out_cards = []
    for i, source in enumerate(cards, 1):
        thesis = source['thesis_id']
        code = thesis_code(thesis)
        png = SOURCE / 'output_64_strategie/cards' / f'{i:02d}.png'
        matches = sorted(VIDEO.glob(f"{source['model']}_{source['token']}_{thesis}_NEON_6s.mp4"))
        if not png.is_file() or len(matches) != 1:
            raise RuntimeError(f'Media missing or ambiguous at {i}: {thesis}, png={png.exists()}, videos={len(matches)}')
        video = matches[0]
        card_dest = assets / 'cards' / png.name
        video_dest = assets / 'videos' / video.name
        for src, dst in ((png,card_dest),(video,video_dest)):
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.stat().st_size != src.stat().st_size:
                shutil.copy2(src,dst)
        linked = by_id.get(source['entita_id'])
        source_metrics = linked['metrics'] if linked else metric_snapshot(con,source['entita_id'])
        fee = numeric(source_metrics, ['commissioni_30g','commissioni_giornaliere','commissioni_24h'])
        volume = numeric(source_metrics, ['volume_24h','volume_dex_24h'])
        eligible = (fee is not None and fee_p25 is not None and fee >= fee_p25) or (volume is not None and volume > 1_000_000)
        replacement = None
        isolated = source['entita_id'] not in all_entities and not source_metrics
        if (code == '5_4' or isolated) and not eligible and liquid:
            replacement = liquid[0]
        item = {'thesis_id': thesis, 'thesis_code': code, 'title_en': source['title_en'],
                'original_token': source['token'], 'original_entity_id': source['entita_id'],
                'token': replacement['ticker'] if replacement else source['token'],
                'entity_id': replacement['entity_id'] if replacement else source['entita_id'],
                'anti_zombie': {'eligible': bool(eligible), 'fee_25th_percentile': fee_p25,
                                'fee_observed': fee, 'volume_24h_observed': volume,
                                'replacement_applied': replacement is not None,
                                'filter_applied': code == '5_4' or isolated},
                'is_tier1_gold': code in GOLD,
                'derivatives_invalidation': INVALIDATION if code.split('_')[0] in ('3','8') else None,
                'model': source['model'], 'date': source['date'], 'requested': source['requested'],
                'kpis': source['kpis'], 'card_png': card_dest.relative_to(SITE).as_posix(),
                'video_mp4': video_dest.relative_to(SITE).as_posix()}
        item['sha256'] = hashlib.sha256(json.dumps(item,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        out_cards.append(item)
        checkpoint('strategies', i, len(cards))
    latest_score = dict(con.execute('SELECT * FROM quadro_giornaliero ORDER BY data DESC LIMIT 1').fetchone())
    macro = {'source_database': str(DB), 'rules_table': 'regole_crypto',
             'rules': [dict(r) for r in con.execute('SELECT * FROM regole_crypto ORDER BY id')],
             'latest_score': latest_score,
             'leading_indicators': [], 'leading_indicators_status': 'not identified in inspected SQLite schema',
             'schema': schema, 'root_inventory_names': root_names}
    bundle = {'source_inventory': str(SOURCE / 'INVENTARIO_IL_MOSTRO.json'),
              'source_inventory_timestamp': inventory.get('timestamp'), 'source_payload_sha256': hashlib.sha256((SOURCE / 'output_64_strategie/payload_64_certificato.json').read_bytes()).hexdigest(),
              'protocol_count': len(protocols), 'protocols': protocols,
              'strategy_count': len(out_cards), 'strategies': out_cards, 'macro': macro,
              'audit': {'gold_count': sum(s['is_tier1_gold'] for s in out_cards),
                        'anti_zombie_replacements': sum(s['anti_zombie']['replacement_applied'] for s in out_cards),
                        'fee_p25': fee_p25, 'historical_win_rate_included': False}}
    save_json(TARGET,bundle)
    checkpoint('complete',len(out_cards),len(out_cards))
    print(json.dumps({'bundle':str(TARGET),'bytes':TARGET.stat().st_size,'protocols':len(protocols),
                      'strategies':len(out_cards),'gold':bundle['audit']['gold_count'],
                      'replacements':bundle['audit']['anti_zombie_replacements'],
                      'sha256_by_thesis':{s['thesis_id']:s['sha256'] for s in out_cards}},ensure_ascii=False))

# Public refresh: source observations retain their own entity, date and fact id.
def refresh_public(render_media=False):
    import argparse
    import copy
    import math
    import sys
    from functools import lru_cache
    from datetime import datetime, timezone

    current = json.loads(TARGET.read_text())
    source_payload = json.loads((SOURCE / 'output_64_strategie/payload_64_certificato.json').read_text())
    originals = {s['thesis_id']: s for s in source_payload['cards']}
    con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    con.execute('BEGIN')
    entities = {r['entita_id']: dict(r) for r in con.execute('SELECT * FROM anagrafica')}
    token_fields = {'prezzo', 'capitalizzazione', 'capitalizzazione_mercato', 'volume_24h',
                    'tasso_finanziamento', 'apertura_interesse', 'variazione_prezzo_24h_pct',
                    'offerta_circolante', 'offerta_totale', 'quota_primi10',
                    'quota_primi10_esclusi_contratti', 'commit_settimanale', 'commit_settimanali_entita'}
    @lru_cache(None)
    def facts(entity):
        result = {}
        for row in con.execute('SELECT id,metrica,valore,unita,riferito_a,preso_il,fonte FROM fatti WHERE oggetto=? AND valore IS NOT NULL', (entity,)):
            value = row['valore']
            if not isinstance(value, (float, int)) or not math.isfinite(value):
                continue
            stamp = (row['riferito_a'] or '', row['preso_il'] or '', row['id'])
            key = row['metrica']
            if key not in result or stamp > result[key]['_stamp']:
                result[key] = dict(value=value, unit=row['unita'], as_of=row['riferito_a'],
                                   source=row['fonte'], source_entity=entity, fact_id=row['id'], _stamp=stamp)
        return {key: {k: v for k, v in item.items() if k != '_stamp'} for key,item in result.items()}
    def resolved(entity, ticker=None):
        row = entities.get(entity, {})
        metrics = copy.deepcopy(facts(entity))
        aliases = list(dict.fromkeys(a for a in (row.get('coingecko_id'), row.get('token_coingecko_id'),
                                                row.get('defillama_slug'), row.get('github_oggetto')) if a and a != entity))
        # Explicit token symbol resolution only when the registry has one unique token id.
        if ticker and not (row.get('coingecko_id') or row.get('token_coingecko_id')):
            candidates = {r.get('coingecko_id') or r.get('token_coingecko_id') for r in entities.values()
                          if (r.get('simbolo') or r.get('token_simbolo') or '').upper() == ticker.upper()}
            candidates.discard(None)
            if len(candidates) == 1:
                aliases += sorted(candidates)
        for alias in aliases:
            for key, item in facts(alias).items():
                # Token market observations and entity aliases; never copy another token's numbers.
                if key not in metrics and (key in token_fields or alias == row.get('defillama_slug')):
                    metrics[key] = copy.deepcopy(item)
        return dict(entity_id=entity, name=row.get('nome') or entity,
                    ticker=ticker or row.get('simbolo') or row.get('token_simbolo'),
                    category=row.get('categoria'), metrics=metrics)
    def complete(p):
        m=p['metrics']
        return all((numeric(m,keys) or 0)>0 for keys in
                   [('tvl',),('capitalizzazione','capitalizzazione_mercato'),
                    ('commissioni_giornaliere','commissioni_24h'),('volume_24h','volume_dex_24h')])
    protocols=[]
    for i,p in enumerate(current['protocols'],1):
        if (p.get('ticker') or '').upper() == 'XTZ':
            continue
        protocols.append(resolved(p['entity_id'],p.get('ticker')))
        checkpoint('public_protocols',i,len(current['protocols']))
    # Daily USD fees only: never mix a trailing-month flow into a daily percentile.
    daily_fees=sorted(numeric(p['metrics'],('commissioni_giornaliere','commissioni_24h')) for p in protocols
                      if numeric(p['metrics'],('commissioni_giornaliere','commissioni_24h')) is not None)
    p25=daily_fees[int((len(daily_fees)-1)*.25)]
    liquid=[p for p in protocols if complete(p) and p.get('ticker') and p.get('category') != 'Stablecoin Issuer'
            and (numeric(p['metrics'],('volume_24h','volume_dex_24h')) or 0)>1e6
            and numeric(p['metrics'],('tasso_finanziamento',)) is not None]
    liquid.sort(key=lambda p:(-numeric(p['metrics'],('volume_24h','volume_dex_24h')),
                              -numeric(p['metrics'],('commissioni_giornaliere','commissioni_24h')),p['entity_id']))
    assert liquid, 'No measured liquid replacement'
    replacement=liquid[0]
    sys.path.insert(0,str(SOURCE))
    import sqlite_loader_64 as loader
    catalog={t['thesis_id']:t for t in json.loads(loader.CATALOG.read_text())['tesi']}
    cutoff=loader.ordinal(con.execute('SELECT substr(max(preso_il),1,10) FROM fatti').fetchone()[0])
    histories={}
    rebase_audit=[]
    strategies=[]
    assets={}
    render_cards=[]
    for i,old in enumerate(current['strategies'],1):
        original=copy.deepcopy(originals[old['thesis_id']])
        p=resolved(original['entita_id'],original['token'])
        replace=original['token'].upper()=='XTZ' or not complete(p)
        s=copy.deepcopy(old)
        if replace:
            p=replacement
            entity=p['entity_id']
            if entity not in histories:
                histories[entity]=loader.History(con,entities[entity],cutoff)
            h=histories[entity]
            candidates=sorted(loader.candidates(catalog[s['thesis_id']],h,True),reverse=True)
            if not candidates:
                raise ValueError('No measured replacement KPI pair for '+s['thesis_id'])
            rank,fields=candidates[0];day=rank[1];kpis=[]
            for field in fields:
                series=h.get(field)
                points=[dict(day=loader.iso(d),value=series[d],expression=series.trace(d)) for d in sorted(series) if day-30<=d<=day]
                assert len(points)>=2
                kpis.append(dict(field=field,points=points))
            original.update(token=p['ticker'],entita_id=entity,date=loader.iso(day),kpis=kpis,
                            substituted=list(fields)!=original['requested'])
            if original['model']=='M3':
                peers=[];tickers={p['ticker']}
                for peer_id,peer_row in sorted(entities.items(),key=lambda item:(item[1].get('categoria')!=p.get('category'),item[0])):
                    symbol=(peer_row.get('simbolo') or peer_row.get('token_simbolo') or '').upper()
                    if not symbol or symbol in tickers or symbol=='XTZ':
                        continue
                    series=loader.History(con,peer_row,cutoff).get(kpis[0]['field'])
                    if day in series:
                        peers.append(dict(token=symbol,entita_id=peer_id,day=loader.iso(day),value=series[day],expression=series.trace(day)))
                        tickers.add(symbol)
                    if len(peers)==3:
                        break
                assert peers, 'No same-date measured peers'
                original['peers']=peers
            s.update(token=p['ticker'],entity_id=entity,date=original['date'],kpis=kpis,
                     original_token=p['ticker'],original_entity_id=entity)
            s['source_selection']={'policy':'Highest measured 24h token volume among complete liquid fee-generating protocols',
                                   'original_exhibit_sha256':hashlib.sha256(json.dumps(originals[s['thesis_id']],sort_keys=True).encode()).hexdigest(),
                                   'kpi_fields_substituted':original['substituted']}
            s['card_png']=f"assets/cards/v2_{i:02}_{p['ticker']}.png"
            s['video_mp4']=f"assets/videos/V2_{original['model']}_{p['ticker']}_{s['thesis_id']}_NEON_6s.mp4"
            render_cards.append((original,s['card_png'],s['video_mp4']))
            rebase_audit.append(dict(thesis=s['thesis_id'],original_token=originals[s['thesis_id']]['token'],
                                     replacement=p['ticker'],fields=list(fields),date=s['date']))
        else:
            s.update(token=original['token'],entity_id=original['entita_id'])
        assets[p['entity_id']]=p
        fee=numeric(p['metrics'],('commissioni_giornaliere','commissioni_24h'))
        volume=numeric(p['metrics'],('volume_24h','volume_dex_24h'))
        s['anti_zombie']=dict(eligible=fee>=p25 or volume>1e6,fee_25th_percentile=p25,
                              fee_observed=fee,volume_24h_observed=volume,replacement_applied=replace,
                              filter_applied=True)
        s.pop('sha256',None)
        s['sha256']=hashlib.sha256(json.dumps(s,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        strategies.append(s);checkpoint('public_strategies',i,64)
    # Preserve the established 199-protocol comparison universe; include strategy-only assets separately.
    current.update(protocols=protocols,protocol_count=len(protocols),strategies=strategies,
                   strategy_assets=list(assets.values()),strategy_count=len(strategies))
    current['audit'].update(fee_p25=p25,anti_zombie_replacements=len(rebase_audit),complete_strategy_count=64,
                            replacement_protocol=replacement['entity_id'])
    current['canvas_config'].update(version=2,arena_defaults=['aave','uniswap'],scatter_default='aave')
    current['source_inventory']='Certified research archive'
    current['macro']['source_database']='archivio.sqlite'
    # Existing rule definitions remain stable; latest aggregate is a real archived measurement.
    current['macro']['latest_score']=dict(con.execute('SELECT * FROM quadro_giornaliero ORDER BY data DESC LIMIT 1').fetchone())
    current['snapshot_dates']=sorted({m['as_of'][:10] for p in protocols for m in p['metrics'].values() if m.get('as_of')})
    checkpoint('public_data_ready',64,64)
    work=SITE/'.private/mostro-f2-p2-20261106';work.mkdir(parents=True,exist_ok=True)
    save_json(work/'rebase-audit.json',rebase_audit)
    if render_media:
        import subprocess
        import produce_64_strategie as renderer
        import produce_video_mp4_neon_6_modelli as video
        renderer.LABELS.setdefault('revenue', 'Daily protocol revenue')
        card_paths={card['thesis_id']:SITE/png for card,png,_ in render_cards}
        video.source_path=lambda card:card_paths[card['thesis_id']]
        card_indices={s['thesis_id']:i for i,s in enumerate(strategies,1)}
        video.card_index=lambda card:card_indices[card['thesis_id']]
        for i,(card,png,mp4) in enumerate(render_cards,1):
            dest=SITE/png;dest.parent.mkdir(parents=True,exist_ok=True)
            renderer.render(card).save(dest)
            raw,receipt=video.generate_card(card,output=work/'rendered-media',mirror=None)
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-an',
                            '-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(SITE/mp4)],check=True)
            checkpoint('public_media',i,len(render_cards))
            print('MEDIA',i,len(render_cards),card['thesis_id'],card['token'],flush=True)
    for _,png,mp4 in render_cards:
        assert (SITE/png).is_file() and (SITE/mp4).is_file(), 'Run --refresh-public --render-media first'
    con.close()
    proofs={s['thesis_id']:json.dumps({k:v for k,v in s.items() if k!='sha256'},ensure_ascii=False,sort_keys=True,separators=(',',':')) for s in strategies}
    assert len(strategies)==64 and not any(s['token']=='XTZ' for s in strategies)
    save_json(TARGET,current)
    js='// VALEN TERMINAL: measured SQLite snapshots and canonical strategy proofs.\nwindow.MOSTRO_BUNDLE = '+json.dumps(current,ensure_ascii=False,separators=(',',':'))+';\nwindow.MOSTRO_PROOFS = '+json.dumps(proofs,ensure_ascii=False,separators=(',',':'))+';\n'
    target_js=TARGET.with_suffix('.js');tmp=target_js.with_suffix('.js.tmp');tmp.write_text(js);os.replace(tmp,target_js)
    checkpoint('complete',64,64)
    print(json.dumps(dict(strategies=64,protocols=len(protocols),strategy_assets=len(assets),replacements=len(rebase_audit),replacement=replacement['ticker'],fee_p25=p25)))

if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--legacy',action='store_true',help='Build the original private research export')
    parser.add_argument('--refresh-public',action='store_true',help='Refresh portable public bundles (default)')
    parser.add_argument('--render-media',action='store_true',help='Regenerate exhibits after source replacement')
    args=parser.parse_args()
    if args.legacy: main()
    else: refresh_public(args.render_media)
