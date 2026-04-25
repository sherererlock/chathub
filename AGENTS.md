# AGENTS.md

This file is for AI coding agents working in this repository.

## Purpose

ChatHub is a Chrome Extension (Manifest V3) built with React, TypeScript, Vite, and CRXJS. The product is a multi-model chat client: different providers are adapted behind a shared bot interface, then exposed through a unified UI.

When making changes, optimize for:

- minimal surface area
- preserving existing bot abstractions
- keeping extension-specific logic at the extension boundary
- verifying with build output, because automated tests are limited

## What Matters Most

If you only keep three things in mind, keep these:

1. All model integrations should conform to the shared bot abstraction in `src/app/bots/abstract-bot.ts`.
2. The main message orchestration lives in `src/app/hooks/use-chat.ts`.
3. Browser-extension behavior depends on `manifest.config.ts`, `src/background`, and `src/content-script`.

## Recommended Reading Order

Read these first when you need repository context:

1. `manifest.config.ts`
2. `src/background/index.ts`
3. `src/app/main.tsx`
4. `src/app/router.tsx`
5. `src/app/hooks/use-chat.ts`
6. `src/app/bots/abstract-bot.ts`
7. `src/app/bots/index.ts`
8. `src/services/user-config.ts`
9. `src/services/chat-history.ts`

If the task is about extending functionality, also read:

1. `src/app/consts.ts`
2. the target bot directory under `src/app/bots/*`
3. `src/services/agent/index.ts`
4. `src/services/proxy-fetch.ts`

## Project Layout

Top-level areas:

- `src/app`: React application UI, routes, pages, hooks, and bot implementations
- `src/background`: extension background service worker logic
- `src/content-script`: page/injected integration logic for site-specific behavior
- `src/services`: storage, service integrations, proxying, and infrastructure helpers
- `src/types`: shared domain and messaging types
- `src/utils`: low-level utility functions
- `_locales`: extension i18n resources

Important `src/app` areas:

- `src/app/bots`: bot abstraction plus per-provider implementations
- `src/app/components`: reusable UI pieces
- `src/app/hooks`: main app orchestration hooks
- `src/app/pages`: route-level pages
- `src/app/state`: Jotai atoms and app state
- `src/app/i18n`: app-local translations

## Runtime Surfaces

This is not a single web app process. It has multiple execution surfaces:

- main app: `app.html` -> `src/app/main.tsx`
- side panel: `sidepanel.html` -> `src/app/sidepanel.tsx`
- background worker: `src/background/index.ts`
- content script: `src/content-script/chatgpt-inpage-proxy.ts`

Be careful to place code in the correct runtime. Do not move extension-only logic into normal UI code unless the behavior truly belongs there.

## Core Architecture

### Bot System

`BotId` in `src/app/bots/index.ts` is a shared key used across:

- routes
- UI state
- settings
- history storage
- bot instance creation

If you add or rename a bot, check every place that depends on `BotId`.

`src/app/consts.ts` contains display metadata like names and icons. It affects presentation, not the transport logic.

`createBotInstance()` in `src/app/bots/index.ts` is the dispatch point from `BotId` to the concrete implementation. Any new bot must be registered there.

### Shared Bot Contract

UI code should not know provider-specific request details. Bot implementations should fit the shared lifecycle:

- input: prompt, raw user input, optional image, abort signal
- output events: `UPDATE_ANSWER`, `DONE`, `ERROR`
- lifecycle methods: sending and conversation reset

Some bots use delayed async setup. In those cases, follow the existing async bot pattern instead of leaking initialization concerns into the UI.

### Message Flow

The main chat flow is centered in `src/app/hooks/use-chat.ts`:

1. UI sends a message.
2. Local state is updated optimistically.
3. An `AbortController` is created.
4. Images are compressed if needed.
5. The current bot instance is asked to send the message.
6. Streaming output updates the placeholder assistant message.
7. Completion or failure clears generating state.
8. Message changes are persisted through storage side effects.

