import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon, GlobeAltIcon } from '@heroicons/react/20/solid'
import { FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cx } from '~/utils'
import { TowerAIBot } from '~app/bots/towerai'
import { TOWERAI_COMMON_MODELS, TOWERAI_MODEL_PROVIDERS, DEFAULT_TOWERAI_MODEL } from '~app/bots/towerai/models'
import { BotInstance } from '~app/bots'
import { getUserConfig, updateUserConfig } from '~services/user-config'

type WebSearchMode = 'off' | 'smart' | 'on'

const WEB_SEARCH_OPTIONS: { value: WebSearchMode; label: string; desc: string }[] = [
  { value: 'on', label: '联网搜索', desc: '始终联网搜索' },
  { value: 'smart', label: '智能联网', desc: '智能判断是否搜索' },
  { value: 'off', label: '关闭联网', desc: '仅使用模型基础知识' },
]

interface Props {
  bot?: BotInstance
}

const TowerAIModelSelector: FC<Props> = ({ bot }) => {
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_TOWERAI_MODEL)
  const [webSearch, setWebSearch] = useState<WebSearchMode>('on')
  const [useBuiltinSearch, setUseBuiltinSearch] = useState(true)

  useEffect(() => {
    getUserConfig().then((config) => {
      const saved = config.toweraiModel
      const isValid = TOWERAI_COMMON_MODELS.some((m) => m.value === saved)
      setCurrentModel(isValid ? saved : DEFAULT_TOWERAI_MODEL)
      setWebSearch(config.toweraiWebSearch ?? 'on')
      setUseBuiltinSearch(config.toweraiUseBuiltinSearch ?? true)
    })
  }, [])

  const currentLabel = useMemo(
    () => TOWERAI_COMMON_MODELS.find((m) => m.value === currentModel)?.label ?? currentModel,
    [currentModel],
  )

  const onChange = useCallback(async (value: string) => {
    setCurrentModel(value)
    if (bot instanceof TowerAIBot) {
      bot.setModel(value)
    }
    await updateUserConfig({ toweraiModel: value })
  }, [bot])

  const onWebSearchChange = useCallback(async (mode: WebSearchMode) => {
    setWebSearch(mode)
    await updateUserConfig({ toweraiWebSearch: mode })
  }, [])

  const onBuiltinSearchToggle = useCallback(async () => {
    const next = !useBuiltinSearch
    setUseBuiltinSearch(next)
    await updateUserConfig({ toweraiUseBuiltinSearch: next })
  }, [useBuiltinSearch])

  const currentWebSearchOption = useMemo(
    () => WEB_SEARCH_OPTIONS.find((o) => o.value === webSearch) ?? WEB_SEARCH_OPTIONS[0],
    [webSearch],
  )

  return (
    <div className="flex flex-row gap-2 items-center">
    <Listbox value={currentModel} onChange={onChange}>
      {({ open }) => (
        <div className="relative">
          <Listbox.Button className="relative cursor-default rounded-md bg-secondary px-2 pr-7 py-[3px] text-left text-xs text-primary-text shadow-sm ring-1 ring-inset ring-primary-border focus:outline-none">
            <span className="block truncate max-w-[140px]">{currentLabel}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
              <ChevronUpDownIcon className="h-4 w-4 text-light-text" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-72 w-52 overflow-auto rounded-md bg-white py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none left-0">
              {TOWERAI_MODEL_PROVIDERS.map((provider) => (
                <div key={provider.provider}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide select-none">
                    {provider.label}
                  </div>
                  {provider.models.map((model) => (
                    <Listbox.Option
                      key={model.value}
                      value={model.value}
                      className={({ active }) =>
                        cx(
                          active ? 'bg-primary-blue text-white' : 'text-[#303030]',
                          'relative cursor-default select-none py-1.5 pl-5 pr-9',
                        )
                      }
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={cx(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
                            {model.label}
                          </span>
                          {selected && (
                            <span
                              className={cx(
                                active ? 'text-white' : 'text-primary-blue',
                                'absolute inset-y-0 right-0 flex items-center pr-3',
                              )}
                            >
                              <CheckIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </div>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>

    <Listbox value={webSearch} onChange={onWebSearchChange}>
      {({ open }) => (
        <div className="relative">
          <Listbox.Button className="relative cursor-default rounded-md bg-secondary px-2 pr-7 py-[3px] text-left text-xs text-primary-text shadow-sm ring-1 ring-inset ring-primary-border focus:outline-none flex items-center gap-1">
            <GlobeAltIcon className={cx('h-3.5 w-3.5 shrink-0', webSearch === 'off' ? 'text-light-text' : 'text-primary-blue')} />
            <span className="block truncate max-w-[72px]">{currentWebSearchOption.label}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
              <ChevronUpDownIcon className="h-4 w-4 text-light-text" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 w-52 overflow-auto rounded-md bg-white py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none left-0">
              {WEB_SEARCH_OPTIONS.map((opt) => (
                <Listbox.Option
                  key={opt.value}
                  value={opt.value}
                  className={({ active }) =>
                    cx(active ? 'bg-primary-blue text-white' : 'text-[#303030]', 'relative cursor-default select-none py-2 pl-5 pr-9')
                  }
                >
                  {({ selected, active }) => (
                    <>
                      <div className="flex flex-col">
                        <span className={cx(selected ? 'font-semibold' : 'font-normal')}>{opt.label}</span>
                        <span className={cx('text-[10px]', active ? 'text-white/70' : 'text-gray-400')}>{opt.desc}</span>
                      </div>
                      {selected && (
                        <span className={cx(active ? 'text-white' : 'text-primary-blue', 'absolute inset-y-0 right-0 flex items-center pr-3')}>
                          <CheckIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-2">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[#303030] text-[11px]">使用模型内置搜索引擎</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onBuiltinSearchToggle() }}
                    className={cx(
                      'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none',
                      useBuiltinSearch ? 'bg-primary-blue' : 'bg-gray-200',
                    )}
                  >
                    <span className={cx('pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform', useBuiltinSearch ? 'translate-x-3' : 'translate-x-0')} />
                  </button>
                </label>
              </div>
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
    </div>
  )
}

export default TowerAIModelSelector
