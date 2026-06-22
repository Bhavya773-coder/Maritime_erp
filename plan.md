# Plan: Fix Task Assignment, Delegation, Notifications & Add Personal Reminders

## Issues Identified

### 1. Task Assignment via Bot API (`/api/bot/test-command`) - Notifications never dispatched
- `bot.service.ts` `processCommand()` returns `notifications` array but **never actually sends** them via WhatsApp.
- `bot.controller.ts` `testCommand()` just returns the JSON result to the caller.

### 2. Task Creation via Task API (`/api/tasks`) - Message may fail for new users
- `tasks.service.ts` `createTask()` sends a WhatsApp message with format: "New task from X: Y. Priority: Z. Due: 2026-06-20."
- This does **NOT** match the template regex pattern, so a regular text message is sent.
- If the user hasn't messaged the bot in 24 hours, WhatsApp Cloud API rejects it (error is caught but only logged, not reported).
- The sender gets a success response (acknowledgement) but the assignee never gets the message.

### 3. Delegation via Task API (`/api/tasks/:id/delegate`) - Same issue
- `tasks.service.ts` `delegateTask()` sends regular text that may fail for new users.

### 4. Delegation via Bot Reply (`bot.reply-service.ts`) - New assignee not notified
- The delegation message format matches the template, but if `WHATSAPP_TEMPLATE_NAME` is not set, it falls back to regular text which fails for new users.

### 5. Reminder Service (`bot.reminder-service.ts`) - Buttons fail for new users
- `sendWhatsAppTaskButtonsAndLog` requires the user to be within the 24h conversation window.
- For overdue/pending reminders, if the user hasn't messaged in 24h, buttons fail silently.

### 6. New User Communication Problem (WhatsApp 24h Window)
- WhatsApp Cloud API requires a 24-hour conversation window for free-form messages and interactive buttons.
- Users who never communicated with the bot can't receive task assignments, delegations, or reminders.
- **Solution**: Use template messages for task assignments/delegations (always work), and for reminders, check the conversation window and fall back to plain text if outside.

## Solution Design

### A. Unified Notification Helper (`bot.notification-service.ts`)
- Helper to check if user is within the 24-hour WhatsApp conversation window.
- `sendTaskAssignment()` - Always sends template message for task assignments (bypasses 24h window).
- `sendTaskDelegation()` - Always sends template message for delegations (bypasses 24h window).
- `sendReminder()` - If in window, send buttons; if outside, send plain text reminder.
- `sendTextNotification()` - For regular updates (with graceful fallback).

### B. Fix `bot.service.ts` `processCommand()`
- Actually dispatch the returned notifications via WhatsApp after creating the task.
- Update the message format to match the template pattern.

### C. Fix `tasks.service.ts` `createTask()` and `delegateTask()`
- Update message formats to match template patterns.
- Use unified notification helper.
- Handle errors gracefully and report when notification fails.

### D. Fix `bot.reply-service.ts` `executeReplyCommand()`
- Update task creation/delegation messages to match template patterns.
- Ensure notifications are actually sent.

### E. Fix `llm.service.ts` `executeDbOperations()`
- Update `createTask` message format to match template pattern.
- Add `createPersonalReminder` dbOperation support.

### F. Add Personal Reminder Module
- **Schema**: New `PersonalReminder` model.
- **Service**: `bot.personal-reminder-service.ts` to process due personal reminders.
- **Controller**: Endpoints to create, list, cancel personal reminders.
- **Routes**: Add to `bot.routes.ts`.
- **Scheduler**: Update `server.ts` to check personal reminders.
- **LLM**: Add `createPersonalReminder` to LLM prompt.

## Files to Modify

1. `backend/prisma/schema.prisma` - Add `PersonalReminder` model, update `BotReminderType` enum.
2. `backend/src/modules/bot/bot.notification-service.ts` - **NEW**.
3. `backend/src/modules/bot/bot.service.ts` - Dispatch notifications, fix message format.
4. `backend/src/modules/bot/whatsapp.service.ts` - Improve template handling, add generic template fallback.
5. `backend/src/modules/tasks/tasks.service.ts` - Fix `createTask` and `delegateTask` notifications.
6. `backend/src/modules/bot/bot.reply-service.ts` - Fix message formats.
7. `backend/src/modules/bot/llm.service.ts` - Fix message formats, add `createPersonalReminder`.
8. `backend/src/modules/bot/bot.personal-reminder-service.ts` - **NEW**.
9. `backend/src/modules/bot/bot.controller.ts` - Add personal reminder endpoints.
10. `backend/src/modules/bot/bot.routes.ts` - Add personal reminder routes.
11. `backend/src/server.ts` - Add personal reminder scheduler.

## Execution Order

1. Schema changes (prisma/schema.prisma)
2. New services (bot.notification-service.ts, bot.personal-reminder-service.ts)
3. Core fixes (whatsapp.service.ts, bot.service.ts, tasks.service.ts, bot.reply-service.ts, llm.service.ts)
4. Controller & routes (bot.controller.ts, bot.routes.ts)
5. Scheduler (server.ts)
6. Regenerate Prisma client
