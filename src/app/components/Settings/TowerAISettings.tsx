import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import {
  findTowerAIProviderByModel,
  getTowerAIModelsForProvider,
  TOWERAI_MODEL_PROVIDERS,
  type TowerAIProviderId,
} from '~app/bots/towerai/models'
import Button from '~app/components/Button'
import { Input } from '~app/components/Input'
import RadioGroup from '~app/components/RadioGroup'
import Select from '~app/components/Select'
import Toggle from '~app/components/Toggle'
import type { UserConfig } from '~services/user-config'
import Blockquote from './Blockquote'
import { normalizeTowerAIModelForProvider } from './TowerAISettings.helpers'

interface Props {
  userConfig: UserConfig
  updateConfigValue: (update: Partial<UserConfig>) => void
}

interface HelperStateResponse {
  ok?: boolean
  data?: {
    connected?: boolean
    loggedIn?: boolean
    hasToken?: boolean
    expiresSoon?: boolean
    lastRefreshAt?: string
  }
}

const TowerAISettings: FC<Props> = ({ userConfig, updateConfigValue }) => {
  const [helperStatus, setHelperStatus] = useState('Not checked')
  const [loadingAction, setLoadingAction] = useState<'login' | 'refresh' | 'status' | ''>('')

  const helperBaseUrl = useMemo(() => userConfig.toweraiHelperUrl.replace(/\/$/, ''), [userConfig.toweraiHelperUrl])
  const selectedProvider = useMemo(
    () => findTowerAIProviderByModel(userConfig.toweraiModel),
    [userConfig.toweraiModel],
  )
  const providerModels = useMemo(() => getTowerAIModelsForProvider(selectedProvider), [selectedProvider])
  const selectedModel = useMemo(
    () => normalizeTowerAIModelForProvider(userConfig.toweraiModel, selectedProvider),
    [selectedProvider, userConfig.toweraiModel],
  )

  const refreshHelperState = useCallback(async () => {
    if (!helperBaseUrl) {
      setHelperStatus('Helper URL missing')
      return
    }

    setLoadingAction('status')
    try {
      const healthResponse = await fetch(`${helperBaseUrl}/health`)
      if (!healthResponse.ok) {
        throw new Error(`health ${healthResponse.status}`)
      }

      const stateResponse = await fetch(`${helperBaseUrl}/auth/state`)
      if (!stateResponse.ok) {
        throw new Error(`state ${stateResponse.status}`)
      }

      const state = (await stateResponse.json()) as HelperStateResponse
      const data = state.data
      if (!data) {
        setHelperStatus('Helper connected, auth state unavailable')
        return
      }

      const parts = [
        data.connected ? 'Connected' : 'Disconnected',
        data.loggedIn ? 'Logged in' : 'Not logged in',
        data.hasToken ? 'Token ready' : 'No token',
      ]
      if (data.lastRefreshAt) {
        parts.push(`Last refresh: ${new Date(data.lastRefreshAt).toLocaleString()}`)
      }
      setHelperStatus(parts.join(' | '))
    } catch (error) {
      setHelperStatus(`Unavailable: ${(error as Error).message}`)
    } finally {
      setLoadingAction('')
    }
  }, [helperBaseUrl])

  const runHelperAction = useCallback(
    async (action: 'login' | 'refresh') => {
      if (!helperBaseUrl) {
        setHelperStatus('Helper URL missing')
        return
      }

      setLoadingAction(action)
      try {
        const response = await fetch(`${helperBaseUrl}/auth/${action}`, { method: 'POST' })
        if (!response.ok) {
          throw new Error(`${action} ${response.status}`)
        }
        await refreshHelperState()
      } catch (error) {
        setHelperStatus(`Action failed: ${(error as Error).message}`)
        setLoadingAction('')
      }
    },
    [helperBaseUrl, refreshHelperState],
  )

  useEffect(() => {
    if (userConfig.toweraiAuthMode === 'helper') {
      refreshHelperState()
    }
  }, [refreshHelperState, userConfig.toweraiAuthMode])

  useEffect(() => {
    if (selectedModel !== userConfig.toweraiModel) {
      updateConfigValue({ toweraiModel: selectedModel })
    }
  }, [selectedModel, updateConfigValue, userConfig.toweraiModel])

  return (
    <div className="flex flex-col gap-3 w-[420px]">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Auth Mode</p>
        <RadioGroup
          options={[
            { label: 'Helper', value: 'helper' },
            { label: 'Manual', value: 'manual' },
          ]}
          value={userConfig.toweraiAuthMode}
          onChange={(v) => updateConfigValue({ toweraiAuthMode: v as 'helper' | 'manual' })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Base URL</p>
        <Input
          placeholder="https://tower-ai.yottastudios.com"
          value={userConfig.toweraiBaseUrl}
          onChange={(e) => updateConfigValue({ toweraiBaseUrl: e.currentTarget.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Provider</p>
        <Select
          options={TOWERAI_MODEL_PROVIDERS.map((item) => ({ name: item.label, value: item.provider }))}
          value={selectedProvider}
          onChange={(provider) => {
            const nextModel = getTowerAIModelsForProvider(provider as TowerAIProviderId)[0]?.value ?? ''
            updateConfigValue({ toweraiModel: nextModel })
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Model</p>
        <Select
          options={providerModels.map((item) => ({ name: item.label, value: item.value }))}
          value={selectedModel}
          onChange={(v) => updateConfigValue({ toweraiModel: v })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Custom Model ID</p>
        <Input
          placeholder="Optional custom model id"
          value={userConfig.toweraiCustomModel}
          onChange={(e) => updateConfigValue({ toweraiCustomModel: e.currentTarget.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium text-sm">Helper</p>
        <Input
          placeholder="http://127.0.0.1:21941"
          value={userConfig.toweraiHelperUrl}
          onChange={(e) => updateConfigValue({ toweraiHelperUrl: e.currentTarget.value })}
        />
        <div className="flex flex-row gap-2">
          <Button
            size="tiny"
            text="Check"
            onClick={() => refreshHelperState()}
            isLoading={loadingAction === 'status'}
          />
          <Button
            size="tiny"
            text="Login"
            color="primary"
            onClick={() => runHelperAction('login')}
            isLoading={loadingAction === 'login'}
          />
          <Button
            size="tiny"
            text="Refresh"
            onClick={() => runHelperAction('refresh')}
            isLoading={loadingAction === 'refresh'}
          />
        </div>
        <Blockquote>{helperStatus}</Blockquote>
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Manual Token</p>
        <Input
          type="password"
          placeholder="TowerAI token"
          value={userConfig.toweraiToken}
          onChange={(e) => updateConfigValue({ toweraiToken: e.currentTarget.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Manual Auth Token</p>
        <Input
          type="password"
          placeholder="X-lobe-chat-auth"
          value={userConfig.toweraiAuthToken}
          onChange={(e) => updateConfigValue({ toweraiAuthToken: e.currentTarget.value })}
        />
      </div>

      <div className="flex flex-row items-center justify-between">
        <p className="font-medium text-sm">Auto Refresh</p>
        <Toggle
          enabled={userConfig.toweraiAutoRefresh}
          onChange={(enabled) => updateConfigValue({ toweraiAutoRefresh: enabled })}
        />
      </div>

      <Blockquote>
        Helper mode reads credentials from the local TowerAI helper. Manual credentials remain available as a fallback.
      </Blockquote>
    </div>
  )
}

export default TowerAISettings
