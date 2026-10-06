# Backtest esteso TVL Rotation_Mirror

Periodo richiesto: 2023-10-05–2026-10-04 UTC; cache prezzi giornalieri dal 2021-11-04 (700 giorni di riscaldamento). 1D: 1096 candele; 1W: settimane complete lunedì–domenica, prima apertura 2023-10-09, ultima chiusura 2026-10-04. Nessuna settimana parziale. Il TVL settimanale è quello della domenica. Nessun riempimento dei buchi; ogni finestra richiede prezzi e TVL strettamente positivi. Finestra: Growth Gap e Rotation Mirror 30 candele, Ratio Atlas 90; sul settimanale sono quindi 30/90 settimane, non giorni.

Formule e convenzione BT1 conservate: valore ritardato di una candela, attraversamento sopra +15 rialzista / sotto −15 ribassista. Ingresso all'apertura della candela successiva al dato, uscita alla chiusura della trentesima candela inclusa. Anticipo corretto = rendimento finale >=+10% per allarme rialzista o <=−10% per ribassista; non misura il primo tocco intraperiodo. Orizzonte 1D: 30 giorni; 1W: 30 settimane (210 giorni), perciò le precisioni dei due timeframe non sono direttamente comparabili. Falso allarme = ogni altro esito maturo. Gli ultimi 29 periodi senza esito completo sono contati come pendenti.

Base: aperture con 30 candele complete, frequenze +10% e −10%. Base direzionale attesa = (allarmi positivi × frequenza base rialzista + negativi × frequenza ribassista) / allarmi maturi; vantaggio in punti percentuali rispetto a questa base. Strategia: solo allarmi positivi, 30 candele in posizione, poi liquidità; nessuno short, posizioni sovrapposte ignorate, pendenti esclusi. Tieni sempre: prima apertura disponibile del timeframe / ultima chiusura. Rendimenti lordi senza costi, slippage, interessi o tasse; esposizioni diverse.

Prezzi spot Binance USDT, TVL chain DeFiLlama USD (USDT non identico a USD). Mappa BTC=Bitcoin, ETH=Ethereum, SOL=Solana, BNB=BSC, XRP=XRPL, ADA=Cardano, AVAX=Avalanche, TRX=Tron. LINK non è il gas token di una chain TVL diretta; DOT non ha una chain diretta nel catalogo usato. Entrambi hanno prezzi/hold, ma nessun backtest TVL valido; N/V non significa zero successo. Non usiamo TVL Ethereum per LINK né parachain arbitrarie per DOT. Rotation: BTC/ETH, ETH/SOL e tutte le altre coin/ETH, estensione dichiarata senza ottimizzazione; esito sul prezzo assoluto della prima coin.

TVL attualmente ricostruito, revisioni e timestamp originali di pubblicazione non disponibili: prova retrospettiva, non validazione in tempo reale. Allarmi sovrapposti non indipendenti, nessuna significatività statistica, nessuna ottimizzazione o promessa. Ranking descrittivo per timeframe; almeno 20 eventi maturi per selezionare una coin, per evitare vincitori su uno o due allarmi.

