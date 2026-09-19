import type { Dispatcher } from '../../ui/dispatcher'
import { PopupType } from '../../models/popup'
import { PreferencesTab } from '../../models/preferences'

/**
 * Opens Options → AI. Components deep in the tree (the diff view, the commit
 * box) have no dispatcher, so the app hands it over once at startup.
 */
let dispatcher: Dispatcher | null = null

export function registerAISettingsOpener(appDispatcher: Dispatcher) {
  dispatcher = appDispatcher
}

export function openAISettings() {
  dispatcher?.showPopup({
    type: PopupType.Preferences,
    initialSelectedTab: PreferencesTab.AI,
  })
}

/** The app's dispatcher, for fork components the upstream tree gives none */
export function getRegisteredDispatcher(): Dispatcher | null {
  return dispatcher
}
