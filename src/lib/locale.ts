'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n/request'

const COOKIE_NAME = 'NEXT_LOCALE'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setLocaleAction(locale: AppLocale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, locale, { maxAge: ONE_YEAR_SECONDS, path: '/' })
  revalidatePath('/', 'layout')
}
