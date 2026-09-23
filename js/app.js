// ===============================================
// 画面係
// URL の # の後ろで画面を切り替える（例：#/pupil/A001）
// データの読み書きは必ず Store（storage.js）を通す
//
// 記録の流れ
//   ① 見立て（困り感・具体的な姿）→ ② 手立て → 保存（実践中）
//   → 授業で試す → ③ 評価 → ④ 今後の展開（次回の手立て候補・相談用の文章）
// ===============================================

const $app = document.getElementById("app");

// ---------- 小さな道具 ----------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(s) {
  return s ? s.replaceAll("-", "/") : "";
}
function catName(id) {
  return (CATEGORIES.find((c) => c.id === id) || {}).name || id;
}
function resultOf(id) {
  return RESULTS.find((r) => r.id === id) || null;
}
function resultText(id) {
  const r = resultOf(id);
  return r ? `${r.icon}${r.name}` : "実践中";
}
function resultBadge(id) {
  const r = resultOf(id);
  return r
    ? `<span class="badge">${r.icon} ${esc(r.name)}</span>`
    : `<span class="badge pending">▶ 実践中</span>`;
}
function strengthName(n) {
  return (STRENGTHS.find((s) => s.id === n) || {}).name || "中";
}
function go(hash) {
  location.hash = hash;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function header(title, backHash) {
  return `<header class="bar">
    ${backHash ? `<a class="back" href="${backHash}">‹ 戻る</a>` : `<span></span>`}
    <h1>${esc(title)}</h1>
    <a class="home" href="#/">ホーム</a>
  </header>`;
}
// 画面上部の「① 見立て ② 手立て ③ 評価 ④ 今後」の進み具合
function stepper(current) {
  const names = ["見立て", "手立て", "評価", "今後"];
  return `<ol class="stepper">${names.map((n, i) =>
    `<li class="${i + 1 === current ? "now" : i + 1 < current ? "done" : ""}"><span>${i + 1}</span>${n}</li>`).join("")}</ol>`;
}
const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));

