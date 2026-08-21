#!/usr/bin/env python3
"""Разовая раскладка двух живых версий квиза на общее ядро + слои версий.

Запускался один раз 2026-08-12, чтобы получить src/ из того, что стояло в Tilda:
  - индивидуальная: outputs/titanic-syndrome-quiz-phone.html (сохранённый DOM страницы)
  - групповая: export-zip проекта reinventionacademy, блоки T123

Дальше источник правды — src/. Скрипт оставлен для воспроизводимости разбора.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")

IND_PATH = ("/Users/dima/Documents/Codex/2026-08-12/"
            "https-reinventionacademy-kz-titanic-syndrome-quiz/outputs/"
            "titanic-syndrome-quiz-phone.html")
GROUP_ZIP = ("https://export.tildacdn.com/export/zips/"
             "reinventionacademy_68333d18a492b16a1d32fb363a8c748efe032b84.zip")

BLOCK_TYPES = ["style", "script"]


def strip_wrapper(s):
    i = s.find("<!-- nominify begin -->")
    if i >= 0:
        s = s[i + len("<!-- nominify begin -->"):]
    j = s.rfind("<!-- nominify end -->")
    if j >= 0:
        s = s[:j]
    return s


def blocks(s, tag):
    out = []
    for m in re.finditer(r"<%s\b([^>]*)>(.*?)</%s>" % (tag, tag), s, re.S):
        idm = re.search(r'id="([^"]+)"', m.group(1))
        out.append((idm.group(1) if idm else "", m.group(2)))
    return out


def markup_only(s):
    s = re.sub(r"<style\b[^>]*>.*?</style>", "", s, flags=re.S)
    s = re.sub(r"<script\b[^>]*>.*?</script>", "", s, flags=re.S)
    s = re.sub(r"<(meta|link)\b[^>]*>", "", s)
    return s.strip()


BLOCK_TAGS = ("div", "section", "header", "footer", "form", "fieldset", "table",
              "thead", "tbody", "tr", "td", "th", "ul", "ol", "li", "p", "h1",
              "h2", "h3", "h4", "button", "label", "input", "textarea", "select")


def pretty_html(s):
    """Переносы только перед блочными тегами — inline-разметку и текст не трогаем."""
    for t in BLOCK_TAGS:
        s = re.sub(r"\s*<%s\b" % t, "\n<%s" % t, s)
        s = re.sub(r"\s*</%s>" % t, "\n</%s>" % t, s)
    lines = [l.rstrip() for l in s.split("\n")]
    out, depth = [], 0
    for l in lines:
        if not l.strip():
            continue
        if l.startswith("</"):
            depth = max(0, depth - 1)
        out.append("  " * depth + l.strip())
        m = re.match(r"^<([a-zA-Z0-9]+)", l)
        if m and not l.startswith("</") and not l.endswith("/>"):
            tag = m.group(1)
            closed_inline = re.search(r"</%s>\s*$" % tag, l)
            if tag in BLOCK_TAGS and tag not in ("input",) and not closed_inline:
                depth += 1
    return "\n".join(out) + "\n"


def fetch_group(workdir):
    zp = os.path.join(workdir, "group.zip")
    if not os.path.exists(zp):
        urllib.request.urlretrieve(GROUP_ZIP, zp)
    with zipfile.ZipFile(zp) as z:
        z.extractall(os.path.join(workdir, "group"))
    page = None
    for base, _, files in os.walk(os.path.join(workdir, "group")):
        for f in files:
            if re.match(r"page\d+\.html$", f):
                page = os.path.join(base, f)
    return open(page, encoding="utf-8").read()


def split_recs(src):
    parts = re.split(r'(<div id="rec\d+")', src)
    recs = {}
    for i in range(1, len(parts), 2):
        rid = re.search(r"rec(\d+)", parts[i]).group(1)
        recs[rid] = parts[i] + parts[i + 1]
    return recs


def write(rel, text):
    p = os.path.join(SRC, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text if text.endswith("\n") else text + "\n")
    print("  %-34s %6d B" % (rel, len(text)))


def main():
    work = os.path.join(ROOT, ".work")
    os.makedirs(work, exist_ok=True)

    ind = strip_wrapper(open(IND_PATH, encoding="utf-8").read())
    grp_page = fetch_group(work)
    recs = split_recs(grp_page)

    grp_css = strip_wrapper(recs["2952667501"])
    grp_html = strip_wrapper(recs["2952845501"])
    grp_js = strip_wrapper(recs["2952849401"])
    grp_gs = strip_wrapper(recs["2952849201"])

    ind_styles = dict((i or "base_%d" % n, b)
                      for n, (i, b) in enumerate(blocks(ind, "style")))
    grp_styles = dict((i or "base_%d" % n, b)
                      for n, (i, b) in enumerate(blocks(grp_css, "style")))

    ind_base = [b for i, b in blocks(ind, "style") if not i and len(b) > 1000][0]
    ind_skin = dict(blocks(ind, "style"))["ts-skin-v2"]
    ind_result = dict(blocks(ind, "style"))["ts-result-design-preview"]
    ind_js = blocks(ind, "script")[0][1]

    grp_group_styles = dict(blocks(grp_css, "style"))["ts-group-session-styles"]
    grp_session_js = dict(blocks(grp_gs, "script"))["ts-group-session-controller"]

    print("Читаю живые версии:")
    print("  индивидуальная  base=%d skin=%d result=%d js=%d"
          % (len(ind_base), len(ind_skin), len(ind_result), len(ind_js)))
    print("  групповая       group.css=%d session.js=%d"
          % (len(grp_group_styles), len(grp_session_js)))
    print("Пишу src/:")

    # --- разметка: берём групповую (она из Tilda, без сериализованного DOM),
    #     вычитаем host-панель и отчёт -> они уходят в group/host.html
    gm = markup_only(grp_html)
    host_parts = []
    for host_id in ("tsHostApp", "tsReportApp"):
        m = re.search(r'<div class="ts-host-app[^"]*" id="%s">' % host_id, gm)
        start = m.start()
        depth, i = 0, start
        while i < len(gm):
            if gm.startswith("<div", i):
                depth += 1
            elif gm.startswith("</div>", i):
                depth -= 1
                if depth == 0:
                    i += len("</div>")
                    break
            i += 1
        host_parts.append(gm[start:i])
        gm = gm[:start] + gm[i:]

    write("core/quiz.html", pretty_html(gm.strip()))
    write("group/host.html", pretty_html("\n".join(host_parts)))
    write("group/group.css", grp_group_styles.strip())
    write("group/session.js", grp_session_js.strip())
    write("core/skin.css", ind_skin.strip())
    write("core/quiz.css", ind_base.strip())
    write("core/result.css", ind_result.strip())
    write("core/quiz.js", ind_js.strip())


if __name__ == "__main__":
    main()
