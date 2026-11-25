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
- **Quizzes:** identify the rule from a highlighted example, or from a letter combination (e.g. نْ + ص). Choose rule groups, length, and "focus on weak rules" mode. Keys 1–4 answer.
- **Progress:** per-rule mastery (last 10 answers), studied markers, and quiz history, saved in the browser's localStorage.
- **English / Arabic** UI toggle with full RTL.

## Files
- `js/data.js`: all rule content. Example syntax: `{…}` highlights, and a trailing `|` means stop.
- `js/i18n.js`: UI strings.
- `js/app.js`: router, views, quiz engine, progress.
- `css/style.css`: styles (light and dark).
