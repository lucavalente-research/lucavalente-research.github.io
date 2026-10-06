# Backtest esteso TVL Ratio_Atlas

Periodo richiesto: 2023-10-05–2026-10-04 UTC; cache prezzi giornalieri dal 2021-11-04 (700 giorni di riscaldamento). 1D: 1096 candele; 1W: settimane complete lunedì–domenica, prima apertura 2023-10-09, ultima chiusura 2026-10-04. Nessuna settimana parziale. Il TVL settimanale è quello della domenica. Nessun riempimento dei buchi; ogni finestra richiede prezzi e TVL strettamente positivi. Finestra: Growth Gap e Rotation Mirror 30 candele, Ratio Atlas 90; sul settimanale sono quindi 30/90 settimane, non giorni.

Formule e convenzione BT1 conservate: valore ritardato di una candela, attraversamento sopra +15 rialzista / sotto −15 ribassista. Ingresso all'apertura della candela successiva al dato, uscita alla chiusura della trentesima candela inclusa. Anticipo corretto = rendimento finale >=+10% per allarme rialzista o <=−10% per ribassista; non misura il primo tocco intraperiodo. Orizzonte 1D: 30 giorni; 1W: 30 settimane (210 giorni), perciò le precisioni dei due timeframe non sono direttamente comparabili. Falso allarme = ogni altro esito maturo. Gli ultimi 29 periodi senza esito completo sono contati come pendenti.

Base: aperture con 30 candele complete, frequenze +10% e −10%. Base direzionale attesa = (allarmi positivi × frequenza base rialzista + negativi × frequenza ribassista) / allarmi maturi; vantaggio in punti percentuali rispetto a questa base. Strategia: solo allarmi positivi, 30 candele in posizione, poi liquidità; nessuno short, posizioni sovrapposte ignorate, pendenti esclusi. Tieni sempre: prima apertura disponibile del timeframe / ultima chiusura. Rendimenti lordi senza costi, slippage, interessi o tasse; esposizioni diverse.

Prezzi spot Binance USDT, TVL chain DeFiLlama USD (USDT non identico a USD). Mappa BTC=Bitcoin, ETH=Ethereum, SOL=Solana, BNB=BSC, XRP=XRPL, ADA=Cardano, AVAX=Avalanche, TRX=Tron. LINK non è il gas token di una chain TVL diretta; DOT non ha una chain diretta nel catalogo usato. Entrambi hanno prezzi/hold, ma nessun backtest TVL valido; N/V non significa zero successo. Non usiamo TVL Ethereum per LINK né parachain arbitrarie per DOT. Rotation: BTC/ETH, ETH/SOL e tutte le altre coin/ETH, estensione dichiarata senza ottimizzazione; esito sul prezzo assoluto della prima coin.

TVL attualmente ricostruito, revisioni e timestamp originali di pubblicazione non disponibili: prova retrospettiva, non validazione in tempo reale. Allarmi sovrapposti non indipendenti, nessuna significatività statistica, nessuna ottimizzazione o promessa. Ranking descrittivo per timeframe; almeno 20 eventi maturi per selezionare una coin, per evitare vincitori su uno o due allarmi.

