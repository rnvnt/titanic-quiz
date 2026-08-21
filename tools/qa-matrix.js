// Матричный прогон: гоняет наборы ответов в iframe и собирает таблицу.
// Требует http (не file://) — запускай против локального сервера над dist/.
// Результат: window.__MATRIX
(function () {
  const CASES = [
    "000000000000000", // 0  — низкий
    "111111111111111", // 15 — низкий, верхняя граница
    "111111111111112", // 16 — умеренный, нижняя граница
    "222222222222222", // 30 — умеренный
    "222222222233333", // 35 — умеренный, верхняя граница
    "222222222233334", // 36 — высокий, нижняя граница
    "333333333333333", // 45 — высокий
    "333334444444444", // 55 — высокий, верхняя граница
    "333344444444444", // 56 — критический, нижняя граница
    "555555555555555", // 75 — критический
    "555550000000000", // 25/0/0 — слабая зона: предвидение
    "000005555500000", // 0/25/0 — слабая зона: дизайн
    "000000000055555"  // 0/0/25 — слабая зона: реализация
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];

  function mkFrame() {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:2400px;border:0";
    document.body.appendChild(f);
    return f;
  }

  async function runCase(frame, pattern) {
    const answers = pattern.split("").map(Number);
    await new Promise((resolve) => {
      frame.onload = resolve;
      frame.src = "preview-individual.html?case=" + pattern + "&t=" + Date.now();
    });
    const w = frame.contentWindow;
    const d = frame.contentDocument;
    // сеть заглушена: ни одна проверка не пишет в боевую таблицу
    w.fetch = function () { return Promise.resolve(new w.Response("{}", { status: 200 })); };
    w.navigator.sendBeacon = function () { return true; };
    w.open = function () { return null; };

    const $ = (id) => d.getElementById(id);
    for (let i = 0; i < 80 && !$("tsProgressText"); i++) await sleep(50);
    if (!$("tsProgressText")) return { pattern: pattern, error: "квиз не смонтировался" };

    for (let i = 0; i < 15; i++) {
      const el = d.querySelector('.ts-question input[value="' + answers[i] + '"]');
      if (!el) return { pattern: pattern, error: "нет карточки вопроса " + (i + 1) };
      const before = $("tsProgressText").textContent;
      el.click();
      for (let t = 0; t < 40; t++) {
        await sleep(40);
        if ($("tsProgressText").textContent !== before) break;
        if (w.getComputedStyle($("tsContactGate")).display !== "none") break;
      }
    }

    $("tsRoleConsultant").click();
    $("tsGateFirstName").value = "Тест";
    $("tsGateLastName").value = "Матрица";
    $("tsGateEmail").value = "qa@example.com";
    if (!$("tsGatePrivacyConsent").checked) $("tsGatePrivacyConsent").click();
    await sleep(80);
    $("tsGateSubmitBtn").click();
    await sleep(800);

    const sum = answers.reduce((a, b) => a + b, 0);
    const parts = [
      answers.slice(0, 5).reduce((a, b) => a + b, 0),
      answers.slice(5, 10).reduce((a, b) => a + b, 0),
      answers.slice(10).reduce((a, b) => a + b, 0)
    ];
    const shownParts = [
      parseInt(($("tsAnticipationScore") || {}).textContent, 10),
      parseInt(($("tsDesignScore") || {}).textContent, 10),
      parseInt(($("tsImplementationScore") || {}).textContent, 10)
    ];
    const activeLabel = d.querySelector(".ts-risk-labels div.is-active");
    const submitBg = w.getComputedStyle($("tsGateSubmitBtn")).backgroundColor;

    return {
      pattern: pattern,
      expected: sum,
      shown: parseInt(($("tsFinalScore") || {}).textContent, 10),
      expectedParts: parts.join("/"),
      shownParts: shownParts.join("/"),
      title: (($("tsResultTitle") || {}).textContent || "").trim(),
      range: activeLabel ? activeLabel.textContent.replace(/\s+/g, " ").trim() : null,
      weakest: (($("tsWeakestArea") || {}).textContent || "").trim(),
      submitBg: submitBg,
      resultShown: $("titanicQuiz").classList.contains("is-results")
    };
  }

  async function run() {
    const frame = mkFrame();
    for (const c of CASES) {
      try {
        out.push(await runCase(frame, c));
      } catch (e) {
        out.push({ pattern: c, error: String(e.message) });
      }
      window.__MATRIX = { done: false, rows: out };
    }
    frame.remove();
    window.__MATRIX = { done: true, rows: out };
  }

  window.__MATRIX = { done: false, rows: out };
  run().catch(function (e) {
    window.__MATRIX = { done: true, rows: out, error: String(e.message) };
  });
})();
