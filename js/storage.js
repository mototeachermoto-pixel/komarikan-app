// ===============================================
// 保存係（ストレージ）
// 画面側は必ずこの Store を通してデータを読み書きする。
// 今はブラウザ（LocalStorage）に保存している。
// 将来 Google スプレッドシートに変えるときは、このファイルだけ差し替える。
// （そのため、すべての関数は async にしてある）
// ===============================================

const KEYS = {
  pupils: "komarikan.pupils",
  records: "komarikan.records",
  supports: "komarikan.supports",
  counter: "komarikan.recordCounter",
};

function load(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

const Store = {
  // ---------- 児童 ----------
  async getPupils() {
    return load(KEYS.pupils, []);
  },
  async getPupil(pupilId) {
    return (await this.getPupils()).find((p) => p.pupil_id === pupilId) || null;
  },
  async addPupil(pupil) {
    const pupils = await this.getPupils();
    if (pupils.some((p) => p.pupil_id === pupil.pupil_id)) {
      throw new Error("この児童IDはすでに使われています");
    }
    pupils.push({ ...pupil, created_at: now() });
    save(KEYS.pupils, pupils);
  },
  async updatePupil(pupilId, changes) {
    const pupils = await this.getPupils();
    const i = pupils.findIndex((p) => p.pupil_id === pupilId);
    if (i < 0) throw new Error("児童が見つかりません");
    pupils[i] = { ...pupils[i], ...changes, pupil_id: pupilId };
    save(KEYS.pupils, pupils);
  },

  // ---------- 支援記録 ----------
  // 1回の支援＝1件の記録。別の回の記録を上書きすることはない。
  async getRecords() {
    return load(KEYS.records, []);
  },
  async getRecord(recordId) {
    return (await this.getRecords()).find((r) => r.record_id === recordId) || null;
  },
  async getRecordsByPupil(pupilId) {
    return (await this.getRecords())
      .filter((r) => r.pupil_id === pupilId)
      .sort((a, b) => (a.date + a.created_at).localeCompare(b.date + b.created_at));
  },
  async addRecord(record) {
    const records = await this.getRecords();
    const n = load(KEYS.counter, 0) + 1;
    save(KEYS.counter, n);
    const newRecord = {
      ...record,
      record_id: "R" + String(n).padStart(4, "0"),
      created_at: now(),
      updated_at: now(),
    };
    records.push(newRecord);
    save(KEYS.records, records);
    return newRecord;
  },
  // 同じ回の記録を書き足す（例：授業後に評価を追加する）
  async updateRecord(recordId, changes) {
    const records = await this.getRecords();
    const i = records.findIndex((r) => r.record_id === recordId);
    if (i < 0) throw new Error("記録が見つかりません");
    records[i] = { ...records[i], ...changes, record_id: recordId, updated_at: now() };
    save(KEYS.records, records);
    return records[i];
  },

  // ---------- 手立てマスター ----------
  async getSupports() {
    const list = load(KEYS.supports, null);
    // 以前のデータに「支援の強さ」が無ければ補う
    if (list) return list.map((s) => ({ ...s, strength: s.strength || DEFAULT_STRENGTH[s.support_id] || 2 }));
    save(KEYS.supports, DEFAULT_SUPPORTS);
    return DEFAULT_SUPPORTS;
  },
  async saveSupport(support) {
    const list = await this.getSupports();
    const i = list.findIndex((s) => s.support_id === support.support_id);
    if (i >= 0) list[i] = support;
    else list.push(support);
    save(KEYS.supports, list);
  },
  async nextSupportId() {
    const list = await this.getSupports();
    const max = list.reduce((m, s) => Math.max(m, parseInt(s.support_id.slice(1)) || 0), 0);
    return "S" + String(max + 1).padStart(3, "0");
  },

  // ---------- まとめて書き出す／読み込む ----------
  async exportAll() {
    return {
      app: "komarikan",
      version: 1,
      exported_at: now(),
      pupils: await this.getPupils(),
      support_records: await this.getRecords(),
      support_master: await this.getSupports(),
      record_counter: load(KEYS.counter, 0),
    };
  },
  async importAll(data) {
    if (!data || data.app !== "komarikan") throw new Error("このアプリのバックアップファイルではありません");
    save(KEYS.pupils, data.pupils || []);
    save(KEYS.records, data.support_records || []);
    save(KEYS.supports, data.support_master || DEFAULT_SUPPORTS);
    // 記録IDの番号が重ならないよう、読み込んだ記録の最大番号から続ける
    const maxId = (data.support_records || []).reduce(
      (m, r) => Math.max(m, parseInt(String(r.record_id).slice(1)) || 0), 0);
    save(KEYS.counter, Math.max(data.record_counter || 0, maxId));
  },
};
