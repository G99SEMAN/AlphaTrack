export type NewsCategory =
  | 'monetary-policy'
  | 'earnings'
  | 'geopolitical'
  | 'commodities'
  | 'crypto'
  | 'general'

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  category: NewsCategory
}
