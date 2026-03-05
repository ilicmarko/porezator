# Porezator

Generator poreske prijave za prenos hartija od vrednosti (PPDG-3R) iz CSV podataka o kupovini i prodaji.

## Mogućnosti

- Generisanje XML fajla u formatu za e-Poreze (PPDG-3R)
- FIFO uparivanje kupovina i prodaja
- Automatsko preuzimanje srednjeg kursa NBS (kurs.resenje.org)
- Agregacija transakcija po tikeru i datumu sa ponderisanom cenom
- Validacija pokrivenosti prodaja kupovinama
- Zbirni finansijski pregled sa procenjenim porezom (15%)
- Lista potrebne dokumentacije
- Offline režim — bez slanja podataka serveru (zahteva kolonu `srednji_kurs` u CSV-u)
- Automatsko čuvanje unetih podataka u pregledač (localStorage)
- Mobilni prikaz

## Pokretanje

```bash
npm install
npm start
```

Aplikacija je dostupna na `http://localhost:3000`.

## Korišćenje

### 1. Režim rada

Na vrhu stranice izaberite Online ili Offline režim:
- **Online** — server preuzima srednji kurs NBS za svaki datum transakcije
- **Offline** — ništa se ne šalje serveru, ali CSV mora sadržati kolonu `srednji_kurs`

### 2. Podaci o prijavi

- **Datum prijave** — automatski postavlja godinu i polugodište na prethodni period
- **Godina prodaje** i **Polugodište** — mogu se ručno promeniti
- Datumi ostvarenja prihoda i dospeća se računaju automatski

### 3. Unos CSV podataka

Nalepite ili učitajte CSV za prodaje i kupovine. Format:

```csv
datum,ticker,shares,price,currency,srednji_kurs
2025-11-25,VWCE,85,142.38,EUR,117.25
```

Kolona `srednji_kurs` je opciona u online režimu, obavezna u offline režimu.

Podržani formati:
- Zarez kao separator (CSV)
- Tab kao separator (copy/paste iz Google Sheets)
- Hiljadarke u cenama (npr. `2,229.75`)

### 4. Validacija

Kliknite **„Učitaj tabelu"** da vidite:
- Pregled unetih transakcija
- Proveru da li kupovine pokrivaju prodaje (FIFO)
- Upozorenja za transakcije sa manje od 1 akcije

### 5. Generisanje XML

Kliknite **„Generiši XML"** za kreiranje poreske prijave.

Ako kupovine ne pokrivaju sve prodaje, pojavljuje se opcija za forsiranje generisanja.

Nakon generisanja prikazuju se:
- XML pregled
- Lista dokumenata za prijavu
- Zbirni finansijski pregled (ukupno prodato/kupljeno u RSD, kapitalni dobitak, procenjeni porez)

## Struktura projekta

```
server.js            — Express server, API za generisanje XML-a i preuzimanje kursa
public/index.html    — Korisničko sučelje
public/offline-core.js — Offline engine za generisanje XML-a na klijentu
primer.xml           — Primer generisanog XML fajla
```

## Napomene

- Ovo nije zvaničan alat državnih organa — koristi se na sopstvenu odgovornost
- Aplikacija ne skladišti podatke niti koristi telemetriju
- Server se koristi isključivo za preuzimanje kursa valute
- Kod je otvorenog tipa (open source)
