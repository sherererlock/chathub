# TowerAI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-usable `TowerAI` bot in ChatHub with model selection, helper-assisted login/refresh, and manual-token fallback, while treating `TowerAI/` as a first-class implementation dependency.

**Architecture:** Keep browser automation and token refresh inside `TowerAI/` as a local HTTP helper built on top of the existing Puppeteer auth flow, and keep the extension side thin: ChatHub stores user settings, requests local/remote permissions, resolves the active model, fetches credentials from the helper when configured, and streams TowerAI SSE responses through the existing `AbstractBot` contract. The integration remains layered so TowerAI auth logic stays outside the extension bundle.

**Tech Stack:** React, TypeScript, Vite, CRXJS, `eventsource-parser`, `ofetch`, `tsx --test`, Puppeteer (`TowerAI/`), Chrome Extension MV3 permissions

---

## File Structure

- `TowerAI/package.json`: add helper/test scripts needed to run and validate the local auth server.
- `TowerAI/src/auth.ts`: keep the existing browser-fetch entry point, but let it optionally persist refreshed credentials for reuse by the helper.
- `TowerAI/src/helper/state-store.ts`: read/write helper state on disk, including token metadata and refresh timestamps.
- `TowerAI/src/helper/server.ts`: expose `/health`, `/auth/state`, `/auth/login`, `/auth/refresh`, and `/auth/token`.
- `TowerAI/src/helper/index.ts`: CLI entry point that starts the helper server on `127.0.0.1:21941` by default.
- `TowerAI/tests/auth-persistence.test.ts`: verify auth persistence behavior without launching a real browser.
- `TowerAI/tests/helper-server.test.ts`: verify helper HTTP routes with mocked token providers.
- `src/app/bots/towerai/models.ts`: curated model list plus “custom model wins” resolution.
- `src/app/bots/towerai/helper.ts`: helper-client and manual credential resolution.
- `src/app/bots/towerai/api.ts`: request/header building and TowerAI SSE parsing for ChatHub.
- `src/app/bots/towerai/index.ts`: `TowerAIBot` implementation conforming to `AbstractBot`.
- `src/app/bots/towerai/models.test.ts`: root-level unit tests for model resolution.
- `src/app/bots/towerai/helper.test.ts`: root-level unit tests for helper/manual credential selection.
- `src/app/components/Settings/TowerAISettings.tsx`: settings UI for auth mode, URLs, tokens, refresh, and model selection.
- `src/app/bots/index.ts`: register the new `towerai` bot.
- `src/app/consts.ts`: add bot metadata and curated model labels.
- `src/services/user-config.ts`: add TowerAI settings defaults and types.
- `src/app/pages/SettingPage.tsx`: mount the TowerAI settings panel and request host permissions on save.
- `src/utils/errors.ts`: add TowerAI-specific error codes so auth/setup failures surface clearly.
- `manifest.config.ts`: allow extension access to `http://127.0.0.1/*`, `http://localhost/*`, and TowerAI host requests.
- `src/assets/logos/towerai.svg`: add a lightweight local logo so the bot appears consistently in enabled-bots UI.
- `package.json`: add `tsx` and a tiny `test` script for focused root-level unit tests.

## Task 1: Build The TowerAI Helper Foundation

**Files:**
- Modify: `TowerAI/package.json`
- Modify: `TowerAI/src/auth.ts`
- Create: `TowerAI/src/helper/state-store.ts`
- Test: `TowerAI/tests/auth-persistence.test.ts`

- [ ] **Step 1: Write the failing persistence test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createStateStore } from '../src/helper/state-store.js'

