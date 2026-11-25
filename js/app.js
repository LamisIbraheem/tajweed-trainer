(function () {
  "use strict";
  const { categories, rules } = window.TAJWEED;
  const letterWord = Object.fromEntries(window.TAJWEED.letterWords || []);   // letter -> Quran word to hear it in
  const ruleById = Object.fromEntries(rules.map(r => [r.id, r]));
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const KEY = "tajweed.v1";
  const app = document.getElementById("app");

  // ---------- state ----------
  function loadState() {
    const blank = { lang: "en", learned: {}, stats: {}, history: [] };
    try { return Object.assign(blank, JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return blank; }
  }
  let state = loadState();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  const t = k => I18N[state.lang][k];
  const L = obj => obj[state.lang] || obj.en;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- stats ----------
  function ruleStat(id) { return state.stats[id] || { a: 0, c: 0, recent: [] }; }
  function ruleAcc(id) {
    const s = ruleStat(id);
    if (!s.recent.length) return null;
    return s.recent.reduce((x, y) => x + y, 0) / s.recent.length;
  }
  function ruleStatus(id) {
    const s = ruleStat(id), acc = ruleAcc(id);
    if (s.a < 3) return "new";
    return acc >= 0.8 && s.recent.length >= 5 ? "mastered" : "learning";
  }
  function record(id, ok) {
    const s = ruleStat(id);
    s.a++; if (ok) s.c++;
    s.recent.push(ok ? 1 : 0); if (s.recent.length > 10) s.recent.shift();
    state.stats[id] = s; save();
  }

  // ---------- rendering helpers ----------
  function renderAr(text, color, opts = {}) {
    const key = text;
    let stop = false;
    if (text.endsWith("|")) { stop = true; text = text.slice(0, -1); }
    const html = esc(text).replace(/\{([^}]*)\}/g, (_, m) => `<span class="hl" style="color:${color}">${m}</span>`);
    const clip = AUDIO.clips[key];
    return `<span class="ar" lang="ar" dir="rtl">${html}</span>` + (stop ? ` <span class="stop" title="waqf">${t("stopBadge")}</span>` : "")
      + (clip ? ` <button class="play" type="button" data-ex="${esc(key)}" title="${t("listen")}" aria-label="${t("listen")}">▶</button>`
          + (opts.ref ? ` <small class="ref muted" dir="ltr">${clip[3]}</small>` : "") : "");
  }

  // ---------- audio (al-Husary, played word-accurate from the full-ayah recording) ----------
  const AUDIO = window.TAJWEED_AUDIO || { base: "", clips: {} };
  const player = new Audio(); player.preload = "none";
  let playing = null, stopTimer = null;
  function stopClip() {
    clearInterval(stopTimer); stopTimer = null; player.pause();
    if (playing) playing.classList.remove("playing", "loading");
    playing = null;
  }
  function playClip(key, btn) {
    const clip = AUDIO.clips[key]; if (!clip) return;
    const wasThis = playing === btn; stopClip(); if (wasThis) return;   // second click stops it
    const [file, startMs, endMs] = clip, src = AUDIO.base + file;
    playing = btn; btn.classList.add("loading"); btn.classList.remove("error");
    const start = Math.max(0, startMs / 1000 - 0.05), end = endMs / 1000 + 0.15;
    const go = () => {
      player.currentTime = start;
      player.play().then(() => {
        if (playing !== btn) return;
        btn.classList.replace("loading", "playing");
        stopTimer = setInterval(() => { if (player.currentTime >= end || player.ended) stopClip(); }, 30);
      }).catch(() => { if (playing === btn) { stopClip(); btn.classList.add("error"); btn.title = t("audioError"); } });
    };
    if (player.src !== src) {
      player.src = src;
      player.addEventListener("loadedmetadata", go, { once: true });
      player.addEventListener("error", () => { if (playing === btn) { stopClip(); btn.classList.add("error"); btn.title = t("audioError"); } }, { once: true });
      player.load();
    } else go();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("button[data-ex]");
    if (b) { e.preventDefault(); playClip(b.dataset.ex, b); }
  });
  window.addEventListener("hashchange", stopClip);
  const catColor = r => catById[r.cat].color;
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function setNav(route) {
    document.querySelectorAll("nav a[data-r]").forEach(a => a.classList.toggle("active", a.dataset.r === route));
  }

  // ---------- views ----------
  function viewHome() {
    setNav("home");
    const learned = rules.filter(r => state.learned[r.id]).length;
    const mastered = rules.filter(r => ruleStatus(r.id) === "mastered").length;
    let a = 0, c = 0; Object.values(state.stats).forEach(s => { a += s.a; c += s.c; });
    const next = rules.find(r => !state.learned[r.id]);
    const weak = rules.filter(r => ruleStat(r.id).a > 0).sort((x, y) => ruleAcc(x.id) - ruleAcc(y.id)).slice(0, 4)
      .filter(r => ruleAcc(r.id) < 0.8);
    app.innerHTML = `
      <section class="hero">
        <h1>${t("appName")}</h1>
        <p>${t("welcome")}</p>
        <div class="bismillah ar" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      </section>
      <section class="stats">
        <div class="stat"><b>${learned}/${rules.length}</b><span>${t("rulesLearned")}</span></div>
        <div class="stat"><b>${mastered}</b><span>${t("mastered")}</span></div>
        <div class="stat"><b>${state.history.length}</b><span>${t("quizzesTaken")}</span></div>
        <div class="stat"><b>${a ? Math.round(100 * c / a) + "%" : "—"}</b><span>${t("accuracy")}</span></div>
      </section>
      <section class="grid2">
        <div class="card">
          <h2>${t("continueLearning")}</h2>
          ${next ? `<p class="muted">${t("nextLesson")}</p>
            <a class="rule-link" href="#/lesson/${next.cat}#${next.id}"><span class="dot" style="background:${catColor(next)}"></span>${esc(L(next.name))}</a>`
            : `<p>✓</p>`}
          <div class="row"><a class="btn" href="#/lessons">${t("lessons")}</a><a class="btn ghost" href="#/quiz">${t("startQuiz")}</a></div>
        </div>
        <div class="card">
          <h2>${t("weakest")}</h2>
          ${weak.length ? `<ul class="plain">${weak.map(r => `<li><a href="#/lesson/${r.cat}#${r.id}"><span class="dot" style="background:${catColor(r)}"></span>${esc(L(r.name))}</a> <span class="muted">${Math.round(100 * ruleAcc(r.id))}%</span></li>`).join("")}</ul>
            <a class="btn" href="#/quiz?mode=weak">${t("practiceWeak")}</a>` : `<p class="muted">${t("noWeak")}</p>`}
        </div>
      </section>`;
  }

  function viewLessons() {
    setNav("lessons");
    app.innerHTML = `<h1>${t("allLessons")}</h1><section class="cats">` + categories.map(c => {
      const rs = rules.filter(r => r.cat === c.id);
      const done = rs.filter(r => state.learned[r.id]).length;
      return `<a class="cat card" href="#/lesson/${c.id}" style="--c:${c.color}">
        <h2>${esc(L(c.name))}</h2>
        <p class="muted">${esc(L(c.intro))}</p>
        <div class="bar"><i style="width:${100 * done / rs.length}%"></i></div>
        <small>${done}/${rs.length} ${t("rulesCount")}</small>
      </a>`;
    }).join("") + `</section>`;
  }

  function viewLesson(catId, focus) {
    setNav("lessons");
    const c = catById[catId]; if (!c) return viewLessons();
    const rs = rules.filter(r => r.cat === c.id);
    const idx = categories.indexOf(c), nextCat = categories[idx + 1];
    app.innerHTML = `
      <a class="back" href="#/lessons">${t("back")}</a>
      <h1 style="color:${c.color}">${esc(L(c.name))}</h1>
      <p class="lead">${esc(L(c.intro))}</p>
      ${rs.map(r => `
        <article class="card rule" id="${r.id}" style="--c:${c.color}">
          <header>
            <h2>${esc(L(r.name))} <span class="ar-name ar" lang="ar">${state.lang === "en" ? esc(r.name.ar) : ""}</span></h2>
            <button class="btn small ${state.learned[r.id] ? "done" : "ghost"}" data-learn="${r.id}">${state.learned[r.id] ? t("learned") : t("markLearned")}</button>
          </header>
          <p>${esc(L(r.summary))}</p>
          <div class="kv"><span>${t("letters")}</span><span class="ar letters" lang="ar">${esc(r.letters)}</span></div>
          ${r.quizLetters ? `<div class="kv"><span>${t("hearLetters")}</span><span class="lchips">${r.quizLetters.split(" ").map(l => {
            const w = letterWord[l];
            return w && AUDIO.clips[w]
              ? `<button class="lchip ar" type="button" lang="ar" data-ex="${esc(w)}" title="${esc(w.replace(/[{}|]/g, ""))}">${esc(l)}</button>`
              : `<span class="lchip ar" lang="ar">${esc(l)}</span>`;
          }).join("")}</span></div>` : ""}
          <div class="kv"><span>${t("howTo")}</span><span class="how">${esc(L(r.how))}</span></div>
          <h3>${t("examples")}</h3>
          <div class="examples">${r.examples.map(e => `<div class="ex">${renderAr(e, c.color, { ref: true })}</div>`).join("")}</div>
        </article>`).join("")}
      <div class="row">
        <a class="btn" href="#/quiz?cats=${c.id}">${t("practiceCat")}</a>
        ${nextCat ? `<a class="btn ghost" href="#/lesson/${nextCat.id}">${esc(L(nextCat.name))} →</a>` : ""}
      </div>`;
    app.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => {
      const id = b.dataset.learn;
      state.learned[id] = !state.learned[id]; save();
      b.classList.toggle("done", !!state.learned[id]); b.classList.toggle("ghost", !state.learned[id]);
      b.textContent = state.learned[id] ? t("learned") : t("markLearned");
    });
    if (focus) { const el = document.getElementById(focus); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); } }
    else window.scrollTo(0, 0);
  }

  // ---------- quiz ----------
  let quiz = null;

  function buildQuestions(catIds, n, mode) {
    const pool = [];
    rules.filter(r => catIds.includes(r.cat)).forEach(r => {
      // Makharij / sifat: one question per letter ("where is it pronounced from?" / "which characteristic?").
      if (catById[r.cat].quiz === "letters") {
        (r.quizLetters || "").split(" ").filter(Boolean).forEach(l => pool.push({ type: "sound", rule: r.id, letter: l }));
        return;
      }
      r.examples.forEach(ex => pool.push({ type: "ex", rule: r.id, ex }));
      if (r.trigger) r.trigger.letters.split(" ").forEach(l => pool.push({ type: "letter", rule: r.id, prefix: r.trigger.prefix, letter: l }));
    });
    const counts = {};
    pool.forEach(q => { const k = q.rule + q.type; counts[k] = (counts[k] || 0) + 1; });
    const weight = q => {
      const acc = ruleAcc(q.rule), hasL = counts[q.rule + "letter"];
      const base = (q.type === "letter" ? 0.3 : (hasL ? 0.7 : 1)) / counts[q.rule + q.type];
      if (mode !== "weak") return base;
      return base * (acc === null ? 1.5 : 0.3 + 3 * (1 - acc));
    };
    const picked = [], used = new Set(), perRule = {};
    while (picked.length < n && used.size < pool.length) {
      let total = 0; const cands = pool.filter((q, i) => !used.has(i));
      const w = cands.map(q => { const v = weight(q) / (1 + (perRule[q.rule] || 0)); total += v; return v; });
      let x = Math.random() * total, k = 0;
      while (x > w[k] && k < w.length - 1) { x -= w[k]; k++; }
      const q = cands[k]; used.add(pool.indexOf(q)); perRule[q.rule] = (perRule[q.rule] || 0) + 1;
      picked.push(q);
    }
    return picked.map(q => Object.assign(q, { options: q.type === "sound" ? buildLetterOptions(q.rule, q.letter) : buildOptions(q.rule) }));
  }

  // Choices for a single-letter question: only rules from the same group (e.g. hams vs jahr),
  // never one that also applies to this letter, so exactly one answer is right.
  function buildLetterOptions(ruleId, letter) {
    const r = ruleById[ruleId];
    const has = x => (x.quizLetters || "").split(" ").includes(letter);
    const others = shuffle(rules.filter(x => x.cat === r.cat && x.id !== r.id && (x.group || "") === (r.group || "") && !has(x)));
    return shuffle([ruleId, ...others.slice(0, 3).map(x => x.id)]);
  }

  function buildOptions(ruleId) {
    const r = ruleById[ruleId], banned = new Set([ruleId]);
    // Avoid distractors that could also be considered correct for the same text.
    if (r.id === "idgham_g" || r.id === "idgham_shafawi") banned.add("ghunnah");
    if (r.id === "ghunnah") { banned.add("idgham_g"); banned.add("idgham_shafawi"); }
    if (r.id === "madd_arid") banned.add("madd_tabii");
    if (r.id === "madd_tabii") banned.add("madd_arid");
    const same = shuffle(rules.filter(x => x.cat === r.cat && !banned.has(x.id)));
    const close = shuffle((r.confusable || []).map(id => ruleById[id]).filter(x => x && !banned.has(x.id)));
    const other = shuffle(rules.filter(x => x.cat !== r.cat && !banned.has(x.id) && catById[x.cat].quiz !== "letters"));
    const out = [];
    [...close, ...same, ...other].forEach(x => { if (out.length < 3 && !out.includes(x.id)) out.push(x.id); });
    return shuffle([ruleId, ...out]);
  }

  function viewQuizSetup(params) {
    setNav("quiz");
    const pre = params.get("cats") ? params.get("cats").split(",") : categories.map(c => c.id);
    const mode = params.get("mode") || "mixed";
    app.innerHTML = `
      <h1>${t("quizSetup")}</h1>
      <div class="card">
        <h3>${t("chooseCats")}</h3>
        <div class="chips">
          <label class="chip"><input type="checkbox" id="allc" ${pre.length === categories.length ? "checked" : ""}> ${t("allCats")}</label>
          ${categories.map(c => `<label class="chip" style="--c:${c.color}"><input type="checkbox" name="cat" value="${c.id}" ${pre.includes(c.id) ? "checked" : ""}> ${esc(L(c.name))}</label>`).join("")}
        </div>
        <h3>${t("length")}</h3>
        <div class="chips">${[5, 10, 20].map(n => `<label class="chip"><input type="radio" name="len" value="${n}" ${n === 10 ? "checked" : ""}> ${n}</label>`).join("")}</div>
        <h3>${t("mode")}</h3>
        <div class="chips">
          <label class="chip"><input type="radio" name="mode" value="mixed" ${mode === "mixed" ? "checked" : ""}> ${t("modeMixed")}</label>
          <label class="chip"><input type="radio" name="mode" value="weak" ${mode === "weak" ? "checked" : ""}> ${t("modeWeak")}</label>
        </div>
        <div class="row"><button class="btn" id="begin">${t("begin")}</button></div>
      </div>`;
    const boxes = [...app.querySelectorAll("input[name=cat]")];
    app.querySelector("#allc").onchange = e => boxes.forEach(b => b.checked = e.target.checked);
    boxes.forEach(b => b.onchange = () => app.querySelector("#allc").checked = boxes.every(x => x.checked));
    app.querySelector("#begin").onclick = () => {
      const cats = boxes.filter(b => b.checked).map(b => b.value);
      if (!cats.length) return;
      const n = +app.querySelector("input[name=len]:checked").value;
      const m = app.querySelector("input[name=mode]:checked").value;
      quiz = { cats, mode: m, qs: buildQuestions(cats, n, m), i: 0, answers: [] };
      viewQuestion();
    };
  }

  function viewQuestion() {
    const q = quiz.qs[quiz.i], r = ruleById[q.rule];
    const prompt = q.type === "ex"
      ? `<p class="qtext">${t("qExample")}</p><div class="qar">${renderAr(q.ex, catColor(r))}</div>`
      : q.type === "sound"
      ? `<p class="qtext">${esc(L(catById[r.cat].question))}</p><div class="qar"><div class="ar qletter" lang="ar" dir="rtl" style="color:${catColor(r)}">${esc(q.letter)}</div>${
          letterWord[q.letter] ? `<div class="qword" title="${t("asIn")}">${renderAr(letterWord[q.letter], catColor(r))}</div>` : ""}</div>`
      : `<p class="qtext">${t("qLetterTitle")}</p><div class="qar"><span class="ar" lang="ar" dir="rtl">${esc(q.prefix)} <span class="plus">+</span> <span class="hl" style="color:${catColor(r)}">${esc(q.letter)}</span></span></div>`;
    app.innerHTML = `
      <div class="qhead"><span>${t("question")} ${quiz.i + 1} ${t("of")} ${quiz.qs.length}</span>
        <div class="bar"><i style="width:${100 * quiz.i / quiz.qs.length}%"></i></div></div>
      <div class="card quiz">
        ${prompt}
        <div class="options">${q.options.map((id, k) => `<button class="opt" data-id="${id}"><kbd>${k + 1}</kbd> ${esc(L(ruleById[id].name))}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;
    const answer = id => {
      if (quiz.answered) return; quiz.answered = true;
      const ok = id === q.rule;
      record(q.rule, ok);
      quiz.answers.push({ q, chosen: id, ok });
      app.querySelectorAll(".opt").forEach(b => {
        b.disabled = true;
        if (b.dataset.id === q.rule) b.classList.add("right");
        else if (b.dataset.id === id) b.classList.add("wrongopt");
      });
      const last = quiz.i === quiz.qs.length - 1;
      app.querySelector("#fb").innerHTML = `
        <div class="feedback ${ok ? "ok" : "bad"}">
          <b>${ok ? t("correct") : t("wrong") + " " + t("answerWas") + ": " + esc(L(r.name))}</b>
          <p>${esc(L(r.summary))}</p>
          <div class="row"><button class="btn" id="nextq">${last ? t("finish") : t("next")}</button>
          <a class="btn ghost" href="#/lesson/${r.cat}#${r.id}" target="_self">${t("openLesson")}</a></div>
        </div>`;
      app.querySelector("#nextq").focus();
      app.querySelector("#nextq").onclick = () => { stopClip(); quiz.answered = false; quiz.i++; last ? viewResults() : viewQuestion(); };
    };
    app.querySelectorAll(".opt").forEach(b => b.onclick = () => answer(b.dataset.id));
    quiz.keyHandler = e => {
      if (e.key === "p" || e.key === "P") { const pb = app.querySelector(".qar .play"); if (pb) playClip(pb.dataset.ex, pb); return; }
      const n = parseInt(e.key, 10);
      if (!quiz.answered && n >= 1 && n <= q.options.length) answer(q.options[n - 1]);
    };
  }

  function viewResults() {
    const score = quiz.answers.filter(a => a.ok).length, total = quiz.answers.length;
    state.history.unshift({ date: new Date().toISOString(), score, total, cats: quiz.cats, mode: quiz.mode });
    state.history = state.history.slice(0, 50); save();
    const wrong = quiz.answers.filter(a => !a.ok);
    app.innerHTML = `
      <h1>${t("results")}</h1>
      <div class="card center">
        <div class="score">${score} / ${total}</div>
        <div class="bar big"><i style="width:${100 * score / total}%"></i></div>
      </div>
      <div class="card">
        <h2>${t("review")}</h2>
        ${wrong.length ? wrong.map(a => {
          const r = ruleById[a.q.rule];
          const shown = a.q.type === "ex" ? renderAr(a.q.ex, catColor(r))
            : a.q.type === "sound" ? `<span class="ar" dir="rtl">${esc(a.q.letter)}</span>`
            : `<span class="ar" dir="rtl">${esc(a.q.prefix)} + ${esc(a.q.letter)}</span>`;
          return `<div class="review-item"><div>${shown}</div>
            <div><s class="muted">${esc(L(ruleById[a.chosen].name))}</s> → <a href="#/lesson/${r.cat}#${r.id}"><b>${esc(L(r.name))}</b></a></div></div>`;
        }).join("") : `<p>${t("noMistakes")}</p>`}
      </div>
      <div class="row"><a class="btn" href="#/quiz?cats=${quiz.cats.join(",")}&mode=${quiz.mode}">${t("again")}</a><a class="btn ghost" href="#/progress">${t("progress")}</a></div>`;
    quiz = null;
  }

  function viewProgress() {
    setNav("progress");
    const label = s => ({ new: t("statusNew"), learning: t("statusLearning"), mastered: t("statusMastered") }[s]);
    app.innerHTML = `
      <h1>${t("progress")}</h1>
      <div class="card">
        <h2>${t("perRule")}</h2>
        ${categories.map(c => `
          <h3 style="color:${c.color}">${esc(L(c.name))}</h3>
          ${rules.filter(r => r.cat === c.id).map(r => {
            const s = ruleStat(r.id), acc = ruleAcc(r.id), st = ruleStatus(r.id);
            return `<div class="prow">
              <a href="#/lesson/${c.id}#${r.id}">${state.learned[r.id] ? "✓ " : ""}${esc(L(r.name))}</a>
              <div class="bar"><i style="width:${acc === null ? 0 : 100 * acc}%;background:${c.color}"></i></div>
              <span class="pill ${st}">${label(st)}</span>
              <small class="muted">${s.a} ${t("attempts")}</small>
            </div>`;
          }).join("")}`).join("")}
      </div>
      <div class="card">
        <h2>${t("history")}</h2>
        ${state.history.length ? `<table><tbody>${state.history.map(h => `<tr>
          <td>${new Date(h.date).toLocaleString(state.lang === "ar" ? "ar" : undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
          <td><b>${h.score}/${h.total}</b></td>
          <td class="muted">${h.cats.length === categories.length ? t("allCats") : h.cats.map(id => esc(L(catById[id].name))).join("، ")}</td></tr>`).join("")}</tbody></table>`
          : `<p class="muted">${t("noHistory")}</p>`}
      </div>
      <div class="card backup">
        <h2>${t("backupTitle")}</h2>
        <p class="muted">${t("backupIntro")}</p>
        <div class="row">
          <button class="btn" id="bk-copy">${t("backupCopy")}</button>
          <button class="btn ghost" id="bk-download">${t("backupDownload")}</button>
        </div>
        <textarea id="bk-code" rows="3" spellcheck="false" dir="ltr" placeholder="${t("backupPaste")}"></textarea>
        <div class="row">
          <button class="btn" id="bk-load">${t("backupLoad")}</button>
          <label class="btn ghost" for="bk-file">${t("backupLoadFile")}</label>
          <input type="file" id="bk-file" accept=".json,.txt,application/json,text/plain" hidden>
        </div>
        <p id="bk-msg" class="bk-msg" role="status"></p>
      </div>
      <button class="btn danger" id="reset">${t("reset")}</button>`;
    app.querySelector("#reset").onclick = () => {
      if (confirm(t("resetConfirm"))) { state = Object.assign(loadState(), { learned: {}, stats: {}, history: [] }); save(); viewProgress(); }
    };
    const box = app.querySelector("#bk-code"), msg = app.querySelector("#bk-msg");
    const say = (k, ok) => { msg.textContent = t(k); msg.className = "bk-msg " + (ok ? "ok" : "bad"); };
    app.querySelector("#bk-copy").onclick = async () => {
      box.value = exportCode();   // set .value (not text content) so digit localisation never touches the code
      box.select();
      try { await navigator.clipboard.writeText(box.value); say("backupCopied", true); }
      catch (e) { say("backupCopyManual", true); }
    };
    app.querySelector("#bk-download").onclick = () => {
      const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tajweed-progress-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      say("backupDownloaded", true);
    };
    const load = text => {
      const data = parseBackup(text);
      if (!data) return say("backupInvalid", false);
      if (!confirm(t("backupConfirm"))) return;
      Object.assign(state, data); save(); viewProgress();
      const m = app.querySelector("#bk-msg"); m.textContent = t("backupLoaded"); m.className = "bk-msg ok";
    };
    app.querySelector("#bk-load").onclick = () => load(box.value);
    app.querySelector("#bk-file").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(load, () => say("backupInvalid", false));
      e.target.value = "";
    };
  }

  // ---------- backup (export / import) ----------
  function exportData() {
    return { app: "tajweed-trainer", v: 1, saved: new Date().toISOString(), learned: state.learned, stats: state.stats, history: state.history };
  }
  function exportCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(exportData()));
    let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
    return "TJW1." + btoa(bin);
  }
  // Accepts a downloaded JSON file or a copied code. Returns clean {learned, stats, history} or null.
  function parseBackup(text) {
    try {
      text = String(text || "").trim();
      if (!text.startsWith("{")) {
        const b64 = text.replace(/^TJW1\./, "").replace(/\s+/g, "");
        text = new TextDecoder().decode(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)));
      }
      const d = JSON.parse(text);
      if (!d || d.app !== "tajweed-trainer") return null;
      const isObj = o => o && typeof o === "object" && !Array.isArray(o);
      const num = x => Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
      const learned = {}, stats = {};
      if (isObj(d.learned)) for (const id in d.learned) if (ruleById[id] && d.learned[id]) learned[id] = true;
      if (isObj(d.stats)) for (const id in d.stats) {
        const s = d.stats[id];
        if (!ruleById[id] || !isObj(s)) continue;
        const recent = Array.isArray(s.recent) ? s.recent.slice(-10).map(x => x ? 1 : 0) : [];
        stats[id] = { a: num(s.a), c: Math.min(num(s.c), num(s.a)), recent };
      }
      const history = (Array.isArray(d.history) ? d.history : [])
        .filter(h => isObj(h) && !isNaN(new Date(h.date)) && Array.isArray(h.cats))
        .map(h => ({ date: h.date, score: num(h.score), total: num(h.total), cats: h.cats.filter(id => catById[id]), mode: h.mode === "weak" ? "weak" : "mixed" }))
        .filter(h => h.total > 0 && h.cats.length).slice(0, 50);
      return { learned, stats, history };
    } catch (e) { return null; }
  }

  // ---------- router ----------
  function route() {
    const h = location.hash.slice(1) || "/";
    const [pathPart, focus] = h.split("#");
    const [path, qs] = pathPart.split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    if (quiz && parts[0] !== "quiz") quiz = null;
    if (parts[0] === "lessons") viewLessons();
    else if (parts[0] === "lesson") viewLesson(parts[1], focus);
    else if (parts[0] === "quiz") viewQuizSetup(params);
    else if (parts[0] === "progress") viewProgress();
    else viewHome();
    if (!focus) window.scrollTo(0, 0);
  }

  // In Arabic, show Arabic-Indic digits (٠١٢…) and the Arabic percent sign in all rendered text.
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  function localizeDigits(root) {
    if (state.lang !== "ar") return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/[0-9%]/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/[0-9]/g, d => AR_DIGITS[d]).replace(/%/g, "٪");
    }
  }
  new MutationObserver(() => localizeDigits(app)).observe(app, { childList: true, subtree: true, characterData: true });

  function applyLang() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.title = t("appName");
    document.querySelectorAll("[data-t]").forEach(el => el.textContent = t(el.dataset.t));
    localizeDigits(document.querySelector("footer"));
  }

  document.getElementById("lang").onclick = () => {
    state.lang = state.lang === "en" ? "ar" : "en"; save(); applyLang();
    if (quiz) viewQuestion(); else route();
  };
  document.addEventListener("keydown", e => { if (quiz && quiz.keyHandler) quiz.keyHandler(e); });
  window.addEventListener("hashchange", route);
  applyLang(); route();
})();
