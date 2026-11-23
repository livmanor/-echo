# ECHO

Public-channel illegal trade monitor for **Rajasthan Police**.

ECHO reads exported posts from public Telegram channels and social-media listings, flags advertisements for drugs, illegal arms, fake documents, bank accounts, ATM or credit cards, net-banking kits, and SIM cards, and keeps an evidence snapshot of each alert.

The bundled dataset is synthetic. Do not load real personal data.

## What it does

- Imports CSV, JSON, or a Telegram desktop export. It does not log in, join private groups, or contact sellers.
- Classifies posts with a slang and emoji lexicon, including Hindi and Hinglish, blended with a naive Bayes model.
- Separately flags financial ads that buy, sell, or rent accounts, cards, kits, or SIMs, and shows the phrases that triggered the flag.
- Extracts phone numbers, UPI IDs, handles, wallets, and locations from the post text and from poster OCR text supplied with the export.
- Links the same identifier across channels into a seller graph, and groups near-duplicate wording into coordinated advertisements.
- Stores each alert with the post text, time, channel, and a SHA-256 hash. A report page can be printed to PDF.

## Run

From the project folder, start both servers:

```bat
run_all.bat
```

Or start them separately:

```bat
cd backend
py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

```bat
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Any 4-digit PIN opens the demo gate. That PIN is not authentication.

The API listens on [http://127.0.0.1:8000](http://127.0.0.1:8000). Set `VITE_API_URL` if the frontend should call a different host.

## Demo data

The first launch loads the synthetic corpus. In **Import** you can restore that corpus, download it as CSV or JSON, or classify a single post without saving it.

Poster images are not read on this machine. Put extracted poster text in the `ocr_text` column and the classifier will use it.

Check the sample set from `backend`:

```bat
py selfcheck.py
```

## Out of scope

- Joining private groups or using a cover identity
- Contacting sellers or making purchases
- Collecting from private accounts
