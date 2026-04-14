#!/usr/bin/env sh

set -eu

REMOTE_HOST="10.6.70.225"
REMOTE_USER="pedro"
REMOTE_PATH="/var/www/programacion-test"
EXCLUDE_FILE="rsync-exclude.txt"

if [ "$#" -gt 1 ]; then
  echo "Uso: $0 [directorio-local]"
  echo "Ejemplo: $0 ./"
  exit 1
fi

# Si no pasas parámetro, usa el directorio actual
LOCAL_PATH="${1:-./}"

# Obtener ruta del script
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# Validar archivo exclude
if [ ! -f "$SCRIPT_DIR/$EXCLUDE_FILE" ]; then
  echo "❌ No existe el archivo de exclusión: $SCRIPT_DIR/$EXCLUDE_FILE"
  exit 1
fi

echo "📦 Sincronizando archivos..."
rsync -rlzv --delete \
  --no-group --no-perms \
  --exclude-from="$SCRIPT_DIR/$EXCLUDE_FILE" \
  "$LOCAL_PATH" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

echo "🚀 Ejecutando deploy remoto..."

ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e

cd /var/www/programacion-test

echo "🔧 Activando entorno virtual..."
source venv/bin/activate

echo "📊 Ejecutando migraciones..."
alembic upgrade head

echo "🔄 Reiniciando servicio..."
sudo systemctl restart programacion-api

echo "✅ Deploy completado!"
EOF

echo "🎉 Todo listo!"