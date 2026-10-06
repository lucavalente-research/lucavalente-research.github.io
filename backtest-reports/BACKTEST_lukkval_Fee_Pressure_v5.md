# Backtest Fee Pressure v5

Periodo richiesto 2023-10-05–2026-10-04 UTC, riscaldamento dal 2023-06-27. Prezzi Binance BTC/ETH/SOLUSDT da cache BT1. Metrica: fee giornaliere delle chain Bitcoin, Ethereum e Solana (dailyFees USD), normalizzate con il rispettivo prezzo e mediana 90g. Nessuna sostituzione di dati mancanti; zero escluso. Serie giornaliera costruita senza buchi di calendario; valori mancanti invalidano tutta la finestra.

I Pine non definiscono segnali operativi. Convenzione sperimentale dichiarata prima del calcolo: attraversamento sopra +15 = ipotesi rialzista, sotto −15 = ribassista; non si ripete l'allarme ogni giorno nella stessa banda. Nessuna ottimizzazione. Il valore mostrato al giorno t deriva soltanto da t−1, come result[1]; ingresso all'apertura UTC di t, esito alla chiusura di t+29 (30 candele). Successo: rendimento finale ≥+10% per rialzo oppure ≤−10% per ribasso. Falso allarme: ogni altro esito; non si misura il tocco intraperiodo. Ultimi 29 giorni senza esito completo esclusi, separatamente contati. Allarmi sovrapposti non indipendenti: nessun test di significatività.

Controllo di base: frequenza di +10% / −10% tra tutte le aperture con 30 giorni completi. Strategia di confronto dichiarata: solo allarmi positivi, compra all'apertura, tieni 30 candele, poi liquidità; ignora allarmi durante una posizione, niente short. Allarmi non maturi ignorati anche dalla strategia. Confronto tieni sempre: prima apertura del periodo / ultima chiusura. Rendimenti lordi, commissioni, slippage, interessi e tasse esclusi; strategia e hold hanno esposizioni differenti. 

Nessuna promessa. Fee positive non sono automaticamente rialziste: il segno è soltanto una convenzione sperimentale. Gli esiti non provano congestione, flussi o causalità. I dati storici del provider sono revisionabili e non hanno timestamp di pubblicazione: nessuna validazione point-in-time. Fonte supply nominale globale diversa da una capitalizzazione a prezzo di mercato. USDT è una proxy USD; disponibilità e definizione TradingView non riconciliate.

| Asset | Giorni / letture | Allarmi + / − | Successi / maturi | Falsi | Pendenti | Base +10% / −10% | Strategia % (trade) | Tieni sempre % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC | 1096 / 774 | 49 / 62 | 22 / 111 | 89 | 7 | 300 / 155 su 1067 | 170.09 (17) | 211.50 |
| ETH | 1096 / 1096 | 87 / 115 | 72 / 202 | 130 | 8 | 352 / 289 su 1067 | 20.55 (27) | 65.61 |
| SOL | 1096 / 1096 | 61 / 65 | 43 / 126 | 83 | 5 | 425 / 298 su 1067 | 13.23 (21) | 425.72 |


Fonti: {"supply": "https://stablecoins.llama.fi/stablecoincharts/all", "BTC": "https://api.llama.fi/summary/fees/bitcoin?dataType=dailyFees", "ETH": "https://api.llama.fi/summary/fees/ethereum?dataType=dailyFees", "SOL": "https://api.llama.fi/summary/fees/solana?dataType=dailyFees"}. Cache e CSV: `/Users/ben/MOTORE CRYPTO/dati/backtest_pine2`. Dettaglio allarmi: PINE2_EVENTI.json. Letture e disponibilità ieri: PROVA_PINE2.json. I giorni senza metriche non sono segnali negativi. Totale letture inferiore a 1096 significa copertura incompleta, non un backtest completo di tre anni. La base prezzo e il tieni sempre usano tutto il periodo: non sono filtrati sui soli giorni di disponibilità della metrica, quindi per BTC Fee Pressure il confronto ha coperture differenti. Le serie supply dei tre asset sono identiche e non costituiscono tre prove indipendenti.

DA FARE PER OPUS: verifica nel Pine Editor dei due sorgenti e riconciliazione feed. Il blocco PINE2 richiede report Markdown, non PNG; nessun browser o prova grafica lanciato.
