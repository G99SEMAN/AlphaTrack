import messages from '../messages/de.json'
import { AppLocale } from '@/i18n/request'

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale
    Messages: typeof messages
  }
}
