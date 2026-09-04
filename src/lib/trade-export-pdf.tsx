import fs from 'node:fs'
import path from 'node:path'
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { Trade } from '@/types/trade'
import { Profile } from '@/types/profile'
import { currencySymbol } from '@/lib/currency'
import type { AppLocale } from '@/i18n/request'

const logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public/logo/report-logo.png'))

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  header: { marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 28, height: 28, marginRight: 10 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666666' },
  summaryBox: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 4 },
  summaryItem: { minWidth: 110, marginRight: 12 },
  summaryLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', marginBottom: 2 },
  summaryValue: { fontSize: 11, fontWeight: 'bold' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dddddd', paddingVertical: 4 },
  cell: { paddingHorizontal: 3 },
  taxNotice: { marginTop: 16, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#dddddd' },
  taxNoticeTitle: { fontSize: 8, fontWeight: 'bold', color: '#666666', marginBottom: 4 },
  taxNoticeItem: { fontSize: 7, color: '#666666', marginBottom: 3, lineHeight: 1.4 },
  colDate: { width: '13%' },
  colInstrument: { width: '14%' },
  colType: { width: '8%' },
  colEntry: { width: '11%', textAlign: 'right' },
  colExit: { width: '11%', textAlign: 'right' },
  colSize: { width: '9%', textAlign: 'right' },
  colPnl: { width: '11%', textAlign: 'right' },
  colCosts: { width: '11%', textAlign: 'right' },
  colNetto: { width: '12%', textAlign: 'right' },
  pageNumber: { position: 'absolute', bottom: 20, right: 32, fontSize: 7, color: '#888888' },
})

const NUMBER_LOCALE: Record<AppLocale, string> = { de: 'de-DE', en: 'en-US' }

const LABELS: Record<AppLocale, {
  title: string
  account: string
  broker: string
  period: string
  exportedOn: string
  tradeCount: string
  grossWin: string
  grossLoss: string
  costs: string
  netResult: string
  colDate: string
  colInstrument: string
  colType: string
  colEntry: string
  colExit: string
  colSize: string
  colPnl: string
  colCosts: string
  colNetto: string
  long: string
  short: string
  taxNoticeTitle: string
  taxNoticeItems: string[]
}> = {
  de: {
    title: 'Steuerreport',
    account: 'Konto',
    broker: 'Broker',
    period: 'Zeitraum',
    exportedOn: 'Exportiert am',
    tradeCount: 'Anzahl Trades',
    grossWin: 'Bruttogewinn',
    grossLoss: 'Bruttoverlust',
    costs: 'Kommission + Swap + Spread',
    netResult: 'Netto-Ergebnis',
    colDate: 'Datum',
    colInstrument: 'Instrument',
    colType: 'Typ',
    colEntry: 'Entry',
    colExit: 'Exit',
    colSize: 'Size',
    colPnl: 'P&L',
    colCosts: 'Kosten',
    colNetto: 'Netto',
    long: 'Long',
    short: 'Short',
    taxNoticeTitle: 'Hinweise zur steuerlichen Behandlung (keine Steuerberatung)',
    taxNoticeItems: [
      'Dieser Report enthält keinen Abzug deutscher Kapitalertragsteuer. Bei ausländischen Brokern erfolgt i.d.R. kein automatischer Steuereinbehalt – die Erträge sind eigenständig in der Anlage KAP anzugeben (Zeile „Kapitalerträge, die dem inländischen Steuerabzug nicht unterlegen haben").',
      'Die frühere Verlustverrechnungsbeschränkung für Termingeschäfte (u.a. CFDs) wurde durch das Jahressteuergesetz 2024 rückwirkend aufgehoben – Gewinne und Verluste sind unbeschränkt verrechenbar.',
      'Der Sparer-Pauschbetrag sowie Kapitalerträge bei anderen Banken/Brokern sind in diesem Report nicht berücksichtigt und müssen separat einbezogen werden.',
      'Zusätzlich zu diesem PDF empfiehlt sich die Aufbewahrung der Kontoauszüge/Transaktionshistorie des Brokers für Rückfragen des Finanzamts.',
    ],
  },
  en: {
    title: 'Trade Report',
    account: 'Account',
    broker: 'Broker',
    period: 'Period',
    exportedOn: 'Exported on',
    tradeCount: 'Number of Trades',
    grossWin: 'Gross Profit',
    grossLoss: 'Gross Loss',
    costs: 'Commission + Swap + Spread',
    netResult: 'Net Result',
    colDate: 'Date',
    colInstrument: 'Instrument',
    colType: 'Type',
    colEntry: 'Entry',
    colExit: 'Exit',
    colSize: 'Size',
    colPnl: 'P&L',
    colCosts: 'Costs',
    colNetto: 'Net',
    long: 'Long',
    short: 'Short',
    taxNoticeTitle: '',
    taxNoticeItems: [],
  },
}

function fmt(n: number, locale: AppLocale): string {
  return n.toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPrice(n: number, locale: AppLocale): string {
  return n.toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 2, maximumFractionDigits: 5 })
}

