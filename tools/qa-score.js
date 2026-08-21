// Проверка скоринга и текста результата для конкретного набора ответов.
// Набор задаётся в хэше: #qa=333333333333333 (15 цифр 0..5).
// Итог кладётся в window.__QA_SCORE.
(function () {
  const m = /qa=([0-5]{15})/.exec(location.hash || "");
  const pattern = m ? m[1].split("").map(Number) : new Array(15).fill(3);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);

  if (!window.__QA_STUBBED) {
    window.__QA_STUBBED = true;
    const rf = window.fetch;
    window.fetch = function (u) {
      return String(u).indexOf("script.google.com") >= 0
        ? Promise.resolve(new Response("{}", { status: 200 }))
        : rf.apply(window, arguments);
    };
    navigator.sendBeacon = function () { return true; };
    window.open = function () { return null; };
  }

  async function answerOne(value) {
    const el = document.querySelector('.ts-question input[value="' + value + '"]');
    if (!el) return false;
    const before = ($("tsProgressText") || {}).textContent;
    el.click();
    for (let w = 0; w < 30; w++) {
      await sleep(40);
      if (($("tsProgressText") || {}).textContent !== before) return true;
      if (getComputedStyle($("tsContactGate")).display !== "none") return true;
    }
    return false;
  }

  async function run() {
    // core.js подключён с defer — на момент eval разметки может ещё не быть
    for (let w = 0; w < 60 && !$("tsProgressText"); w++) await sleep(100);
    if (!$("tsProgressText")) throw new Error("квиз не смонтировался");

    for (let i = 0; i < 15; i++) {
      if (!(await answerOne(pattern[i]))) break;
    }
    $("tsRoleConsultant").click();
    $("tsGateFirstName").value = "Тест";
    $("tsGateLastName").value = "Скоринг";
    $("tsGateEmail").value = "qa@example.com";
    if (!$("tsGatePrivacyConsent").checked) $("tsGatePrivacyConsent").click();
    await sleep(80);
    $("tsGateSubmitBtn").click();
    await sleep(700);

    const expected = pattern.reduce((a, b) => a + b, 0);
    const shown = parseInt(($("tsFinalScore") || {}).textContent, 10);
    const parts = [
      parseInt(($("tsAnticipationScore") || {}).textContent, 10),
      parseInt(($("tsDesignScore") || {}).textContent, 10),
      parseInt(($("tsImplementationScore") || {}).textContent, 10)
    ];
    const expectedParts = [
      pattern.slice(0, 5).reduce((a, b) => a + b, 0),
      pattern.slice(5, 10).reduce((a, b) => a + b, 0),
      pattern.slice(10).reduce((a, b) => a + b, 0)
    ];
    const activeLabel = document.querySelector(".ts-risk-labels div.is-active");

    window.__QA_SCORE = {
      done: true,
      pattern: pattern.join(""),
      expectedTotal: expected,
      shownTotal: shown,
      totalOk: expected === shown,
      expectedParts: expectedParts.join("/"),
      shownParts: parts.join("/"),
      partsOk: expectedParts.join("/") === parts.join("/"),
      riskText: (($("tsResultRisk") || $("tsRiskLabel") || {}).textContent || "").trim().slice(0, 60),
      title: (($("tsResultTitle") || {}).textContent || "").trim().slice(0, 80),
      activeRange: activeLabel ? activeLabel.textContent.replace(/\s+/g, " ").trim().slice(0, 60) : null,
      weakest: (($("tsWeakestArea") || {}).textContent || "").trim().slice(0, 60)
    };
  }

  window.__QA_SCORE = { done: false };
  run().catch(function (e) {
    window.__QA_SCORE = { done: true, error: String(e.message) };
  });
})();
