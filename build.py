#!/usr/bin/env python3
"""Собирает из src/ то, что выкладывается на хостинг, и сниппеты для Tilda.

  python3 build.py            — собрать dist/
  python3 build.py --snippet individual   — положить сниппет T123 в буфер обмена
  python3 build.py --snippet group

Ядро (core/) одно на обе версии. Различия — только в слоях individual/ и group/
и в window.TS_CONFIG внутри сниппета.
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")

# Куда выложен dist/. Меняется в одном месте — сниппеты пересоберутся сами.
BASE_URL = "https://titanic-quiz.netlify.app"

CORE_CSS = ["core/quiz.css", "core/skin.css", "core/result.css"]

FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800;900'
         '&amp;family=Montserrat:wght@500;600;700;800&amp;display=swap" rel="stylesheet">')


def read(rel):
    return open(os.path.join(SRC, rel), encoding="utf-8").read()


def write(name, text):
    os.makedirs(DIST, exist_ok=True)
    p = os.path.join(DIST, name)
    open(p, "w", encoding="utf-8").write(text)
    print("  %-22s %7d B" % (name, len(text)))


def banner(title):
    return "/* ===== %s ===== */\n" % title


def build_css():
    parts = [banner(f) + read(f) for f in CORE_CSS]
    write("core.css", "\n\n".join(parts))
    write("individual.css", read("individual/individual.css"))
    write("group.css", read("group/group.css"))


def inject_markup(js, placeholder, markup_rel):
    markup = read(markup_rel)
    if placeholder not in js:
        sys.exit("В %s нет плейсхолдера %s" % (markup_rel, placeholder))
    return js.replace('"%s"' % placeholder, json.dumps(markup))


def build_js():
    core = read("core/quiz.js")
    core = inject_markup(core, "__QUIZ_MARKUP__", "core/quiz.html")
    write("core.js", core)

    session = read("group/session.js")
    session = inject_markup(session, "__HOST_MARKUP__", "group/host.html")
    write("session.js", session)


def snippet(kind):
    cfg = {
        "individual": {"testVersion": "tilda_ru_post_result_flow_v3_phone", "phoneGate": True},
        # Метку групповой не меняем — по ней уже собрана выгрузка в Google Sheet.
        "group": {"testVersion": "tilda_ru_post_result_flow_v2", "phoneGate": False},
    }[kind]

    lines = [
        "<!-- Тест на Синдром Титаника — %s версия." % ("индивидуальная" if kind == "individual" else "групповая"),
        "     Этот блок менять не нужно: и разметка, и логика приезжают с %s." % BASE_URL,
        "     Правки делаются в ~/titanic-quiz/src и выкладываются заново. -->",
        FONTS,
        '<link rel="stylesheet" href="%s/core.css">' % BASE_URL,
        '<link rel="stylesheet" href="%s/%s.css">' % (BASE_URL, kind),
    ]
    if kind == "group":
        lines.append('<div id="titanicQuizHostRoot"></div>')
    lines += [
        '<div id="titanicQuizRoot"></div>',
        "<script>window.TS_CONFIG = %s;</script>" % json.dumps(cfg, ensure_ascii=False),
        '<script src="%s/core.js" defer></script>' % BASE_URL,
    ]
    if kind == "group":
        lines.append('<script src="%s/session.js" defer></script>' % BASE_URL)
    return "\n".join(lines) + "\n"


def build_snippets():
    for kind in ("individual", "group"):
        write("tilda-%s.html" % kind, snippet(kind))


def build_headers():
    # Netlify: статика всегда перепроверяется, чтобы правка доезжала сразу.
    write("_headers", "/*\n  Cache-Control: public, max-age=0, must-revalidate\n"
                      "  Access-Control-Allow-Origin: *\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snippet", choices=["individual", "group"],
                    help="положить сниппет T123 в буфер обмена")
    args = ap.parse_args()

    if args.snippet:
        text = snippet(args.snippet)
        subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
        print("Сниппет %s в буфере обмена — вставь в блок T123." % args.snippet)
        return

    print("Собираю dist/:")
    build_css()
    build_js()
    build_snippets()
    build_headers()
    print("\nГотово. Выложи папку dist/ на хостинг (%s)." % BASE_URL)


if __name__ == "__main__":
    main()
