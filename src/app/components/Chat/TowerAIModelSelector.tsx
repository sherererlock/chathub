import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cx } from '~/utils'
import { TowerAIBot } from '~app/bots/towerai'
import { TOWERAI_COMMON_MODELS, TOWERAI_MODEL_PROVIDERS, DEFAULT_TOWERAI_MODEL } from '~app/bots/towerai/models'
import { BotInstance } from '~app/bots'
import { getUserConfig, updateUserConfig } from '~services/user-config'

interface Props {
  bot?: BotInstance
}

const TowerAIModelSelector: FC<Props> = ({ bot }) => {
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_TOWERAI_MODEL)

  useEffect(() => {
    getUserConfig().then((config) => {
      const saved = config.toweraiModel
      const isValid = TOWERAI_COMMON_MODELS.some((m) => m.value === saved)
      setCurrentModel(isValid ? saved : DEFAULT_TOWERAI_MODEL)
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

  return (
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
  )
}

export default TowerAIModelSelector
