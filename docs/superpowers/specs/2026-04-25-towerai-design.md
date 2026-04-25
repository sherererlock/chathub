# TowerAI Integration Design

**Goal:** Add TowerAI support to ChatHub as a first-class bot with model selection, direct chat streaming, and a local helper workflow for OA login and token refresh.

**Status:** Approved for design drafting, pending user review before implementation planning.

## Context

ChatHub is a Chrome Extension that adapts multiple providers behind the shared `AbstractBot` contract. `TowerAI/` is available in the workspace as a design dependency and provides two relevant capabilities:

- an OpenAI-compatible chat request shape with streaming SSE responses
- a browser-automation-based token acquisition and refresh flow that relies on `puppeteer`

The extension can safely implement the chat transport and model selection pieces, but it should not embed `puppeteer` or browser automation into the extension bundle. The OA login and refresh flow therefore needs to live outside the extension runtime.

## Scope

This design covers:

- a new `towerai` bot in ChatHub
- a TowerAI settings panel in ChatHub
- TowerAI model selection using "common models + custom model ID"
- a local helper process used for OA login and token refresh
- extension-to-helper communication over localhost
- request, refresh, fallback, and verification behavior

This design does not cover:

- image input in the first release
- helper packaging or installer UX beyond a local development and manual-run flow
- a helper-side chat proxy; chat requests stay in the extension
- exposing the full TowerAI model catalog directly in the main dropdown on day one

## User Experience

Users enable a new `TowerAI` bot in ChatHub and configure it in Settings.

The TowerAI settings area provides:

- auth mode selection: `Helper` or `Manual Token`
- helper URL configuration
- helper health and auth state display
- actions to `Login` and `Refresh`
- manual `token` and `authToken` fallback fields
- a model selector with curated common models
- a `Custom Model ID` field that overrides the curated selection when filled

When chatting with the TowerAI bot:

- ChatHub streams responses directly from the TowerAI endpoint
- if helper auth is enabled, ChatHub fetches current credentials from the helper before sending
- if TowerAI reports token expiry, ChatHub requests one refresh and retries once
- if helper is unavailable, ChatHub falls back to manually stored credentials when present

## Architecture

### Extension Responsibilities

The extension owns:

- bot registration and UI metadata
- settings storage
- model selection
- prompt-to-message conversion
- direct HTTP requests to TowerAI endpoints
- SSE parsing and answer streaming
- helper status checks and token retrieval

The extension does not own:

- OA web login automation
- local browser profile handling
- long-lived token refresh state outside the current chat request

### Helper Responsibilities

The helper owns:

- OA login orchestration using the existing TowerAI browser automation flow
- token and auth token extraction
- token refresh
- lightweight local status endpoints
- short-lived in-memory or local-file token cache

The helper does not own:

- message history
- model selection UI
- chat transport proxying

### Runtime Boundary

The extension talks to the helper over `http://127.0.0.1:<port>`.

The helper talks to the TowerAI web surface and performs automation locally.

The extension talks directly to `https://tower-ai.yottastudios.com` for chat completion requests.

This boundary keeps the extension bundle small and avoids pulling `puppeteer` into the CRX build while preserving the complete login capability required by TowerAI.

## ChatHub Changes

### Bot Registration

ChatHub adds a new `BotId` named `towerai`.

The following extension surfaces will be updated:

- bot id union and factory registration
- chatbot metadata in `CHATBOTS`
- enabled bot list and startup page selection
- settings page with a TowerAI section

No router or global chat flow change is required because TowerAI will conform to the existing `AbstractBot` interface.

### User Config

`UserConfig` adds TowerAI-specific fields:

- `toweraiBaseUrl`: default `https://tower-ai.yottastudios.com`
- `toweraiAuthMode`: `helper` or `manual`
- `toweraiToken`: manual fallback token
- `toweraiAuthToken`: manual fallback auth header value
- `toweraiModel`: selected curated model id
- `toweraiCustomModel`: optional freeform override
- `toweraiHelperUrl`: default `http://127.0.0.1:21941`
- `toweraiAutoRefresh`: boolean, default `true`

These fields stay in sync storage like the rest of ChatHub settings.

