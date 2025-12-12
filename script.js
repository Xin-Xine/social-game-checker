// ====== 設定 ======
const JSON_PATH = "./data/result.json";
const CHUNK_SIZE = 20;
const IDLE_TIMEOUT = 16;

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
    container.innerHTML = `<div class="col-12 text-center py-5"><p class="text-danger">データの読み込みに失敗しました。</p></div>`;
  }
}

// ====== フィルタUI生成 ======
function buildFilterUI(filterArea, data) {
  const frag = document.createDocumentFragment();

  // 全選択/全解除ボタン
  const controls = document.createElement("div");
  controls.className = "d-flex justify-content-between mb-2 px-2";

  const selectAllBtn = document.createElement("button");
  selectAllBtn.textContent = "全選択";
  selectAllBtn.className = "btn btn-sm btn-outline-success flex-fill me-1";
  selectAllBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // メニューが閉じないように
    filterArea.querySelectorAll("input[type=checkbox]").forEach(cb => (cb.checked = true));
    setCompanyFilter(COMPANY_LIST);
    renderUpdates(data);
  });

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "全解除";
  clearBtn.className = "btn btn-sm btn-outline-danger flex-fill ms-1";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    filterArea.querySelectorAll("input[type=checkbox]").forEach(cb => (cb.checked = false));
    setCompanyFilter([]);
    renderUpdates(data);
  });

  controls.appendChild(selectAllBtn);
  controls.appendChild(clearBtn);
  frag.appendChild(controls);

  const divider = document.createElement("hr");
  divider.className = "dropdown-divider";
  frag.appendChild(divider);

  // 企業ごとのチェックボックス
  COMPANY_LIST.forEach(company => {
    const div = document.createElement("div");
    div.className = "form-check px-4 py-1 dropdown-item";
    div.addEventListener("click", (e) => {
      // ラベルクリックでもチェックボックスを反応させる
      // ただしinput自体をクリックしたときは重複しないように
      if (e.target.tagName !== 'INPUT') {
        e.stopPropagation();
        const cb = div.querySelector('input');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "form-check-input";
    checkbox.id = "check-" + company;
    checkbox.value = company;
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      const checkedCompanies = [...filterArea.querySelectorAll("input:checked")].map(cb => cb.value);
      setCompanyFilter(checkedCompanies);
      scheduleRender(data);
    });
    // クリックイベントの伝播ストップ (メニュー閉じ防止)
    checkbox.addEventListener("click", e => e.stopPropagation());

    const label = document.createElement("label");
    label.className = "form-check-label w-100";
    label.htmlFor = "check-" + company;
    label.textContent = company;
    label.style.cursor = "pointer";

    div.appendChild(checkbox);
    div.appendChild(label);
    frag.appendChild(div);
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
    container.innerHTML = `<div class="col-12 text-center py-5"><p class="text-muted">表示する更新情報がありません。</p></div>`;
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

    // 日付ヘッダー
    const headerCol = document.createElement("div");
    headerCol.className = "col-12";
    const h2 = document.createElement("h2");
    h2.className = "day-header";
    h2.innerHTML = `<i class="bi bi-calendar-event me-2"></i> ${date}`;
    headerCol.appendChild(h2);
    container.appendChild(headerCol);

    const items = grouped[date];
    let start = 0;

    function renderChunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(start + CHUNK_SIZE, items.length);

      for (let i = start; i < end; i++) {
        const item = items[i];

        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4 mb-4"; // 2カラム/3カラムレイアウト

        const card = document.createElement("div");
        const companyClass = "company-" + toCompanyClassKey(item.company);
        card.className = `card h-100 update-card ${companyClass}`;

        const cardBody = document.createElement("div");
        cardBody.className = "card-body d-flex flex-column";

        const cardSubtitle = document.createElement("h6");
        cardSubtitle.className = "card-subtitle mb-2";
        cardSubtitle.textContent = item.company;

        const cardTitle = document.createElement("h5");
        cardTitle.className = "card-title";
        cardTitle.textContent = item.game;

        const cardText = document.createElement("p");
        cardText.className = "card-text flex-grow-1";
        // item.title (見出し的な内容) と summary を組み合わせる
        cardText.innerHTML = `<strong>${item.title}</strong><br><span class="text-secondary small">${item.summary}</span>`;

        const btnDiv = document.createElement("div");
        btnDiv.className = "mt-3 text-end";

        const a = document.createElement("a");
        a.href = item.link;
        a.target = "_blank";
        a.className = "btn btn-sm btn-primary-gold stretched-link"; // stretched-linkでカード全体をクリック可能に
        a.textContent = "Official Site";

        btnDiv.appendChild(a);

        cardBody.appendChild(cardSubtitle);
        cardBody.appendChild(cardTitle);
        cardBody.appendChild(cardText);
        cardBody.appendChild(btnDiv);
        card.appendChild(cardBody);
        col.appendChild(card);

        frag.appendChild(col);
      }

      container.appendChild(frag);
      start = end;

      if (start < items.length) {
        idle(renderChunk);
      } else {
        idle(renderNextDate);
      }
    }

    idle(renderChunk);
  }

  idle(renderNextDate);
}

// ====== 初期化 ======
document.addEventListener("DOMContentLoaded", () => {
  loadUpdates();
});
