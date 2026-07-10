# TUTOR-SPACE: student token Edge Function flow

Файл функции:

- [supabase/functions/student-token-flow/index.ts](/Users/olazavalisina/Documents/сайт/supabase/functions/student-token-flow/index.ts)

Основание:

- ученик входит без пароля по постоянной ссылке-токену;
- в БД хранится только `students.access_token_hash`;
- фото Д/З лежат в private Storage bucket `homework-photos`;
- service role key нельзя отдавать в браузер.

## 1. Почему Edge Function

Для ученического профиля нужен публичный HTTP-вход без Supabase Auth session, но с проверкой token hash. Также нужен безопасный Storage flow: сервер генерирует путь фото и signed upload URL, а клиент не получает service role key.

Supabase Edge Functions подходят для этого слоя: это server-side TypeScript функции на Deno, которым доступны Supabase secrets/environment variables.

## 2. Endpoint

```text
POST /functions/v1/student-token-flow
```

Все запросы используют JSON body:

```json
{
  "action": "getProfile",
  "token": "student-plaintext-token-from-url"
}
```

## 3. Actions

| Action | Назначение | Требуемые поля | Что делает |
|---|---|---|---|
| `getProfile` | Получить публичный профиль ученика. | `token` | Проверяет token hash, возвращает ученика, полезные ссылки, уроки, материалы, сдачи и metadata фото. |
| `prepareHomeworkPhotoUploads` | Подготовить signed upload URLs для фото Д/З. | `token`, `lessonId`, `photos[]` | Проверяет ученика и урок, валидирует до 10 фото, генерирует server-side storage paths и signed upload URLs. |
| `completeHomeworkSubmission` | Завершить сдачу Д/З после загрузки фото. | `token`, `lessonId`, `comment`, `photos[]` со `storagePath` | Проверяет пути фото, создает submission и photo metadata, переводит Д/З в `in_review`, фиксирует первую сдачу и просрочку. |
| `markUpdatesSeen` | Отметить обновления просмотренными. | `token` | Сбрасывает `students.has_unread_updates_for_student` и помечает `update_events` как просмотренные. |

## 4. Фото flow

1. Frontend сжимает фото на клиенте.
2. Frontend вызывает `prepareHomeworkPhotoUploads`.
3. Edge Function проверяет token, lesson ownership и лимиты.
4. Edge Function генерирует Storage paths в формате:

```text
tutor_{tutorId}/student_{studentId}/lesson_{lessonId}/submission_pending/{photoId}.{ext}
```

5. Frontend загружает файлы через signed upload URLs.
6. Frontend вызывает `completeHomeworkSubmission` с теми же `storagePath`.
7. Edge Function создает `homework_submissions`, `homework_submission_photos`, обновляет урок.

Примечание: в MVP paths включают `submission_pending`, потому что signed upload URLs выдаются до создания submission. Пути все равно server-generated и уникальны по `photoId`. Если позже потребуется путь с настоящим `submissionId`, нужно добавить trusted Storage move/copy step после создания submission.

## 5. Что функция закрывает

| Требование | Статус |
|---|---|
| Проверка ученика по token hash | Закрыто scaffold-реализацией. |
| Отсутствие plaintext token в БД | Соблюдается: функция хэширует входной token и ищет `access_token_hash`. |
| До 10 фото | Проверяется функцией. |
| До 20 МБ исходное фото | Проверяется по metadata `sizeBytes`; frontend также должен проверять до загрузки. |
| Форматы JPG/PNG/HEIC/HEIF | Проверяются по MIME type. |
| Server-generated storage path | Закрыто. |
| Статус Д/З `in_review` после сдачи | Закрыто. |
| Просрочка от дедлайна до первой сдачи | Закрыто в функции. |

## 6. Что еще нужно проверить на реальном Supabase

| Проверка | Почему важно |
|---|---|
| `supabase functions serve student-token-flow` | Локально в текущем окружении нет `deno`/Supabase CLI, type-check не выполнен. |
| Signed upload URL flow | Нужно подтвердить клиентский метод загрузки `uploadToSignedUrl` и формат возвращаемых данных. |
| Service role secrets | В production должна быть доступна secret key только в Edge Function, не в браузере. |
| Storage object existence before `completeHomeworkSubmission` | Сейчас функция доверяет, что клиент загрузил файлы после `prepare`. Можно усилить проверкой существования объектов. |
| Signed read URLs для фото ученика | `getProfile` возвращает metadata фото, но не добавляет signed read URLs. Если ученику нужно видеть отправленные фото, добавить выдачу signed read URLs. |
| Rate limiting | В MVP не реализовано. Для публичного token endpoint желательно добавить позже. |

