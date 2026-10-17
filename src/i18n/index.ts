import { EN_ACCOUNT } from './account'
import { EN_CASINO } from './casino'
import { EN_CORE } from './core'
import { EN_FAUCETS } from './faucets'
import { EN_LANDING } from './landing'

// English dictionary, keyed by the Spanish source text. Split by area so each
// part can be edited on its own.
export const EN: Record<string, string> = { ...EN_CORE, ...EN_LANDING, ...EN_ACCOUNT, ...EN_CASINO, ...EN_FAUCETS }
