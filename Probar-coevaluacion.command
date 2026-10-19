#!/bin/bash
# Caso Forestal · prueba la auto y coevaluación en este Mac.
# 1) Corre las pruebas de dominio y de reglas de Firestore (emulador local).
# 2) Abre la página del estudiante y el panel en MODO DEMO (no toca Firebase real).
# Doble clic en este archivo. Para detener el servidor: cierra la ventana o Ctrl + C.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"
LOG="pruebas-coevaluacion.log"
{
  echo "== $(date) =="
  echo "== Pruebas de dominio =="
  npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"
  echo "== Pruebas de reglas (emulador) =="
  npm run test:reglas 2>&1 | grep -vE "^\s*$" | tail -40
} 2>&1 | tee "$LOG"
echo ""
echo "  Resultado guardado en $LOG"
PUERTO=5174
while lsof -i :"$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO + 1)); done
echo ""
echo "  Modo demo en http://localhost:$PUERTO"
echo "    Estudiante:  http://localhost:$PUERTO/coevaluacion.html?demo=1   (demo1@udd.cl, cualquier RUT válido, clave DEMO-A-COEV1)"
echo "    Panel:       http://localhost:$PUERTO/coevaluacion-panel.html?demo=1   (botón «Cargar datos de ejemplo»)"
echo ""
(sleep 1; open "http://localhost:$PUERTO/coevaluacion-panel.html?demo=1"; sleep 1; open "http://localhost:$PUERTO/coevaluacion.html?demo=1") &
python3 -m http.server "$PUERTO"
