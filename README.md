# Porezator

Generator poreske prijave za prenos hartija od vrednosti (PPDG-3R) iz CSV podataka o kupovini i prodaji.

## Mogućnosti

- Generisanje XML fajla u formatu za e-Poreze (PPDG-3R)
- FIFO uparivanje kupovina i prodaja
- Automatsko preuzimanje srednjeg kursa NBS (kurs.resenje.org) na zahtev iz koraka Pregled
- Agregacija transakcija po tikeru i datumu sa ponderisanom cenom
- Validacija pokrivenosti prodaja kupovinama
- Zbirni finansijski pregled sa procenjenim porezom (15%)
- Lista potrebne dokumentacije
- Lokalno generisanje XML-a u pregledaču
- Automatsko čuvanje unetih podataka u pregledač (localStorage)
- Mobilni prikaz

## Pokretanje

```bash
npm install
npm start
```

Aplikacija je dostupna na `http://localhost:3000`.

## Korišćenje

### 1. Lokalni režim

Porezator sada radi lokalno po defaultu:
- XML se generiše direktno u pregledaču
- Server se koristi samo kada u koraku **Pregled** kliknete na preuzimanje srednjih kurseva
- Kolonu `srednji_kurs` možete uneti ručno ili je automatski popuniti u pregledu

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

Kolona `srednji_kurs` može biti prazna pri unosu, ali mora biti popunjena pre generisanja XML-a.

Podržani formati:
- Zarez kao separator (CSV)
- Tab kao separator (copy/paste iz Google Sheets)
- Hiljadarke u cenama (npr. `2,229.75`)

### 4. Validacija

Kliknite **„Učitaj tabelu"** da vidite:
- Pregled unetih transakcija
- Proveru da li kupovine pokrivaju prodaje (FIFO)
- Upozorenja za transakcije sa manje od 1 akcije

### 5. Pregled i kursevi

U koraku **Pregled** možete:
- ručno uneti `srednji_kurs` za svaki red
- kliknuti na **„Preuzmi srednje kurseve sa servera"** da automatski popunite sve unete datume i valute

### 6. Generisanje XML

Kliknite **„Generiši XML"** za kreiranje poreske prijave.

Ako kupovine ne pokrivaju sve prodaje, pojavljuje se opcija za forsiranje generisanja.

Nakon generisanja prikazuju se:
- XML pregled
- Lista dokumenata za prijavu
- Zbirni finansijski pregled (ukupno prodato/kupljeno u RSD, kapitalni dobitak, procenjeni porez)

## Struktura projekta

```
server.js            — Express server, API za preuzimanje kursa
public/index.html    — Korisničko sučelje
public/offline-core.js — Engine za generisanje XML-a na klijentu
primer.xml           — Primer generisanog XML fajla
```

## Primeri test podataka

Anonimizovani IBKR primeri za testiranje importa nalaze se u `examples/ibkr-dummy/`.
Set sadrži tri godišnja izveštaja koja zajedno prolaze validaciju, ali namerno prijavljuju FIFO greške ako izostavite jednu od godina kupovine.

## Zahvalnice

Podaci o kursu valuta preuzeti sa [kurs.resenje.org](https://kurs.resenje.org) — autor **Janoš Guljaš** ([@janos](https://github.com/janos)).

## Napomene

- Ovo nije zvaničan alat državnih organa — koristi se na sopstvenu odgovornost
- Aplikacija ne skladišti podatke niti koristi telemetriju
- Server se koristi isključivo za preuzimanje kursa valute
- Kod je otvorenog tipa (open source) — [github.com/ilicmarko/porezator](https://github.com/ilicmarko/porezator)