| Coin / coppia | TF | Barre / letture | Corretti / maturi | Falsi | Pend. | Base + / - (n) | Vantaggio pp | Strategia % (trade) | Tieni % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC | 1D | 1096 / 1096 | 3 / 22 | 19 | 0 | 300 / 155 (1067) | -8.30 | 7.02 (6) | 211.50 |
| BTC | 1W | 156 / 156 | 0 / 3 | 3 | 3 | 78 / 37 (127) | -29.13 | 0.00 (0) | 209.95 |
| ETH | 1D | 1096 / 1096 | 11 / 33 | 22 | 0 | 352 / 289 (1067) | 4.28 | 22.79 (4) | 65.61 |
| ETH | 1W | 156 / 156 | 3 / 5 | 2 | 0 | 50 / 58 (127) | 14.33 | 0.00 (0) | 67.00 |
| SOL | 1D | 1096 / 1096 | 19 / 61 | 42 | 5 | 425 / 298 (1067) | 1.07 | 239.27 (5) | 425.72 |
| SOL | 1W | 156 / 156 | 1 / 2 | 1 | 2 | 52 / 52 (127) | 9.06 | 64.06 (1) | 423.91 |
| BNB | 1D | 1096 / 1096 | 1 / 28 | 27 | 0 | 305 / 117 (1067) | -21.87 | -10.41 (6) | 272.74 |
| BNB | 1W | 156 / 156 | 0 / 2 | 2 | 0 | 75 / 29 (127) | -40.94 | -47.12 (1) | 276.45 |
| XRP | 1D | 1096 / 836 | 10 / 27 | 17 | 0 | 239 / 263 (1067) | 13.80 | 192.15 (6) | 185.51 |
| XRP | 1W | 156 / 43 | 0 / 0 | 0 | 2 | 49 / 49 (127) | N/V | 0.00 (0) | 193.89 |
| ADA | 1D | 1096 / 1096 | 9 / 28 | 19 | 0 | 294 / 376 (1067) | 3.22 | 4.16 (10) | 0.27 |
| ADA | 1W | 156 / 156 | 2 / 6 | 4 | 1 | 41 / 70 (127) | 1.05 | -56.47 (2) | 1.29 |
| AVAX | 1D | 1096 / 1096 | 13 / 41 | 28 | 4 | 352 / 373 (1067) | -2.19 | -61.88 (10) | 9.93 |
| AVAX | 1W | 156 / 156 | 1 / 4 | 3 | 1 | 28 / 89 (127) | -9.06 | -31.01 (1) | 10.15 |
| LINK | 1D | 1096 / 0 | N/V (0 eventi) | N/V | 0 | 326 / 322 (1067) | N/V | N/V (0) | 86.08 |
| LINK | 1W | 156 / 0 | N/V (0 eventi) | N/V | 0 | 51 / 58 (127) | N/V | N/V (0) | 86.13 |
| DOT | 1D | 1096 / 0 | N/V (0 eventi) | N/V | 0 | 267 / 440 (1067) | N/V | N/V (0) | -70.19 |
| DOT | 1W | 156 / 0 | N/V (0 eventi) | N/V | 0 | 16 / 97 (127) | N/V | N/V (0) | -69.97 |
| TRX | 1D | 1096 / 1096 | 8 / 34 | 26 | 0 | 266 / 77 (1067) | 0.68 | 163.67 (13) | 277.57 |
| TRX | 1W | 156 / 156 | 5 / 5 | 0 | 0 | 101 / 5 (127) | 20.47 | 31.40 (1) | 281.35 |

![Tabella completa](./BACKTEST_lukkval_TVL_Ratio_Atlas_v5_ESTESO.png)

N/V nelle colonne allarmi/strategia: nessuna lettura TVL valida. N/V nel vantaggio: nessun evento maturo. Zero strategia con letture valide e zero trade indica liquidità. Rendimenti hold calcolati solo dai prezzi.

Cache e 60 serie CSV: `/Users/ben/MOTORE CRYPTO/dati/backtest_bt2/`. Eventi: `BT2_EVENTI.json`; risultati e hash: `PROVA_BT2.json`; controlli: `VERIFICA_BT2.json`.

Fonti pubbliche: https://api.binance.com/api/v3/klines ; https://api.llama.fi/v2/chains ; https://api.llama.fi/v2/historicalChainTvl/{chain}.

DA FARE PER OPUS: controllo visivo sul Mac: `open "/Users/ben/NOTE CRYPTO/SOCIAL/INDICATORI/v5/BACKTEST_lukkval_TVL_Ratio_Atlas_v5_ESTESO.png"`.