Implications:

- UI is optimistic before the remote response arrives.
- bot output is streamed incrementally
- abort behavior is important and should not be broken
- history persistence is related, but separate from the request flow

## Storage Model

Configuration and conversation content are intentionally stored separately:

- user settings: `src/services/user-config.ts` using browser sync storage
- chat history: `src/services/chat-history.ts` using browser local storage

Do not mix these responsibilities unless the design truly changes.

History keys are partitioned by bot and conversation. If you modify persistence behavior, make sure you preserve that mental model.

## Where Changes Usually Belong

Use this placement guide before editing:

- page or component rendering change -> `src/app/components` or `src/app/pages`
- message orchestration change -> `src/app/hooks/use-chat.ts`
- model/provider integration change -> `src/app/bots/*`
- browser permission or extension runtime change -> `manifest.config.ts`, `src/background`, `src/content-script`
- storage change -> `src/services/user-config.ts` or `src/services/chat-history.ts`
- request proxy or infrastructure change -> `src/services/*` or `src/utils/*`

## Adding A New Bot

The smallest normal change set is:

1. extend `BotId` in `src/app/bots/index.ts`
2. add bot metadata in `src/app/consts.ts`
3. create `src/app/bots/<bot-name>/index.ts`
4. implement the bot with the shared abstraction
5. register it in `createBotInstance()`
6. add settings in `src/services/user-config.ts` if needed
7. add UI in `src/app/components/Settings` if needed
8. update `manifest.config.ts` if permissions or site matching are required

Usually do not start by editing:

- `src/app/hooks/use-chat.ts`
- `src/app/router.tsx`
- app bootstrap files

Only touch those when the feature changes global chat behavior or page structure.

## Extension-Specific Risks

Changes in these areas are higher risk and should be reviewed carefully:

- `manifest.config.ts`
- `src/background/*`
- `src/content-script/*`
- `src/services/proxy-fetch.ts`
- bot implementations that depend on site context or special permissions

If a provider cannot work from the extension context with a plain `fetch`, inspect the proxy-fetch path before introducing a brand new mechanism.

## Web Access Agent

`src/services/agent/index.ts` implements a focused web-access flow. It is not a general-purpose framework for all bots. Treat it as a targeted tool path for search-assisted responses.

## Important Invariants

Try not to break these:

1. UI talks to bots through a shared abstraction, not provider-private logic.
2. `BotId` stays consistent across UI, settings, history, and factory code.
3. settings and content persistence remain separate.
4. extension-boundary logic stays at the extension boundary.
5. page structure and bot implementation remain loosely coupled.

## Build And Validation

Primary commands:

- `yarn install`
- `yarn dev`
- `yarn build`

The repository currently exposes build scripts but not a mature automated test suite at the root. After changes:

1. run `yarn build`
2. inspect TypeScript or bundling failures
3. manually validate the affected flow in the extension when the change touches runtime behavior

For changes involving permissions, bot streaming, site integration, or proxy behavior, manual validation is especially important.

## Editing Guidance For Agents

Before making changes, answer these questions:

1. Is this a UI change, bot change, extension-runtime change, storage change, or infrastructure change?
2. Will this modify `BotId` or bot registration?
3. Does it require a new user setting?
4. Does it require manifest permissions or content-script support?
5. Could it affect streaming updates, abort behavior, or persistence side effects?

Preferred workflow:

1. identify the correct architectural layer
2. trace from the entry point to the concrete implementation
3. edit only the smallest necessary surface area
4. verify with build output and targeted manual checks

## Notes On Testing

Avoid adding low-value tests that only restate implementation details. If you add tests, keep them targeted and tied to behavior that is easy to regress.

Because root-level automated coverage is limited, validation quality depends heavily on:

- careful file placement
- preserving architecture boundaries
- successful build verification
- focused manual runtime checks