test('createStateStore persists helper credentials and refresh metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'towerai-helper-'))
  const store = createStateStore({ stateDir: dir })

  await store.save({
    token: 'token-1',
    authToken: 'auth-1',
    baseUrl: 'https://tower-ai.yottastudios.com',
    source: 'browser',
    cookies: [{ name: 'sid', value: '1' }],
  })

  const state = await store.read()
  assert.equal(state.token, 'token-1')
  assert.equal(state.authToken, 'auth-1')
  assert.equal(state.source, 'browser')
  assert.ok(state.lastRefresh)

  const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'))
  assert.equal(raw.authToken, 'auth-1')
})
```

- [ ] **Step 2: Run the TowerAI test command to confirm it fails**

Run: `npm test -- tests/auth-persistence.test.ts`
Expected: non-zero exit code because `test` script or `src/helper/state-store.ts` does not exist yet.

- [ ] **Step 3: Add the helper test script and the minimal state store**

```json
{
  "scripts": {
    "build": "tsc",
    "example": "tsx examples/usage.ts",
    "helper": "tsx src/helper/index.ts",
    "test": "tsx --test tests/**/*.test.ts"
  }
}
```

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface StoredState {
  token: string
  authToken: string
  baseUrl: string
  source: string
  lastRefresh?: string
  cookies?: Array<Record<string, unknown>>
}

export function createStateStore({ stateDir = join(homedir(), '.towerai-helper') }: { stateDir?: string } = {}) {
  const filePath = join(stateDir, 'state.json')

  return {
    async read(): Promise<StoredState> {
      try {
        const raw = await readFile(filePath, 'utf8')
        return JSON.parse(raw) as StoredState
      } catch {
        return { token: '', authToken: '', baseUrl: '', source: '', cookies: [] }
      }
    },
    async save(next: StoredState) {
      await mkdir(stateDir, { recursive: true })
      await writeFile(
        filePath,
        JSON.stringify({ ...next, lastRefresh: new Date().toISOString() }, null, 2),
        'utf8',
      )
    },
  }
}
```

- [ ] **Step 4: Thread persistence through the auth fetcher**

```ts
import { createStateStore } from './helper/state-store.js'

export interface FetchTokenOptions {
  baseUrl?: string
  chromePath?: string
  headless?: boolean
  timeoutMs?: number
  userDataDir?: string
  oaUsername?: string
  oaPassword?: string
  persistToStateDir?: string
}

const persistDir = options?.persistToStateDir ?? process.env.TOWERAI_STATE_DIR
if (persistDir) {
  await createStateStore({ stateDir: persistDir }).save({
    token,
    authToken: capturedAuthToken,
    baseUrl,
    source: 'browser',
  })
}
```

- [ ] **Step 5: Re-run the persistence test**

Run: `npm test -- tests/auth-persistence.test.ts`
Expected: exit code `0` and output mentioning `auth-persistence.test.ts`.

- [ ] **Step 6: Commit the helper foundation**

```bash
git add TowerAI/package.json TowerAI/src/auth.ts TowerAI/src/helper/state-store.ts TowerAI/tests/auth-persistence.test.ts
git commit -m "feat(towerai): add helper state persistence"
```

## Task 2: Expose A Local TowerAI Helper Server

**Files:**
- Create: `TowerAI/src/helper/server.ts`
- Create: `TowerAI/src/helper/index.ts`
- Test: `TowerAI/tests/helper-server.test.ts`
- Modify: `TowerAI/package.json`

- [ ] **Step 1: Write the failing helper-route test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { createHelperServer } from '../src/helper/server.js'

test('helper exposes health and token routes', async () => {
  const server = createHelperServer({
    host: '127.0.0.1',
    port: 0,
    getState: async () => ({
      token: 'token-1',
      authToken: 'auth-1',
      baseUrl: 'https://tower-ai.yottastudios.com',
      source: 'cache',
      lastRefresh: '2026-04-25T00:00:00.000Z',
    }),
    login: async () => undefined,
    refresh: async () => undefined,
  })

  await server.start()
  const baseUrl = server.url()

  const health = await fetch(`${baseUrl}/health`).then((r) => r.json())
  assert.equal(health.ok, true)

  const token = await fetch(`${baseUrl}/auth/token`).then((r) => r.json())
  assert.equal(token.token, 'token-1')
  assert.equal(token.authToken, 'auth-1')

  await server.stop()
})
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run: `npm test -- tests/helper-server.test.ts`
Expected: non-zero exit code because `createHelperServer()` does not exist yet.

- [ ] **Step 3: Implement the helper HTTP server with the agreed routes**

