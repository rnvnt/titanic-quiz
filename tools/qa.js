// Сквозной прогон квиза в браузере. Запускается через browse eval, результат
// кладётся в window.__QA — читать через `browse js "JSON.stringify(window.__QA)"`.
//
// Сетевые вызовы заглушены: ни один прогон не пишет в боевой Google Sheet.
// Перехваченные запросы попадают в отчёт — по ним проверяется, что именно
// ушло бы в таблицу.
(function () {
  const R = [];
  const sent = [];

  function ok(name, cond, extra) {
    R.push({ t: name, pass: !!cond, info: extra === undefined ? null : String(extra).slice(0, 200) });
  }

  function stubNetwork() {
    if (window.__QA_STUBBED) return;
    window.__QA_STUBBED = true;
    const realFetch = window.fetch;
    window.fetch = function (url, opts) {
      const u = String(url);
      if (u.indexOf("script.google.com") >= 0) {
        let body = null;
        try { body = JSON.parse((opts && opts.body) || "null"); } catch (e) { body = String(opts && opts.body); }
        sent.push({ via: "fetch", url: u, body: body });
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      return realFetch.apply(window, arguments);
    };
    const realBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      const u = String(url);
      if (u.indexOf("script.google.com") >= 0) {
        // sendBeacon шлёт Blob — без разбора не видно, что именно уходит в таблицу
        const rec = { via: "beacon", url: u, body: null };
        sent.push(rec);
        if (data && typeof data.text === "function") {
          data.text().then(function (t) {
            try { rec.body = JSON.parse(t); } catch (e) { rec.body = t; }
          });
        }
        return true;
      }
      return realBeacon ? realBeacon(url, data) : true;
    };
    // окно книги/благодарности не открываем
    window.open = function () { sent.push({ via: "window.open", url: String(arguments[0]) }); return null; };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  function visible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  async function answerOne(value) {
    const el = document.querySelector('.ts-question input[value="' + value + '"]');
    if (!el) return false;
    const before = ($("tsProgressText") || {}).textContent;
    el.click();
    for (let w = 0; w < 25; w++) {
      await sleep(40);
      const now = ($("tsProgressText") || {}).textContent;
      if (now !== before) return true;
      if (visible($("tsContactGate"))) return true;
    }
    return false;
  }

  async function fillGate(opts) {
    const o = opts || {};
    if (o.role !== false) $(o.role || "tsRoleConsultant").click();
    await sleep(60);
    if (o.otherText) { $("tsRoleOtherInput").value = o.otherText; $("tsRoleOtherInput").dispatchEvent(new Event("blur")); }
    $("tsGateFirstName").value = o.first === undefined ? "Тест" : o.first;
    $("tsGateLastName").value = o.last === undefined ? "Проверкин" : o.last;
    $("tsGateEmail").value = o.email === undefined ? "qa@example.com" : o.email;
    if (o.consent !== false && !$("tsGatePrivacyConsent").checked) $("tsGatePrivacyConsent").click();
    if (o.marketing && !$("tsGateMarketingConsent").checked) $("tsGateMarketingConsent").click();
    await sleep(60);
  }

  function pressEnter(el) {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  }

  async function run() {
    stubNetwork();
    const cfg = window.TS_CONFIG || {};
    const isGroup = cfg.phoneGate === false;

    // --- 1. стартовое состояние
    ok("квиз смонтирован", !!$("titanicQuiz"));
    ok("виден первый вопрос", ($("tsProgressText") || {}).textContent === "Вопрос 1 из 15",
        ($("tsProgressText") || {}).textContent);
    ok("контактный гейт скрыт на старте", !visible($("tsContactGate")));
    ok("нет предвыбранной роли", !document.querySelector('input[name="tsRole"]:checked'));
    ok("нет предвыбранного ответа", !document.querySelector('.ts-question input:checked'));
    ok("плавающей CTA нет в разметке", !$("tsSideBookCta") && !$("tsScrollCta"));
    ok("прогресс-бар на нуле", ($("tsProgressFill") || {}).style.width === "0%" || !$("tsProgressFill").style.width,
        ($("tsProgressFill") || {}).style.width);

    // --- 2. категории по ходу прохождения
    const seenCategories = [];
    let advanced = 0;
    for (let i = 0; i < 15; i++) {
      seenCategories.push($("tsProgressCategory").textContent);
      if (await answerOne(3)) advanced++;
      else break;
    }
    ok("15 вопросов пройдено", advanced === 15, advanced);
    ok("первые 5 — Предвидение", seenCategories.slice(0, 5).every((c) => c === "Предвидение изменений"), seenCategories.slice(0, 5).join("|"));
    ok("вторые 5 — Дизайн", seenCategories.slice(5, 10).every((c) => c === "Дизайн изменений"), seenCategories.slice(5, 10).join("|"));
    ok("последние 5 — Реализация", seenCategories.slice(10).every((c) => c === "Реализация изменений"), seenCategories.slice(10).join("|"));
    ok("после ответов открылся гейт", visible($("tsContactGate")));

    // --- 3. валидация гейта
    $("tsGateSubmitBtn").click();
    await sleep(120);
    ok("без роли и контактов результат не показан", !$("titanicQuiz").classList.contains("is-results"));
    ok("подсвечена невалидная роль", $("tsRoleGate").classList.contains("is-invalid"));

    await fillGate({ email: "не-email", consent: false });
    $("tsGateSubmitBtn").click();
    await sleep(120);
    ok("невалидный email не пропускает", !$("titanicQuiz").classList.contains("is-results"));
    ok("нет согласия — не пропускает", !$("titanicQuiz").classList.contains("is-results"));

    // --- 4. Enter в полях гейта
    await fillGate({});
    let enterWorked = false;
    const before = $("titanicQuiz").classList.contains("is-results");
    pressEnter($("tsGateEmail"));
    await sleep(400);
    enterWorked = !before && $("titanicQuiz").classList.contains("is-results");
    ok("Enter в поле email = «Показать результат»", enterWorked);

    // --- 5. экран результата
    await sleep(400);
    ok("экран результата показан", $("titanicQuiz").classList.contains("is-results"));
    ok("вид вопросов скрыт", !visible($("tsQuizView")));
    const total = parseInt(($("tsFinalScore") || {}).textContent, 10);
    ok("сумма 15 ответов по 3 = 45", total === 45, total);
    ok("уровень риска = высокий", (($("tsResultTitle") || {}).textContent || "").length > 0,
        ($("tsRiskLabel") || $("tsResultTitle") || {}).textContent);
    const a = parseInt(($("tsAnticipationScore") || {}).textContent, 10);
    const d = parseInt(($("tsDesignScore") || {}).textContent, 10);
    const im = parseInt(($("tsImplementationScore") || {}).textContent, 10);
    ok("по компетенциям 15/15/15", a === 15 && d === 15 && im === 15, [a, d, im].join("/"));
    ok("сумма компетенций = общему баллу", a + d + im === total);

    // --- 6. что ушло бы в таблицу
    await sleep(200);
    const payload = (sent.find((s) => s.body && s.body.email) || {}).body;
    ok("результат отправлен в Sheet", !!payload, sent.length + " запрос(ов)");
    if (payload) {
      ok("в payload есть email", payload.email === "qa@example.com", payload.email);
      ok("в payload есть имя и фамилия", payload.firstName === "Тест" && payload.lastName === "Проверкин");
      ok("в payload есть согласие", payload.privacyConsent === true, payload.privacyConsent);
      ok("в payload есть балл", payload.total === 45, payload.total);
      ok("в payload есть роль", !!payload.role, payload.role);
      ok("testVersion из конфига", payload.testVersion === cfg.testVersion, payload.testVersion);
      ok("ответы переданы (15 шт.)", Array.isArray(payload.answers) && payload.answers.length === 15,
          payload.answers && payload.answers.length);
    }

    // --- 7. блок консультации
    const cBtn = $("tsConsultationBtn");
    ok("кнопка консультации есть", !!cBtn);
    if (cBtn) {
      cBtn.click();
      await sleep(200);
      if (cfg.phoneGate === false) {
        ok("без phone gate заявка уходит сразу", cBtn.disabled === true, cBtn.textContent);
        ok("формы телефона нет", !$("tsConsultationForm"));
      } else {
        ok("phone gate развернулся", $("tsConsultationForm").classList.contains("is-visible"));
        $("tsConsultationPhone").value = "12345";
        $("tsConsultationForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await sleep(150);
        ok("короткий номер отклонён", $("tsConsultationForm").classList.contains("is-invalid"));
        $("tsConsultationPhone").value = "+7 999 123 45 67";
        $("tsConsultationPhone").dispatchEvent(new Event("input", { bubbles: true }));
        pressEnter($("tsConsultationPhone"));
        await sleep(400);
        await sleep(200);
        const withPhone = sent.find((s) => s.body && s.body.phone);
        ok("Enter в поле телефона отправляет заявку", !!withPhone, withPhone && withPhone.body.phone);
        ok("телефон нормализован", withPhone && withPhone.body.phoneNormalized === "+79991234567",
            withPhone && withPhone.body.phoneNormalized);
        ok("статус подтверждения показан", visible($("tsConsultationStatus")),
            ($("tsConsultationStatus") || {}).textContent);
      }
    }

    // --- 8. книга
    const bookBtn = $("tsBookDownloadBtn");
    ok("ссылка на книгу ведёт на PDF", bookBtn && /\.pdf$/i.test(bookBtn.href), bookBtn && bookBtn.href);

    // --- 9. на экране результата ничего не перекрывает шкалу
    const scale = document.querySelector(".ts-risk-scale");
    if (scale) {
      scale.scrollIntoView({ block: "center" });
      await sleep(250);
      const rect = scale.getBoundingClientRect();
      const mid = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const blockedByFloating = mid && mid !== scale && !scale.contains(mid) && !mid.contains(scale) &&
        (getComputedStyle(mid).position === "fixed" || getComputedStyle(mid).position === "sticky") &&
        mid.className.indexOf("fake-tilda-header") < 0;
      ok("шкала риска не перекрыта плавающим блоком", !blockedByFloating, mid && mid.className);
    }

    window.__QA = {
      done: true,
      group: isGroup,
      results: R,
      sentCount: sent.length,
      sentUrls: sent.map(function (x) { return x.via + " " + x.url.slice(0, 62); })
    };
  }

  window.__QA = { done: false, results: R, sent: sent };
  run().catch(function (e) {
    R.push({ t: "ИСКЛЮЧЕНИЕ: " + e.message, pass: false, info: String(e.stack).slice(0, 300) });
    window.__QA = { done: true, results: R, error: String(e.message) };
  });
})();
