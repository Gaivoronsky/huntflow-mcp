# @theyahia/huntflow-mcp

MCP-сервер для HuntFlow ATS API — вакансии, кандидаты, резюме, этапы, комментарии, аккаунты. **11 инструментов, 2 скилла.**

[![npm](https://img.shields.io/npm/v/@theyahia/huntflow-mcp)](https://www.npmjs.com/package/@theyahia/huntflow-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Часть серии [Russian API MCP](https://github.com/theYahia/russian-mcp) (50 серверов).

## Установка

### Claude Desktop (stdio)
```json
{
  "mcpServers": {
    "huntflow": {
      "command": "npx",
      "args": ["-y", "@theyahia/huntflow-mcp"],
      "env": { "HUNTFLOW_TOKEN": "ваш-токен" }
    }
  }
}
```

### Streamable HTTP
```bash
HUNTFLOW_TOKEN=ваш-токен npx @theyahia/huntflow-mcp --http
# POST /mcp, GET /health на порту 3000 (PORT=...)
```

### Smithery
```bash
npx @smithery/cli install @theyahia/huntflow-mcp
```

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|:---:|----------|
| `HUNTFLOW_TOKEN` | да | API токен (Настройки → API) |
| `HUNTFLOW_BASE_URL` | нет | По умолчанию `https://api.huntflow.ru/v2`. Для международного аккаунта — `https://api.huntflow.ai/v2` |
| `HUNTFLOW_USER_AGENT` | нет | Заголовок User-Agent (HuntFlow требует его). Дефолт `huntflow-mcp/<версия> (+repo)`; рекомендуется указать контактный email |
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
| `add_applicant_comment` | ✍️ Добавить комментарий (**запись**; правка/удаление через API недоступны) |

## Скиллы (Prompts)

| Скилл | Описание |
|-------|----------|
| `skill-applicants` | Кандидаты на вакансию — таблица с этапами и сводкой |
| `skill-vacancy-stats` | Статистика по вакансии — воронка, сроки, конверсия |

## Разработка

```bash
npm install
npm test           # vitest
npm run dev        # tsx src/index.ts
npm run build      # tsc
```

## Лицензия
MIT