```ts
import { createServer } from 'node:http'

export function createHelperServer(deps: {
  host: string
  port: number
  getState: () => Promise<Record<string, unknown>>
  login: () => Promise<void>
  refresh: () => Promise<void>
}) {
  let server: ReturnType<typeof createServer> | undefined

  const respond = (res: any, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  return {
    async start() {
      server = createServer(async (req, res) => {
        if (!req.url) return respond(res, 400, { error: 'missing_url' })
        if (req.method === 'GET' && req.url === '/health') return respond(res, 200, { ok: true })
        if (req.method === 'GET' && req.url === '/auth/state') return respond(res, 200, await deps.getState())
        if (req.method === 'GET' && req.url === '/auth/token') return respond(res, 200, await deps.getState())
        if (req.method === 'POST' && req.url === '/auth/login') {
          await deps.login()
          return respond(res, 200, await deps.getState())
        }
        if (req.method === 'POST' && req.url === '/auth/refresh') {
          await deps.refresh()
          return respond(res, 200, await deps.getState())
        }
        return respond(res, 404, { error: 'not_found' })
      })
      await new Promise<void>((resolve) => server!.listen(deps.port, deps.host, () => resolve()))
    },
    url() {
      const addr = server!.address()
      if (!addr || typeof addr === 'string') throw new Error('helper server not started')
      return `http://${deps.host}:${addr.port}`
    },
    async stop() {
      if (!server) return
      await new Promise<void>((resolve, reject) => server!.close((err) => (err ? reject(err) : resolve())))
    },
  }
}
```

```ts
import { fetchTokenViaBrowser } from '../auth.js'
import { createStateStore } from './state-store.js'
import { createHelperServer } from './server.js'

const stateStore = createStateStore({ stateDir: process.env.TOWERAI_STATE_DIR })

const server = createHelperServer({
  host: process.env.TOWERAI_HELPER_HOST ?? '127.0.0.1',
  port: Number(process.env.TOWERAI_HELPER_PORT ?? 21941),
  getState: () => stateStore.read(),
  login: async () => {
    await fetchTokenViaBrowser({ persistToStateDir: process.env.TOWERAI_STATE_DIR, headless: false })
  },
  refresh: async () => {
    await fetchTokenViaBrowser({ persistToStateDir: process.env.TOWERAI_STATE_DIR })
  },
})

await server.start()
console.log(`[towerai-helper] listening on ${server.url()}`)
```

- [ ] **Step 4: Re-run the helper-route test**

Run: `npm test -- tests/helper-server.test.ts`
Expected: exit code `0` and output mentioning `helper-server.test.ts`.

- [ ] **Step 5: Build the TowerAI helper**

Run: `npm run build`
Expected: TypeScript build succeeds and emits `dist/helper/index.js`.

- [ ] **Step 6: Commit the helper server**

```bash
git add TowerAI/package.json TowerAI/src/helper/index.ts TowerAI/src/helper/server.ts TowerAI/tests/helper-server.test.ts
git commit -m "feat(towerai): add local auth helper server"
```

## Task 3: Add Root Test Harness And TowerAI Model Resolution

**Files:**
- Modify: `package.json`
- Create: `src/app/bots/towerai/models.ts`
- Test: `src/app/bots/towerai/models.test.ts`
- Modify: `src/app/consts.ts`

- [ ] **Step 1: Write the failing model-resolution test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTowerAIModel, TOWERAI_COMMON_MODELS } from './models'

test('custom TowerAI model overrides curated selection', () => {
  assert.equal(resolveTowerAIModel('gpt-4.1', 'claude-sonnet-4.5'), 'claude-sonnet-4.5')
})

test('falls back to first curated model when saved model is missing', () => {
  assert.equal(resolveTowerAIModel('', ''), TOWERAI_COMMON_MODELS[0].value)
})
```

- [ ] **Step 2: Run the root test command to confirm it fails**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: non-zero exit code because the root `test` script and `models.ts` do not exist yet.

