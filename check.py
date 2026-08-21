#!/usr/bin/env python3
"""Сверяет, что стоит в Tilda прямо сейчас, с тем, что лежит в src/.

  python3 check.py

Пока обе страницы не переведены на подключаемое ядро, скрипт показывает,
насколько живые версии разошлись между собой и с источником. После перевода
проверка становится однострочной: обе страницы должны ссылаться на dist/.
"""
import difflib
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")

GROUP_URL = "https://reinventionacademy.kz/titanic-group-test"
INDIVIDUAL_URL = "https://reinventionacademy.kz/titanic-syndrome-quiz"

GREEN, RED, YELLOW, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[0m"


def norm(s):
    """Сравниваем без учёта отступов: Tilda срезает ведущие пробелы."""
    return [l.strip() for l in s.split("\n") if l.strip()]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "titanic-quiz-check"})
    return urllib.request.urlopen(req, timeout=60).read()


def blocks(s, tag):
    out = {}
    for m in re.finditer(r"<%s\b([^>]*)>(.*?)</%s>" % (tag, tag), s, re.S):
        idm = re.search(r'id="([^"]+)"', m.group(1))
        out.setdefault(idm.group(1) if idm else "", []).append(m.group(2))
    return out


def uses_hosted_core(page):
    return "titanicQuizRoot" in page and re.search(r'<script src="[^"]+/core\.js"', page)


def compare(label, live, source):
    live_n, src_n = norm(live), norm(source)
    if live_n == src_n:
        print("  %s%-28s совпадает с src/%s" % (GREEN, label, RESET))
        return 0
    diff = list(difflib.unified_diff(src_n, live_n, "src", "живая", lineterm="", n=0))
    changed = len([l for l in diff if l[:1] in "+-" and l[:3] not in ("---", "+++")])
    print("  %s%-28s расходится: %d строк%s" % (RED, label, changed, RESET))
    for l in diff[2:12]:
        print("      %s" % l)
    if len(diff) > 12:
        print("      … ещё %d строк" % (len(diff) - 12))
    return 1


def check_page(label, url, with_skin):
    print("%s (%s):" % (label, url))
    try:
        page = fetch(url).decode("utf-8")
    except Exception as e:
        print("  %sстраница недоступна: %s%s" % (YELLOW, e, RESET))
        return 0

    if uses_hosted_core(page):
        print("  %sподключает ядро с хостинга — сверять нечего%s" % (GREEN, RESET))
        return 0

    problems = 0
    st, sc = blocks(page, "style"), blocks(page, "script")
    base = [b for k, v in st.items() if not k for b in v if len(b) > 5000]
    if base:
        problems += compare("базовый CSS", base[0], open(os.path.join(SRC, "core/quiz.css"), encoding="utf-8").read())
    if with_skin:
        if "ts-skin-v2" in st:
            problems += compare("skin", st["ts-skin-v2"][0], open(os.path.join(SRC, "core/skin.css"), encoding="utf-8").read())
        if "ts-result-design-preview" in st:
            problems += compare("result CSS", st["ts-result-design-preview"][0], open(os.path.join(SRC, "core/result.css"), encoding="utf-8").read())
    quiz_js = [b for k, v in sc.items() if not k for b in v if "SHEET_ENDPOINT" in b]
    if quiz_js:
        problems += compare("JS квиза", quiz_js[0], open(os.path.join(SRC, "core/quiz.js"), encoding="utf-8").read())
    return problems


def main():
    print("Сверяю живые страницы с src/\n")
    problems = 0
    problems += check_page("Групповая", GROUP_URL, with_skin=True)
    print()
    problems += check_page("Индивидуальная", INDIVIDUAL_URL, with_skin=False)

    print()
    if problems:
        print("%sРасхождений: %d. Пока страницы не переведены на подключаемое ядро,"
              " это ожидаемо.%s" % (YELLOW, problems, RESET))
    else:
        print("%sЖивые страницы и src/ сходятся.%s" % (GREEN, RESET))


if __name__ == "__main__":
    main()
