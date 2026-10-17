import { locale, t } from './i18n'

// Points are worth a fixed amount and are paid out manually by an admin.
// Keep these in sync with public.request_withdrawal (supabase/migrations/202610170014).
export const POINTS_PER_USD = 1000
export const MIN_WITHDRAWAL_POINTS = 5000
export const REFERRAL_REWARD_POINTS = 100

export type WithdrawalMethod = 'ltc' | 'usdt_bep20' | 'trx' | 'doge' | 'binance_pay'
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected'

export type MethodInfo = {
  label: string
  network: string
  addressLabel: string
  placeholder: string
  pattern: RegExp
  explorer?: (tx: string) => string
}

// Labels are read through getters so they follow the current language.
export const WITHDRAWAL_METHODS: Record<WithdrawalMethod, MethodInfo> = {
  usdt_bep20: {
    label: 'USDT',
    network: 'BNB Smart Chain (BEP20)',
    get addressLabel() { return t('Dirección USDT (BEP20)') },
    placeholder: '0x…',
    pattern: /^0x[a-fA-F0-9]{40}$/,
    explorer: (tx) => `https://bscscan.com/tx/${tx}`,
  },
  ltc: {
    label: 'Litecoin',
    network: 'Litecoin',
    get addressLabel() { return t('Dirección LTC') },
    placeholder: 'ltc1… / L… / M…',
    pattern: /^(ltc1[a-z0-9]{25,62}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$/,
    explorer: (tx) => `https://blockchair.com/litecoin/transaction/${tx}`,
  },
  trx: {
    label: 'TRON',
    network: 'TRON (TRC20)',
    get addressLabel() { return t('Dirección TRX') },
    placeholder: 'T…',
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    explorer: (tx) => `https://tronscan.org/#/transaction/${tx}`,
  },
  doge: {
    label: 'Dogecoin',
    network: 'Dogecoin',
    get addressLabel() { return t('Dirección DOGE') },
    placeholder: 'D…',
    pattern: /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/,
    explorer: (tx) => `https://blockchair.com/dogecoin/transaction/${tx}`,
  },
  binance_pay: {
    label: 'Binance Pay',
    get network() { return t('Binance Pay (sin comisiones)') },
    get addressLabel() { return t('Pay ID de Binance') },
    placeholder: '123456789',
    pattern: /^[0-9]{6,12}$/,
  },
}

export const METHOD_ORDER: WithdrawalMethod[] = ['usdt_bep20', 'binance_pay', 'ltc', 'trx', 'doge']

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  get pending() { return t('Pendiente') },
  get paid() { return t('Pagado') },
  get rejected() { return t('Rechazado') },
}

export const pointsToUsd = (points: number) => points / POINTS_PER_USD

export function formatUsd(amount: number) {
  return amount.toLocaleString(locale(), { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: amount > 0 && amount < 0.01 ? 3 : 2 })
}

export const isValidAddress = (method: WithdrawalMethod, address: string) => WITHDRAWAL_METHODS[method].pattern.test(address.trim())

// Explorer link for a paid withdrawal, when the reference looks like a transaction hash.
export function explorerUrl(method: WithdrawalMethod, txRef: string | null) {
  const explorer = WITHDRAWAL_METHODS[method].explorer
  return explorer && txRef && /^(0x)?[a-fA-F0-9]{40,80}$/.test(txRef) ? explorer(txRef) : null
}
