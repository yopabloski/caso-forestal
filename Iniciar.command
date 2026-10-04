#!/bin/bash
# Caso Forestal · inicia el servidor local y abre el panel en el navegador.
# Doble clic en este archivo. Para detenerlo: cierra esta ventana o presiona Ctrl + C.
cd "$(dirname "$0")" || exit 1
PUERTO=5174
while lsof -i :"$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO + 1)); done
echo ""
echo "  Caso Forestal está corriendo en http://localhost:$PUERTO"
echo "    Panel docente:           http://localhost:$PUERTO/panel.html"
echo "    Página del estudiante:   http://localhost:$PUERTO/index.html"
echo ""
echo "  Deja esta ventana abierta mientras lo uses. Para detenerlo: Ctrl + C."
echo ""
(sleep 1; open "http://localhost:$PUERTO/panel.html") &
python3 -m http.server "$PUERTO"
