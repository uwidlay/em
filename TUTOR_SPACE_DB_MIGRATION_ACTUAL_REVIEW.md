# TUTOR-SPACE: ревью фактической миграции `0001_init.sql`

Проверяемый файл:

- [supabase/migrations/0001_init.sql](/Users/olazavalisina/Documents/сайт/supabase/migrations/0001_init.sql)

Источники:

- [TUTOR_SPACE_SPEC.md](/Users/olazavalisina/Documents/сайт/TUTOR_SPACE_SPEC.md)
- [TUTOR_SPACE_REQUIREMENTS.md](/Users/olazavalisina/Documents/сайт/TUTOR_SPACE_REQUIREMENTS.md)
- [TUTOR_SPACE_PROJECT_ONBOARDING.md](/Users/olazavalisina/Documents/сайт/TUTOR_SPACE_PROJECT_ONBOARDING.md)
- [TUTOR_SPACE_ARCHITECTURE.md](/Users/olazavalisina/Documents/сайт/TUTOR_SPACE_ARCHITECTURE.md)

## 1. Общий вывод

| Область | Итог |
|---|---|
| Покрытие MVP-сущностей | В целом покрыто: репетиторы, ученики, полезные ссылки, уроки, материалы, сдачи Д/З, фото, события обновлений. |
| Post-MVP scope | Лишних Post-MVP сущностей не найдено: нет подписок, платежей, админки, экспорта, SMS, внешних уведомлений, мультиязычности и multi-tutor связи. |
| RLS для репетитора | Базовый подход покрыт, но есть риск с physical delete уроков и недостающие операции для фото/сдач, если они понадобятся не только через service role. |
| Доступ ученика по токену | Не реализован в миграции, только оставлен комментарий. Это допустимо, если токен-поток будет реализован через Edge Function/RPC, но без него MVP-сценарий ученика не завершен. |
| Storage | Приватный bucket создан, read-policy для репетитора есть. Upload/read для ученика по токену не реализован и должен быть в Edge Function/RPC/Storage policy. |
| Проверка SQL | Локально не выполнена: `psql` и `supabase` CLI отсутствуют в окружении. |

## 2. Findings

