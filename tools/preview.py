#!/usr/bin/env python3
"""Локальные страницы для проверки сборки до выкладки на хостинг.

  python3 tools/preview.py

Создаёт dist/preview-individual.html и dist/preview-group.html — те же
сниппеты, что уходят в Tilda, но со ссылками на соседние файлы. Открывать
как file:///Users/dima/titanic-quiz/dist/preview-individual.html
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

PAGE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Предпросмотр: %(title)s</title>
<style>
  body { margin: 0; background: #fff; }
  /* Имитируем фиксированную шапку Tilda — под неё считаны отступы квиза. */
  .fake-tilda-header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 900;
    height: 80px; display: flex; align-items: center; padding: 0 24px;
    background: #fff; border-bottom: 1px solid #eee;
    font: 600 15px/1 Arial, sans-serif; color: #555;
  }
</style>
</head>
<body>
<div class="fake-tilda-header">Предпросмотр · %(title)s · шапка Tilda 80px</div>
%(snippet)s
</body>
</html>
"""

TITLES = {"individual": "индивидуальный тест", "group": "групповая сессия"}


def main():
    if not os.path.isdir(DIST):
        sys.exit("Сначала запусти python3 build.py")

    for kind, title in TITLES.items():
        src = os.path.join(DIST, "tilda-%s.html" % kind)
        snippet = open(src, encoding="utf-8").read()
        # тот же сниппет, но файлы берём из соседней папки, а не с хостинга
        snippet = re.sub(r'https://[^"]*?/(core|individual|group|session)\.(css|js)',
                         r"./\1.\2", snippet)
        out = os.path.join(DIST, "preview-%s.html" % kind)
        open(out, "w", encoding="utf-8").write(PAGE % {"title": title, "snippet": snippet})
        print("file://%s" % out)

    print("\nГрупповая: хост-панель открывается только с ?host=1&hostKey=<ключ>,")
    print("страница участника — с ?session=<код>.")


if __name__ == "__main__":
    main()
