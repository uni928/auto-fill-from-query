(() => {
  "use strict";

  // ===== 設定 =====
  const RUN_FOR_MS = 30_000;      // 30秒間だけ動かす
  const INTERVAL_MS = 2_000;      // 2秒に1回
  const PREFER_CLASS = false;     // trueならclass優先、falseならid優先
  const FILL_ONLY_IF_EMPTY = true;// 空欄のときだけ入れる（上書き防止）

  // 「作業済み」マーキング用（競合しにくい長いclass名）
  const DONE_CLASS = "___autofill_from_query_params__done__v1__a9f0c0c3d6b84a9e8b1f2c7f___";

  const SUPPORTED_SELECTOR =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="file"]), textarea, select';

  const IGNORE_KEYS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
  // =================

  function cssEscapeSafe(s) {
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
  }

  function parseParams() {
    const url = new URL(location.href);
    const params = url.searchParams;
    const map = new Map();
    for (const [k, v] of params.entries()) {
      if (!k || IGNORE_KEYS.has(k)) continue;
      map.set(k, v); // 同名が複数あれば最後
    }
    return map;
  }

  function getCandidatesByKey(key) {
    const k = cssEscapeSafe(key);
    const byId = document.querySelectorAll(`#${k}`);
    const byClass = document.querySelectorAll(`.${k}`);
  const byName = document.querySelectorAll(`[name="${k}"]`);

  const list = PREFER_CLASS
    ? [...byClass, ...byId, ...byName]
    : [...byId, ...byClass, ...byName];
  return list;
  }

  function isFillable(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.matches(SUPPORTED_SELECTOR)) return false;
    if (el.classList.contains(DONE_CLASS)) return false; // 作業済みは絶対触らない
    if (el.hasAttribute("disabled")) return false;
    if (el.hasAttribute("readonly")) return false;
    return true;
  }

  function isEmpty(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return !el.value;

    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") return false;

    return (el.value ?? "") === "";
  }

  function setNativeValue(el, value) {
    const tag = el.tagName.toLowerCase();

    if (tag === "select") {
      const v = String(value);
      const opts = Array.from(el.options);
      let found = opts.find(o => o.value === v);
      if (!found) found = opts.find(o => (o.textContent || "").trim() === v);
      if (found) el.value = found.value;
      return;
    }

    if (tag === "textarea") {
      el.value = String(value);
      return;
    }

    const type = (el.getAttribute("type") || "text").toLowerCase();

    if (type === "checkbox") {
      const v = String(value).toLowerCase();
      el.checked = ["1", "true", "on", "yes", "checked"].includes(v);
      return;
    }

    if (type === "radio") {
      const name = el.name;
      if (!name) return;
      const v = String(value);
      const radios = document.querySelectorAll(`input[type="radio"][name="${cssEscapeSafe(name)}"]`);
      radios.forEach(r => {
        if (r.value === v) r.checked = true;
      });
      return;
    }

    el.value = String(value);
  }

  function fireEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markDone(el) {
    // 「触った/触らないを判断した」要素は二度と処理しない
    el.classList.add(DONE_CLASS);
  }

  function applyOnce(paramMap) {
    if (!paramMap || paramMap.size === 0) return;

    for (const [key, value] of paramMap.entries()) {
      const candidates = getCandidatesByKey(key);

      for (const el of candidates) {
        if (!isFillable(el)) continue;

        // 空欄のみ（上書き防止）
        if (FILL_ONLY_IF_EMPTY && !isEmpty(el)) {
          markDone(el);
          continue;
        }

        setNativeValue(el, value);
        fireEvents(el);
        markDone(el);

        // 同じキーを複数要素に入れたいなら break を外す
        break;
      }
    }
  }

  // ===== 30秒間だけ、2秒に1回再実行 =====
  const paramMap = parseParams();
  applyOnce(paramMap);

  const start = Date.now();
  const timerId = setInterval(() => {
    if (Date.now() - start >= RUN_FOR_MS) {
      clearInterval(timerId);
      return;
    }
    applyOnce(paramMap);
  }, INTERVAL_MS);
})();