| ID | Приоритет | Файл / строки | Замечание | Почему важно | Рекомендация |
|---|---|---|---|---|---|
| F-001 | Blocker | `0001_init.sql`:343-344, 536-538 | Ученический доступ по токену и upload/read фото учеником не реализованы, только описаны комментариями. | Главный MVP-сценарий ученика: открыть профиль по ссылке и сдать Д/З с фото. Без RPC/Edge Function или эквивалентного безопасного слоя этот сценарий не работает end-to-end. | Создать отдельную миграцию/RPC и/или Edge Function contract: проверка token hash, выдача профиля ученика, создание сдачи, запись фото metadata, смена статуса Д/З, событие/бейдж. |
| F-002 | Major | `0001_init.sql`:139, 441-446 | В таблице есть `deleted_at` для soft delete уроков, но RLS разрешает physical `DELETE` уроков. | Архитектура рекомендует soft delete, чтобы случайное удаление не разрушало учебную историю. Наличие delete-policy делает физическое удаление доступным через API. | Убрать delete-policy для `lessons` или оставить только для service role. Для репетитора использовать update `deleted_at = now()`. |
| F-003 | Major | `0001_init.sql`:173-185, 477-490 | Для `homework_submissions` есть select/update для репетитора, но нет insert для ученика/secure flow в SQL. | Это нормально для Edge Function, но миграция сама по себе не завершает модель сдачи Д/З. Также update-policy для репетитора потенциально шире, чем нужно: репетитор по ТЗ проверяет работу через статус/комментарий в `lessons`, а не редактирует саму сдачу. | Зафиксировать, что insert сдачи выполняется только trusted server/RPC. Рассмотреть удаление tutor update-policy для `homework_submissions`, если нет конкретного сценария редактирования сдачи репетитором. |
| F-004 | Major | `0001_init.sql`:190-207, 526-534 | Storage read-policy полагается на путь `tutor_{id}/...`, но таблица `homework_submission_photos.storage_path` не проверяет соответствие этой структуре. | Доступ к object и metadata разделены: metadata может ссылаться на путь, не соответствующий ожидаемой структуре. Это не обязательно пробьет RLS Storage, но усложнит отладку и может сломать просмотр фото. | В Edge Function/RPC генерировать `storage_path` строго на сервере. Можно добавить комментарий/constraint на prefix невозможно без знания tutor_id, но это нужно покрыть server-side тестом. |
| F-005 | Major | `0001_init.sql`:212-222 | `update_events_lesson_matches_student` с nullable `lesson_id` разрешает событие без урока, но при заполненном `lesson_id` валидирует пару. Это корректно SQL-wise, но доменно не все события могут быть без урока. | События из ТЗ в основном связаны с уроком/ДЗ/материалом, но не все будущие обновления обязаны иметь урок. Сейчас поведение гибкое, но требует явного решения. | Оставить как есть для MVP или добавить комментарий, что `lesson_id` nullable намеренно для событий профиля ученика. |
| F-006 | Minor | `0001_init.sql`:54-58 | `tutors.email` хранится отдельно от `auth.users.email` и не имеет уникального ограничения. | Supabase Auth уже обеспечивает email как идентификатор входа, но дублирование может расходиться. | Либо считать `tutors.email` денормализованным отображением, либо убрать уникальность намеренно. Добавить комментарий о source of truth. |
| F-007 | Minor | `0001_init.sql`:86-93 | Constraint `students_archived_at_matches_status` требует одновременно менять `status` и `archived_at`. | Это хорошо для целостности, но фронт/сервис должен помнить об атомарном update. | Оставить, но в сервисном слое сделать одну операцию `archiveStudent`, которая меняет оба поля. |
| F-008 | Minor | `0001_init.sql`:173-185 | Constraint `homework_submissions_lesson_student_unique_pair` избыточен, потому что оба поля уже `not null`. | Не ломает миграцию, но добавляет шум. | Можно удалить для чистоты. |
| F-009 | Minor | `0001_init.sql`:521-524 | Bucket создается миграцией через `storage.buckets`. Это стандартно для Supabase SQL, но требует запуска в окружении, где schema `storage` уже существует. | В чистом Postgres без Supabase миграция не применится. | Это нормально для Supabase-миграции; отметить в README/документации, что миграция не предназначена для vanilla Postgres. |

## 3. Таблица соответствия ТЗ

| Требование / область | Статус | Где в миграции | Комментарий |
|---|---|---|---|
| Репетиторы | Покрыто | 51-63 | Есть `tutors`, связь с `auth.users`. |
| Ученики | Покрыто | 68-101 | Есть обязательные и необязательные поля, status, token hash. |
| Только `access_token_hash`, без plaintext token | Покрыто | 82, 104 | Plaintext token не добавлен. |
| Архивация ученика | Покрыто | 81, 97-100 | `status`, `archived_at`, constraint. |
| Полезные ссылки | Покрыто | 108-120 | `title`, `url`, `sort_order`. |
| Уроки | Покрыто | 124-152 | Дата, тема, рейтинг, Д/З, дедлайн, статус, комментарий, оплата. |
| Рейтинг 1-5 или NULL | Покрыто | 141-144 | CHECK есть. |
| Статус Д/З default `not_submitted` | Покрыто | 132 | Default есть. |
| Оплата default false | Покрыто | 136 | `is_paid false`. |
| Soft delete уроков | Частично | 139, 441-446 | `deleted_at` есть, но physical delete разрешен RLS. |
| Материалы урока | Покрыто | 157-169 | Только внешние ссылки, тип enum. |
| Сдачи Д/З | Частично | 173-185 | Таблица есть, но ученический insert flow не реализован. |
| Фото сдачи Д/З | Частично | 190-207, 521-534 | Metadata и private bucket есть, но upload/read ученика по токену не реализованы. |
| До 10 фото | Не БД / не покрыто | - | Должно проверяться приложением/Edge Function, при желании триггером. |
| Клиентское сжатие фото | Не БД | - | Frontend. |
| Просрочка от дедлайна до первой сдачи | Частично | 134-135, 145-150 | Поля и CHECK есть, расчет остается в приложении/RPC. |
| Update events / индикатор ученика | Покрыто | 212-224 | Таблица есть. |
| RLS на доменных таблицах | Покрыто | 274-281 | Включено на всех доменных таблицах. |
| RLS для репетитора | В основном покрыто | 346-519 | Базовые политики есть. См. замечания по delete/update. |
| Student token public access | Не покрыто в SQL | 343-344 | Отложено в RPC/Edge Function. |
| Storage private bucket | Покрыто | 521-524 | Bucket private. |
| Storage policies | Частично | 526-534 | Есть только read-policy для репетитора. |
| Отсутствие Post-MVP сущностей | Покрыто | весь файл | Лишних таблиц не найдено. |

