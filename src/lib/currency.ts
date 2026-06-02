import type { Currency } from '@/types/profile'

const SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  USDT: 'USDT',
}

export function currencySymbol(currency: Currency | string): string {
  return SYMBOLS[currency as Currency] ?? currency
}
