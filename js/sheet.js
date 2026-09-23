// ===============================================
// スプレッドシート（.xlsx）係
// アプリのデータ ⇔ 3つのシート（児童・支援記録・手立て）に変換する
// 中身は人が読める日本語にする（例：評価＝「少し変化した」）
// 複数の値は「、」で区切って1つのセルに入れる
// ===============================================

const SEP = "、";
const SHEET_PUPILS = "児童";
const SHEET_RECORDS = "支援記録";
const SHEET_SUPPORTS = "手立て";

function splitCell(v) {
  return String(v ?? "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
}
function cell(v) {
  return String(v ?? "").trim();
}
// 「2026/9/23」「2026-09-23」などを「2026-09-23」にそろえる
function normDate(v) {
  const m = cell(v).match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
}

// ---------- 書き出す ----------
// research = true のときは表示名・児童メモを入れない（研究用）
function buildWorkbook(data, research) {
  const supports = data.support_master;
  const sName = (id) => (supports.find((s) => s.support_id === id) || {}).support_name || id;

  const pupilRows = data.pupils.map((p) => research
    ? { 児童ID: p.pupil_id, 学年: p.grade, 組: p.class_name }
    : { 児童ID: p.pupil_id, 表示名: p.display_name, 学年: p.grade, 組: p.class_name, メモ: p.memo, 登録日時: p.created_at });

  const recordRows = data.support_records.map((r) => ({
    記録ID: r.record_id,
    児童ID: r.pupil_id,
    日付: r.date,
    困り感: r.difficulty_categories.map(catName).join(SEP),
    具体的な姿: r.observed_behavior,
    手立てID: r.selected_supports.join(SEP),
    手立て: r.selected_supports.map(sName).join(SEP),
    評価: resultOf(r.result) ? resultOf(r.result).name : "",
    変化: r.change_tags.join(SEP),
    教師メモ: r.teacher_note,
    前の記録ID: r.from_record_id || "",
    作成日時: r.created_at,
    更新日時: r.updated_at,
  }));

  const supportRows = supports.map((s) => ({
    手立てID: s.support_id,
    手立て名: s.support_name,
    説明: s.description,
    困り感: s.categories.map(catName).join(SEP),
    支援の強さ: strengthName(s.strength),
    使用場面: s.scene,
    備考: s.note,
    使う: s.active ? "はい" : "いいえ",
  }));

  const wb = XLSX.utils.book_new();
  const add = (rows, name, header) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    ws["!cols"] = header.map((h) => ({ wch: Math.max(10, h.length * 2 + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(pupilRows, SHEET_PUPILS, research ? ["児童ID", "学年", "組"] : ["児童ID", "表示名", "学年", "組", "メモ", "登録日時"]);
  add(recordRows, SHEET_RECORDS, ["記録ID", "児童ID", "日付", "困り感", "具体的な姿", "手立てID", "手立て", "評価", "変化", "教師メモ", "前の記録ID", "作成日時", "更新日時"]);
  add(supportRows, SHEET_SUPPORTS, ["手立てID", "手立て名", "説明", "困り感", "支援の強さ", "使用場面", "備考", "使う"]);
  return wb;
}

// ---------- 読み込む ----------
// 読めなかった行は errors に「どのシートの何行目が、なぜだめか」を入れて返す
function parseWorkbook(wb) {
  const errors = [];
  const rows = (name) => {
    const ws = wb.Sheets[name];
    if (!ws) { errors.push(`「${name}」シートがありません`); return []; }
    return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  };
  // 研究用ファイル（表示名の列が無い）を読み込むと名前が消えるので止める
  const pws = wb.Sheets[SHEET_PUPILS];
  if (pws && !(XLSX.utils.sheet_to_json(pws, { header: 1 })[0] || []).includes("表示名")) {
    errors.push("これは「研究用」のファイルなので読み込めません。「バックアップ用」のファイルを選んでください");
    return { errors, data: null };
  }
  const catId = (name) => (CATEGORIES.find((c) => c.name === name) || {}).id;
  const now = new Date().toISOString();

  // 手立て
  const supports = [];
  rows(SHEET_SUPPORTS).forEach((row, i) => {
    const line = `手立て ${i + 2}行目`;
    const id = cell(row["手立てID"]);
    const name = cell(row["手立て名"]);
    if (!id && !name) return; // 空行
    if (!id) return errors.push(`${line}：手立てIDがありません`);
    if (!name) return errors.push(`${line}：手立て名がありません`);
    if (supports.some((s) => s.support_id === id)) return errors.push(`${line}：手立てID「${id}」が重なっています`);
    const catNames = splitCell(row["困り感"]);
    const bad = catNames.filter((n) => !catId(n));
    if (bad.length) return errors.push(`${line}：困り感「${bad.join(SEP)}」が分かりません`);
    if (catNames.length === 0) return errors.push(`${line}：困り感がありません`);
    const st = STRENGTHS.find((x) => x.name === cell(row["支援の強さ"]));
    supports.push({
      support_id: id,
      support_name: name,
      description: cell(row["説明"]),
      categories: catNames.map(catId),
      scene: cell(row["使用場面"]),
      strength: st ? st.id : 2,
      note: cell(row["備考"]),
      active: cell(row["使う"]) !== "いいえ",
    });
  });

  // 児童
  const pupils = [];
  rows(SHEET_PUPILS).forEach((row, i) => {
    const line = `児童 ${i + 2}行目`;
    const id = cell(row["児童ID"]);
    if (!id) {
      if (Object.values(row).some((v) => cell(v))) errors.push(`${line}：児童IDがありません`);
      return;
    }
    if (pupils.some((p) => p.pupil_id === id)) return errors.push(`${line}：児童ID「${id}」が重なっています`);
    pupils.push({
      pupil_id: id,
      display_name: cell(row["表示名"]),
      grade: cell(row["学年"]),
      class_name: cell(row["組"]),
      memo: cell(row["メモ"]),
      created_at: cell(row["登録日時"]) || now,
    });
  });

  // 支援記録
  const records = [];
  rows(SHEET_RECORDS).forEach((row, i) => {
    const line = `支援記録 ${i + 2}行目`;
    const id = cell(row["記録ID"]);
    if (!id && !Object.values(row).some((v) => cell(v))) return; // 空行
    if (!id) return errors.push(`${line}：記録IDがありません`);
    if (records.some((r) => r.record_id === id)) return errors.push(`${line}：記録ID「${id}」が重なっています`);
    const pid = cell(row["児童ID"]);
    if (!pupils.some((p) => p.pupil_id === pid)) return errors.push(`${line}：児童ID「${pid}」が「児童」シートにありません`);
    const date = normDate(row["日付"]);
    if (!date) return errors.push(`${line}：日付が読めません（例：2026/09/24）`);
    const catNames = splitCell(row["困り感"]);
    const badCat = catNames.filter((n) => !catId(n));
    if (badCat.length) return errors.push(`${line}：困り感「${badCat.join(SEP)}」が分かりません`);
    // 手立ては「手立てID」列を優先。空なら「手立て」列の名前から探す
    let supIds = splitCell(row["手立てID"]);
    if (supIds.length === 0) {
      const names = splitCell(row["手立て"]);
      const missing = names.filter((n) => !supports.some((s) => s.support_name === n));
      if (missing.length) return errors.push(`${line}：手立て「${missing.join(SEP)}」が「手立て」シートにありません`);
      supIds = names.map((n) => supports.find((s) => s.support_name === n).support_id);
    }
    const badSup = supIds.filter((sid) => !supports.some((s) => s.support_id === sid));
    if (badSup.length) return errors.push(`${line}：手立てID「${badSup.join(SEP)}」が「手立て」シートにありません`);
    const resName = cell(row["評価"]);
    const res = RESULTS.find((x) => x.name === resName || x.oldName === resName);
    if (resName && !res) return errors.push(`${line}：評価「${resName}」が分かりません（${RESULTS.map((x) => x.name).join("／")}、または空欄）`);
    const tags = splitCell(row["変化"]);
    const badTag = tags.filter((t) => !CHANGE_TAGS.includes(t));
    if (badTag.length) return errors.push(`${line}：変化「${badTag.join(SEP)}」が分かりません`);
    records.push({
      record_id: id,
      pupil_id: pid,
      date,
      difficulty_categories: catNames.map(catId),
      observed_behavior: cell(row["具体的な姿"]),
      selected_supports: supIds,
      result: res ? res.id : "",
      change_tags: tags,
      teacher_note: cell(row["教師メモ"]),
      from_record_id: cell(row["前の記録ID"]),
      created_at: cell(row["作成日時"]) || now,
      updated_at: cell(row["更新日時"]) || now,
    });
  });

  return {
    errors,
    data: { app: "komarikan", pupils, support_records: records, support_master: supports },
  };
}
