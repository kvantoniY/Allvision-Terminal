# Allvision Terminal: учёт ставок и социальная лента

Приложение для ведения банка и истории спортивных ставок. Пользователь создаёт сессию с начальной суммой, добавляет ставки, отмечает результат и смотрит изменение банка. Внутри также есть лента публикаций, профили, подписки и личные сообщения.

## Что сделано

- Сессии банка, история ставок, расчёт результата и графики.
- Расчёт размера ставки по заданным параметрам риска.
- Регистрация, вход, настройки профиля и приватности.
- Публикации, лайки и комментарии.
- Личные сообщения, уведомления и присутствие пользователей через Socket.IO.
- Миграции PostgreSQL и документация API в Swagger.

## Как устроен проект

Frontend: Next.js 14 App Router, React, Redux Toolkit и RTK Query. Backend: Express, Sequelize, PostgreSQL, Socket.IO и Zod. Клиент получает данные через REST, а события общения приходят через WebSocket.

| Путь | Назначение |
| --- | --- |
| `frontend/src/app` | Страницы приложения |
| `frontend/src/shared/lib/api` | RTK Query API |
| `frontend/src/shared/ui` | Общие компоненты и графики |
| `backend/src/modules/terminal` | Сессии, ставки и расчёты |
| `backend/src/modules` | Авторизация, лента, сообщения и другие модули |
| `backend/src/db/migrations` | Изменения схемы PostgreSQL |
| `backend/docs/openapi.yaml` | Контракт API |

## Запуск

Нужны Node.js 24, npm и Docker с Compose.

```bash
git clone https://github.com/kvantoniY/Allvision-Terminal.git
cd Allvision-Terminal
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d --wait
npm ci --prefix backend
npm ci --prefix frontend
npm run db:migrate --prefix backend
npm start --prefix backend
```

Во втором терминале:

```bash
npm run dev --prefix frontend
```

Сайт: http://localhost:3000. Проверка API: http://localhost:4000/health. PostgreSQL: локальный порт 55432.

В Windows PowerShell используйте `Copy-Item` вместо `cp`. Если PowerShell блокирует `npm.ps1`, запускайте `npm.cmd` вместо `npm`.

## Что проверить

1. Зарегистрируйтесь на `/register`.
2. В разделе `/terminal` создайте сессию с условным банком 10 000.
3. Добавьте ставку и отметьте результат. Проверьте баланс и историю.
4. Создайте публикацию, откройте профиль, отправьте сообщение второму тестовому пользователю.

Сборка: `npm run build --prefix frontend`. Результаты проверки: [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Границы проекта

Приложение ведёт записи пользователя и выполняет расчёты. Интеграции с букмекером и приёма реальных денег нет. Формула размера ставки не прогнозирует исход события. Для демо используйте условные суммы.