- [ ] **Step 3: Add the root test script and implement model resolution**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "tsx --test src/**/*.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.0"
  }
}
```

```ts
export const TOWERAI_COMMON_MODELS = [
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
  { label: 'Claude 3.7 Sonnet', value: 'claude-3.7-sonnet' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
]

export function resolveTowerAIModel(selected: string, custom: string) {
  const customModel = custom.trim()
  if (customModel) return customModel
  const curated = selected.trim()
  if (curated) return curated
  return TOWERAI_COMMON_MODELS[0].value
}
```

- [ ] **Step 4: Export the curated list for settings/UI**

```ts
export const CHATBOTS: Record<BotId, { name: string; avatar: string }> = {
  // ...
  towerai: {
    name: 'TowerAI',
    avatar: toweraiLogo,
  },
}
```

- [ ] **Step 5: Re-run the model tests**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: exit code `0` and output mentioning `models.test.ts`.

- [ ] **Step 6: Commit the root test harness and model layer**

```bash
git add package.json src/app/bots/towerai/models.ts src/app/bots/towerai/models.test.ts src/app/consts.ts
git commit -m "feat(chathub): add TowerAI model resolution"
```

## Task 4: Add TowerAI Config, Helper Resolution, And Streaming Bot

**Files:**
- Modify: `src/services/user-config.ts`
- Modify: `src/utils/errors.ts`
- Modify: `src/app/bots/index.ts`
- Create: `src/app/bots/towerai/helper.ts`
- Create: `src/app/bots/towerai/api.ts`
- Create: `src/app/bots/towerai/index.ts`
- Test: `src/app/bots/towerai/helper.test.ts`

- [ ] **Step 1: Write the failing helper/manual credential test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTowerAICredentials } from './helper'

test('manual mode returns sync-stored credentials without calling helper', async () => {
  const result = await resolveTowerAICredentials({
    toweraiAuthMode: 'manual',
    toweraiToken: 'token-1',
    toweraiAuthToken: 'auth-1',
    toweraiHelperUrl: 'http://127.0.0.1:21941',
  })

  assert.equal(result.token, 'token-1')
  assert.equal(result.authToken, 'auth-1')
})
```

- [ ] **Step 2: Run the credential test and confirm it fails**

Run: `yarn test src/app/bots/towerai/helper.test.ts`
Expected: non-zero exit code because `resolveTowerAICredentials()` does not exist yet.

- [ ] **Step 3: Extend user config and error codes**

```ts
const userConfigWithDefaultValue = {
  // ...
  toweraiBaseUrl: 'https://tower-ai.yottastudios.com',
  toweraiAuthMode: 'helper',
  toweraiToken: '',
  toweraiAuthToken: '',
  toweraiModel: 'gpt-4.1',
  toweraiCustomModel: '',
  toweraiHelperUrl: 'http://127.0.0.1:21941',
  toweraiAutoRefresh: true,
}
```

```ts
export enum ErrorCode {
  // ...
  TOWERAI_AUTH_MISSING = 'TOWERAI_AUTH_MISSING',
  TOWERAI_HELPER_UNAVAILABLE = 'TOWERAI_HELPER_UNAVAILABLE',
  TOWERAI_REQUEST_FAILED = 'TOWERAI_REQUEST_FAILED',
}
```

- [ ] **Step 4: Implement helper/manual credential resolution**

```ts
import { ChatError, ErrorCode } from '~utils/errors'
import { UserConfig } from '~services/user-config'

export async function resolveTowerAICredentials(config: Pick<
  UserConfig,
  'toweraiAuthMode' | 'toweraiToken' | 'toweraiAuthToken' | 'toweraiHelperUrl'
>) {
  if (config.toweraiAuthMode === 'manual') {
    if (!config.toweraiToken.trim()) {
      throw new ChatError('TowerAI token missing', ErrorCode.TOWERAI_AUTH_MISSING)
    }
    return { token: config.toweraiToken.trim(), authToken: config.toweraiAuthToken.trim() }
  }

  try {
    const response = await fetch(`${config.toweraiHelperUrl.replace(/\/$/, '')}/auth/token`)
    if (!response.ok) {
      throw new Error(`helper returned ${response.status}`)
    }
    const body = await response.json()
    if (!body.token) {
      throw new Error('helper returned empty token')
    }
    return { token: String(body.token), authToken: String(body.authToken ?? '') }
  } catch (error) {
    throw new ChatError(
      `TowerAI helper unavailable: ${(error as Error).message}`,
      ErrorCode.TOWERAI_HELPER_UNAVAILABLE,
    )
  }
}
```

- [ ] **Step 5: Implement the TowerAI API transport and bot**

```ts
import { createParser } from 'eventsource-parser'
import { getUserConfig } from '~services/user-config'
import { AbstractBot, SendMessageParams } from '../abstract-bot'
import { resolveTowerAIModel } from './models'
import { resolveTowerAICredentials } from './helper'

export class TowerAIBot extends AbstractBot {
  async doSendMessage(params: SendMessageParams) {
    const config = await getUserConfig()
    const model = resolveTowerAIModel(config.toweraiModel, config.toweraiCustomModel)
    const creds = await resolveTowerAICredentials(config)
    const response = await fetch(resolveTowerAIEndpoint(config.toweraiBaseUrl, model), {
      method: 'POST',
      signal: params.signal,
      headers: {
        'content-type': 'application/json',
        token: creds.token,
        authorization: `Bearer ${creds.token}`,
        'x-lobe-chat-auth': creds.authToken,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: params.prompt }],
        stream: true,
      }),
    })

    let answer = ''
    const parser = createParser({
      onEvent(event) {
        if (event.event === 'text' && event.data) {
          answer += JSON.parse(event.data) as string
          params.onEvent({ type: 'UPDATE_ANSWER', data: { text: answer } })
        }
        if (event.event === 'stop') {
          params.onEvent({ type: 'DONE' })
        }
      },
    })

    for await (const chunk of response.body!) {
      parser.feed(new TextDecoder().decode(chunk))
    }
  }

  resetConversation() {}
  get name() {
    return 'TowerAI'
  }
}
```

- [ ] **Step 6: Register the bot**

```ts
export type BotId =
  | 'chatgpt'
  | 'bing'
  // ...
  | 'gemini'
  | 'towerai'

case 'towerai':
  return new TowerAIBot()
```

- [ ] **Step 7: Re-run focused tests and a full type build**

Run: `yarn test src/app/bots/towerai/helper.test.ts`
Expected: exit code `0`.

Run: `yarn build`
Expected: extension build succeeds with the new bot included.

- [ ] **Step 8: Commit the bot layer**

```bash
git add src/services/user-config.ts src/utils/errors.ts src/app/bots/index.ts src/app/bots/towerai
git commit -m "feat(chathub): add TowerAI bot transport"
```

## Task 5: Add TowerAI Settings UI And Extension Permissions

**Files:**
- Create: `src/app/components/Settings/TowerAISettings.tsx`
- Modify: `src/app/pages/SettingPage.tsx`
- Modify: `manifest.config.ts`
- Create: `src/assets/logos/towerai.svg`

- [ ] **Step 1: Write the failing settings smoke test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTowerAIModel } from '~app/bots/towerai/models'

