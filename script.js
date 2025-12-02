async function loadUpdates() {
  console.log("📢 loadUpdates() が呼ばれました");
  const container = document.getElementById("calendar");
  container.innerHTML = "読み込み中…";

  try {
    const res = await fetch("./data/result.json");
    const data = await res.json();
    console.log("✅ JSON読み込み成功:", data);

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p style='color:red;'>更新情報がありません</p>";
      return;
    }

    // 日付ごとにグループ化
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    // 日付降順にソートして HTML を生成
    container.innerHTML = Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => {
      return `
        <div class="day">
          <h3>${date}</h3>
          ${grouped[date].map(u => `
            <div class="update-item">
              <h4>${u.title}</h4>
              <p>${u.summary}</p>
              <a href="${u.link}" target="_blank">詳細を見る</a>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("❌ JSON読み込み失敗:", e);
    container.innerHTML = "<p style='color:red;'>更新情報の読み込みに失敗しました</p>";
  }
}

// ページロード後に必ず呼び出す
window.onload = loadUpdates;