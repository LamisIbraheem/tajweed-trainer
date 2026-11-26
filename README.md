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
- **More chapters from the book:** Isti'adha & Basmala (lesson only), the sakin lams (verb, هل/بل, noun, command), Hamzat al-Wasl (examples start an ayah, marked `^`), the two meeting letters (mithlayn, mutajanisayn, mutaqaribayn, mutaba'idayn), how to stop (alif, ha, sukun, rawm & ishmam) and the stop signs.
- **Report a mistake:** every rule and quiz answer links to a pre-filled GitHub issue. **Printable copy** (`#/print`): all content in English and Arabic with surah:ayah and review boxes, for a teacher to check.
- **Makharij & Sifat:** the 17 makharij in 5 areas and the 20 sifat, following *Ghayat al-Murid fi 'Ilm al-Tajwid* ('Atiyya Qabil Nasr). Their quizzes show one letter and ask where it comes from or which characteristic it has; the choices never include another answer that is also true for that letter.
- **Audio:** every example has a ▶ button that plays just those words from Sheikh Mahmoud Khalil al-Husary's recitation (Hafs, murattal), streamed from everyayah.com using quran.com's word timings. In quizzes press **P** to play. Needs an internet connection.
- **Record yourself and compare:** a microphone button on every example with audio. Record, play yourself back, or press ⇄ to hear al-Husary and then you. Recordings stay in the browser's memory only (nothing uploaded or saved).
- **Install & offline:** add the site to the phone's home screen (a one-time banner offers it: an Install button on Android, the Share → Add to Home Screen steps on iPhone). Lessons, quizzes and progress work offline; audio works offline once played or downloaded.
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
- `index.html` loads the CSS/JS with a `?v=…` version. After changing any of them, bump that version (one value, five places) so visitors' browsers fetch the new files together instead of mixing cached and new ones.
- `manifest.webmanifest` + `sw.js`: the installable app and offline support. Pages are network-first (updates arrive whenever the app is opened online), CSS/JS are cached by their `?v=` URL, and recitation audio is saved on the device after it is played or via "Download all audio" on the Progress page (≈45 MB). Bump `SW_VERSION` in `sw.js` only when the worker's own logic changes.
