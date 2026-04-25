import { UserConfig } from '~services/user-config'
import { ChatError, ErrorCode } from '~utils/errors'

type TowerAICredentialConfig = Pick<
  UserConfig,
  'toweraiAuthMode' | 'toweraiToken' | 'toweraiAuthToken' | 'toweraiHelperUrl'
>

function normalizeHelperUrl(helperUrl: string) {
  return helperUrl.replace(/\/$/, '')
}

async function requestHelper(
  helperUrl: string,
  path: '/auth/token' | '/auth/refresh',
  init?: RequestInit,
) {
  const response = await fetch(`${normalizeHelperUrl(helperUrl)}${path}`, init)
  if (!response.ok) {
    throw new Error(`helper returned ${response.status}`)
  }

  return (await response.json()) as {
    ok?: boolean
    data?: { token?: unknown; authToken?: unknown }
  }
}

function resolveManualCredentials(config: TowerAICredentialConfig) {
  const token = config.toweraiToken.trim()
  if (!token) {
    throw new ChatError('TowerAI token missing', ErrorCode.TOWERAI_AUTH_MISSING)
  }

  return {
    token,
    authToken: config.toweraiAuthToken.trim(),
  }
}

export async function resolveTowerAICredentials(config: TowerAICredentialConfig) {
  if (config.toweraiAuthMode === 'manual') {
    return resolveManualCredentials(config)
  }

  try {
    const body = await requestHelper(config.toweraiHelperUrl, '/auth/token')
    const token = typeof body.data?.token === 'string' ? body.data.token.trim() : ''
    const authToken = typeof body.data?.authToken === 'string' ? body.data.authToken.trim() : ''

    if (token) {
      return { token, authToken }
    }
  } catch (error) {
    const fallbackToken = config.toweraiToken.trim()
    if (fallbackToken) {
      return {
        token: fallbackToken,
        authToken: config.toweraiAuthToken.trim(),
      }
    }

    throw new ChatError(
      `TowerAI helper unavailable: ${(error as Error).message}`,
      ErrorCode.TOWERAI_HELPER_UNAVAILABLE,
    )
  }

  return resolveManualCredentials(config)
}

export async function refreshTowerAICredentials(config: TowerAICredentialConfig) {
  if (config.toweraiAuthMode !== 'helper') {
    return resolveManualCredentials(config)
  }

  try {
    await requestHelper(config.toweraiHelperUrl, '/auth/refresh', { method: 'POST' })
  } catch (error) {
    throw new ChatError(
      `TowerAI helper unavailable: ${(error as Error).message}`,
      ErrorCode.TOWERAI_HELPER_UNAVAILABLE,
    )
  }

  return resolveTowerAICredentials(config)
}
