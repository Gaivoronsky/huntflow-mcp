# huntflow-mcp

MCP-сервер для [HuntFlow](https://huntflow.ru) ATS API v2 — вакансии, кандидаты, резюме, этапы воронки, причины отказа, комментарии, аккаунты. **11 инструментов, 2 промпта.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Работает с HuntFlow v2 (`api.huntflow.ru` для РФ или `api.huntflow.ai` для международных аккаунтов). Транспорты: **stdio** и **streamable HTTP**. Все данные read-only, кроме добавления комментариев.

## Установка (из исходника)

```bash
git clone https://github.com/Gaivoronsky/huntflow-mcp.git
cd huntflow-mcp
npm install
npm run build      # → dist/
```

Сборка кладёт исполняемый код в `dist/`. Запускается через `node dist/index.js`.

### Подключение к Claude Desktop

В `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`):

```json
{
  "mcpServers": {
    "huntflow": {
      "command": "/абсолютный/путь/к/node",
      "args": ["/абсолютный/путь/к/huntflow-mcp/dist/index.js"],
      "env": {
        "HUNTFLOW_TOKEN": "ваш-токен",
        "HUNTFLOW_BASE_URL": "https://api.huntflow.ai/v2"
      }
    }
  }
}
```

> Claude Desktop запускается из GUI и не наследует `PATH` оболочки — указывайте **абсолютный** путь к `node` (например, из nvm: `~/.nvm/versions/node/<версия>/bin/node`). После правки конфига полностью перезапустите приложение (⌘Q и заново).

### Streamable HTTP

```bash
HUNTFLOW_TOKEN=ваш-токен node dist/index.js --http
# POST /mcp, GET /health на порту 3000 (переопределяется PORT=...)
```

## Получение токена

1. В HuntFlow: **Настройки → API → Добавить токен**.
2. Система выдаст ссылку вида `https://huntflow.ai/token_request/<hash>`. **Не переходите по ней «просто так»** — это её деактивирует. Откройте в браузере под своим аккаунтом и нажмите **Receive** («Получить»).
3. Полученный `access_token` (длинная строка) кладётся в `HUNTFLOW_TOKEN`.

> `access_token` живёт 7 дней, `refresh_token` — 14. Сервер токен не обновляет автоматически — по истечении переполучите токен заново.

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|:---:|----------|
| `HUNTFLOW_TOKEN` | да | API-токен (Настройки → API) |
| `HUNTFLOW_BASE_URL` | нет | По умолчанию `https://api.huntflow.ru/v2`. Для международного аккаунта — `https://api.huntflow.ai/v2` |
| `HUNTFLOW_USER_AGENT` | нет | Заголовок `User-Agent` (HuntFlow его требует). Дефолт `huntflow-mcp/<версия> (+repo)`; рекомендуется указать контактный email |
| `PORT` | нет | Порт HTTP-сервера (по умолчанию 3000) |

## Инструменты (11)

| Инструмент | Описание |
|------------|----------|
| `list_accounts` | Список доступных аккаунтов |
| `list_vacancies` | Список вакансий (открытые/все), пагинация `page`/`count` |
| `get_vacancy` | Полная информация о вакансии |
| `list_applicants` | Кандидаты с фильтром по `vacancy`/`status`, пагинация (`count`≤30) |
| `search_applicants` | Текстовый поиск кандидатов (`q`, `field`), пагинация (`count`≤100) |
| `get_applicant` | Полная карточка кандидата (`external[]`, `links[]`) |
| `get_applicant_resume` | Резюме (CV) с телом по `external_id` (из `get_applicant`) |
| `list_stages` | Этапы воронки подбора (статусы): код → название |
| `list_rejection_reasons` | Справочник причин отказа: код → название |
| `list_applicant_comments` | Комментарии о кандидате (журнал, по умолчанию `type=COMMENT`) |
| `add_applicant_comment` | ✍️ Добавить комментарий (**запись**; правка/удаление через API HuntFlow недоступны) |

## Промпты (2)

MCP-промпты для типовых сценариев рекрутинга:

| Промпт | Описание |
|-------|----------|
| `skill-applicants` | Кандидаты на вакансию — таблица с этапами и сводкой |
| `skill-vacancy-stats` | Статистика по вакансии — воронка, сроки, конверсия |

## Разработка

```bash
npm install
npm test           # vitest (unit-тесты, мок fetch)
npm run dev        # tsx src/index.ts (запуск из TS без сборки)
npm run build      # tsc → dist/
```

Структура: тонкий HTTP-клиент `src/client.ts` (Bearer + User-Agent, проброс тела ошибок API, ретраи только для GET), инструменты в `src/tools/*.ts`, сборка сервера в `src/index.ts`.

## Лицензия

MIT. Основано на [theYahia/huntflow-mcp](https://github.com/theYahia/huntflow-mcp) (MIT) с доработками под реальный HuntFlow v2 API.