### Settings Panel

The TowerAI settings panel contains five groups:

1. `Auth Mode`
   - radio toggle between `Helper` and `Manual Token`

2. `Helper`
   - helper base URL input
   - status text derived from `/health` or `/auth/state`
   - `Login` button
   - `Refresh` button
   - brief note that helper is required for OA automation

3. `Manual Credentials`
   - password input for `token`
   - password input for `authToken`
   - note that these act as a fallback when helper is unavailable

4. `Model`
   - grouped curated options for common models
   - freeform `Custom Model ID`
   - note that custom value overrides the curated dropdown

5. `Connection Notes`
   - short explanation of helper usage and localhost requirement

### Curated Model Strategy

The first release uses curated groups plus custom override rather than dumping the entire TowerAI catalog into a flat dropdown.

Curated groups:

- GPT
- Claude
- Gemini
- DeepSeek
- Qwen

Initial curated entries should prefer stable and commonly useful models, for example:

- GPT: `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-5-mini`
- Claude: `claude-3-7-sonnet-latest`, `claude-sonnet-4-20250514`, `claude-3-5-haiku-latest`
- Gemini: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash-latest`
- DeepSeek: `deepseek-chat`, `deepseek-reasoner`
- Qwen: `qwen-plus`, `qwen-max`, `qwen-turbo`

The full model list from `TowerAI/docs/models.json` remains the source of truth for future expansion, but the main UI will stay focused and usable in the first release.

### TowerAI Bot Behavior

The new bot follows the same high-level behavior as existing API-driven bots:

- store a small rolling conversation context
- send OpenAI-style messages
- stream text chunks into `UPDATE_ANSWER`
- emit `DONE` at completion
- reset local conversation state on reset

Message format:

- `system` message is optional in the first release and can be omitted unless a concrete TowerAI-specific need appears
- `user` and `assistant` messages are retained in a small rolling window, matching existing patterns in ChatHub

The selected model is resolved as:

1. use `toweraiCustomModel` if non-empty
2. otherwise use `toweraiModel`

### Endpoint Routing

TowerAI uses multiple backend paths based on model family. The extension bot mirrors the routing logic already present in the `TowerAI` design dependency:

- `gpt*` -> `/zi/webapi/chat/openai`
- `gemini*` -> `/zi/webapi/chat/vertexai`
- `claude*` -> `/zi/webapi/chat/vertexai`
- fallback -> `/zi/webapi/chat/openai`

This logic should be isolated in a TowerAI-specific helper module inside ChatHub so it can be adjusted without touching the UI.

### Streaming

TowerAI returns SSE-style events. The bot parses these events and maps them into ChatHub answer updates:

- `event: text` appends content
- `event: stop` finalizes the stream
- `event: usage` is informational and can be ignored by the first release unless surfaced later

The parser should be local to the TowerAI bot implementation rather than retrofitting global SSE utilities if the event format differs from OpenAI-compatible providers already in the codebase.

## Auth Flow

### Auth Resolution Order

For each send operation, the bot resolves credentials in this order:

1. if auth mode is `helper` and auto refresh is enabled, request credentials from helper
2. if helper returns valid `token` and `authToken`, use them
3. if helper is unavailable or returns no valid credentials, fall back to `toweraiToken` and `toweraiAuthToken`
4. if neither source is usable, fail fast with a user-facing configuration error

### Expiry Handling

If TowerAI returns its known token-expired error:

1. call helper refresh when auth mode is `helper`
2. retry the chat request once with refreshed credentials
3. if retry fails, surface the underlying error

No unbounded retries are allowed.

### Manual Fallback

Manual credentials remain usable even when helper mode exists. This ensures:

- development can continue when helper is not running
- users still have a recovery path during helper failures
- support debugging is simpler because extension and helper failures can be isolated

## Helper Design

### Process Form

The helper is a separate local process that can live under the `TowerAI/` workspace as an additional entry point or small companion server.

The helper should reuse the existing TowerAI token extraction logic where possible instead of re-implementing OA automation from scratch.

### HTTP API

The helper exposes the following minimal HTTP endpoints:

- `GET /health`
  - returns service availability and version metadata

- `GET /auth/state`
  - returns structured auth state
  - fields include `connected`, `loggedIn`, `hasToken`, `expiresSoon`, `lastRefreshAt`

- `POST /auth/login`
  - starts OA login and token extraction
  - can accept optional credentials payload if later required

- `POST /auth/refresh`
  - forces one refresh cycle

- `GET /auth/token`
  - returns current `token` and `authToken`

### Helper Response Shape

Responses should be plain JSON with explicit success and message fields. Example shapes:

`GET /health`

```json
{
  "ok": true,
  "version": "0.1.0"
}
```

`GET /auth/state`

```json
{
  "ok": true,
  "data": {
    "connected": true,
    "loggedIn": true,
    "hasToken": true,
    "expiresSoon": false,
    "lastRefreshAt": "2026-04-25T15:00:00.000Z"
  }
}
```

`GET /auth/token`

```json
{
  "ok": true,
  "data": {
    "token": "xxxxx",
    "authToken": "yyyyy"
  }
}
```

Errors should return:

```json
{
  "ok": false,
  "message": "Human readable error"
}
```

### Security Considerations

The helper runs only on localhost in the first release.

The extension should:

- default to `127.0.0.1` rather than a wildcard hostname
- treat helper responses as local-only and not persist fetched helper tokens unless explicitly needed
- request host permission for the configured helper origin when necessary

The helper should:

- bind to localhost only
- avoid exposing OA credentials in logs
- avoid returning refresh tokens unless they are truly required

## Failure Modes

### Helper Unavailable

If the helper cannot be reached:

- settings page shows unavailable state
- `Login` and `Refresh` actions fail with a short actionable error
- chat send falls back to manual credentials if available

### Helper Available But Not Logged In

If helper is healthy but has no valid auth state:

- settings page shows `connected` but not `logged in`
- chat send fails unless manual credentials are configured
- user is prompted to use `Login`

### Model Unavailable

If TowerAI rejects the selected model:

- surface the original error response
- add a short user-readable hint that the account may not have access to the chosen model

### Token Refresh Failure

If refresh fails:

- one refresh attempt is allowed
- one request retry is allowed
- the final error is shown without silent loops

## Validation Plan

### Build Validation

- run `yarn build`
- fix any TypeScript or bundling failures

### Diagnostic Validation

- run editor diagnostics on modified files
- ensure the TowerAI settings and bot files are type-safe

### Manual Validation

Required manual checks:

1. helper not running -> settings show unavailable
2. manual credential mode -> can chat successfully
3. helper mode with successful login -> can chat successfully
4. helper mode with forced refresh -> request recovers after one retry
5. model dropdown selection -> selected model is used in requests
6. custom model id -> overrides curated model selection
7. helper unavailable during send -> fallback path behaves as designed

## Risks

- localhost permission and request behavior may need explicit handling in the extension
- TowerAI token expiry detection may differ from current SDK assumptions
- some models listed in `models.json` may not be available to all accounts
- helper packaging is intentionally deferred, so first-run setup is more manual

## Implementation Boundaries

Planned ChatHub-side work:

- add `towerai` bot id, metadata, settings, and factory registration
- implement TowerAI request and stream parser modules
- add helper client utilities
- add TowerAI settings UI
- update manifest or runtime permission handling if localhost access requires it

Planned TowerAI-side work:

- add a lightweight local HTTP helper entry point
- wrap existing token extraction and refresh logic in stable endpoints

## Open Decisions Closed By This Spec

The following choices are now fixed for implementation:

- use `extension + local helper` instead of extension-only auth automation
- keep chat transport in the extension instead of proxying through helper
- ship curated model groups plus custom model override in the first release
- allow manual credentials as a fallback even when helper mode exists
- support text chat first and defer image input

## Acceptance Criteria

The feature is considered complete when:

- ChatHub shows a `TowerAI` bot that can be enabled and selected
- Settings include TowerAI auth mode, helper controls, manual credentials, and model selection
- TowerAI chat requests stream correctly in the existing conversation UI
- helper login and refresh can provide credentials to the extension
- token expiry triggers at most one refresh and one retry
- custom model id overrides curated selection
- `yarn build` passes after the change
