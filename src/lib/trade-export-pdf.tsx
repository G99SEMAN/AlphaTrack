import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Trade } from '@/types/trade'
import { Profile } from '@/types/profile'
import { currencySymbol } from '@/lib/currency'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  header: { marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666666' },
  summaryBox: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 4 },
  summaryItem: { minWidth: 110, marginRight: 12 },
  summaryLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', marginBottom: 2 },
  summaryValue: { fontSize: 11, fontWeight: 'bold' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dddddd', paddingVertical: 4 },
  cell: { paddingHorizontal: 3 },
  colDate: { width: '13%' },
  colInstrument: { width: '14%' },
  colType: { width: '8%' },
  colEntry: { width: '11%', textAlign: 'right' },
  colExit: { width: '11%', textAlign: 'right' },
  colSize: { width: '9%', textAlign: 'right' },
  colPnl: { width: '11%', textAlign: 'right' },
  colCosts: { width: '11%', textAlign: 'right' },
  colNetto: { width: '12%', textAlign: 'right' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#888888', borderTopWidth: 0.5, borderTopColor: '#dddddd', paddingTop: 6 },
  pageNumber: { position: 'absolute', bottom: 20, right: 32, fontSize: 7, color: '#888888' },
})

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  trades: Trade[]
  profile: Profile
  yearLabel: string
}

function TradeReportDocument({ trades, profile, yearLabel }: Props) {
  const symbol = currencySymbol(profile.currency)
  const closed = trades.filter(t => t.pnl !== undefined)
  const gross = closed.reduce((acc, t) => {
    const pnl = t.pnl ?? 0
    if (pnl >= 0) acc.win += pnl
    else acc.loss += pnl
    return acc
  }, { win: 0, loss: 0 })
  const totalCosts = closed.reduce((s, t) => s + (t.commission ?? 0) + (t.swap ?? 0), 0)
  const netResult = gross.win + gross.loss - totalCosts
  const sorted = [...trades].sort((a, b) => {
    const aClose = a.closeTime ?? a.date
    const bClose = b.closeTime ?? b.date
    return aClose < bClose ? -1 : aClose > bClose ? 1 : 0
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Steuerreport – {profile.name}</Text>
          <Text style={styles.subtitle}>
            {profile.broker ? `Broker: ${profile.broker} · ` : ''}Konto: {profile.currency} · Zeitraum: {yearLabel} · Exportiert am {new Date().toLocaleDateString('de-DE')}
          </Text>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Anzahl Trades</Text>
            <Text style={styles.summaryValue}>{closed.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bruttogewinn</Text>
            <Text style={styles.summaryValue}>+{fmt(gross.win)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bruttoverlust</Text>
            <Text style={styles.summaryValue}>{fmt(gross.loss)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Kommission + Swap</Text>
            <Text style={styles.summaryValue}>-{fmt(totalCosts)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Netto-Ergebnis</Text>
            <Text style={styles.summaryValue}>{netResult >= 0 ? '+' : ''}{fmt(netResult)} {symbol}</Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.cell, styles.colDate]}>Datum</Text>
            <Text style={[styles.cell, styles.colInstrument]}>Instrument</Text>
            <Text style={[styles.cell, styles.colType]}>Typ</Text>
            <Text style={[styles.cell, styles.colEntry]}>Entry</Text>
            <Text style={[styles.cell, styles.colExit]}>Exit</Text>
            <Text style={[styles.cell, styles.colSize]}>Size</Text>
            <Text style={[styles.cell, styles.colPnl]}>P&L</Text>
            <Text style={[styles.cell, styles.colCosts]}>Kosten</Text>
            <Text style={[styles.cell, styles.colNetto]}>Netto</Text>
          </View>
          {sorted.map(t => {
            const costs = (t.commission ?? 0) + (t.swap ?? 0)
            const netto = t.pnl !== undefined ? t.pnl - costs : undefined
            return (
              <View style={styles.tableRow} key={t.id} wrap={false}>
                <Text style={[styles.cell, styles.colDate]}>{fmtDate(t.closeTime ?? t.date)}</Text>
                <Text style={[styles.cell, styles.colInstrument]}>{t.instrument}</Text>
                <Text style={[styles.cell, styles.colType]}>{t.type === 'long' ? 'Long' : 'Short'}</Text>
                <Text style={[styles.cell, styles.colEntry]}>{t.entry}</Text>
                <Text style={[styles.cell, styles.colExit]}>{t.exit ?? '-'}</Text>
                <Text style={[styles.cell, styles.colSize]}>{t.size}</Text>
                <Text style={[styles.cell, styles.colPnl]}>{t.pnl !== undefined ? fmt(t.pnl) : '-'}</Text>
                <Text style={[styles.cell, styles.colCosts]}>{fmt(costs)}</Text>
                <Text style={[styles.cell, styles.colNetto]}>{netto !== undefined ? fmt(netto) : '-'}</Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer} fixed>
          Dies ist kein amtliches Steuerdokument. Bitte in Zusammenarbeit mit einem Steuerberater prüfen. Bei Fremdwährungskonten ist ggf. eine manuelle Umrechnung zum Tageskurs erforderlich.
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}

export async function buildTradePdf(trades: Trade[], profile: Profile, yearLabel: string): Promise<Buffer> {
  return renderToBuffer(<TradeReportDocument trades={trades} profile={profile} yearLabel={yearLabel} />)
}
