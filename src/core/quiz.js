(function () {
  // Всё, что различается между индивидуальной и групповой страницей, задаётся
  // через window.TS_CONFIG в блоке T123. Кода на два варианта здесь нет.
  const CFG = Object.assign({
    // Метка версии в Google Sheet — по ней различаются потоки в выгрузке.
    testVersion: "tilda_ru_post_result_flow_v3_phone",
    // Спрашивать телефон перед отправкой заявки на консультацию.
    phoneGate: true
  }, window.TS_CONFIG || {});

  // Разметку квиза держим здесь же, а не в Tilda: иначе правку снова пришлось
  // бы вручную повторять на двух страницах. build.py подставляет её сюда.
  const QUIZ_MARKUP = "__QUIZ_MARKUP__";
  const mountPoint = document.getElementById("titanicQuizRoot");
  if (mountPoint && !mountPoint.firstElementChild) {
    mountPoint.innerHTML = QUIZ_MARKUP;
  }

  const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbxHIeLZ-tPJB-9P6W2d2emSWgJL2b4MabHGWBiFF-86qA4EJhPLqc_5MEOuH8iif0__/exec";
  const CONSENT_TEXT_VERSION = "2026-07-17-v1";
  const BOOK_DOWNLOAD_URL = "https://s3.amazonaws.com/kajabi-storefronts-production/sites/49312/downloads/JDtM4QYyTFiznVNDOOD9_Titanic_Syndrome_RUS_Short.pdf";
  const THANK_YOU_URL = "https://reinventionacademy.mykajabi.com/thank-you-titanic-free";
  const CERTIFICATION_URL = "https://reinventionacademy.kz/crp-certification";
  const TELEGRAM_URL = "https://t.me/nadyazhexembayeva";
  const INSTAGRAM_URL = "https://www.instagram.com/chief_reinvention_officer/";


  let latestPayload = null;


  const QUESTIONS = [
    {
      category: "Предвидение изменений",
      text: "Наша компания получает информацию и новости из одних и тех же источников, например от поставщиков, клиентов, профессиональных журналов, и редко использует необычные или непривычные источники."
    },
    {
      category: "Предвидение изменений",
      text: "Когда наша компания получает информацию и предупреждения о возможных угрозах, этой информацией делятся только с небольшой группой людей."
    },
    {
      category: "Предвидение изменений",
      text: "К сотрудникам редко обращаются с просьбой поделиться своим видением потенциальных угроз или возможностей для нашего бизнеса."
    },
    {
      category: "Предвидение изменений",
      text: "В нашей компании лидеры часто обосновывают решения прошлым опытом: «я делал это миллион раз», «мы уже пробовали, и это не сработало»."
    },
    {
      category: "Предвидение изменений",
      text: "Когда мы терпим неудачу, компания часто возлагает вину на внешние причины: конкурентов, поставщиков, государство, клиентов или рынок."
    },
    {
      category: "Дизайн изменений",
      text: "Мы уделяем недостаточно времени размышлениям, разработке стратегий, креативному мышлению и проактивным действиям."
    },
    {
      category: "Дизайн изменений",
      text: "Я регулярно слышу «мы всегда так делали» или «у нас принято так поступать» при обсуждении изменений."
    },
    {
      category: "Дизайн изменений",
      text: "Структура нашей компании мешает быстро реагировать на изменения: например, бюджетный процесс слишком бюрократичен или производственные решения привязывают нас к продукту на годы вперед."
    },
    {
      category: "Дизайн изменений",
      text: "В нашей компании не приветствуются эксперименты и метод проб и ошибок. От нас ожидают, что изменения сразу будут идеальными, а за ошибки могут наказать."
    },
    {
      category: "Дизайн изменений",
      text: "Большинство людей в компании сердятся или разочаровываются, когда сталкиваются с необходимостью делать что-то по-другому, даже если изменение ведет к лучшему."
    },
    {
      category: "Реализация изменений",
      text: "В нашей компании мы чаще реагируем уже под влиянием разворачивающегося кризиса, чем предвидим возможные угрозы и действуем заранее."
    },
    {
      category: "Реализация изменений",
      text: "В процессе перемен мы редко останавливаемся, чтобы отпраздновать маленькие или краткосрочные победы. Мы часто не замечаем прогресс, который делаем."
    },
    {
      category: "Реализация изменений",
      text: "Есть заметный разрыв между тем, что мы говорим о приверженности изменениям, и тем, как на самом деле работаем, распределяем ресурсы, проводим время на встречах и выплачиваем бонусы."
    },
    {
      category: "Реализация изменений",
      text: "Я не получил понятного обучения или инструкций о том, как инициировать и реализовывать изменения в нашей компании."
    },
    {
      category: "Реализация изменений",
      text: "На наши бизнес-решения чаще влияют внешние требования, чем сильная, ясная и проактивная стратегия."
    }
  ];


  const form = document.getElementById("tsQuizForm");
  const quizRoot = document.getElementById("titanicQuiz");
  const submitBtn = document.getElementById("tsGateSubmitBtn");
  const roleGate = document.getElementById("tsRoleGate");
  const roleOtherField = document.getElementById("tsRoleOtherField");
  const roleOtherInput = document.getElementById("tsRoleOtherInput");
  const questionFlow = document.getElementById("tsQuestionFlow");
  const contactGate = document.getElementById("tsContactGate");
  const progressText = document.getElementById("tsProgressText");
  const progressCategory = document.getElementById("tsProgressCategory");
  const progressFill = document.getElementById("tsProgressFill");
  const bookOffer = document.getElementById("tsBookOffer");
  const bookDownloadBtn = document.getElementById("tsBookDownloadBtn");
  const downloadStatus = document.getElementById("tsDownloadStatus");
  const consultationBtn = document.getElementById("tsConsultationBtn");
  const consultationStatus = document.getElementById("tsConsultationStatus");
  let consultationForm = document.getElementById("tsConsultationForm");
  if (CFG.phoneGate && !consultationForm && consultationBtn) {
    consultationForm = document.createElement("form");
    consultationForm.className = "ts-consultation-form";
    consultationForm.id = "tsConsultationForm";
    consultationForm.noValidate = true;
    consultationForm.innerHTML =
      '<label class="ts-consultation-phone-label" for="tsConsultationPhone">Номер телефона</label>' +
      '<input class="ts-consultation-phone-input" id="tsConsultationPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 999 123-45-67" aria-describedby="tsConsultationPhoneError" required>' +
      '<p class="ts-consultation-phone-error" id="tsConsultationPhoneError">Введите номер телефона.</p>' +
      '<button class="ts-consultation-submit" id="tsConsultationSubmit" type="submit">Отправить запрос</button>';
    consultationBtn.insertAdjacentElement("afterend", consultationForm);
  }
  const consultationPhoneInput = document.getElementById("tsConsultationPhone");
  const consultationSubmit = document.getElementById("tsConsultationSubmit");
  if (bookDownloadBtn) {
    bookDownloadBtn.href = BOOK_DOWNLOAD_URL;
  }
  const answers = new Array(QUESTIONS.length).fill(null);
  let currentQuestion = 0;
  let selectedRole = "";
  let selectedRoleLabel = "";
  let selectedRoleOther = "";
  let bookDownloadTracked = false;
  let consultationInterestTracked = false;


  // Some browsers restore radio state from bfcache/history on load or refresh,
  // which made a random-looking option appear pre-selected. Force a clean slate.
  roleGate.querySelectorAll('input[name="tsRole"]').forEach(function (input) {
    input.checked = false;
  });
  roleOtherField.classList.remove("is-visible");


  function categoryId(category) {
    if (category === "Предвидение изменений") return "anticipation";
    if (category === "Дизайн изменений") return "design";
    return "implementation";
  }


  function renderQuestion(index) {
    const q = QUESTIONS[index];
    const card = document.createElement("div");
    card.className = "ts-question";
    card.id = "tsQCard" + index;


    let scale = "";
    for (let v = 0; v <= 5; v++) {
      const checked = answers[index] === v ? " checked" : "";
      scale +=
        '<div class="ts-opt">' +
          '<input type="radio" name="tsq' + index + '" id="tsq' + index + '_' + v + '" value="' + v + '" autocomplete="off"' + checked + '>' +
          '<label for="tsq' + index + '_' + v + '">' + v + '</label>' +
        '</div>';
    }


    card.innerHTML =
      '<div class="ts-q-top">' +
        '<div class="ts-q-num">' + String(index + 1).padStart(2, "0") + '</div>' +
        '<div class="ts-q-content">' +
          '<p class="ts-q-text">' + q.text + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="ts-scale-ends">' +
        '<span>0 — не похоже на нашу компанию</span>' +
        '<span>5 — наша компания на 100%</span>' +
      '</div>' +
      '<div class="ts-scale">' + scale + '</div>' +
      '<p class="ts-warning">Ответьте на этот вопрос.</p>' +
      '<div class="ts-q-nav">' +
        (index > 0 ? '<button type="button" class="ts-back-btn" id="tsBackBtn">Назад</button>' : '') +
      '</div>';


    form.innerHTML = "";
    form.style.display = "";
    form.appendChild(card);
    progressText.textContent = "Вопрос " + (index + 1) + " из " + QUESTIONS.length;
    progressCategory.textContent = q.category;
    progressFill.style.width = ((index / QUESTIONS.length) * 100) + "%";
    contactGate.classList.remove("is-visible");


    const backBtn = document.getElementById("tsBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        currentQuestion = index - 1;
        renderQuestion(currentQuestion);
      });
    }
  }


  contactGate.addEventListener("change", function (e) {
    if (!e.target || e.target.name !== "tsRole") return;


    selectedRole = e.target.value;
    selectedRoleLabel = e.target.getAttribute("data-label") || e.target.value;
    setInvalid("tsRoleGate", false);


    if (selectedRole === "other") {
      roleOtherField.classList.add("is-visible");
      roleOtherInput.focus();
      return;
    }


    roleOtherField.classList.remove("is-visible");
    selectedRoleOther = "";
  });


  contactGate.addEventListener("input", function (e) {
    const field = e.target && e.target.closest ? e.target.closest(".ts-field") : null;
    if (field) {
      field.classList.remove("is-invalid");
    }
  });


  contactGate.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "tsGatePrivacyConsent") return;
    setInvalid("tsPrivacyConsentField", false);
  });


  roleOtherInput.addEventListener("blur", function () {
    selectedRoleOther = roleOtherInput.value.trim();
  });


  document.getElementById("tsGateBackBtn").addEventListener("click", function () {
    contactGate.classList.remove("is-visible");
    currentQuestion = QUESTIONS.length - 1;
    renderQuestion(currentQuestion);
  });


  function showContactGate() {
    form.innerHTML = "";
    form.style.display = "none";
    progressText.textContent = "Вопросы пройдены";
    progressCategory.textContent = "";
    progressFill.style.width = "100%";
    contactGate.classList.add("is-visible");
    resetContactGateErrors();


    contactGate.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }


  form.addEventListener("change", function (e) {
    const match = e.target.name.match(/^tsq(\d+)$/);
    if (!match) return;


    const index = Number(match[1]);
    answers[index] = Number(e.target.value);


    setTimeout(function () {
      if (index < QUESTIONS.length - 1) {
        currentQuestion = index + 1;
        renderQuestion(currentQuestion);
      } else {
        showContactGate();
      }
    }, 220);
  });


  // Enter в текстовом поле = нажатие основной кнопки этого шага.
  // Контактный гейт — не <form>, поэтому браузер сам этого не делает.
  function submitOnEnter(input, button) {
    if (!input || !button) return;
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (button.disabled) return;
      button.click();
    });
  }


  [roleOtherInput,
   document.getElementById("tsGateFirstName"),
   document.getElementById("tsGateLastName"),
   document.getElementById("tsGateEmail")].forEach(function (input) {
    submitOnEnter(input, submitBtn);
  });


  // Поле телефона лежит в <form>, но на неявный сабмит полагаться не стоит:
  // он зависит от браузера и от того, сколько в форме полей.
  submitOnEnter(consultationPhoneInput, consultationSubmit);


  submitBtn.addEventListener("click", function () {
    const missingIndex = answers.findIndex(function (value) {
      return value === null;
    });


    if (missingIndex >= 0) {
      currentQuestion = missingIndex;
      renderQuestion(currentQuestion);
      return;
    }


    const total = answers.reduce(function (sum, value) {
      return sum + value;
    }, 0);


    const categoryScores = {
      anticipation: 0,
      design: 0,
      implementation: 0
    };


    answers.forEach(function (value, index) {
      categoryScores[categoryId(QUESTIONS[index].category)] += value;
    });


    const result = getResult(total);
    const contact = validateContactGate();
    if (!contact.isValid) return;


    const contactFirstName = contact.firstName;
    const contactLastName = contact.lastName;
    const name = [contactFirstName, contactLastName].filter(Boolean).join(" ");
    const email = contact.email;
    const privacyConsent = contact.privacyConsent;
    const marketingConsent = contact.marketingConsent;
    const consentAt = new Date().toISOString();
    selectedRole = contact.role;
    selectedRoleLabel = contact.roleLabel;
    selectedRoleOther = contact.roleOther;


    const anticipation = getCategoryResult(categoryScores.anticipation, "anticipation");
    const design = getCategoryResult(categoryScores.design, "design");
    const implementation = getCategoryResult(categoryScores.implementation, "implementation");
    const weakestArea = getWeakestArea(categoryScores);


    document.getElementById("tsQuizView").style.display = "none";
    quizRoot.classList.add("is-results");
    document.getElementById("tsResultView").classList.add("is-show");


    document.getElementById("tsFinalScore").textContent = total;
    document.getElementById("tsRiskLabel").textContent = result.risk;
    document.getElementById("tsResultTitle").textContent = result.title;
    document.getElementById("tsResultText").textContent = result.text;
    document.getElementById("tsResultExplain").textContent = result.explain;


    document.getElementById("tsAnticipationScore").textContent = categoryScores.anticipation;
    document.getElementById("tsDesignScore").textContent = categoryScores.design;
    document.getElementById("tsImplementationScore").textContent = categoryScores.implementation;


    updateAreaLevel("tsAnticipationLevel", anticipation.level);
    updateAreaLevel("tsDesignLevel", design.level);
    updateAreaLevel("tsImplementationLevel", implementation.level);


    document.getElementById("tsAnticipationText").textContent = anticipation.text;
    document.getElementById("tsDesignText").textContent = design.text;
    document.getElementById("tsImplementationText").textContent = implementation.text;


    updateAreaBar("tsAnticipationBar", categoryScores.anticipation, anticipation.level);
    updateAreaBar("tsDesignBar", categoryScores.design, design.level);
    updateAreaBar("tsImplementationBar", categoryScores.implementation, implementation.level);


    updateRiskMarker(total);
    updateActiveRiskLabel(total);


    latestPayload = {
      name: name,
      fullName: name,
      firstName: contactFirstName,
      lastName: contactLastName,
      first_name: contactFirstName,
      last_name: contactLastName,
      email: email,
      consent: privacyConsent,
      privacyConsent: privacyConsent,
      marketingConsent: marketingConsent,
      consentAt: consentAt,
      consentTextVersion: CONSENT_TEXT_VERSION,
      role: selectedRole,
      roleKey: selectedRole,
      roleSegment: selectedRole,
      roleLabel: selectedRoleLabel,
      roleOther: selectedRoleOther,
      language: "ru",
      testVersion: CFG.testVersion,
      bookDownloadStatus: "pending",
      bookDownloadUrl: BOOK_DOWNLOAD_URL,
      thankYouUrl: THANK_YOU_URL,
      total: total,
      result: result.title,
      risk: result.risk,
      anticipation: categoryScores.anticipation,
      design: categoryScores.design,
      implementation: categoryScores.implementation,
      weakestArea: weakestArea,
      page: window.location.href,
      answers: answers.slice()
    };


    document.getElementById("titanicQuiz").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });


    revealResultSteps();
    saveResult(latestPayload);
  });


  renderQuestion(currentQuestion);


  function revealResultSteps() {
    const steps = document.querySelectorAll("#tsResultView .ts-step");

    steps.forEach(function(step) {
      step.classList.add("is-visible");
    });
  }


  function getResult(total) {
    if (total <= 15) {
      return {
        risk: "Низкий риск",
        title: "У вас сильная готовность к пересборке",
        text: "Компания хорошо замечает изменения, работает с ними системно и умеет превращать вызовы в новые возможности.",
        explain: "Такой балл — сильная зона. Главная задача сейчас — поддерживать систему регулярного обновления и не превращать текущий успех в новую точку слепоты."
      };
    }


    if (total <= 35) {
      return {
        risk: "Умеренный риск",
        title: "Есть база для пересборки",
        text: "Компания уже умеет адаптироваться, но отдельные слабые места могут стать опасными при резких изменениях.",
        explain: "Самый высокий показатель ниже показывает, какую способность стоит усиливать первой."
      };
    }


    if (total <= 55) {
      return {
        risk: "Высокий риск",
        title: "Есть значимые признаки Синдрома Титаника",
        text: "Компания может слишком поздно замечать угрозы, опираться на прошлый успех или реагировать только после начала кризиса.",
        explain: "При таком балле у компании уже накопилось несколько признаков Синдрома Титаника одновременно — тревожный сигнал, ведь гибкость теряется именно тогда, когда изменения требуют быстрых и согласованных действий. Ниже — по какому из трёх направлений просело сильнее всего."
      };
    }


    return {
      risk: "Критический риск",
      title: "Нужна системная пересборка",
      text: "У компании выраженный риск Синдрома Титаника.",
      explain: "Компания может не замечать изменения вовремя, не переосмыслять решения и не внедрять изменения до того, как ситуация становится критической."
    };
  }


  function getCategoryResult(score, type) {
    const copy = {
      anticipation: {
        high: "Компания хорошо замечает внешние сигналы, угрозы и новые возможности до того, как они становятся кризисом.",
        medium: "Компания частично замечает внешние сигналы, но может упускать слабые или непривычные источники изменений.",
        risk: "Компания может поздно замечать внешние сигналы, угрозы и новые возможности.",
        critical: "Компания почти не использует внешние сигналы как источник решений и может узнавать об изменениях слишком поздно."
      },
      design: {
        high: "Компания умеет пересматривать подходы, стратегии и привычные способы работы.",
        medium: "Компания иногда переосмысляет решения, но может слишком часто опираться на привычные подходы.",
        risk: "Компания может застревать в старых правилах, прошлых успехах и привычном способе принимать решения.",
        critical: "Компания почти не создает пространства для переосмысления и может продолжать делать то, что уже перестало работать."
      },
      implementation: {
        high: "Компания хорошо переводит идеи в действия и умеет внедрять изменения на практике.",
        medium: "Компания частично переводит идеи в действия, но процесс изменений можно усилить.",
        risk: "Компания может говорить об изменениях больше, чем реально менять процессы, ресурсы и поведение.",
        critical: "Компания почти не превращает идеи изменений в действия и может реагировать только после начала кризиса."
      }
    };


    if (score <= 5) return { level: "Сильная зона", text: copy[type].high };
    if (score <= 11) return { level: "Средняя зона", text: copy[type].medium };
    if (score <= 18) return { level: "Зона риска", text: copy[type].risk };
    return { level: "Критическая зона", text: copy[type].critical };
  }


  function getWeakestArea(scores) {
    const areas = [
      { name: "Предвидение изменений", value: scores.anticipation },
      { name: "Дизайн изменений", value: scores.design },
      { name: "Реализация изменений", value: scores.implementation }
    ];


    areas.sort(function(a, b) {
      return b.value - a.value;
    });


    return areas[0].name;
  }


  function levelClass(level) {
    if (level === "Сильная зона") return "is-strong";
    if (level === "Средняя зона") return "is-medium";
    if (level === "Зона риска") return "is-risk";
    return "is-critical";
  }


  function updateAreaLevel(id, level) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = level;
    el.classList.remove("is-strong", "is-medium", "is-risk", "is-critical");
    el.classList.add(levelClass(level));
  }


  function pluralScore(value) {
    const abs = Math.abs(value) % 100;
    const tail = abs % 10;
    if (abs > 10 && abs < 20) return "баллов";
    if (tail === 1) return "балл";
    if (tail >= 2 && tail <= 4) return "балла";
    return "баллов";
  }


  function updateRiskMarker(total) {
    const marker = document.getElementById("tsRiskMarker");
    const percent = Math.max(0, Math.min(100, (total / 75) * 100));
    marker.style.left = percent + "%";
    marker.textContent = total + " " + pluralScore(total);
  }


  function updateActiveRiskLabel(total) {
    const ids = ["tsRiskLabelCritical", "tsRiskLabelHigh", "tsRiskLabelMedium", "tsRiskLabelLow"];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove("is-active");
    });

    let activeId;
    if (total >= 56) activeId = "tsRiskLabelLow";
    else if (total >= 36) activeId = "tsRiskLabelMedium";
    else if (total >= 16) activeId = "tsRiskLabelHigh";
    else activeId = "tsRiskLabelCritical";

    const activeEl = document.getElementById(activeId);
    if (activeEl) activeEl.classList.add("is-active");

    const badge = document.getElementById("tsRiskLabel");
    if (badge) {
      badge.classList.remove("is-strong", "is-medium", "is-risk", "is-critical");
      badge.classList.add(
        activeId === "tsRiskLabelCritical" ? "is-strong" :
        activeId === "tsRiskLabelHigh" ? "is-medium" :
        activeId === "tsRiskLabelMedium" ? "is-risk" : "is-critical"
      );
    }
  }


  function updateAreaBar(id, score, level) {
    const bar = document.getElementById(id);
    if (!bar) return;

    const percent = Math.max(0, Math.min(100, (score / 25) * 100));
    bar.style.width = percent + "%";
    bar.style.background = "transparent";
    bar.classList.remove("is-strong", "is-medium", "is-risk", "is-critical");
    bar.classList.add(levelClass(level));
  }


  function saveResult(payload) {
    // Точка расширения: групповой контроллер подписан на это событие.
    // Ядро о нём больше ничего не знает.
    window.dispatchEvent(new CustomEvent("titanic:result", { detail: payload }));

    if (!SHEET_ENDPOINT) {
      return;
    }


    fetch(SHEET_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).catch(function () {
      console.warn("Result was shown, but saving to the sheet failed.");
    });
  }


  function setInvalid(fieldId, isInvalid) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.toggle("is-invalid", isInvalid);
  }


  function resetContactGateErrors() {
    ["tsRoleGate", "tsFirstNameField", "tsLastNameField", "tsEmailField", "tsPrivacyConsentField"].forEach(function(fieldId) {
      setInvalid(fieldId, false);
    });
  }


  function validateContactGate() {
    const firstNameInput = document.getElementById("tsGateFirstName");
    const lastNameInput = document.getElementById("tsGateLastName");
    const emailInput = document.getElementById("tsGateEmail");
    const selectedRoleInput = document.querySelector('input[name="tsRole"]:checked');
    const privacyConsentInput = document.getElementById("tsGatePrivacyConsent");
    const marketingConsentInput = document.getElementById("tsGateMarketingConsent");


    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;


    const firstNameInvalid = !firstName;
    const lastNameInvalid = !lastName;
    const emailInvalid = !emailInput.checkValidity();
    const roleOther = selectedRoleInput && selectedRoleInput.value === "other" ? roleOtherInput.value.trim() : "";
    const roleInvalid = !selectedRoleInput || (selectedRoleInput.value === "other" && !roleOther);
    const privacyConsentInvalid = !privacyConsentInput.checked;


    // Подсвечиваем только первое незаполненное поле — следующее подсветится
    // после повторного нажатия на кнопку.
    resetContactGateErrors();


    const firstInvalidFieldId =
      roleInvalid ? "tsRoleGate" :
      firstNameInvalid ? "tsFirstNameField" :
      lastNameInvalid ? "tsLastNameField" :
      emailInvalid ? "tsEmailField" :
      privacyConsentInvalid ? "tsPrivacyConsentField" : "";


    if (firstInvalidFieldId) {
      setInvalid(firstInvalidFieldId, true);
    }


    const firstInvalidInput =
      roleInvalid ? (selectedRoleInput && selectedRoleInput.value === "other" ? roleOtherInput : roleGate) :
      firstNameInput && firstNameInvalid ? firstNameInput :
      lastNameInput && lastNameInvalid ? lastNameInput :
      emailInput && emailInvalid ? emailInput :
      privacyConsentInput && privacyConsentInvalid ? privacyConsentInput : null;


    if (firstInvalidInput) {
      firstInvalidInput.focus();
    }


    return {
      isValid: !roleInvalid && !firstNameInvalid && !lastNameInvalid && !emailInvalid && !privacyConsentInvalid,
      firstName: firstName,
      lastName: lastName,
      email: email,
      role: selectedRoleInput ? selectedRoleInput.value : "",
      roleLabel: selectedRoleInput ? (selectedRoleInput.value === "other" ? "Другое: " + roleOther : (selectedRoleInput.getAttribute("data-label") || selectedRoleInput.value)) : "",
      roleOther: roleOther,
      privacyConsent: privacyConsentInput.checked,
      marketingConsent: marketingConsentInput.checked
    };
  }


  function sendTrackingEvent(payload) {
    if (!SHEET_ENDPOINT) {
      return Promise.resolve(false);
    }


    const body = JSON.stringify(payload);


    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      if (navigator.sendBeacon(SHEET_ENDPOINT, blob)) {
        return Promise.resolve(true);
      }
    }


    return fetch(SHEET_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: body,
      keepalive: true
    }).then(function () {
      return true;
    }).catch(function () {
      console.warn("Tracking request failed.");
      return false;
    });
  }


  function trackJourneyClick(eventName, destination) {
    if (!latestPayload) return;

    sendTrackingEvent({
      event: eventName,
      email: latestPayload.email,
      firstName: latestPayload.firstName,
      lastName: latestPayload.lastName,
      role: latestPayload.role,
      language: latestPayload.language,
      testVersion: latestPayload.testVersion,
      total: latestPayload.total,
      risk: latestPayload.risk,
      weakestArea: latestPayload.weakestArea,
      destination: destination,
      page: window.location.href
    });
  }


  function showDownloadTransition() {
    if (downloadStatus) {
      downloadStatus.classList.add("is-visible");
    }
    if (bookDownloadBtn) {
      bookDownloadBtn.textContent = "Открыть книгу еще раз";
    }
  }


  function pingThankYouPage() {
    // Silent background visit so any ad-conversion pixel/GTM tag on the Kajabi
    // thank-you page still fires, without sending the visitor to a second tab.
    try {
      const pingFrame = document.createElement("iframe");
      pingFrame.style.display = "none";
      pingFrame.setAttribute("aria-hidden", "true");
      pingFrame.src = THANK_YOU_URL;
      document.body.appendChild(pingFrame);
    } catch (err) {
      console.warn("Thank-you page ping failed.", err);
    }
  }


  function handleBookDownloadClick(event) {
    if (!latestPayload) return;
    if (bookDownloadTracked) {
      showDownloadTransition();
      return;
    }
    bookDownloadTracked = true;
    latestPayload.bookDownloadStatus = "downloaded";
    latestPayload.bookDownloadedAt = new Date().toISOString();


    sendTrackingEvent({
      event: "book_downloaded",
      email: latestPayload.email,
      firstName: latestPayload.firstName,
      lastName: latestPayload.lastName,
      fullName: latestPayload.fullName,
      role: latestPayload.role,
      roleKey: latestPayload.roleKey,
      roleSegment: latestPayload.roleSegment,
      roleLabel: latestPayload.roleLabel,
      roleOther: latestPayload.roleOther,
      consent: latestPayload.consent,
      privacyConsent: latestPayload.privacyConsent,
      marketingConsent: latestPayload.marketingConsent,
      consentAt: latestPayload.consentAt,
      consentTextVersion: latestPayload.consentTextVersion,
      language: latestPayload.language,
      testVersion: latestPayload.testVersion,
      total: latestPayload.total,
      result: latestPayload.result,
      risk: latestPayload.risk,
      anticipation: latestPayload.anticipation,
      design: latestPayload.design,
      implementation: latestPayload.implementation,
      weakestArea: latestPayload.weakestArea,
      bookDownloadStatus: "downloaded",
      bookDownloadedAt: latestPayload.bookDownloadedAt,
      bookDownloadUrl: BOOK_DOWNLOAD_URL,
      thankYouUrl: THANK_YOU_URL,
      page: window.location.href
    });


    pingThankYouPage();
    showDownloadTransition();
  }


  if (bookDownloadBtn) {
    bookDownloadBtn.addEventListener("click", handleBookDownloadClick);
  }


  // Общая часть заявки на консультацию. Телефон подмешивается только там,
  // где включён phone gate.
  function consultationPayload(extra) {
    const base = {
      event: "consultation_interest",
      email: latestPayload.email,
      firstName: latestPayload.firstName,
      lastName: latestPayload.lastName,
      fullName: latestPayload.fullName,
      role: latestPayload.role,
      roleLabel: latestPayload.roleLabel,
      roleOther: latestPayload.roleOther,
      privacyConsent: latestPayload.privacyConsent,
      marketingConsent: latestPayload.marketingConsent,
      consentAt: latestPayload.consentAt,
      consentTextVersion: latestPayload.consentTextVersion,
      language: latestPayload.language,
      testVersion: latestPayload.testVersion,
      total: latestPayload.total,
      result: latestPayload.result,
      risk: latestPayload.risk,
      anticipation: latestPayload.anticipation,
      design: latestPayload.design,
      implementation: latestPayload.implementation,
      weakestArea: latestPayload.weakestArea,
      answers: latestPayload.answers,
      bookDownloadStatus: latestPayload.bookDownloadStatus,
      requestedAt: new Date().toISOString(),
      page: window.location.href
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    }
    return base;
  }


  if (consultationBtn) {
    consultationBtn.addEventListener("click", function () {
      if (!latestPayload || consultationInterestTracked) return;

      if (!CFG.phoneGate) {
        // Без phone gate заявка уходит сразу по клику — контакты уже собраны
        // на экране перед результатом.
        consultationInterestTracked = true;
        consultationBtn.textContent = "Запрос отправлен";
        consultationBtn.disabled = true;
        if (consultationStatus) {
          consultationStatus.classList.add("is-visible");
        }
        sendTrackingEvent(consultationPayload());
        return;
      }

      consultationBtn.classList.add("is-hidden");
      consultationForm.classList.add("is-visible");
      consultationPhoneInput.focus();
    });
  }


  function getPhoneData(value) {
    const phone = value.trim();
    const digits = phone.replace(/\D/g, "");
    return {
      phone: phone,
      phoneNormalized: phone.charAt(0) === "+" ? "+" + digits : digits,
      isValid: digits.length >= 10 && digits.length <= 15
    };
  }


  if (consultationPhoneInput) {
    consultationPhoneInput.addEventListener("input", function () {
      consultationForm.classList.remove("is-invalid");
      consultationPhoneInput.removeAttribute("aria-invalid");
      if (consultationStatus) {
        consultationStatus.classList.remove("is-visible", "is-error");
      }
    });
  }


  if (consultationForm) {
    consultationForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!latestPayload || consultationInterestTracked) return;

      const phoneData = getPhoneData(consultationPhoneInput.value);
      if (!phoneData.isValid) {
        consultationForm.classList.add("is-invalid");
        consultationPhoneInput.setAttribute("aria-invalid", "true");
        consultationPhoneInput.focus();
        return;
      }

      consultationForm.classList.remove("is-invalid");
      consultationPhoneInput.removeAttribute("aria-invalid");
      consultationSubmit.disabled = true;
      consultationSubmit.textContent = "Отправляем...";

      sendTrackingEvent(consultationPayload({
        phone: phoneData.phone,
        phoneNormalized: phoneData.phoneNormalized
      })).then(function (wasSent) {
        if (!wasSent) {
          consultationSubmit.disabled = false;
          consultationSubmit.textContent = "Отправить запрос";
          if (consultationStatus) {
            consultationStatus.textContent = "Не удалось отправить запрос. Попробуйте ещё раз.";
            consultationStatus.classList.add("is-visible", "is-error");
          }
          return;
        }

        consultationInterestTracked = true;
        latestPayload.phone = phoneData.phone;
        latestPayload.phoneNormalized = phoneData.phoneNormalized;
        consultationForm.classList.remove("is-visible");
        if (consultationStatus) {
          consultationStatus.textContent = "Спасибо! Запрос отправлен. Мы свяжемся с вами по указанному номеру.";
          consultationStatus.classList.remove("is-error");
          consultationStatus.classList.add("is-visible");
        }
      });
    });
  }


  document.getElementById("tsCopyResultBtn").addEventListener("click", function () {
    if (!latestPayload) return;


    const text =
      "Мой результат теста на Синдром Титаника\n\n" +
      "Общий балл: " + latestPayload.total + " из 75\n" +
      "Уровень риска: " + latestPayload.risk + "\n" +
      "Самая слабая компетенция: " + latestPayload.weakestArea + "\n\n" +
      "Компетенция 1 — Предвидение изменений: " + latestPayload.anticipation + " из 25\n" +
      "Компетенция 2 — Дизайн изменений: " + latestPayload.design + " из 25\n" +
      "Компетенция 3 — Реализация изменений: " + latestPayload.implementation + " из 25\n\n" +
      "Пройдите тест и сравните результат:\n" +
      window.location.href;


    const copyBtn = document.getElementById("tsCopyResultBtn");
    const copyNote = document.getElementById("tsCopyNote");


    navigator.clipboard.writeText(text).then(function () {
      copyBtn.textContent = "Результат скопирован";
      copyNote.classList.add("is-visible");


      setTimeout(function () {
        copyBtn.textContent = "Скопировать результат";
      }, 3500);
    });
  });


  document.getElementById("tsTeamShareBtn").addEventListener("click", function () {
    const subject = encodeURIComponent("Давайте пройдем тест на Синдром Титаника");


    const body = encodeURIComponent(
      "Предлагаю пройти короткий тест на Синдром Титаника и сравнить результаты внутри команды.\n\n" +
      "Тест помогает увидеть, где мы можем терять гибкость:\n" +
      "— в предвидении изменений;\n" +
      "— в дизайне изменений;\n" +
      "— в реализации изменений.\n\n" +
      "Ссылка на тест:\n" +
      window.location.href
    );


    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
  });


  document.getElementById("tsCertificationLink").addEventListener("click", function () {
    trackJourneyClick("certification_opened", CERTIFICATION_URL);
  });


  document.getElementById("tsTelegramLink").addEventListener("click", function () {
    trackJourneyClick("telegram_opened", TELEGRAM_URL);
  });


  document.getElementById("tsInstagramLink").addEventListener("click", function () {
    trackJourneyClick("instagram_opened", INSTAGRAM_URL);
  });


  document.getElementById("tsRestartBtn").addEventListener("click", function () {
    window.location.reload();
  });


  function showResultDesignPreview() {
    if (window.location.hash !== "#result-preview") return;

    const total = 51;
    const categoryScores = {
      anticipation: 13,
      design: 17,
      implementation: 21
    };
    const result = getResult(total);
    const anticipation = getCategoryResult(categoryScores.anticipation, "anticipation");
    const design = getCategoryResult(categoryScores.design, "design");
    const implementation = getCategoryResult(categoryScores.implementation, "implementation");

    document.getElementById("tsQuizView").style.display = "none";
    quizRoot.classList.add("is-results");
    document.getElementById("tsResultView").classList.add("is-show");
    document.getElementById("tsFinalScore").textContent = total;
    document.getElementById("tsRiskLabel").textContent = result.risk;
    document.getElementById("tsResultTitle").textContent = result.title;
    document.getElementById("tsResultText").textContent = result.text;
    document.getElementById("tsResultExplain").textContent = result.explain;

    document.getElementById("tsAnticipationScore").textContent = categoryScores.anticipation;
    document.getElementById("tsDesignScore").textContent = categoryScores.design;
    document.getElementById("tsImplementationScore").textContent = categoryScores.implementation;
    updateAreaLevel("tsAnticipationLevel", anticipation.level);
    updateAreaLevel("tsDesignLevel", design.level);
    updateAreaLevel("tsImplementationLevel", implementation.level);
    document.getElementById("tsAnticipationText").textContent = anticipation.text;
    document.getElementById("tsDesignText").textContent = design.text;
    document.getElementById("tsImplementationText").textContent = implementation.text;

    updateAreaBar("tsAnticipationBar", categoryScores.anticipation, anticipation.level);
    updateAreaBar("tsDesignBar", categoryScores.design, design.level);
    updateAreaBar("tsImplementationBar", categoryScores.implementation, implementation.level);
    updateRiskMarker(total);
    updateActiveRiskLabel(total);
    revealResultSteps();

    latestPayload = {
      total: total,
      risk: result.risk,
      weakestArea: getWeakestArea(categoryScores),
      anticipation: categoryScores.anticipation,
      design: categoryScores.design,
      implementation: categoryScores.implementation
    };

    requestAnimationFrame(function () {
      quizRoot.scrollIntoView({ block: "start" });
    });
  }


  showResultDesignPreview();
})();
