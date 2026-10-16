export type LocalDateKey = `${number}-${string}-${string}`

export type Activity = { id: string; time: string; label: string; category: string }
export type Mood = 'low' | 'okay' | 'good'
export type DayRecord = {
  checkedActivityIds?: string[]
  note?: string
  mood?: Mood
  digitalBreak?: boolean
  scheduleOverride?: Activity[]
}
export type Store = {
  days: Record<string, DayRecord>
  settings: {
    gymPreference: 'morning' | 'evening'
    scheduleTemplate: Activity[]
    sevenDayWindowStartDate: LocalDateKey
    quoteSeed: string
  }
}

export const STORAGE_KEY = 'my-daily-reset'

export function formatLocalDate(date: Date): LocalDateKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(dateKey: string, amount: number): LocalDateKey {
  const [year, month, day] = dateKey.split('-').map(Number)
  return formatLocalDate(new Date(year, month - 1, day + amount, 12))
}

export function mondayOfWeek(dateKey: string): LocalDateKey {
  const [year, month, day] = dateKey.split('-').map(Number)
  return addDays(dateKey, -((new Date(year, month - 1, day, 12).getDay() + 6) % 7))
}

export function retentionCutoff(today: string): LocalDateKey {
  return addDays(today, -29)
}

export function isValidDateKey(value: string): value is LocalDateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return formatLocalDate(new Date(year, month - 1, day, 12)) === value
}

export const DEFAULT_SCHEDULE: Activity[] = [
  { id: 'wake', time: '08:30', label: 'Wake up, breakfast & hygiene', category: 'Wellbeing' },
  { id: 'jobs', time: '09:00', label: 'Job search / interview prep', category: 'Career' },
  { id: 'move', time: '11:00', label: 'Gentle movement / personal time', category: 'Movement' },
  { id: 'lunch', time: '12:00', label: 'Lunch & shower', category: 'Wellbeing' },
  { id: 'project', time: '13:00', label: 'Projects or learning (optional)', category: 'Career' },
  { id: 'chores', time: '14:30', label: 'Chores / errands', category: 'Home' },
  { id: 'rest', time: '16:00', label: 'Rest, music or reading', category: 'Rest' },
  { id: 'dinner', time: '18:00', label: 'Dinner & family time', category: 'Social' },
  { id: 'evening', time: '20:30', label: 'Gaming / friends / free time', category: 'Social' },
  { id: 'wind', time: '22:00', label: 'Wind down, phone away', category: 'Rest' },
  { id: 'sleep', time: '23:30', label: 'Bedtime', category: 'Wellbeing' },
]

export function createDefaultStore(today: LocalDateKey): Store {
  return {
    days: {},
    settings: {
      gymPreference: 'morning',
      scheduleTemplate: structuredClone(DEFAULT_SCHEDULE),
      sevenDayWindowStartDate: today,
      quoteSeed: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    },
  }
}

export function isDayEditable(day: string, today: string): boolean {
  return isValidDateKey(day) && day >= retentionCutoff(today) && day <= today
}

export function activitiesFor(record: DayRecord, settings: Store['settings'], gym: 'morning' | 'evening'): Activity[] {
  const original = record.scheduleOverride ?? settings.scheduleTemplate
  return original
    .map((activity) => {
      if (activity.id === 'move') return { ...activity, label: gym === 'morning' ? 'Gym window / gentle movement' : 'Personal time / gentle movement' }
      if (activity.id === 'evening') return { ...activity, label: gym === 'evening' ? 'Gym window / gentle movement' : 'Gaming / friends / free time' }
      return activity
    })
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function pruneStore(store: Store, today: LocalDateKey): Store {
  const cutoff = retentionCutoff(today)
  for (const day of Object.keys(store.days)) if (day < cutoff) delete store.days[day]
  return store
}

export function writeDay(store: Store, day: string, record: DayRecord): void {
  const clean: DayRecord = {}
  const checked = [...new Set(record.checkedActivityIds ?? [])]
  if (checked.length) clean.checkedActivityIds = checked
  if (record.note?.trim()) clean.note = record.note
  if (record.mood) clean.mood = record.mood
  if (record.digitalBreak) clean.digitalBreak = true
  if (record.scheduleOverride && JSON.stringify(record.scheduleOverride) !== JSON.stringify(store.settings.scheduleTemplate)) {
    clean.scheduleOverride = record.scheduleOverride
  }
  if (Object.keys(clean).length) store.days[day] = clean
  else delete store.days[day]
}

export function parseStore(value: unknown): Store {
  if (!value || typeof value !== 'object') throw new Error('Backup must contain a store object')
  const candidate = value as Partial<Store>
  if (!candidate.days || typeof candidate.days !== 'object' || !candidate.settings) {
    throw new Error('Store is incomplete')
  }
  const settings = candidate.settings
  if (!['morning', 'evening'].includes(settings.gymPreference) || !Array.isArray(settings.scheduleTemplate) ||
      !isValidDateKey(settings.sevenDayWindowStartDate) || typeof settings.quoteSeed !== 'string') {
    throw new Error('Store settings are invalid')
  }
  const validActivity = (activity: unknown): activity is Activity => {
    if (!activity || typeof activity !== 'object') return false
    const item = activity as Activity
    return ['id', 'time', 'label', 'category'].every((key) => typeof item[key as keyof Activity] === 'string')
  }
  if (!settings.scheduleTemplate.every(validActivity)) throw new Error('Schedule template is invalid')
  const days: Record<string, DayRecord> = {}
  for (const [date, raw] of Object.entries(candidate.days)) {
    if (!isValidDateKey(date) || !raw || typeof raw !== 'object') throw new Error('Day record is invalid')
    const record = raw as DayRecord
    if (record.checkedActivityIds !== undefined && (!Array.isArray(record.checkedActivityIds) || !record.checkedActivityIds.every((id) => typeof id === 'string')) ||
        record.note !== undefined && typeof record.note !== 'string' ||
        record.mood !== undefined && !['low', 'okay', 'good'].includes(record.mood) ||
        record.digitalBreak !== undefined && typeof record.digitalBreak !== 'boolean' ||
        record.scheduleOverride !== undefined && (!Array.isArray(record.scheduleOverride) || !record.scheduleOverride.every(validActivity))) {
      throw new Error('Day record is invalid')
    }
    const temp: Store = { days: {}, settings: structuredClone(settings) }
    writeDay(temp, date, record)
    if (temp.days[date]) days[date] = temp.days[date]
  }
  return { days, settings: structuredClone(settings) }
}