| Coin / coppia | TF | Barre / letture | Corretti / maturi | Falsi | Pend. | Base + / - (n) | Vantaggio pp | Strategia % (trade) | Tieni % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC/ETH | 1D | 1096 / 1096 | 9 / 39 | 30 | 0 | 300 / 155 (1067) | 0.54 | 52.42 (10) | 211.50 |
| BTC/ETH | 1W | 156 / 156 | 4 / 8 | 4 | 5 | 78 / 37 (127) | 4.72 | -18.28 (2) | 209.95 |
| ETH/SOL | 1D | 1096 / 1096 | 12 / 36 | 24 | 0 | 352 / 289 (1067) | 1.00 | 5.96 (11) | 65.61 |
| ETH/SOL | 1W | 156 / 156 | 4 / 9 | 5 | 1 | 50 / 58 (127) | 5.07 | -45.12 (3) | 67.00 |
| SOL/ETH | 1D | 1096 / 1096 | 16 / 49 | 33 | 0 | 425 / 298 (1067) | 0.35 | 43.00 (9) | 425.72 |
| SOL/ETH | 1W | 156 / 156 | 5 / 7 | 2 | 1 | 52 / 52 (127) | 30.48 | 147.63 (1) | 423.91 |
| BNB/ETH | 1D | 1096 / 1096 | 5 / 40 | 35 | 0 | 305 / 117 (1067) | -13.44 | 38.69 (12) | 272.74 |
| BNB/ETH | 1W | 156 / 156 | 6 / 9 | 3 | 4 | 75 / 29 (127) | 11.64 | -3.96 (3) | 276.45 |
| XRP/ETH | 1D | 1096 / 895 | 5 / 35 | 30 | 2 | 239 / 263 (1067) | -9.46 | 208.33 (6) | 185.51 |
| XRP/ETH | 1W | 156 / 102 | 4 / 6 | 2 | 3 | 49 / 49 (127) | 28.08 | 19.52 (2) | 193.89 |
| ADA/ETH | 1D | 1096 / 1096 | 19 / 79 | 60 | 1 | 294 / 376 (1067) | -6.23 | 56.19 (12) | 0.27 |
| ADA/ETH | 1W | 156 / 156 | 5 / 6 | 1 | 5 | 41 / 70 (127) | 47.24 | 43.39 (2) | 1.29 |
| AVAX/ETH | 1D | 1096 / 1096 | 17 / 52 | 35 | 4 | 352 / 373 (1067) | -1.28 | -37.27 (10) | 9.93 |
| AVAX/ETH | 1W | 156 / 156 | 6 / 8 | 2 | 4 | 28 / 89 (127) | 10.93 | 73.76 (1) | 10.15 |
| LINK/ETH | 1D | 1096 / 0 | N/V (0 eventi) | N/V | 0 | 326 / 322 (1067) | N/V | N/V (0) | 86.08 |
| LINK/ETH | 1W | 156 / 0 | N/V (0 eventi) | N/V | 0 | 51 / 58 (127) | N/V | N/V (0) | 86.13 |
| DOT/ETH | 1D | 1096 / 0 | N/V (0 eventi) | N/V | 0 | 267 / 440 (1067) | N/V | N/V (0) | -70.19 |
| DOT/ETH | 1W | 156 / 0 | N/V (0 eventi) | N/V | 0 | 16 / 97 (127) | N/V | N/V (0) | -69.97 |
| TRX/ETH | 1D | 1096 / 1096 | 17 / 54 | 37 | 2 | 266 / 77 (1067) | 11.80 | 153.88 (17) | 277.57 |
| TRX/ETH | 1W | 156 / 156 | 5 / 7 | 2 | 2 | 101 / 5 (127) | 13.50 | 26.51 (2) | 281.35 |

![Tabella completa](./BACKTEST_lukkval_TVL_Rotation_Mirror_v5_ESTESO.png)

N/V nelle colonne allarmi/strategia: nessuna lettura TVL valida. N/V nel vantaggio: nessun evento maturo. Zero strategia con letture valide e zero trade indica liquidità. Rendimenti hold calcolati solo dai prezzi.

Cache e 60 serie CSV: `/Users/ben/MOTORE CRYPTO/dati/backtest_bt2/`. Eventi: `BT2_EVENTI.json`; risultati e hash: `PROVA_BT2.json`; controlli: `VERIFICA_BT2.json`.

Fonti pubbliche: https://api.binance.com/api/v3/klines ; https://api.llama.fi/v2/chains ; https://api.llama.fi/v2/historicalChainTvl/{chain}.

DA FARE PER OPUS: controllo visivo sul Mac: `open "/Users/ben/NOTE CRYPTO/SOCIAL/INDICATORI/v5/BACKTEST_lukkval_TVL_Rotation_Mirror_v5_ESTESO.png"`.
