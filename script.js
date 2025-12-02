// ====== 設定 ======
const JSON_PATH = "./data/result.json";
const CHUNK_SIZE = 20; // 最初に渡してくれた新しいバージョンの値を維持
const IDLE_TIMEOUT = 16; // フォールバック用

// ====== 企業カテゴリ（固定） ======
const COMPANY_LIST = [
  "HoYoverse",
  "KuroGames",
  "BandaiNamco-CinderellaGirls",
  "BandaiNamco-MillionLive",
  "BandaiNamco-ShinyColors",
  "BandaiNamco-GakuenIdolmaster",
  "Konami",
  "Yostar",
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

  // 全選択/全解除ボタン
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

  // 企業ごとのチェックボックス
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
  }, 120);
}

// ====== 描画 ======
function renderUpdates(data) {
  const container = document.getElementById("calendar");
  const checkedCompanies = [...document.querySelectorAll("#filter-area input:checked")].map(cb => cb.value);

  let filtered = checkedCompanies.length
    ? data.filter(item => checkedCompanies.includes(item.company))
    : data;

  if (!filtered.length) {
    container.innerHTML = "<p style='color:red;'>更新情報がありません</p>";
    return;
  }

  // 日付降順
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 日付ごとにグループ化
  const grouped = filtered.reduce((acc, item) => {
    (acc[item.date] ||= []).push(item);
    return acc;
  }, {});

  container.innerHTML = "";
  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

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
        idle(renderChunk);
      } else {
        container.appendChild(dayWrap);
        idle(renderNextDate);
      }
    }

    idle(renderChunk);
  }

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