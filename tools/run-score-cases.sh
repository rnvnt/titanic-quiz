#!/bin/bash
# Прогоняет скоринг по наборам ответов и печатает таблицу.
# Использование: tools/run-score-cases.sh <путь к preview-individual.html>
set -u
B="$HOME/.claude/skills/gstack/browse/dist/browse"
PAGE="${1:?укажи путь к preview-individual.html}"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/qa-score.js"

# набор:ожидаемый уровень
CASES="
000000000000000:Низкий
111111111111111:Низкий
111111111111112:Умеренный
222222222222233333:пропуск
222222222222222:Умеренный
222222222233333:Умеренный
222222222233334:Высокий
333333333333333:Высокий
333334444444444:Высокий
333344444444444:Критический
555555555555555:Критический
"

printf '%-17s %6s %6s %-10s %s\n' "ОТВЕТЫ" "ОЖИД" "ПОКАЗ" "ЗОНЫ" "ТЕКСТ РЕЗУЛЬТАТА"
for case in $CASES; do
  pattern="${case%%:*}"
  [ ${#pattern} -eq 15 ] || continue

  timeout 40 "$B" goto "file://${PAGE}#qa=${pattern}" >/dev/null 2>&1
  timeout 30 "$B" reload >/dev/null 2>&1
  timeout 40 "$B" eval "$SCRIPT" >/dev/null 2>&1

  for _ in $(seq 1 40); do
    ready=$(timeout 40 "$B" js "'RDY:'+String(window.__QA_SCORE.done)" 2>&1 | grep -o 'RDY:[a-z]*' | head -1)
    [ "$ready" = "RDY:true" ] && break
    sleep 0
  done

  out=$(timeout 40 "$B" js "'RES:'+window.__QA_SCORE.expectedTotal+'~'+window.__QA_SCORE.shownTotal+'~'+window.__QA_SCORE.expectedParts+'~'+window.__QA_SCORE.shownParts+'~'+window.__QA_SCORE.title" 2>&1 | grep -o 'RES:.*' | head -1)
  out="${out#RES:}"
  exp="${out%%~*}"; rest="${out#*~}"
  shown="${rest%%~*}"; rest="${rest#*~}"
  eparts="${rest%%~*}"; rest="${rest#*~}"
  sparts="${rest%%~*}"; rest="${rest#*~}"
  title="${rest%%~*}"
  err=$(timeout 30 "$B" js "'ERR:'+String(window.__QA_SCORE.error||'-')" 2>&1 | grep -o 'ERR:.*' | head -1)
  [ "$err" = "ERR:-" ] || title="$title  [$err]"

  mark=""
  [ "$exp" = "$shown" ] || mark="  ❌ БАЛЛ"
  [ "$eparts" = "$sparts" ] || mark="$mark  ❌ ЗОНЫ ($eparts ждали, $sparts показано)"
  printf '%-17s %6s %6s %-10s %s%s\n' "$pattern" "$exp" "$shown" "$sparts" "$title" "$mark"
done
