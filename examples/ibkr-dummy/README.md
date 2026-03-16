# IBKR dummy examples

Anonimizovani test podaci za proveru IBKR importa u Porezatoru.

Fajlovi:
- `UDUMMY001_2023_2023.csv` — kupovine iz 2023.
- `UDUMMY001_2024_2024.csv` — dodatne kupovine iz 2024.
- `UDUMMY001_2025_2025.csv` — prodaje iz 2025.

Sta ovi primeri pokrivaju:
- Frakcione kupovine i prodaje (`GOOGL 0.75`, `GOOGL 0.25`, `MSFT 1.2`, `AAPL 2.5`).
- Ispravan prolaz kada se ucitaju sve 3 godine zajedno.
- Namernu FIFO gresku ako se ne ucita jedna od godina kupovine.

Ocekivano ponasanje:
- Ako ucitate sve 3 datoteke: validacija treba da prodje bez greske o nedostajucim akcijama.
- Ako ucitate samo `2024` + `2025`: trebalo bi da dobijete manjak za `VWCE`, `AAPL` i `GOOGL`.
- Ako ucitate samo `2023` + `2025`: trebalo bi da dobijete manjak za `VWCE`, `MSFT` i deo `GOOGL`.
- Ako ucitate samo `2025`: trebalo bi da dobijete samo prodaje i jasne FIFO greske.

Napomena:
- Ovi CSV fajlovi su namerno minimalni i sadrze samo sekcije koje su potrebne parseru.
- `Code` kolona koristi IBKR oznake `O` (opening trade) i `C` (closing trade).