## 4. Что покрыто БД

| Область | Покрытие |
|---|---|
| Доменные сущности | Таблицы MVP созданы. |
| Основные связи | FK между репетитором, учениками, уроками, материалами, сдачами и фото есть. |
| Статусы | Enum для учеников, Д/З, материалов и событий есть. |
| Обязательность | Основные required поля покрыты `not null` и blank-check. |
| Defaults | `created_at`, `updated_at`, `student active`, `homework not_submitted`, `is_paid false`, `is_seen false` есть. |
| Ограничения | Рейтинг 1-5, неотрицательные sort_order, положительные размеры/размерности фото metadata, late_days >= 0. |
| Изоляция репетитора | RLS-политики в основном ограничивают доступ владельцем через `current_tutor_id()`. |
| Private Storage | Bucket `homework-photos` создан как private. |

## 5. Что остается приложению / Edge Function / Storage

| Область | Где реализовывать |
|---|---|
| Генерация student token | Server-side / Edge Function; в БД хранить только hash. |
| Проверка student token | Edge Function или Postgres RPC security definer. |
| Публичный профиль ученика | Edge Function/RPC должен вернуть только разрешенный набор данных. |
| Создание сдачи Д/З учеником | Edge Function/RPC, чтобы проверить token и атомарно изменить `homework_status`. |
| Загрузка фото учеником | Edge Function/signed upload URL/Storage flow; service role только на сервере. |
| Лимит до 10 фото | Frontend + Edge Function; optional DB trigger. |
| Сжатие фото | Frontend. |
| Просрочка | Edge Function/RPC или application service при первой сдаче. |
| Бейдж "Д/З на проверке" | Query/UI на основе `homework_status = in_review`. |
| Актуальное Д/З | Query/service/UI, потому что логика частично открыта. |
| Открытие внешних ссылок в новой вкладке | Frontend. |
| Скрытие пустых виджетов | Frontend/API serialization. |

## 6. Рекомендации по исправлению

| ID | Рекомендация | Приоритет |
|---|---|---|
| R-001 | Следующим шагом создать Edge Function/RPC design для student token flow: get public profile, submit homework, mark updates seen, generate signed photo URLs. | Blocker |
| R-002 | Убрать RLS delete-policy для `lessons`, если принято решение использовать soft delete. | Major |
| R-003 | Решить, должен ли репетитор иметь update-policy на `homework_submissions`; если нет, убрать. | Major |
| R-004 | Зафиксировать server-side генерацию `storage_path`; не принимать путь от клиента. | Major |
| R-005 | Добавить миграционные/интеграционные тесты RLS: tutor A не видит tutor B, student token не дает доступа к чужому профилю, private фото не публичны. | Major |
| R-006 | Прогнать миграцию в реальном Supabase/Postgres окружении, так как локально `psql` и `supabase` CLI недоступны. | Major |
| R-007 | Добавить краткий README для БД: Supabase-only migration, required env, expected Storage path convention. | Minor |

## 7. Открытые вопросы

| ID | Вопрос | Почему важно |
|---|---|---|
| OQ-001 | Подтверждаем soft delete уроков как единственное удаление для репетитора? | Сейчас `deleted_at` есть, но physical delete разрешен. |
| OQ-002 | Student token flow будет через Edge Function или Postgres RPC? | От этого зависят RLS, Storage access и тесты. |
| OQ-003 | Нужно ли показывать всю историю повторных сдач в UI или только последнюю? | БД хранит историю, интерфейсный сценарий еще открыт. |
| OQ-004 | Нужен ли DB trigger на лимит 10 фото или достаточно Frontend + Edge Function? | DB trigger даст дополнительную защиту, но усложнит миграцию. |
| OQ-005 | Нужно ли запрещать events без `lesson_id`? | Сейчас nullable разрешает события профиля без урока. |