// ---------- 画面の切り替え ----------
const routes = [
  [/^#\/?$/, homeView],
  [/^#\/pupils$/, pupilListView],
  [/^#\/pupil-new$/, () => pupilFormView(null)],
  [/^#\/pupil\/([^/]+)\/edit$/, (id) => pupilFormView(id)],
  [/^#\/pupil\/([^/]+)$/, pupilDetailView],
  [/^#\/record-new\/([^/]+)$/, (pid) => planView(pid, null)],
  [/^#\/record\/([^/]+)\/plan$/, (rid) => planView(null, rid)],
  [/^#\/record\/([^/]+)\/evaluate$/, evaluateView],
  [/^#\/record\/([^/]+)\/next$/, nextView],
  [/^#\/record\/([^/]+)$/, recordDetailView],
  [/^#\/pending$/, pendingView],
  [/^#\/supports$/, supportListView],
  [/^#\/support-new$/, () => supportFormView(null)],
  [/^#\/support\/([^/]+)$/, supportFormView],
  [/^#\/data$/, dataView],
];

async function render() {
  const hash = location.hash || "#/";
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (m) {
      await view(...m.slice(1).map(decodeURIComponent));
      window.scrollTo(0, 0);
      return;
    }
  }
  go("#/");
}
window.addEventListener("hashchange", render);
render();

// ===============================================
// ホーム
// ===============================================
async function homeView() {
  const pupils = await Store.getPupils();
  const pending = (await Store.getRecords()).filter((r) => !r.result);
  $app.innerHTML = `
    <header class="bar"><span></span><h1>困り感 支援記録</h1><span></span></header>
    <main>
      <p class="lead">見立て → 手立て → 実践 → 評価 → 次の手立て</p>
      <div class="menu">
        <a class="menu-btn primary" href="#/pupils">👧 児童一覧・記録する<small>${pupils.length}人</small></a>
        <a class="menu-btn" href="#/pending">▶ 実践中（評価待ち）<small>${pending.length}件</small></a>
        <a class="menu-btn" href="#/supports">🧰 手立ての編集</a>
        <a class="menu-btn" href="#/data">💾 データの書き出し・読み込み</a>
      </div>
      <p class="note">このアプリは児童を診断するものではありません。授業中に見取った具体的な姿を記録し、授業改善につなげるための道具です。</p>
    </main>`;
}

// ===============================================
// 児童一覧
// ===============================================
async function pupilListView() {
  const pupils = (await Store.getPupils()).sort((a, b) => a.pupil_id.localeCompare(b.pupil_id));
  const records = await Store.getRecords();
  $app.innerHTML = `
    ${header("児童一覧", "#/")}
    <main>
      <a class="btn primary block" href="#/pupil-new">＋ 児童を登録する</a>
      ${pupils.length === 0 ? `<p class="empty">まだ児童が登録されていません。</p>` : ""}
      <ul class="cards">
        ${pupils.map((p) => {
          const mine = records.filter((r) => r.pupil_id === p.pupil_id);
          const pend = mine.filter((r) => !r.result).length;
          return `<li><a class="card" href="#/pupil/${encodeURIComponent(p.pupil_id)}">
            <strong class="pid">${esc(p.pupil_id)}</strong>
            <span>${esc(p.display_name)}</span>
            <small>${p.grade ? esc(p.grade) + "年" : ""}${p.class_name ? esc(p.class_name) + "組" : ""}・記録${mine.length}件${pend ? `・<b class="warn">実践中${pend}</b>` : ""}</small>
          </a></li>`;
        }).join("")}
      </ul>
    </main>`;
}

// ===============================================
// 児童の登録・編集
// ===============================================
async function pupilFormView(pupilId) {
  const p = pupilId ? await Store.getPupil(pupilId) : { pupil_id: "", display_name: "", grade: "", class_name: "", memo: "" };
  if (!p) return go("#/pupils");
  const back = pupilId ? `#/pupil/${encodeURIComponent(pupilId)}` : "#/pupils";
  $app.innerHTML = `
    ${header(pupilId ? "児童情報の編集" : "児童の登録", back)}
    <main>
      <form id="f" class="form">
        <label>児童ID <span class="req">必須</span>
          <input name="pupil_id" value="${esc(p.pupil_id)}" placeholder="例：A001" ${pupilId ? "disabled" : "required"} autocomplete="off">
          <small>研究データにはこのIDが使われます。${pupilId ? "（登録後は変更できません）" : ""}</small>
        </label>
        <label>表示名
          <input name="display_name" value="${esc(p.display_name)}" placeholder="例：Aさん" autocomplete="off">
          <small>実名ではなく、イニシャルや呼び名をおすすめします。</small>
        </label>
        <div class="row">
          <label>学年
            <select name="grade">
              <option value="">-</option>
              ${[3, 4, 5, 6].map((g) => `<option ${String(p.grade) === String(g) ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </label>
          <label>組 <input name="class_name" value="${esc(p.class_name)}" placeholder="例：1" autocomplete="off"></label>
        </div>
        <label>メモ
          <textarea name="memo" rows="3" placeholder="例：前年度から英語の時間は発言が少ない">${esc(p.memo)}</textarea>
          <small>診断名や特性の推測ではなく、見取った様子を書きます。</small>
        </label>
        <button class="btn primary block">保存する</button>
      </form>
    </main>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (pupilId) {
        delete fd.pupil_id;
        await Store.updatePupil(pupilId, fd);
        toast("保存しました");
        go(back);
      } else {
        fd.pupil_id = fd.pupil_id.trim();
        await Store.addPupil(fd);
        toast("登録しました");
        go(`#/pupil/${encodeURIComponent(fd.pupil_id)}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };
}

// ===============================================
// 児童詳細（実践中の記録・支援履歴）
// ===============================================
async function pupilDetailView(pupilId) {
  const p = await Store.getPupil(pupilId);
  if (!p) return go("#/pupils");
  const records = await Store.getRecordsByPupil(pupilId);
  const supports = await Store.getSupports();
  const sName = (id) => (supports.find((s) => s.support_id === id) || {}).support_name || id;
  const enc = encodeURIComponent(pupilId);
  const pending = records.filter((r) => !r.result);

  $app.innerHTML = `
    ${header(p.pupil_id, "#/pupils")}
    <main>
      <section class="profile">
        <div><strong>${esc(p.display_name) || "（表示名なし）"}</strong>
        <small>${p.grade ? esc(p.grade) + "年" : ""}${p.class_name ? esc(p.class_name) + "組" : ""}</small></div>
        <a class="link" href="#/pupil/${enc}/edit">編集</a>
      </section>
      ${p.memo ? `<p class="memo">${esc(p.memo)}</p>` : ""}

      ${pending.map((r) => `
        <section class="practice">
          <div class="tl-head"><b>▶ 実践中</b><small>${fmtDate(r.date)}</small></div>
          <div><span class="k">困り感</span>${r.difficulty_categories.map(catName).map(esc).join("、") || "-"}</div>
          <div><span class="k">手立て</span>${r.selected_supports.map(sName).map(esc).join("、") || "-"}</div>
          <a class="btn primary block big" href="#/record/${r.record_id}/evaluate">試した結果を評価する</a>
          <a class="link" href="#/record/${r.record_id}/plan">見立て・手立てを直す</a>
        </section>`).join("")}

      <a class="btn ${pending.length ? "" : "primary"} block big" href="#/record-new/${enc}">＋ 新しい記録</a>

      <h2>支援履歴 <small>${records.length}件</small></h2>
      ${records.length === 0 ? `<p class="empty">まだ記録がありません。</p>` : ""}
      <ol class="timeline">
        ${records.map((r) => `
          <li><a href="#/record/${r.record_id}">
            <div class="tl-head"><b>${fmtDate(r.date)}</b>${resultBadge(r.result)}</div>
            <div><span class="k">困り感</span>${r.difficulty_categories.map(catName).map(esc).join("、") || "-"}</div>
            <div><span class="k">手立て</span>${r.selected_supports.map(sName).map(esc).join("、") || "-"}</div>
            ${r.change_tags.length ? `<div><span class="k">変化</span>${r.change_tags.map(esc).join("、")}</div>` : ""}
          </a></li>`).join("")}
      </ol>
    </main>`;
}

// ===============================================
// ①見立て → ②手立て（新規・直す 共通）
// ===============================================

// その児童が過去にその手立てを使ったときの、いちばん新しい記録
function lastUseMap(pupilRecords, excludeId) {
  const map = {};
  for (const r of pupilRecords) {
    if (r.record_id === excludeId) continue;
    for (const sid of r.selected_supports) map[sid] = r; // 日付順に並んでいるので最後が最新
  }
  return map;
}

async function planView(pupilId, recordId) {
  let r = null;
  if (recordId) {
    r = await Store.getRecord(recordId);
    if (!r) return go("#/");
    pupilId = r.pupil_id;
  }
  const pupil = await Store.getPupil(pupilId);
  if (!pupil) return go("#/pupils");
  const supports = await Store.getSupports();
  const lastUse = lastUseMap(await Store.getRecordsByPupil(pupilId), recordId);

  const state = {
    step: 1,
    date: r ? r.date : today(),
    cats: new Set(r ? r.difficulty_categories : []),
    observed: r ? r.observed_behavior : "",
    sups: new Set(r ? r.selected_supports : []),
    showAll: false,
  };
  const exitHash = recordId ? `#/record/${recordId}` : `#/pupil/${encodeURIComponent(pupilId)}`;

  // ---- ① 見立て ----
  function drawStep1() {
    $app.innerHTML = `
      ${header(`${pupil.pupil_id} ① 見立て`, exitHash)}
      ${stepper(1)}
      <main class="with-footer">
        <label class="date-row">日付 <input type="date" id="date" value="${esc(state.date)}"></label>
        <section class="step">
          <h2>どこで困っていましたか？ <small>複数選べます</small></h2>
          <div class="choices grid">
            ${CATEGORIES.map((c) => `
              <button type="button" class="choice ${state.cats.has(c.id) ? "on" : ""}" data-cat="${c.id}">${esc(c.name)}</button>`).join("")}
          </div>
          <label>見取った具体的な姿 <small>（任意）</small>
            <textarea id="observed" rows="3" placeholder="例：ペアでは話せるが、全体になると発話しない">${esc(state.observed)}</textarea>
          </label>
          <small class="muted">診断名や特性の推測ではなく、実際に見られた行動や学習の様子を書きます。</small>
        </section>
      </main>
      <footer class="save-bar">
        <span>${state.cats.size ? `${state.cats.size}つ選択中` : "困り感を選んでください"}</span>
        <button class="btn primary" id="next" ${state.cats.size ? "" : "disabled"}>決定 →</button>
      </footer>`;
    document.getElementById("date").oninput = (e) => (state.date = e.target.value);
    document.getElementById("observed").oninput = (e) => (state.observed = e.target.value);
    $app.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { toggle(state.cats, b.dataset.cat); redraw(); }));
    document.getElementById("next").onclick = () => { state.step = 2; draw(); window.scrollTo(0, 0); };
  }

  // ---- ② 手立て ----
  function supportCard(s) {
    const last = lastUse[s.support_id];
    const hist = last ? `<span class="hist">前回 ${resultText(last.result)}（${fmtDate(last.date)}）</span>` : "";
    return `<button type="button" class="choice sup ${state.sups.has(s.support_id) ? "on" : ""}" data-sup="${s.support_id}">
      <span>${esc(s.support_name)}</span>
      ${s.description ? `<small>${esc(s.description)}</small>` : ""}
      ${hist}
    </button>`;
  }
  // 並べ方：まだ試していない・うまくいった手立てを先に、「変化しなかった」手立ては後ろへ
  function order(list) {
    const rank = (s) => (lastUse[s.support_id] && lastUse[s.support_id].result === "none" ? 1 : 0);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }
  function drawStep2() {
    const visible = supports.filter((s) =>
      state.sups.has(s.support_id) ||
      (s.active && (state.showAll || s.categories.some((c) => state.cats.has(c)))));
    const groups = CATEGORIES.filter((c) => state.showAll || state.cats.has(c.id)).map((c) => ({
      name: c.name,
      items: visible.filter((s) => s.categories.includes(c.id)),
    })).filter((g) => g.items.length);
    // 困り感の選択を外しても、選んだ手立ては「選択中」として残す
    const inGroups = new Set(groups.flatMap((g) => g.items.map((s) => s.support_id)));
    const rest = visible.filter((s) => !inGroups.has(s.support_id));
    if (rest.length) groups.push({ name: "選択中（ほかの困り感）", items: rest });
    const shown = new Set(); // 2つの困り感に当てはまる手立ては1回だけ表示

    $app.innerHTML = `
      ${header(`${pupil.pupil_id} ② 手立て`, exitHash)}
      ${stepper(2)}
      <main class="with-footer">
        <p class="summary"><span class="k">困り感</span>${[...state.cats].map(catName).map(esc).join("、")}</p>
        <section class="step">
          <h2>どの手立てを試しますか？ <small>複数選べます</small></h2>
          ${groups.map((g) => {
            const items = order(g.items).filter((s) => !shown.has(s.support_id) && shown.add(s.support_id));
            return items.length ? `<h4>${esc(g.name)}</h4><div class="choices">${items.map(supportCard).join("")}</div>` : "";
          }).join("")}
          <button type="button" class="link" id="toggleAll">${state.showAll ? "選んだ困り感の手立てだけ表示" : "すべての手立てから選ぶ"}</button>
        </section>
      </main>
      <footer class="save-bar">
        <button class="btn" id="prev">← 見立て</button>
        <button class="btn primary" id="save" ${state.sups.size ? "" : "disabled"}>決定して保存</button>
      </footer>`;
    $app.querySelectorAll("[data-sup]").forEach((b) => (b.onclick = () => { toggle(state.sups, b.dataset.sup); redraw(); }));
    document.getElementById("toggleAll").onclick = () => { state.showAll = !state.showAll; redraw(); };
    document.getElementById("prev").onclick = () => { state.step = 1; draw(); window.scrollTo(0, 0); };
    document.getElementById("save").onclick = onSave;
  }

  function draw() {
    state.step === 1 ? drawStep1() : drawStep2();
  }
  // スクロール位置を保ったまま描き直す
  function redraw() {
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  }

  async function onSave() {
    const data = {
      pupil_id: pupilId,
      date: state.date || today(),
      difficulty_categories: CATEGORIES.map((c) => c.id).filter((id) => state.cats.has(id)),
      observed_behavior: state.observed.trim(),
      selected_supports: [...state.sups],
    };
    if (recordId) {
      await Store.updateRecord(recordId, data);
    } else {
      await Store.addRecord({ ...data, result: "", change_tags: [], teacher_note: "", from_record_id: "" });
    }
    toast("保存しました。授業で試してみましょう");
    go(`#/pupil/${encodeURIComponent(pupilId)}`);
  }

  draw();
}

// ===============================================
// ③ 評価
// ===============================================
async function evaluateView(recordId) {
  const r = await Store.getRecord(recordId);
  if (!r) return go("#/");
  const supports = await Store.getSupports();
  const sName = (id) => (supports.find((s) => s.support_id === id) || {}).support_name || id;
  const state = { result: r.result, tags: new Set(r.change_tags), note: r.teacher_note };

  function draw() {
    $app.innerHTML = `
      ${header(`${r.pupil_id} ③ 評価`, `#/pupil/${encodeURIComponent(r.pupil_id)}`)}
      ${stepper(3)}
      <main class="with-footer">
        <section class="summary-box">
          <div><span class="k">日付</span>${fmtDate(r.date)}</div>
          <div><span class="k">困り感</span>${r.difficulty_categories.map(catName).map(esc).join("、")}</div>
          <div><span class="k">手立て</span>${r.selected_supports.map(sName).map(esc).join("、")}</div>
        </section>
        <section class="step">
          <h2>試してみてどうでしたか？</h2>
          <p class="muted">評価は、①で見立てた「ねらった姿」にどれだけ近づいたかで選びます。ほかに見られたよい変化は、下の「見られた変化」で選べます。</p>
          <div class="choices grid">
            ${RESULTS.map((x) => `
              <button type="button" class="choice ${state.result === x.id ? "on" : ""}" data-res="${x.id}">${x.icon} ${esc(x.name)}</button>`).join("")}
          </div>
          ${state.result === "none" && state.tags.size ? `<p class="muted">💡 よい変化にチェックが入っています。ねらった姿に少しでも近づいたなら、「🟡 ねらった姿に近づいた」の方が合うかもしれません。ねらいとは別の変化なら、このままで大丈夫です。</p>` : ""}
          <h3>見られた変化 <small>複数選べます</small></h3>
          <div class="choices grid">
            ${CHANGE_TAGS.map((t) => `
              <button type="button" class="choice ${state.tags.has(t) ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}
          </div>
          <label>教師メモ
            <textarea id="note" rows="3" placeholder="例：前回よりも発話までの時間が短くなった">${esc(state.note)}</textarea>
          </label>
        </section>
      </main>
      <footer class="save-bar">
        <span>${state.result ? "" : "評価を1つ選んでください"}</span>
        <button class="btn primary" id="save" ${state.result ? "" : "disabled"}>決定 →</button>
      </footer>`;
    document.getElementById("note").oninput = (e) => (state.note = e.target.value);
    $app.querySelectorAll("[data-res]").forEach((b) => (b.onclick = () => { state.result = b.dataset.res; redraw(); }));
    $app.querySelectorAll("[data-tag]").forEach((b) => (b.onclick = () => { toggle(state.tags, b.dataset.tag); redraw(); }));
    document.getElementById("save").onclick = async () => {
      await Store.updateRecord(recordId, {
        result: state.result,
        change_tags: CHANGE_TAGS.filter((t) => state.tags.has(t)),
        teacher_note: state.note.trim(),
      });
      go(`#/record/${recordId}/next`);
    };
  }
  function redraw() {
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  }
  draw();
}

// ===============================================
// ④ 今後の展開
// ===============================================

// 次回の手立て候補を、決まりに沿って出す（AIは使わない）
//   🟢できた         → 同じ手立てを続ける／支援を減らす方向（今より「強さ」が小さい手立て）
//   🟡少し変化した   → 同じ手立てを続ける／まだ試していない手立て
//   🔴変化しなかった → まだ試していない手立て
//   ⚪まだ試していない → 同じ手立てをもう一度
function suggestNext(record, pupilRecords, supports) {
  const byId = Object.fromEntries(supports.map((s) => [s.support_id, s]));
  const current = record.selected_supports.map((id) => byId[id]).filter(Boolean);
  const tried = new Set(pupilRecords.flatMap((r) => r.selected_supports));
  const inCats = supports.filter((s) => s.active && s.categories.some((c) => record.difficulty_categories.includes(c)));
  const untried = inCats.filter((s) => !tried.has(s.support_id));
  const out = [];
  const add = (s, reason) => { if (!out.some((o) => o.s.support_id === s.support_id)) out.push({ s, reason }); };

  if (record.result === "done") {
    current.forEach((s) => add(s, "同じ手立てを続ける"));
    const minStrength = Math.min(...current.map((s) => s.strength || 2));
    inCats.filter((s) => (s.strength || 2) < minStrength && !record.selected_supports.includes(s.support_id))
      .sort((a, b) => b.strength - a.strength)
      .forEach((s) => add(s, "支援を減らす方向"));
  } else if (record.result === "some") {
    current.forEach((s) => add(s, "同じ手立てを続ける"));
    untried.forEach((s) => add(s, "まだ試していない"));
  } else if (record.result === "none") {
    untried.forEach((s) => add(s, "まだ試していない"));
  } else if (record.result === "not_yet") {
    current.forEach((s) => add(s, "もう一度試す"));
  }
  return out;
}

// 相談用の文章（表示名・児童メモは入れない）
function consultText(pupil, pupilRecords, supports) {
  const sName = (id) => (supports.find((s) => s.support_id === id) || {}).support_name || id;
  const lines = [
    "小学校外国語の授業で、ある児童への手立てについて相談させてください。",
    "診断や特性の判断ではなく、次の授業で試せる手立ての候補や、記録から見える傾向を一緒に考えてほしいです。",
    "",
    `児童ID：${pupil.pupil_id}${pupil.grade ? `（${pupil.grade}年）` : ""}`,
    "",
    "これまでの経過（古い順）：",
  ];
  pupilRecords.forEach((r, i) => {
    lines.push(`【${i + 1}】${fmtDate(r.date)}`);
    lines.push(`・困り感：${r.difficulty_categories.map(catName).join("、") || "-"}`);
    if (r.observed_behavior) lines.push(`・具体的な姿：${r.observed_behavior}`);
    lines.push(`・手立て：${r.selected_supports.map(sName).join("、") || "-"}`);
    lines.push(`・評価：${resultText(r.result)}`);
    if (r.change_tags.length) lines.push(`・変化：${r.change_tags.join("、")}`);
    if (r.teacher_note) lines.push(`・教師メモ：${r.teacher_note}`);
    lines.push("");
  });
  lines.push(
    "―――",
    "【お願いしたい立場】",
    "特別支援教育（発達の特性・困り感の見取り・合理的配慮・UDL〈学びのユニバーサルデザイン〉）と、小学校外国語の授業づくりの両方に詳しい専門家として考えてください。",
    "",
    "【考える順番】",
    "1. 困り感の背景の仮説を2〜3つ立ててください。記録の「具体的な姿」を根拠に、次のような視点から考えてください（決めつけず、あくまで仮説として）。",
    "   ・英語が分からないことへの不安、失敗したくない気持ち",
    "   ・活動の見通しが持てない、やることが分からない",
    "   ・聞く力（音の聞き分け、話を覚えておくこと）の負担",
    "   ・感覚の過敏さ（周りの声や音、ざわざわした活動、友達との距離）",
    "   ・読み書きの苦手さ（ディスレクシアの傾向など：文字と音を結びつける、書き写す）",
    "   ・注意の向け方、気持ちの切り替え、人との関わり方",
    "2. これまでの手立てを比べ、効いたもの・効かなかったものと、その理由を考えてください。",
    "3. この子が「できていること」（例：先生の話は聞ける）を手がかりとして生かしてください。",
    "",
    "【答えてほしいこと】",
    "・背景の仮説（2〜3つ）と、その根拠になった記録",
    "・次の授業で試す手立てを3つ。それぞれに次の内容をつけてください。",
    "   なぜ効きそうか／授業のどの場面で使うか／かける言葉の例／支援の強さ（大・中・小）",
    "・学習指導要領（外国語・外国語活動）の目標とのつながり：その手立てが、どの領域（聞くこと・話すこと〈やり取り・発表〉・読むこと・書くこと）のどんな力を育てることにつながるか",
    "・学級のほかの子への広げ方：この子のための手立てを、学級全体にも役立つ形（全員にとって分かりやすい授業）にするにはどうすればよいか",
    "・次の授業で見取るとよいポイント",
    "・うまくいったときの、支援の減らし方",
    "",
    "【守ってほしいこと】",
    "・診断名や特性を決めつけないでください。",
    "・学級全体の授業の中で、担任1人でもできる手立てにしてください。",
    "・一般論ではなく、この子の記録に基づいて答えてください。",
  );
  return lines.join("\n");
}

async function nextView(recordId) {
  const r = await Store.getRecord(recordId);
  if (!r) return go("#/");
  const pupil = await Store.getPupil(r.pupil_id);
  const supports = await Store.getSupports();
  const pupilRecords = await Store.getRecordsByPupil(r.pupil_id);
  const candidates = suggestNext(r, pupilRecords, supports);
  const picked = new Set();
  const enc = encodeURIComponent(r.pupil_id);

  function draw() {
    $app.innerHTML = `
      ${header(`${r.pupil_id} ④ 今後の展開`, `#/pupil/${enc}`)}
      ${stepper(4)}
      <main class="with-footer">
        <section class="summary-box">
          <div><span class="k">今回</span>${fmtDate(r.date)} ${resultBadge(r.result)}</div>
          <div><span class="k">困り感</span>${r.difficulty_categories.map(catName).map(esc).join("、")}</div>
        </section>

        <section class="step">
          <h2>次回の手立て候補</h2>
          <p class="muted">これまでの記録から出した候補です。どれがよいかは、先生が判断してください。</p>
          <p class="muted">${picked.size ? `✅ ${picked.size}つ選んでいます。下の「次回の記録を作る」を押せます。` : "👉 候補を1つ以上タップして選ぶと、下の「次回の記録を作る」が押せるようになります。"}</p>
          ${candidates.length === 0 ? `<p class="empty">候補が見つかりませんでした。下の「相談用の文章」で相談してみましょう。</p>` : ""}
          <div class="choices">
            ${candidates.map(({ s, reason }) => `
              <button type="button" class="choice sup ${picked.has(s.support_id) ? "on" : ""}" data-sup="${s.support_id}">
                <span>${esc(s.support_name)}</span>
                <span class="hist">${esc(reason)}・支援の強さ ${strengthName(s.strength)}</span>
                ${s.description ? `<small>${esc(s.description)}</small>` : ""}
              </button>`).join("")}
          </div>
        </section>

        <section class="step">
          <h2>相談する</h2>
          <p class="muted">この子の記録を相談用の文章にまとめます。表示名とメモは入りません。コピーして Claude などに貼り付けて相談できます。</p>
          <textarea id="consult" rows="8" readonly>${esc(consultText(pupil, pupilRecords, supports))}</textarea>
          <button class="btn block" id="copy">📋 相談用の文章をコピー</button>
        </section>
      </main>
      <footer class="save-bar">
        <a class="btn" href="#/pupil/${enc}">今回はここまで</a>
        <button class="btn primary" id="makeNext" ${picked.size ? "" : "disabled"} title="上の候補を1つ以上選ぶと押せます">次回の記録を作る</button>
      </footer>`;
    $app.querySelectorAll("[data-sup]").forEach((b) => (b.onclick = () => {
      toggle(picked, b.dataset.sup);
      const y = window.scrollY; draw(); window.scrollTo(0, y);
    }));
    document.getElementById("copy").onclick = async () => {
      const text = document.getElementById("consult").value;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const t = document.getElementById("consult"); t.select(); document.execCommand("copy");
      }
      toast("コピーしました");
    };
    document.getElementById("makeNext").onclick = async () => {
      // ①②が入った状態で、次回の新しい記録を「実践中」として作る
      await Store.addRecord({
        pupil_id: r.pupil_id,
        date: today(),
        difficulty_categories: r.difficulty_categories,
        observed_behavior: r.observed_behavior,
        selected_supports: [...picked],
        result: "",
        change_tags: [],
        teacher_note: "",
        from_record_id: r.record_id, // どの記録から続いているか（研究で経過を追うため）
      });
      toast("次回の記録を作りました");
      go(`#/pupil/${enc}`);
    };
  }
  draw();
}

// ===============================================
// 記録の確認
// ===============================================
async function recordDetailView(recordId) {
  const r = await Store.getRecord(recordId);
  if (!r) return go("#/");
  const supports = await Store.getSupports();
  const sups = r.selected_supports.map((id) => supports.find((s) => s.support_id === id) || { support_name: id });
  $app.innerHTML = `
    ${header(`記録 ${r.record_id}`, `#/pupil/${encodeURIComponent(r.pupil_id)}`)}
    <main>
      <dl class="detail">
        <dt>児童</dt><dd>${esc(r.pupil_id)}</dd>
        <dt>日付</dt><dd>${fmtDate(r.date)}</dd>
        <dt>困り感</dt><dd>${r.difficulty_categories.map(catName).map(esc).join("、") || "-"}</dd>
        <dt>具体的な姿</dt><dd class="pre">${esc(r.observed_behavior) || "-"}</dd>
        <dt>手立て</dt><dd>${sups.length ? `<ul>${sups.map((s) => `<li>${esc(s.support_name)}</li>`).join("")}</ul>` : "-"}</dd>
        <dt>評価</dt><dd>${resultBadge(r.result)}</dd>
        <dt>変化</dt><dd>${r.change_tags.map(esc).join("、") || "-"}</dd>
        <dt>教師メモ</dt><dd class="pre">${esc(r.teacher_note) || "-"}</dd>
        ${r.from_record_id ? `<dt>前の記録</dt><dd><a class="link" href="#/record/${r.from_record_id}">${esc(r.from_record_id)} から続く</a></dd>` : ""}
      </dl>
      ${r.result
        ? `<a class="btn primary block" href="#/record/${r.record_id}/next">④ 今後の展開・相談</a>
           <a class="btn block" href="#/record/${r.record_id}/evaluate">評価を直す</a>`
        : `<a class="btn primary block" href="#/record/${r.record_id}/evaluate">試した結果を評価する</a>`}
      <a class="btn block" href="#/record/${r.record_id}/plan">見立て・手立てを直す</a>
    </main>`;
}

// ===============================================
// 実践中（評価待ち）一覧
// ===============================================
async function pendingView() {
  const list = (await Store.getRecords()).filter((r) => !r.result)
    .sort((a, b) => b.date.localeCompare(a.date));
  $app.innerHTML = `
    ${header("実践中（評価待ち）", "#/")}
    <main>
      ${list.length === 0 ? `<p class="empty">実践中の記録はありません。</p>` : ""}
      <ul class="cards">
        ${list.map((r) => `<li><a class="card" href="#/record/${r.record_id}/evaluate">
          <strong class="pid">${esc(r.pupil_id)}</strong>
          <span>${fmtDate(r.date)}</span>
          <small>${r.difficulty_categories.map(catName).map(esc).join("、")}</small>
        </a></li>`).join("")}
      </ul>
    </main>`;
}

// ===============================================
// 手立ての一覧・編集
// ===============================================
async function supportListView() {
  const list = await Store.getSupports();
  $app.innerHTML = `
    ${header("手立ての編集", "#/")}
    <main>
      <a class="btn primary block" href="#/support-new">＋ 手立てを追加する</a>
      ${CATEGORIES.map((c) => {
        const items = list.filter((s) => s.categories.includes(c.id));
        return `<h2>${esc(c.name)} <small>${items.length}</small></h2>
          <ul class="sup-list">
            ${items.map((s) => `<li class="${s.active ? "" : "off"}"><a href="#/support/${s.support_id}">
              <span>${esc(s.support_name)}</span> <small>強さ${strengthName(s.strength)}${s.active ? "" : "・使わない"}</small>
            </a></li>`).join("") || `<li class="empty">なし</li>`}
          </ul>`;
      }).join("")}
    </main>`;
}

async function supportFormView(supportId) {
  const s = supportId
    ? (await Store.getSupports()).find((x) => x.support_id === supportId)
    : { support_id: await Store.nextSupportId(), support_name: "", description: "", categories: [], scene: "", strength: 2, note: "", active: true };
  if (!s) return go("#/supports");
  $app.innerHTML = `
    ${header(supportId ? "手立ての編集" : "手立ての追加", "#/supports")}
    <main>
      <form id="f" class="form">
        <p class="muted">手立てID：${esc(s.support_id)}</p>
        <label>手立て名 <span class="req">必須</span>
          <input name="support_name" value="${esc(s.support_name)}" required autocomplete="off">
        </label>
        <label>説明 <textarea name="description" rows="3">${esc(s.description)}</textarea></label>
        <fieldset>
          <legend>対応する困り感 <span class="req">1つ以上</span></legend>
          <div class="checks">
            ${CATEGORIES.map((c) => `<label class="check"><input type="checkbox" name="cat" value="${c.id}" ${s.categories.includes(c.id) ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}
          </div>
        </fieldset>
        <label>支援の強さ
          <select name="strength">
            ${STRENGTHS.map((x) => `<option value="${x.id}" ${s.strength === x.id ? "selected" : ""}>${x.name}</option>`).join("")}
          </select>
          <small>大＝教師がかなり手伝う、小＝掲示や環境の工夫程度。「ねらった姿になった」のあとに支援を減らす候補を出すときに使います。</small>
        </label>
        <label>使用場面 <input name="scene" value="${esc(s.scene)}" placeholder="例：発表・スピーチ" autocomplete="off"></label>
        <label>備考 <textarea name="note" rows="2">${esc(s.note)}</textarea></label>
        <label class="check"><input type="checkbox" name="active" ${s.active ? "checked" : ""}> 記録の選択肢に表示する</label>
        <small class="muted">使わなくなった手立ては、チェックを外すと選択肢から消えます（過去の記録には残ります）。</small>
        <button class="btn primary block">保存する</button>
      </form>
    </main>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cats = fd.getAll("cat");
    if (cats.length === 0) return alert("対応する困り感を1つ以上選んでください。");
    await Store.saveSupport({
      support_id: s.support_id,
      support_name: fd.get("support_name").trim(),
      description: fd.get("description").trim(),
      categories: cats,
      scene: fd.get("scene").trim(),
      strength: Number(fd.get("strength")),
      note: fd.get("note").trim(),
      active: fd.get("active") === "on",
    });
    toast("保存しました");
    go("#/supports");
  };
}

// ===============================================
// データの書き出し・読み込み
// ===============================================
async function dataView() {
  $app.innerHTML = `
    ${header("データ管理", "#/")}
    <main>
      <section class="step">
        <h2>スプレッドシートに書き出す</h2>
        <p>Excel形式（.xlsx）のファイルができます。「児童」「支援記録」「手立て」の3つのシートが入っています。Googleドライブに入れると、Googleスプレッドシートで開けます。</p>
        <button class="btn primary block" id="expFull">バックアップ用（全部入り）</button>
        <small class="muted">表示名・児童メモも入ります。アプリに読み込めるのはこちらです。</small>
        <button class="btn block" id="expResearch">研究用（IDだけ）</button>
        <small class="muted">表示名・児童メモは入りません。研究データとして渡すときに使います。</small>
      </section>
      <section class="step">
        <h2>スプレッドシートを読み込む</h2>
        <p>書き出したファイルを読み込みます。スプレッドシートで直した内容（手立ての追加・修正など）もアプリに反映されます。別の端末にデータを移すときにも使えます。</p>
        <p class="warn">⚠ 読み込むと、この端末の今のデータはすべて置き換わります。</p>
        <label class="btn block file-btn">ファイルを選んで読み込む<input type="file" id="imp" accept=".xlsx" hidden></label>
        <div id="impResult"></div>
      </section>
      <section class="step">
        <h2>スプレッドシートで直すときの注意</h2>
        <ul class="tips">
          <li>1行目の見出し（児童ID・日付など）とシート名は変えないでください。</li>
          <li>複数あるときは「、」で区切ります（例：人前での発話、聞く）。</li>
          <li>困り感・評価・変化・支援の強さは、アプリと同じ言葉で書きます。</li>
          <li>手立てを増やすときは、「手立て」シートに新しい手立てID（例：S051）で1行足します。</li>
          <li>保存するときは Excel形式（.xlsx）で保存してください。</li>
        </ul>
      </section>
      <p class="note">データはこの端末のブラウザの中だけに保存されています。ブラウザの履歴やサイトデータを消すと記録も消えるので、ときどきバックアップ用に書き出しておくと安心です。</p>
    </main>`;

  const exportFile = async (research) => {
    const wb = buildWorkbook(await Store.exportAll(), research);
    XLSX.writeFile(wb, `komarikan-${research ? "research" : "backup"}-${today()}.xlsx`);
  };
  document.getElementById("expFull").onclick = () => exportFile(false);
  document.getElementById("expResearch").onclick = () => exportFile(true);

  document.getElementById("imp").onchange = async (e) => {
    const file = e.target.files[0];
    const $res = document.getElementById("impResult");
    $res.innerHTML = "";
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const { errors, data } = parseWorkbook(wb);
      if (errors.length) {
        // 1つでもおかしな行があれば読み込まない（今のデータは変わらない）
        $res.innerHTML = `<div class="error-box"><b>読み込めませんでした。次のところを直してください。</b>
          <ul>${errors.slice(0, 30).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
          ${errors.length > 30 ? `<p>ほか ${errors.length - 30}件</p>` : ""}
          <p>今のデータはそのままです。</p></div>`;
        return;
      }
      const msg = `次の内容を読み込みます。\n\n児童：${data.pupils.length}人\n支援記録：${data.support_records.length}件\n手立て：${data.support_master.length}個\n\nこの端末の今のデータは置き換わります。よろしいですか？`;
      if (!confirm(msg)) return;
      await Store.importAll(data);
      toast("読み込みました");
      go("#/");
    } catch (err) {
      $res.innerHTML = `<div class="error-box">ファイルを開けませんでした。Excel形式（.xlsx）か確かめてください。</div>`;
    } finally {
      e.target.value = "";
    }
  };
}
