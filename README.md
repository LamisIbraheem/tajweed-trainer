# Tajweed Trainer

A small offline-friendly web app for learning and practising tajweed (riwayah Hafs 'an 'Asim).

## Run it
- **Easiest:** double-click `index.html` (opens in Edge/Chrome).
- **Or** serve it locally and open http://localhost:8765:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

No installs are needed. Fonts load from Google Fonts when online and fall back to Windows Arabic fonts when offline.

## Features (v1)
- **Lessons:** 7 rule groups and 26 rules (Noon sakinah/tanween, Meem sakinah, Ghunnah, Qalqalah, Lam rules, Madd, Tafkheem/Tarqeeq). Each rule has its letters, how to recite it, and colour-highlighted examples. A "stop" badge marks examples read while stopping (waqf).
- **Makharij & Sifat:** the 17 makharij in 5 areas and the 20 sifat, following *Ghayat al-Murid fi 'Ilm al-Tajwid* ('Atiyya Qabil Nasr). Their quizzes show one letter and ask where it comes from or which characteristic it has; the choices never include another answer that is also true for that letter.
- **Audio:** every example has a ▶ button that plays just those words from Sheikh Mahmoud Khalil al-Husary's recitation (Hafs, murattal), streamed from everyayah.com using quran.com's word timings. In quizzes press **P** to play. Needs an internet connection.
- **Letter audio (Makharij & Sifat):** each letter has a button that plays it inside one Quran word, with sukun wherever possible (`letterWords` in `data.js`); the single-letter quiz questions show and play that word too.
- **Quizzes:** identify the rule from a highlighted example, or from a letter combination (e.g. نْ + ص). Choose rule groups, length, and "focus on weak rules" mode. Keys 1–4 answer.
- **Progress:** per-rule mastery (last 10 answers), studied markers, and quiz history, saved in the browser's localStorage.
- **English / Arabic** UI toggle with full RTL.

## Files
- `js/data.js`: all rule content. Example syntax: `{…}` highlights, and a trailing `|` means stop.
- `js/i18n.js`: UI strings.
- `js/app.js`: router, views, quiz engine, progress.
- `css/style.css`: styles (light and dark).
- `js/audio.js`: generated audio clip map (ayah file + start/end time for each example). After adding or changing examples in `data.js`, regenerate it with `perl tools/audio_map.pl js/data.js <tanzil quran-simple JSON> js/audio.js <cache dir>` (the Quran text JSON is from https://api.alquran.cloud/v1/quran/quran-simple).
