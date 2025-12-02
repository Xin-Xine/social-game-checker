// ====== 設定 ======
const JSON_PATH = "./data/result.json";
const CHUNK_SIZE = 30; // 1回で描画するアイテム数（負荷軽減）
const IDLE_TIMEOUT = 16; // フレーム間の休憩 (ms) / フォールバック

// ====== 企業カテゴリ（固定） ======
// JSONの company はこのいずれかに揃える想定
// 例: "HoYoverse", "KuroGames", "BandaiNamco-CinderellaGirls", ...
const COMPANY_LIST = [
  "HoYoverse",
  "KuroGames",
  "BandaiNamco-CinderellaGirls",
  "BandaiNamco-MillionLive",
  "BandaiNamco-ShinyColors",
  "BandaiNamco-GakuenIdolmaster",
  "Konami",
  "Yostar",            // まとめカテゴリ（アークナイツ／ブルアカ／雀魂 など）
  "Sega",
  "Bushiroad",
  "Cygames",
  "Takaratomy",
  "Others"
];

// ====== ストレージ ======
function getCompanyFilter() {
  const saved = localStorage.getItem("companyFilter");
  return saved ? saved.split(",") : null;
}
function setCompanyFilter(companies) {
  localStorage.setItem("companyFilter", companies.join(","));
}

// ====== ユーティリティ ======
function idle(cb) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(cb, { timeout: IDLE_TIMEOUT });
  } else {
    setTimeout(cb, IDLE_TIMEOUT);
  }
}

// company を CSS クラス用に正規化（小文字＋ハイフン）
// 例: "BandaiNamco-CinderellaGirls" -> "bandainamco-cinderellagirls"
function toCompanyClassKey(company) {
  return String(company || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

// ====== 初期化ロード ======
async function loadUpdates() {
  const container = document.getElementById("calendar");
  const filterArea = document.getElementById("filter-area");

  try {
    container.textContent = "読み込み中...";
    const res = await fetch(JSON_PATH, { cache: "no-cache" });
    const data = await res.json();

    // フィルタUI生成（初回のみ）
    if (!filterArea.innerHTML) {
      buildFilterUI(filterArea, data);
    }

    // 初回表示
    renderUpdates(data);
  } catch (e) {
    console.error("❌ JSON読み込み失敗:", e);
    container.innerHTML = "<p style='color:red;'>読み込み失敗</p>";
  }
}

// ====== フィルタUI生成 ======
function buildFilterUI(filterArea, data) {
  const frag = document.createDocumentFragment();

  // 全選択/全解除コントロール
  const controls = document.createElement("div");
  controls.style.marginBottom = "0.5rem";

  const selectAllBtn = document.createElement("button");
  selectAllBtn.textContent = "全選択";
  selectAllBtn.className = "mini";
  selectAllBtn.addEventListener("click", () => {
    filterArea.querySelectorAll("input[type=checkbox]").forEach(cb => (cb.checked = true));
    setCompanyFilter(COMPANY_LIST);
    renderUpdates(data);
  });

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "全解除";
  clearBtn.className = "mini";
  clearBtn.style.marginLeft = "0.5rem";
  clearBtn.addEventListener("click", () => {
    filterArea.querySelectorAll("input[type=checkbox]").forEach(cb => (cb.checked = false));
    setCompanyFilter([]);
    renderUpdates(data);
  });

  controls.appendChild(selectAllBtn);
  controls.appendChild(clearBtn);
  frag.appendChild(controls);

  // 企業ごとのチェックボックス（固定リストから生成）
  COMPANY_LIST.forEach(company => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = company;
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      const checkedCompanies = [...filterArea.querySelectorAll("input:checked")].map(cb => cb.value);
      setCompanyFilter(checkedCompanies);
      scheduleRender(data);
    });

    label.appendChild(checkbox);
    label.append(" " + company);
    frag.appendChild(label);
  });

  filterArea.appendChild(frag);

  // 保存フィルタを反映
  const saved = getCompanyFilter();
  if (saved) {
    filterArea.querySelectorAll("input").forEach(cb => {
      cb.checked = saved.includes(cb.value);
    });
  }
}

// ====== レンダリング制御（デバウンス）======
let renderTimer = null;
function scheduleRender(data) {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderUpdates(data);
    renderTimer = null;
  }, 120); // 素早い連続操作をまとめる
}

// ====== 描画 ======
function renderUpdates(data) {
  const container = document.getElementById("calendar");
  const checkedCompanies = [...document.querySelectorAll("#filter-area input:checked")].map(cb => cb.value);

  // company が固定リストに含まれるもののみ表示（Others は任意の単発タイトル）
  let filtered = data.filter(item => {
    const company = item.company;
    // JSON側の company が固定カテゴリに揃っていることが前提
    return checkedCompanies.includes(company);
  });

  if (!filtered.length) {
    container.innerHTML = "<p style='color:red;'>更新情報がありません</p>";
    return;
  }

  // 日付降順
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  // 日付ごとにグループ化
  const grouped = filtered.reduce((acc, item) => {
    (acc[item.date] ||= []).push(item);
    return acc;
  }, {});

  // 既存を初期化してから段階的に描画
  container.innerHTML = "";
  const dates = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

  // 大きなグループはチャンクに分割して描画
  let dateIndex = 0;

  function renderNextDate() {
    if (dateIndex >= dates.length) return;

    const date = dates[dateIndex++];
    const dayWrap = document.createElement("div");
    dayWrap.className = "day";

    const h2 = document.createElement("h2");
    h2.textContent = date;
    dayWrap.appendChild(h2);

    const items = grouped[date];
    let start = 0;

    function renderChunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(start + CHUNK_SIZE, items.length);

      for (let i = start; i < end; i++) {
        const item = items[i];

        const div = document.createElement("div");
        // company クラス付与（CSSで色分け）
        const companyClass = "company-" + toCompanyClassKey(item.company);
        div.className = `update-item ${companyClass}`;

        const h3 = document.createElement("h3");
        h3.innerHTML = `${item.game} <span style="color:gray">(${item.company})</span>`;

        const h4 = document.createElement("h4");
        h4.textContent = item.title;

        const p = document.createElement("p");
        p.textContent = item.summary;

        const a = document.createElement("a");
        a.href = item.link;
        a.target = "_blank";
        a.textContent = "公式サイトへ";

        div.appendChild(h3);
        div.appendChild(h4);
        div.appendChild(p);
        div.appendChild(a);

        frag.appendChild(div);
      }

      dayWrap.appendChild(frag);
      start = end;

      if (start < items.length) {
        idle(renderChunk); // 次のチャンクをアイドル時に描画
      } else {
        container.appendChild(dayWrap);
        // 次の日付へ
        idle(renderNextDate);
      }
    }

    // 最初のチャンク開始
    idle(renderChunk);
  }

  // 最初の日付から開始
  idle(renderNextDate);
}

// ====== メニュー開閉 ======
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menuContent = document.querySelector(".menu-content");

  toggleBtn.addEventListener("click", () => {
    menuContent.classList.toggle("show");
  });

  loadUpdates();
});