test('settings-facing model resolution keeps custom input first', () => {
  assert.equal(resolveTowerAIModel('gpt-4.1', 'gemini-2.5-pro-preview'), 'gemini-2.5-pro-preview')
})
```

- [ ] **Step 2: Run the build before UI changes and confirm the new panel is still missing**

Run: `yarn build`
Expected: build passes, but there is no TowerAI settings panel yet; this is the behavioral failure before the UI task.

- [ ] **Step 3: Implement the settings panel**

```tsx
import { FC } from 'react'
import RadioGroup from '../RadioGroup'
import Select from '../Select'
import { Input } from '../Input'
import Blockquote from './Blockquote'
import { TOWERAI_COMMON_MODELS } from '~app/bots/towerai/models'
import { UserConfig } from '~services/user-config'

export const TowerAISettings: FC<{
  userConfig: UserConfig
  updateConfigValue: (update: Partial<UserConfig>) => void
}> = ({ userConfig, updateConfigValue }) => (
  <div className="flex flex-col gap-3 w-[420px]">
    <RadioGroup
      options={[
        { label: 'Helper', value: 'helper' },
        { label: 'Manual', value: 'manual' },
      ]}
      value={userConfig.toweraiAuthMode}
      onChange={(v) => updateConfigValue({ toweraiAuthMode: v as 'helper' | 'manual' })}
    />
    <Input
      placeholder="https://tower-ai.yottastudios.com"
      value={userConfig.toweraiBaseUrl}
      onChange={(e) => updateConfigValue({ toweraiBaseUrl: e.currentTarget.value })}
    />
    <Select
      options={TOWERAI_COMMON_MODELS.map((item) => ({ name: item.label, value: item.value }))}
      value={userConfig.toweraiModel}
      onChange={(v) => updateConfigValue({ toweraiModel: v })}
    />
    <Input
      placeholder="Optional custom model id"
      value={userConfig.toweraiCustomModel}
      onChange={(e) => updateConfigValue({ toweraiCustomModel: e.currentTarget.value })}
    />
    {userConfig.toweraiAuthMode === 'helper' ? (
      <Input
        placeholder="http://127.0.0.1:21941"
        value={userConfig.toweraiHelperUrl}
        onChange={(e) => updateConfigValue({ toweraiHelperUrl: e.currentTarget.value })}
      />
    ) : (
      <>
        <Input
          type="password"
          placeholder="TowerAI Token"
          value={userConfig.toweraiToken}
          onChange={(e) => updateConfigValue({ toweraiToken: e.currentTarget.value })}
        />
        <Input
          type="password"
          placeholder="X-lobe-chat-auth"
          value={userConfig.toweraiAuthToken}
          onChange={(e) => updateConfigValue({ toweraiAuthToken: e.currentTarget.value })}
        />
      </>
    )}
    <Blockquote>Helper mode uses the local TowerAI server; manual mode is the fallback.</Blockquote>
  </div>
)
```

- [ ] **Step 4: Mount the panel and request the required permissions**

```ts
if (userConfig?.toweraiBaseUrl) {
  await Browser.permissions.request({ origins: [userConfig.toweraiBaseUrl.replace(/\/$/, '') + '/*'] })
}
if (userConfig?.toweraiAuthMode === 'helper' && userConfig.toweraiHelperUrl) {
  await Browser.permissions.request({ origins: [userConfig.toweraiHelperUrl.replace(/\/$/, '') + '/*'] })
}
```

```ts
host_permissions: [
  // existing entries...
  'https://tower-ai.yottastudios.com/*',
  'http://127.0.0.1/*',
  'http://localhost/*',
]
```

- [ ] **Step 5: Run tests and build after the UI wiring**

Run: `yarn test src/app/bots/towerai/models.test.ts src/app/bots/towerai/helper.test.ts`
Expected: exit code `0`.

Run: `yarn build`
Expected: build succeeds and the generated extension includes the TowerAI settings panel.

- [ ] **Step 6: Commit the UI layer**

```bash
git add src/app/components/Settings/TowerAISettings.tsx src/app/pages/SettingPage.tsx manifest.config.ts src/assets/logos/towerai.svg
git commit -m "feat(chathub): add TowerAI settings UI"
```

## Task 6: End-To-End Verification Before Claiming Completion

**Files:**
- Modify: none
- Verify: `TowerAI/` helper output, ChatHub production build, manual runtime flow

- [ ] **Step 1: Install or refresh dependencies in both workspaces**

Run: `yarn install`
Expected: root dependencies are present, including `tsx`.

Run: `npm install`
Expected: `TowerAI/node_modules` exists with `puppeteer-core` and `tsx`.

- [ ] **Step 2: Re-run the full automated checks**

Run: `yarn test`
Expected: exit code `0`.

Run: `yarn build`
Expected: exit code `0`.

Run: `npm test`
Expected: exit code `0`.

Run: `npm run build`
Expected: exit code `0`.

- [ ] **Step 3: Start the local helper and verify its health**

Run: `npm run helper`
Expected: console prints `listening on http://127.0.0.1:21941`.

Run: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:21941/health | Select-Object -ExpandProperty Content`
Expected: JSON containing `"ok":true`.

- [ ] **Step 4: Manually validate the extension flow**

```text
1. Load the built extension in Chrome.
2. Open Settings and enable TowerAI.
3. Choose Helper mode, keep helper URL at http://127.0.0.1:21941, save, and reload.
4. Send one prompt with GPT-family model, one with Claude-family model, and one with Gemini-family model.
5. Confirm streaming text updates incrementally, stop-generation still works, and chat history persists after refresh.
6. Switch to Manual mode, paste known-good token/auth token, save, and confirm the same flow works with the helper stopped.
```

- [ ] **Step 5: Record the remaining risks in the handoff**

```text
- OA login selectors may change on TowerAI's sign-in page and would require helper updates.
- Helper mode depends on a local Chrome installation and permission to access localhost.
- Curated model labels may drift from TowerAI's server-side catalog; custom model input remains the escape hatch.
```

- [ ] **Step 6: Commit only if verification is green**

```bash
git status --short
git add -A
git commit -m "feat: complete TowerAI integration"
```
