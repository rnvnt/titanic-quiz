(function () {
  // Разметка панели хоста и отчёта. Подставляется build.py из group/host.html.
  // Ставится до квиза, чтобы порядок блоков на странице был как раньше.
  const HOST_MARKUP = "__HOST_MARKUP__";
  const hostMount = document.getElementById("titanicQuizHostRoot");
  if (hostMount && !hostMount.firstElementChild) {
    hostMount.innerHTML = HOST_MARKUP;
  }

  const GROUP_SESSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbwv7hl4DkxCoaMKPkgV4xdOjSXM8El0W9xmxpe1CRQg5zD9WxBq1mxFBoVzsG6l1jhu/exec";
  // QR всегда ведёт на опубликованную страницу группового теста, даже если
  // хост открыл локальный preview-файл перед публикацией.
  const PUBLIC_TEST_URL = "https://reinventionacademy.kz/titanic-group-test";
  const GROUP_STORAGE_PREFIX = "titanicGroupSession:";
  const HOST_KEY_STORAGE = "titanicGroupHostKey";
  function buildPageParams() {
    const params = new URLSearchParams(window.location.search);
    const injected = window.__TS_INITIAL_PARAMS__;
    if (injected && typeof injected === "object") Object.keys(injected).forEach(function (key) {
      if (injected[key] && !params.has(key)) params.set(key, injected[key]);
    });
    return params;
  }
  const pageParams = buildPageParams();
  const suppliedHostKey = String(pageParams.get("hostKey") || "").trim();
  if (suppliedHostKey) {
    // localStorage, не sessionStorage: хост открывает полную ссылку с ключом
    // один раз на устройство, а не заново при каждом перезапуске браузера.
    try { window.localStorage.setItem(HOST_KEY_STORAGE, suppliedHostKey); } catch (err) {}
  }
  let storedHostKey = "";
  try { storedHostKey = window.localStorage.getItem(HOST_KEY_STORAGE) || ""; } catch (err) {}
  const hostKey = suppliedHostKey || storedHostKey;
  const reportRequested = pageParams.get("report") === "1";
  const activeSessionCode = cleanSessionCode(pageParams.get("session") || "");
  // Это отдельная групповая страница: без session открывается только хост-маршрут.
  const hostRequested = pageParams.get("host") === "1" || (!reportRequested && !activeSessionCode);
  const regularMode = false;
  const reportMode = reportRequested && Boolean(hostKey);
  const hostMode = hostRequested && Boolean(hostKey);
  const accessDeniedMode = (hostRequested || reportRequested) && !hostKey;
  const hostApp = document.getElementById("tsHostApp");
  const reportApp = document.getElementById("tsReportApp");
  const quizRoot = document.getElementById("titanicQuiz");
  const downloadTransition = document.getElementById("tsDownloadTransition");
  const testResultBtn = document.getElementById("tsTestResultBtn");
  const sessionBanner = document.getElementById("tsSessionBanner");
  const sessionBannerTitle = document.getElementById("tsSessionBannerTitle");
  const sideBookCta = document.getElementById("tsSideBookCta");
  let hostSessionCode = "";
  let hostRefreshTimer = null;

  if (suppliedHostKey) {
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("hostKey");
      window.history.replaceState({}, "", cleanUrl.toString());
    } catch (err) {}
  }

  function cleanSessionCode(code) {
    return String(code || "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
  }


  function makeSessionCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }


  function sessionKey(code) {
    return GROUP_STORAGE_PREFIX + code;
  }


  function readSession(code) {
    try {
      const raw = window.localStorage.getItem(sessionKey(code));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }


  function writeSession(session) {
    try {
      window.localStorage.setItem(sessionKey(session.code), JSON.stringify(session));
    } catch (err) {
      console.warn("Session was not cached locally.", err);
    }
  }


  function groupBackendEnabled() {
    return Boolean(GROUP_SESSION_ENDPOINT && GROUP_SESSION_ENDPOINT.trim());
  }


  function postGroupEvent(payload, requiresHostKey) {
    if (!groupBackendEnabled()) return;
    const body = Object.assign({}, payload);
    if (requiresHostKey) {
      if (!hostKey) return;
      body.hostKey = hostKey;
    }
    fetch(GROUP_SESSION_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(function () {
      console.warn("Group session event was not sent.");
    });
  }


  function getGroupStatus(code, hostScope) {
    if (!groupBackendEnabled()) {
      return Promise.resolve(readSession(code));
    }

    return new Promise(function (resolve) {
      const callbackName = "tsGroupCallback_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const url = new URL(GROUP_SESSION_ENDPOINT);
      url.searchParams.set("action", hostScope ? "report" : "participant_status");
      url.searchParams.set("session", code);
      url.searchParams.set("callback", callbackName);
      if (hostScope) url.searchParams.set("hostKey", hostKey);
      const timeout = window.setTimeout(function () {
        cleanup();
        resolve(null);
      }, 8000);

      window[callbackName] = function (response) {
        cleanup();
        if (!response || !response.ok) {
          resolve(response || null);
          return;
        }
        const session = {
          code: response.code || code,
          title: response.title || "Групповая сессия",
          status: response.status || "active",
          sessionNumber: response.sessionNumber || "",
          sessionDate: response.sessionDate || "",
          createdAt: response.createdAt || "",
          closedAt: response.closedAt || "",
          startedCount: Number(response.startedCount || 0),
          results: response.results || []
        };
        writeSession(session);
        resolve(session);
      };

      script.onerror = function () {
        cleanup();
        resolve(null);
      };

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      script.src = url.toString();
      document.head.appendChild(script);
    });
  }


  function updateAddressBar(params) {
    try {
      const url = new URL(window.location.href);
      Object.keys(params).forEach(function (key) {
        url.searchParams.set(key, params[key]);
      });
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      console.warn("Address bar was not updated.", err);
    }
  }


  function publicBaseUrl() {
    const url = new URL(PUBLIC_TEST_URL || window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }


  function participantLink(code) {
    const url = new URL(publicBaseUrl());
    url.search = "";
    url.hash = "";
    url.searchParams.set("session", code);
    return url.toString();
  }


  function hostLink(code) {
    const url = new URL(publicBaseUrl());
    url.search = "";
    url.hash = "";
    url.searchParams.set("host", "1");
    url.searchParams.set("session", code);
    url.searchParams.set("hostKey", hostKey);
    return url.toString();
  }


  function reportLink(code) {
    const url = new URL(publicBaseUrl());
    url.search = "";
    url.hash = "";
    url.searchParams.set("report", "1");
    url.searchParams.set("session", code);
    url.searchParams.set("hostKey", hostKey);
    return url.toString();
  }



  function initGroupMode() {
    if (accessDeniedMode) { setupAccessDenied(); return; }
    if (reportMode && activeSessionCode) { setupReportMode(activeSessionCode); return; }
    if (reportRequested) { setupAccessDenied("Не указан номер сессии."); return; }
    if (hostMode) { setupHostMode(); return; }
    if (activeSessionCode) setupParticipantSession(activeSessionCode);
  }

  function setupAccessDenied(message) {
    if (quizRoot) quizRoot.style.display = "none";
    if (downloadTransition) downloadTransition.style.display = "none";
    if (reportApp) reportApp.classList.add("is-hidden");
    if (hostApp) {
      hostApp.classList.remove("is-hidden");
      const title = hostApp.querySelector(".ts-host-title");
      const copy = hostApp.querySelector(".ts-host-copy");
      if (title) title.textContent = "Доступ к панели закрыт";
      if (copy) copy.textContent = message || "Откройте общую секретную ссылку команды. Ссылка участника из QR работает без неё.";
    }
    const createCard = document.getElementById("tsSessionCreateCard");
    const dashboard = document.getElementById("tsHostDashboard");
    if (createCard) createCard.classList.add("is-hidden");
    if (dashboard) dashboard.classList.add("is-hidden");
  }

  function setupReportMode(code) {
    if (quizRoot) quizRoot.style.display = "none";
    if (downloadTransition) downloadTransition.style.display = "none";
    if (hostApp) hostApp.classList.add("is-hidden");
    if (reportApp) reportApp.classList.remove("is-hidden");

    function refresh() {
      getGroupStatus(code, true).then(function (session) {
        if (session && session.error === "unauthorized") {
          setupAccessDenied("Секретный ключ устарел или введён неверно.");
          return;
        }
        renderFullReport(session);
      });
    }

    refresh();
    window.setInterval(refresh, 5000);
  }


  function setupParticipantSession(code) {
    const session = readSession(code);
    if (quizRoot) quizRoot.classList.add("is-group-session");
    if (sessionBanner) {
      sessionBanner.classList.add("is-visible");
      sessionBannerTitle.textContent = session && session.title ? session.title : "Групповая сессия";
    }

    if (testResultBtn) {
      testResultBtn.style.display = "none";
    }

    if (session && session.status === "closed") {
      sessionBannerTitle.textContent = "Эта групповая сессия уже закрыта";
    }

    getGroupStatus(code, false).then(function (freshSession) {
      if (!freshSession || freshSession.error === "not_found") {
        if (sessionBannerTitle) sessionBannerTitle.textContent = "Сессия не найдена";
        return;
      }
      if (sessionBannerTitle) {
        sessionBannerTitle.textContent = freshSession.status === "closed"
          ? "Эта групповая сессия уже закрыта"
          : freshSession.title;
      }
      if (freshSession.status === "active") markParticipantStarted(code);
    });
  }


  function setupHostMode() {
    if (hostApp) {
      hostApp.classList.remove("is-hidden");
    }
    if (quizRoot) {
      quizRoot.style.display = "none";
    }
    if (downloadTransition) {
      downloadTransition.style.display = "none";
    }

    const createBtn = document.getElementById("tsCreateSessionBtn");
    const titleInput = document.getElementById("tsSessionTitleInput");
    // Enter в названии встречи = «Создать сессию».
    if (titleInput && createBtn) {
      titleInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        if (!createBtn.disabled) createBtn.click();
      });
    }
    const refreshBtn = document.getElementById("tsRefreshSessionBtn");
    const showReportBtn = document.getElementById("tsShowReportBtn");
    const closeBtn = document.getElementById("tsCloseSessionBtn");
    const resetBtn = document.getElementById("tsResetSessionBtn");
    const copyBtn = document.getElementById("tsCopySessionLinkBtn");
    const incomingCode = activeSessionCode || cleanSessionCode(pageParams.get("code") || "");

    if (incomingCode) {
      const session = readSession(incomingCode) || createSession(incomingCode, "Командная встреча");
      hostSessionCode = session.code;
      if (titleInput) titleInput.value = session.title;
      showHostDashboard(session);
    }

    if (createBtn) {
      createBtn.addEventListener("click", function () {
        const title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : "Командная встреча";
        const session = createSession(makeSessionCode(), title);
        hostSessionCode = session.code;
        postGroupEvent({
          action: "create",
          code: session.code,
          title: session.title,
          status: session.status,
          createdAt: session.createdAt
        }, true);
        updateAddressBar({ host: "1", session: session.code });
        showHostDashboard(session);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", renderHostDashboard);
    }

    if (showReportBtn) {
      showReportBtn.addEventListener("click", function () {
        if (!hostSessionCode) return;
        window.open(reportLink(hostSessionCode), "_blank", "noopener");
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        const session = readSession(hostSessionCode);
        if (!session) return;
        const confirmed = window.confirm("Завершить сессию? Участники по ссылке увидят, что тест закрыт. Это действие нельзя отменить.");
        if (!confirmed) return;
        session.status = "closed";
        session.closedAt = new Date().toISOString();
        writeSession(session);
        postGroupEvent({
          action: "close",
          code: session.code,
          closedAt: session.closedAt
        }, true);
        renderHostDashboard();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!hostSessionCode) return;
        window.localStorage.removeItem(sessionKey(hostSessionCode));
        const title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : "Командная встреча";
        const session = createSession(hostSessionCode, title);
        postGroupEvent({
          action: "reset",
          code: session.code,
          title: session.title,
          createdAt: session.createdAt
        }, true);
        showHostDashboard(session);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const input = document.getElementById("tsParticipantLink");
        if (!input) return;
        navigator.clipboard.writeText(input.value).then(function () {
          copyBtn.textContent = "Ссылка скопирована";
          setTimeout(function () {
            copyBtn.textContent = "Скопировать ссылку";
          }, 2200);
        });
      });
    }
  }


  function createSession(code, title) {
    const session = {
      code: code,
      title: title,
      status: "active",
      createdAt: new Date().toISOString(),
      started: [],
      results: []
    };
    writeSession(session);
    return session;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function openLargeQrWindow(session, link) {
    const popup = window.open("", "titanicSessionQr", "popup=yes,width=980,height=900,scrollbars=yes,resizable=yes");
    if (!popup) {
      window.alert("Разрешите всплывающие окна, чтобы открыть QR-код крупно.");
      return;
    }

    const qrUrl = "https://quickchart.io/qr?size=900&margin=2&text=" + encodeURIComponent(link);
    const title = session && session.title ? session.title : "Групповая сессия";

    popup.document.open();
    popup.document.write(
      '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>QR-код — ' + escapeHtml(title) + '</title>' +
      '<style>' +
      '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:32px;background:#fff;color:#15202b;' +
      'font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}' +
      'main{width:100%;max-width:1400px}h1{margin:0 0 12px;font-size:clamp(16px,3.7vw,48px);line-height:1.08;white-space:nowrap}' +
      'p{margin:0 0 22px;color:#46525e;font-size:clamp(18px,2.4vw,26px)}' +
      'img{display:block;width:min(72vh,760px,calc(100vw - 64px));height:auto;margin:0 auto;' +
      'padding:16px;background:#fff;border:1px solid #d9e2e8}' +
      '</style></head><body><main>' +
      '<h1>Отсканируйте код, чтобы открыть тест</h1>' +
      '<p>' + escapeHtml(title) + '</p>' +
      '<img src="' + escapeHtml(qrUrl) + '" alt="QR-код для открытия теста">' +
      '</main></body></html>'
    );
    popup.document.close();
    popup.opener = null;
    popup.focus();
  }


  function showHostDashboard(session) {
    const createCard = document.getElementById("tsSessionCreateCard");
    const dashboard = document.getElementById("tsHostDashboard");
    const qr = document.getElementById("tsSessionQr");
    const linkInput = document.getElementById("tsParticipantLink");
    const titleView = document.getElementById("tsSessionTitleView");
    const link = participantLink(session.code);

    if (createCard) createCard.classList.add("is-hidden");
    if (dashboard) dashboard.classList.remove("is-hidden");
    if (linkInput) linkInput.value = link;
    if (titleView) titleView.textContent = session.title;
    if (qr) {
      qr.src = "https://quickchart.io/qr?size=520&margin=2&text=" + encodeURIComponent(link);
    }
    const bigQrUrl = "https://quickchart.io/qr?size=900&margin=2&text=" + encodeURIComponent(link);
    const qrWrapLink = document.getElementById("tsSessionQrLink");
    const qrOpenLink = document.getElementById("tsOpenQrLink");
    if (qrWrapLink) {
      qrWrapLink.href = bigQrUrl;
      qrWrapLink.onclick = function (event) {
        event.preventDefault();
        openLargeQrWindow(session, link);
      };
    }
    if (qrOpenLink) {
      qrOpenLink.href = bigQrUrl;
      qrOpenLink.onclick = function (event) {
        event.preventDefault();
        openLargeQrWindow(session, link);
      };
    }

    renderHostDashboard();
    if (hostRefreshTimer) window.clearInterval(hostRefreshTimer);
    hostRefreshTimer = window.setInterval(renderHostDashboard, 2500);
  }


  function renderHostDashboard() {
    if (!hostSessionCode) return;
    const session = readSession(hostSessionCode);
    if (session) {
      renderHostSnapshot(session);
    }

    getGroupStatus(hostSessionCode, true).then(function (freshSession) {
      const statusNode = document.getElementById("tsHostStatus");
      if (freshSession && freshSession.error === "unauthorized") {
        setupAccessDenied("Секретный ключ устарел или введён неверно.");
        return;
      }
      if (freshSession && freshSession.error === "not_found") {
        if (statusNode) statusNode.textContent = "Сессия ещё создаётся или не найдена. Обновление повторится автоматически.";
        return;
      }
      if (freshSession && !freshSession.error) {
        if (statusNode) statusNode.textContent = "";
        renderHostSnapshot(freshSession);
      }
    });
  }


  function renderHostSnapshot(session) {
    const report = calculateReport(session.results || []);
    const startedCount = document.getElementById("tsStartedCount");
    const completedCount = document.getElementById("tsCompletedCount");
    const averageTotal = document.getElementById("tsAverageTotal");
    const titleView = document.getElementById("tsSessionTitleView");

    if (titleView) titleView.textContent = session.title || "Групповая сессия";
    if (startedCount) startedCount.textContent = String(session.startedCount || (session.started || []).length);
    if (completedCount) completedCount.textContent = String((session.results || []).length);
    if (averageTotal) averageTotal.textContent = report.count ? String(Math.round(report.total)) : "0";
  }


  const RISK_ORDER = ["Низкий риск", "Умеренный риск", "Высокий риск", "Критический риск"];
  const RISK_CLASS = {
    "Критический риск": "critical",
    "Высокий риск": "high",
    "Умеренный риск": "medium",
    "Низкий риск": "low"
  };


  function renderFullReport(session) {
    if (!session || session.error) return;
    const results = (session && session.results) || [];
    const report = calculateReport(results);

    const titleNode = document.getElementById("tsReportPageTitle");
    const summaryNode = document.getElementById("tsReportPageSummary");
    if (titleNode) {
      titleNode.textContent = "Итоги теста: " + (session && session.title ? session.title : "Групповая сессия");
    }
    if (summaryNode) {
      summaryNode.textContent = report.count
        ? "Учтено завершенных прохождений: " + report.count + ". Самая слабая зона команды в среднем: " + report.weakestArea + "."
        : "Пока никто из команды не завершил тест. Отчет обновится сам, как только появятся первые результаты.";
    }

    setText_("tsRepStatCompleted", report.count);
    setText_("tsRepStatAverage", report.count ? Math.round(report.total) : 0);
    setText_("tsRepStatMin", report.count ? report.min : 0);
    setText_("tsRepStatMax", report.count ? report.max : 0);

    renderRiskDistribution(report.riskCounts, report.count);
    renderTotalDotplot(results, report);
    renderDimensionDotplots(results, report);
    renderWeakestDotplot(results);
    renderResultsTable(results);
  }

  function setText_(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }


  function renderRiskDistribution(riskCounts, total) {
    const legend = document.getElementById("tsRiskDistLegend");
    if (!legend) return;

    if (!total) {
      legend.innerHTML = "";
      return;
    }

    const counts = RISK_ORDER.map(function (name) { return (riskCounts && riskCounts[name]) || 0; });
    let stackHtml = "";
    let keyHtml = "";

    RISK_ORDER.forEach(function (name, index) {
      const count = counts[index];
      const percent = (count / total) * 100;
      const cls = RISK_CLASS[name];
      if (count) {
        stackHtml += '<span class="ts-risk-segment ' + cls + '" style="flex-basis:' + percent.toFixed(2) + '%" aria-label="' +
          escapeXml_(name + ": " + count + " из " + total) + '">' + count + '</span>';
      }
      keyHtml += '<li><span><i class="' + cls + '"></i>' + escapeXml_(name.replace(" риск", "")) + '</span><b>' +
        count + ' из ' + total + ' · ' + Math.round(percent) + '%</b></li>';
    });

    legend.innerHTML = '<div class="ts-risk-distribution">' +
      '<p class="ts-chart-kicker">Как распределились участники</p>' +
      '<p class="ts-chart-explainer">Полоса показывает, какая доля завершивших тест попала в каждый уровень риска.</p>' +
      '<div class="ts-risk-stack" role="img" aria-label="Распределение участников по уровню риска">' + stackHtml + '</div>' +
      '<ul class="ts-risk-key">' + keyHtml + '</ul></div>';
  }


  function buildBarsHtml_(rows) {
    let html = '<div class="ts-bars">';
    rows.forEach(function (row) {
      html += '<div class="ts-bar-row">' +
        '<span class="ts-bar-label">' + escapeXml_(row.label) + '</span>' +
        '<div class="ts-bar-track"><div class="ts-bar-fill ' + (row.cls || "") + '" style="width:' +
        Math.max(0, Math.min(100, row.width)).toFixed(1) + '%"></div></div>' +
        '<span class="ts-bar-value">' + escapeXml_(String(row.value)) + '</span>' +
        '</div>';
    });
    return html + '</div>';
  }


  function escapeXml_(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function renderTotalDotplot(results, report) {
    const el = document.getElementById("tsTotalDotplot");
    if (!el) return;

    if (!results.length) {
      el.innerHTML = '<p class="ts-muted-text">Пока нет данных для графика.</p>';
      return;
    }

    const maxScore = 75;
    const zones = [
      { from: 0, to: 16, cls: "low" },
      { from: 16, to: 36, cls: "medium" },
      { from: 36, to: 56, cls: "high" },
      { from: 56, to: 75, cls: "critical" }
    ];

    let zonesHtml = "";
    zones.forEach(function (zone) {
      zonesHtml += '<div class="ts-scale-zone ' + zone.cls + '" style="width:' +
        (((zone.to - zone.from) / maxScore) * 100).toFixed(2) + '%"></div>';
    });

    const meanValue = Math.round(report.total);
    const meanRisk = riskForScore_(report.total);
    const meanLeft = Math.max(3, Math.min(97, (report.total / maxScore) * 100));
    const markerHtml = '<div class="ts-report-score-marker" style="left:' + meanLeft.toFixed(1) +
      '%"><span>' + meanValue + '</span></div>';

    el.innerHTML = '<div class="ts-report-callout"><strong>' + escapeXml_(meanRisk) + '</strong><span>средний балл риска ' + meanValue + ' из 75 · ниже — лучше</span></div>' +
      '<p class="ts-chart-kicker">Средний балл команды на шкале риска</p>' +
      '<p class="ts-chart-explainer">Маркер показывает средний балл всех завершивших тест.</p>' +
      '<div class="ts-report-scale">' +
      '<div class="ts-report-score-track"><div class="ts-report-score-zones">' + zonesHtml + '</div>' + markerHtml + '</div>' +
      '<div class="ts-report-zone-labels"><span><b>0–15</b> Низкий</span><span><b>16–35</b> Умеренный</span><span><b>36–55</b> Высокий</span><span><b>56–75</b> Критический</span></div>' +
      '</div>';
  }


  function renderDimensionDotplots(results, report) {
    const wrap = document.getElementById("tsDimensionDotplots");
    if (!wrap) return;

    if (!results.length) {
      wrap.innerHTML = '<p class="ts-muted-text">Нет данных.</p>';
      return;
    }

    const dims = [
      { title: "Предвидение изменений", mean: report.anticipation },
      { title: "Дизайн изменений", mean: report.design },
      { title: "Реализация изменений", mean: report.implementation }
    ];

    let rowsHtml = "";
    dims.forEach(function (dim) {
      const mean = Number(dim.mean || 0);
      const percent = Math.max(0, Math.min(100, (mean / 25) * 100));
      const isWeak = dim.title === report.weakestArea;
      rowsHtml += '<div class="ts-profile-row' + (isWeak ? ' is-weak' : '') + '">' +
        '<span class="ts-profile-label">' + escapeXml_(dim.title) + '</span>' +
        '<div class="ts-profile-track"><span class="ts-profile-fill" style="width:' + percent.toFixed(1) + '%"></span>' +
        '<span class="ts-profile-dot" style="left:' + percent.toFixed(1) + '%"></span></div>' +
        '<strong class="ts-profile-value">' + (Math.round(mean * 10) / 10) + ' / 25</strong></div>';
    });
    wrap.innerHTML = '<div class="ts-profile-chart" role="img" aria-label="Средние баллы риска команды по трём зонам">' + rowsHtml +
      '</div><div class="ts-profile-axis"><span>0 — сильная зона</span><span>25 — критическая зона</span></div>';
  }


  function weakestAreaForResult_(item) {
    return [
      { name: "Предвидение изменений", value: Number(item.anticipation || 0) },
      { name: "Дизайн изменений", value: Number(item.design || 0) },
      { name: "Реализация изменений", value: Number(item.implementation || 0) }
    ].sort(function (a, b) { return b.value - a.value; })[0].name;
  }


  function renderWeakestDotplot(results) {
    const el = document.getElementById("tsWeakestDotplot");
    if (!el) return;

    if (!results.length) {
      el.innerHTML = '<p class="ts-muted-text">Пока нет данных для графика.</p>';
      return;
    }

    const categories = ["Предвидение изменений", "Дизайн изменений", "Реализация изменений"];
    const counts = {};
    categories.forEach(function (name) { counts[name] = 0; });

    results.forEach(function (item) {
      const area = weakestAreaForResult_(item);
      counts[area] += 1;
    });

    const maxCount = Math.max.apply(null, categories.map(function (name) { return counts[name]; }));
    let rowsHtml = "";
    categories.forEach(function (name) {
      const count = counts[name];
      let dots = "";
      for (let i = 0; i < results.length; i += 1) {
        dots += '<i class="ts-unit-dot' + (i < count ? ' is-filled' : '') + '"></i>';
      }
      rowsHtml += '<div class="ts-weakness-row' + (count === maxCount && count > 0 ? ' is-priority' : '') + '">' +
        '<span class="ts-weakness-label">' + escapeXml_(name) + '</span>' +
        '<span class="ts-unit-dots" aria-label="' + count + ' из ' + results.length + '">' + dots + '</span>' +
        '<strong class="ts-weakness-value">' + count + ' из ' + results.length + '</strong></div>';
    });
    el.innerHTML = '<div class="ts-weakness-list" role="img" aria-label="Сколько участников назвали каждую зону самой слабой">' + rowsHtml + '</div>';
  }


  function riskForScore_(score) {
    const value = Number(score || 0);
    if (value < 16) return "Низкий риск";
    if (value < 36) return "Умеренный риск";
    if (value < 56) return "Высокий риск";
    return "Критический риск";
  }


  function renderResultsTable(results) {
    const body = document.getElementById("tsResultsTableBody");
    if (!body) return;
    body.innerHTML = "";

    const sorted = results.slice().sort(function (a, b) {
      return Number(b.total || 0) - Number(a.total || 0);
    });

    if (!sorted.length) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="5" class="ts-muted-text">Пока нет завершенных прохождений.</td>';
      body.appendChild(row);
      return;
    }

    sorted.forEach(function (item, index) {
      const row = document.createElement("tr");
      const risk = riskForScore_(item.total);
      const weakestArea = weakestAreaForResult_(item);
      const riskClass = RISK_CLASS[risk] || "medium";
      row.innerHTML =
        '<td>Участник ' + (index + 1) + '</td>' +
        '<td>' + Number(item.total || 0) + '/75</td>' +
        '<td><span class="ts-badge ' + riskClass + '">' + risk + '</span></td>' +
        '<td>' + weakestArea + '</td>' +
        '<td>' + formatDate_(item.completedAt) + '</td>';
      body.appendChild(row);
    });
  }


  function formatDate_(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }


  function calculateReport(results) {
    const count = results.length;
    const emptyRiskCounts = { "Низкий риск": 0, "Умеренный риск": 0, "Высокий риск": 0, "Критический риск": 0 };
    const emptyWeakestCounts = { "Предвидение изменений": 0, "Дизайн изменений": 0, "Реализация изменений": 0 };

    if (!count) {
      return {
        count: 0,
        total: 0,
        anticipation: 0,
        design: 0,
        implementation: 0,
        min: 0,
        max: 0,
        weakestArea: "нет данных",
        riskCounts: emptyRiskCounts,
        weakestCounts: emptyWeakestCounts
      };
    }

    const sums = results.reduce(function (acc, item) {
      acc.total += Number(item.total || 0);
      acc.anticipation += Number(item.anticipation || 0);
      acc.design += Number(item.design || 0);
      acc.implementation += Number(item.implementation || 0);
      return acc;
    }, { total: 0, anticipation: 0, design: 0, implementation: 0 });

    const totals = results.map(function (item) { return Number(item.total || 0); });

    const averages = {
      count: count,
      total: sums.total / count,
      anticipation: sums.anticipation / count,
      design: sums.design / count,
      implementation: sums.implementation / count,
      min: Math.min.apply(null, totals),
      max: Math.max.apply(null, totals)
    };
    const weakest = [
      { name: "Предвидение изменений", value: averages.anticipation },
      { name: "Дизайн изменений", value: averages.design },
      { name: "Реализация изменений", value: averages.implementation }
    ].sort(function (a, b) {
      return b.value - a.value;
    })[0];
    averages.weakestArea = weakest.name;

    const riskCounts = Object.assign({}, emptyRiskCounts);
    const weakestCounts = Object.assign({}, emptyWeakestCounts);

    results.forEach(function (item) {
      const risk = riskForScore_(item.total);
      riskCounts[risk] = (riskCounts[risk] || 0) + 1;

      weakestCounts[weakestAreaForResult_(item)] += 1;
    });

    averages.riskCounts = riskCounts;
    averages.weakestCounts = weakestCounts;
    return averages;
  }


  function markParticipantStarted(code) {
    const session = readSession(code) || createSession(code, "Групповая сессия");
    const participantId = getParticipantId(code);
    session.started = session.started || [];
    if (!session.started.includes(participantId)) {
      session.started.push(participantId);
      writeSession(session);
    }
    postGroupEvent({
      action: "started",
      code: code,
      participantId: participantId,
      startedAt: new Date().toISOString()
    });
  }


  function saveGroupResult(payload) {
    if (!activeSessionCode) return;
    const session = readSession(activeSessionCode) || createSession(activeSessionCode, "Групповая сессия");
    const participantId = getParticipantId(activeSessionCode);
    const result = {
      participantId: participantId,
      completedAt: new Date().toISOString(),
      total: payload.total,
      risk: payload.risk,
      anticipation: payload.anticipation,
      design: payload.design,
      implementation: payload.implementation,
      weakestArea: payload.weakestArea
    };

    session.results = (session.results || []).filter(function (item) {
      return item.participantId !== participantId;
    });
    session.results.push(result);
    writeSession(session);
    postGroupEvent({
      action: "result",
      code: activeSessionCode,
      participantId: participantId,
      payload: result
    });
  }


  function getParticipantId(code) {
    const key = GROUP_STORAGE_PREFIX + code + ":participantId";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      window.localStorage.setItem(key, id);
    }
    return id;
  }



  window.addEventListener("titanic:result", function (event) {
    if (!activeSessionCode || !event.detail) return;
    saveGroupResult(event.detail);
  });
  initGroupMode();
})();