function fmtDate(iso: string, locale: AppLocale): string {
  return new Date(iso).toLocaleDateString(NUMBER_LOCALE[locale], { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  trades: Trade[]
  profile: Profile
  yearLabel: string
  locale: AppLocale
}

function TradeReportDocument({ trades, profile, yearLabel, locale }: Props) {
  const t = LABELS[locale]
  const symbol = currencySymbol(profile.currency)
  const closed = trades.filter(tr => tr.pnl !== undefined)
  const gross = closed.reduce((acc, tr) => {
    const pnl = tr.pnl ?? 0
    if (pnl >= 0) acc.win += pnl
    else acc.loss += pnl
    return acc
  }, { win: 0, loss: 0 })
  const totalCosts = closed.reduce((s, tr) => s + (tr.commission ?? 0) + (tr.swap ?? 0) + (tr.spreadCost ?? 0), 0)
  const netResult = gross.win + gross.loss - totalCosts
  const sorted = [...trades].sort((a, b) => {
    const aClose = a.closeTime ?? a.date
    const bClose = b.closeTime ?? b.date
    return aClose < bClose ? -1 : aClose > bClose ? 1 : 0
  })
  const periodLabel = sorted.length > 0
    ? sorted.length === 1
      ? fmtDate(sorted[0].closeTime ?? sorted[0].date, locale)
      : `${fmtDate(sorted[0].closeTime ?? sorted[0].date, locale)} – ${fmtDate(sorted[sorted.length - 1].closeTime ?? sorted[sorted.length - 1].date, locale)}`
    : yearLabel

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoBuffer} style={styles.logo} />
          <View>
            <Text style={styles.title}>{t.title} – {profile.name}</Text>
            <Text style={styles.subtitle}>
              {profile.broker ? `${t.broker}: ${profile.broker} · ` : ''}{t.account}: {profile.currency} · {t.period}: {periodLabel} · {t.exportedOn} {new Date().toLocaleDateString(NUMBER_LOCALE[locale])}
            </Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.tradeCount}</Text>
            <Text style={styles.summaryValue}>{closed.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.grossWin}</Text>
            <Text style={styles.summaryValue}>+{fmt(gross.win, locale)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.grossLoss}</Text>
            <Text style={styles.summaryValue}>{fmt(gross.loss, locale)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.costs}</Text>
            <Text style={styles.summaryValue}>-{fmt(totalCosts, locale)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.netResult}</Text>
            <Text style={styles.summaryValue}>{netResult >= 0 ? '+' : ''}{fmt(netResult, locale)} {symbol}</Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.cell, styles.colDate]}>{t.colDate}</Text>
            <Text style={[styles.cell, styles.colInstrument]}>{t.colInstrument}</Text>
            <Text style={[styles.cell, styles.colType]}>{t.colType}</Text>
            <Text style={[styles.cell, styles.colEntry]}>{t.colEntry}</Text>
            <Text style={[styles.cell, styles.colExit]}>{t.colExit}</Text>
            <Text style={[styles.cell, styles.colSize]}>{t.colSize}</Text>
            <Text style={[styles.cell, styles.colPnl]}>{t.colPnl}</Text>
            <Text style={[styles.cell, styles.colCosts]}>{t.colCosts}</Text>
            <Text style={[styles.cell, styles.colNetto]}>{t.colNetto}</Text>
          </View>
          {sorted.map(tr => {
            const costs = (tr.commission ?? 0) + (tr.swap ?? 0) + (tr.spreadCost ?? 0)
            const netto = tr.pnl !== undefined ? tr.pnl - costs : undefined
            return (
              <View style={styles.tableRow} key={tr.id} wrap={false}>
                <Text style={[styles.cell, styles.colDate]}>{fmtDate(tr.closeTime ?? tr.date, locale)}</Text>
                <Text style={[styles.cell, styles.colInstrument]}>{tr.instrument}</Text>
                <Text style={[styles.cell, styles.colType]}>{tr.type === 'long' ? t.long : t.short}</Text>
                <Text style={[styles.cell, styles.colEntry]}>{fmtPrice(tr.entry, locale)}</Text>
                <Text style={[styles.cell, styles.colExit]}>{tr.exit !== undefined ? fmtPrice(tr.exit, locale) : '-'}</Text>
                <Text style={[styles.cell, styles.colSize]}>{tr.size}</Text>
                <Text style={[styles.cell, styles.colPnl]}>{tr.pnl !== undefined ? fmt(tr.pnl, locale) : '-'}</Text>
                <Text style={[styles.cell, styles.colCosts]}>{fmt(costs, locale)}</Text>
                <Text style={[styles.cell, styles.colNetto]}>{netto !== undefined ? fmt(netto, locale) : '-'}</Text>
              </View>
            )
          })}
        </View>

        {locale === 'de' && (
          <View style={styles.taxNotice}>
            <Text style={styles.taxNoticeTitle}>{t.taxNoticeTitle}</Text>
            {t.taxNoticeItems.map((item, i) => (
              <Text style={styles.taxNoticeItem} key={i}>• {item}</Text>
            ))}
          </View>
        )}

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}

export async function buildTradePdf(trades: Trade[], profile: Profile, yearLabel: string, locale: AppLocale): Promise<Buffer> {
  return renderToBuffer(<TradeReportDocument trades={trades} profile={profile} yearLabel={yearLabel} locale={locale} />)
}
