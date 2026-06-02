export type EventImpact = 'Low' | 'Medium' | 'High' | 'Holiday'

export interface WirtschaftsEvent {
  id: string
  title: string
  country: string
  date: string
  time: string
  impact: EventImpact
  forecast: string | null
  previous: string | null
  actual: string | null
}

export interface WirtschaftskalenderData {
  events: WirtschaftsEvent[]
  fetchedAt: string
}
