# Programación Médica

Baseline listo para publicar en GitHub con frontend React/Vite y backend FastAPI/SQLAlchemy.

## Requisitos

- Node.js 18+
- Python 3.10+
- Docker Desktop o Docker Engine

## Levantar local con PostgreSQL Docker

1. Copia el template seguro:

   ```bash
   cp .env.example .env.local
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Completa al menos `SECRET_KEY` y `POSTGRES_PASSWORD` en `.env.local`.
3. Levanta PostgreSQL local:

   ```bash
   docker compose --env-file .env.local up -d postgres
   ```

4. Instala dependencias:

   ```bash
   npm install
   python -m pip install -r requirements.txt
   ```

5. Inicia el backend y el frontend en terminales separadas:

   ```bash
   python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
   npm run dev
   ```

## Verificaciones sin build

```bash
python -m pytest
npm run test:run
npm run check
```

## Notas de seguridad

- `.env` queda solo como template seguro.
- Los secretos reales van en `.env.local`.
- Swagger/ReDoc se muestran solo en local/dev, salvo que `EXPOSE_API_DOCS=true`.

## CI

El repositorio incluye `.github/workflows/security-readiness.yml` con checks mínimos de GitHub Actions para:

- `python -m pytest`
- `npm run test:run`
- `npm run check`

## Documentación adicional

- `DOCUMENTATION.md` — arquitectura, seguridad y operación local.
- `NoNecesario/` — archivo local ignorado con scripts, migraciones y documentación secundaria fuera del baseline publicable.
