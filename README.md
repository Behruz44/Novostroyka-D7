# Стройконтроль

Веб-платформа контроля строительства для владельца-девелопера.
Пилотный объект: 8-этажный паркинг.

## Ядро ценности

Сверка трёх потоков: **ДЕНЬГИ** (расходы/чеки) ↔ **ФАКТ** (фото этапов) ↔ **ПЛАН** (график и бюджет).
Если деньги обгоняют подтверждённый прогресс — красный флаг сразу.

## Стек

- Next.js 14 (App Router, TypeScript strict)
- PostgreSQL + Prisma ORM
- S3-совместимое хранилище (MinIO локально / Cloudflare R2 прод)
- Auth.js (credentials + роли, JWT)
- Vitest для тестов
- Docker Compose для локальной разработки

## Быстрый старт

```bash
# 1. Скопировать env
cp .env.example .env

# 2. Поднять инфраструктуру (postgres + minio)
docker compose up -d postgres minio

# 3. Установить зависимости
npm install

# 4. Применить миграции
npx prisma migrate dev

# 5. Запустить dev-сервер
npm run dev
```

## Проверка здоровья

```bash
curl http://localhost:3000/api/health
# {"ok":true,"db":true}
```

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript проверка типов |
| `npm run test` | Vitest (однократный прогон) |
| `npm run test:watch` | Vitest (watch mode) |
| `npm run db:migrate` | Prisma миграции |
| `npm run db:reset` | Сброс БД + миграции с нуля |
| `npm run db:seed` | Сид-данные |
| `npm run db:studio` | Prisma Studio |

## Docker

```bash
# Полный стек (app + postgres + minio)
docker compose up --build

# Только инфраструктура
docker compose up postgres minio
```

## Структура проекта

```
src/
  app/           # Next.js App Router (pages, layouts, API routes)
    (auth)/      # Страницы авторизации (Stage 1)
    (owner)/     # Интерфейс владельца (Stage 3+)
    (foreman)/   # Интерфейс прораба (Stage 2+)
    api/         # API routes
  lib/           # Утилиты (db, auth, storage)
  services/      # Бизнес-логика
  hooks/         # React hooks
  components/    # UI-компоненты
prisma/
  schema.prisma  # Схема БД
  seed.ts        # Сид-данные
```
