// ====== 描画 ======
function renderUpdates(data) {
  const container = document.getElementById("calendar");
  const checkedCompanies = [...document.querySelectorAll("#filter-area input:checked")].map(cb => cb.value);

  let filtered = data.filter(item => checkedCompanies.includes(item.company));

  if (!filtered.length) {
    container.innerHTML = "<p style='color:red;'>更新情報がありません</p>";
    return;
  }

  // 日付降順（新しい順）
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