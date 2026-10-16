<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Moon, RotateCcw, Settings, Sunrise, Timer, Upload, X } from 'lucide-vue-next'
import { activitiesFor, addDays, createDefaultStore, formatLocalDate, isDayEditable, mondayOfWeek, parseStore, pruneStore, retentionCutoff, STORAGE_KEY, writeDay, type Activity, type DayRecord, type Mood, type Store } from './lib/store'

const todayKey = ref(formatLocalDate(new Date()))
const selected = ref(todayKey.value)
const weekStart = ref(mondayOfWeek(todayKey.value))
const tab=ref<'planner'|'social'|'settings'>('planner'),editing=ref(false),newTime=ref('15:00'),newLabel=ref(''),newCategory=ref('Personal'),confirmReset=ref(false)
const storageError = ref('')
let storageBlocked = false
function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return createDefaultStore(todayKey.value)
    return parseStore(JSON.parse(raw))
  } catch {
    storageBlocked = true
    storageError.value = 'Saved data could not be read, so it has been left untouched. Import a valid backup or choose a fresh store to continue saving.'
    return createDefaultStore(todayKey.value)
  }
}
const state = ref<Store>(loadStore())
const quotes = [
  'Take today one moment at a time.',
  'A pause can be part of the plan.',
  'Your day can be shaped in small ways.',
  'Begin wherever you are today.',
]
function quoteIndex(date: string, seed: string) {
  let hash = 0
  for (const char of `${date}:${seed}`) hash = Math.imul(hash, 31) + char.charCodeAt(0) | 0
  return (hash >>> 0) % quotes.length
}
const dailyQuote = computed(() => quotes[quoteIndex(todayKey.value, state.value.settings.quoteSeed)])
function persist() {
  if (storageBlocked) return
  pruneStore(state.value, todayKey.value)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value)) }
  catch { storageError.value = 'This device could not save changes. Your in-memory changes are still visible.' }
}
if (!storageBlocked) persist()
watch(state, persist, { deep: true })

const dates = computed(() => {
  const start = weekStart.value
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i)
    const date = new Date(`${key}T12:00:00`)
    return { key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), day: date.getDate() }
  })
})
const weekLabel = computed(() => {
  const start = new Date(`${weekStart.value}T12:00:00`)
  const end = new Date(`${addDays(weekStart.value, 6)}T12:00:00`)
  const startMonth = start.toLocaleDateString('en-US', { month: 'long' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' })
  const year = end.getFullYear()
  return start.getMonth() === end.getMonth() && start.getFullYear() === year
    ? `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`
    : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${year}`
})
function canEditDay(date: string) {
  return isDayEditable(date, todayKey.value)
}
function moveWeek(amount: number) {
  weekStart.value = addDays(weekStart.value, amount * 7)
  selected.value = weekStart.value
  editing.value = false
}
function goToday() {
  weekStart.value = mondayOfWeek(todayKey.value)
  selected.value = todayKey.value
  editing.value = false
}
const editable = computed(() => canEditDay(selected.value))
const expired = computed(() => selected.value < retentionCutoff(todayKey.value))
const selectedRecord = computed(() => editable.value ? state.value.days[selected.value] ?? {} : {})
const gym = computed({ get: () => state.value.settings.gymPreference, set: (value: 'morning' | 'evening') => { state.value.settings.gymPreference = value } })
const checked = (id: string) => selectedRecord.value.checkedActivityIds?.includes(id) ?? false
const count = computed(() => activitiesFor(selectedRecord.value, state.value.settings, gym.value).filter((activity) => checked(activity.id)).length)
const pct = computed(() => Math.round(count.value / Math.max(activitiesFor(selectedRecord.value, state.value.settings, gym.value).length, 1) * 100))
const socialDates = computed(() => Array.from({ length: 7 }, (_, i) => addDays(state.value.settings.sevenDayWindowStartDate, i)))
const socialWindowExpired = computed(() => addDays(state.value.settings.sevenDayWindowStartDate, 6) < retentionCutoff(todayKey.value))
const socialMarked = (date: string) => state.value.days[date]?.digitalBreak ?? false
const socialCount = computed(() => socialDates.value.filter(socialMarked).length)
function copyDayRecord(record: DayRecord): DayRecord {
  const source = toRaw(record)
  const copy: DayRecord = {}
  if (source.checkedActivityIds) copy.checkedActivityIds = [...toRaw(source.checkedActivityIds)]
  if (source.note !== undefined) copy.note = source.note
  if (source.mood !== undefined) copy.mood = source.mood
  if (source.digitalBreak !== undefined) copy.digitalBreak = source.digitalBreak
  if (source.scheduleOverride) copy.scheduleOverride = toRaw(source.scheduleOverride).map((activity) => ({ ...toRaw(activity) }))
  return copy
}
function updateSelectedDay(change: (record: DayRecord) => void) {
  if (!editable.value) return
  const record = copyDayRecord(selectedRecord.value)
  change(record)
  writeDay(state.value, selected.value, record)
}
function setChecked(id: string, value: boolean) {
  updateSelectedDay((record) => {
    const ids = new Set(record.checkedActivityIds ?? [])
    value ? ids.add(id) : ids.delete(id)
    record.checkedActivityIds = [...ids]
  })
}
function setSocialMark(date: string, value: boolean) {
  if (!canEditDay(date)) return
  const record = copyDayRecord(state.value.days[date] ?? {})
  record.digitalBreak = value
  writeDay(state.value, date, record)
}
function add() {
  if (!editable.value || !newLabel.value.trim()) return
  const activities = activitiesFor(selectedRecord.value, state.value.settings, gym.value).map((activity) => ({ ...activity }))
  updateSelectedDay((record) => { record.scheduleOverride = [...activities, { id: crypto.randomUUID(), time: newTime.value, label: newLabel.value.trim(), category: newCategory.value }] })
  newLabel.value = ''
}
function remove(id: string) {
  const activities = activitiesFor(selectedRecord.value, state.value.settings, gym.value).map((activity) => ({ ...activity }))
  updateSelectedDay((record) => {
    record.scheduleOverride = activities.filter((activity) => activity.id !== id)
    record.checkedActivityIds = (record.checkedActivityIds ?? []).filter((checkedId) => checkedId !== id)
  })
}
function resetDay() { updateSelectedDay((record) => { delete record.checkedActivityIds }); confirmReset.value = false }
function resetSchedule() { updateSelectedDay((record) => { delete record.scheduleOverride; delete record.checkedActivityIds }) }
function setNote(event: Event) { updateSelectedDay((record) => { const value = (event.target as HTMLTextAreaElement).value; if (value.trim()) record.note = value; else delete record.note }) }
function setMood(mood?: Mood) { updateSelectedDay((record) => { if (mood) record.mood = mood; else delete record.mood }) }
function exportData() {
  const retained = pruneStore(JSON.parse(JSON.stringify(state.value)), todayKey.value)
  const blob = new Blob([JSON.stringify(retained, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'my-daily-reset-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}
const pendingImport = ref<Store | null>(null)
async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pendingImport.value = null
  try {
    pendingImport.value = parseStore(JSON.parse(await file.text()))
    storageError.value = ''
  } catch (error) {
    storageError.value = error instanceof Error ? error.message : 'Could not read backup file'
  }
  input.value = ''
}
function confirmImport() {
  if (!pendingImport.value) return
  state.value = pruneStore(pendingImport.value, todayKey.value)
  pendingImport.value = null
  storageBlocked = false
  storageError.value = ''
  selected.value = todayKey.value
  weekStart.value = mondayOfWeek(todayKey.value)
  persist()
}
function useFreshStore() {
  state.value = createDefaultStore(todayKey.value)
  storageBlocked = false
  storageError.value = ''
  selected.value = todayKey.value
  persist()
}
function refreshDate() {
  const current = formatLocalDate(new Date())
  const changed = current !== todayKey.value
  if (changed) todayKey.value = current
  const pruned = Object.keys(state.value.days).some((day) => day < retentionCutoff(todayKey.value))
  if (selected.value < retentionCutoff(todayKey.value)) selected.value = todayKey.value
  if (changed || pruned) persist()
}
const onResume = () => refreshDate()
let rolloverTimer: ReturnType<typeof setInterval>
onMounted(() => {
  rolloverTimer = setInterval(refreshDate, 60_000)
  window.addEventListener('focus', onResume)
  document.addEventListener('visibilitychange', onResume)
})
onUnmounted(() => {
  clearInterval(rolloverTimer)
  window.removeEventListener('focus', onResume)
  document.removeEventListener('visibilitychange', onResume)
})
</script>
<template>
<div class="app-shell"><div class="aurora" aria-hidden="true"></div><header class="top"><div class="brand"><div class="logo">✓</div><div><h1>My Daily Reset<span class="period">.</span></h1></div></div><div class="today-pill">{{new Date(todayKey+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}}</div></header>
<div class="hero"><div class="eyebrow">ONE DAY AT A TIME</div><h2>Small steps count.</h2><p>{{dailyQuote}}</p><div class="hero-meta"><span><Sunrise :size="22" aria-hidden="true" />&nbsp;Wake 8:30 AM</span><span><Moon :size="22" aria-hidden="true" />&nbsp;Rest 11:30 PM</span></div></div>
<p v-if="storageError" class="notice" role="alert">{{storageError}} <button v-if="storageBlocked" @click="useFreshStore">Use a fresh store</button></p>
<nav class="tabs" aria-label="Main navigation"><button :class="{active:tab==='planner'}" @click="tab='planner'"><CalendarDays :size="18" aria-hidden="true" />&nbsp; Planner</button><button :class="{active:tab==='social'}" @click="tab='social'"><Timer :size="18" aria-hidden="true" />&nbsp; Digital break</button><button :class="{active:tab==='settings'}" @click="tab='settings'"><Settings :size="18" aria-hidden="true" />&nbsp; Settings</button></nav>
<main v-if="tab==='planner'"><section class="panel"><div class="section-head"><div><div class="eyebrow">WEEKLY PLANNER</div><h3>Your week</h3><p class="subtle" aria-live="polite">{{weekLabel}}</p></div><div class="week-controls"><button aria-label="Previous week" @click="moveWeek(-1)"><ChevronLeft :size="18" aria-hidden="true" /></button><button @click="goToday">Today</button><button aria-label="Next week" @click="moveWeek(1)"><ChevronRight :size="18" aria-hidden="true" /></button></div></div><div class="days"><button v-for="d in dates" :key="d.key" :class="['day',{chosen:selected===d.key,now:todayKey===d.key}]" :aria-pressed="selected===d.key" @click="selected=d.key"><span>{{d.label}}</span><strong>{{d.day}}</strong><i v-if="todayKey===d.key"></i></button></div><div class="section-head gym-head"><div><h3>Gym window</h3></div><div class="seg"><button :disabled="!editable" :aria-label="!editable ? 'Gym preference unavailable for preview dates' : 'Gym before 12'" :class="{active:gym==='morning'}" @click="gym='morning'">Before 12</button><button :disabled="!editable" :aria-label="!editable ? 'Gym preference unavailable for preview dates' : 'Gym at 8:30 PM'" :class="{active:gym==='evening'}" @click="gym='evening'">8:30 PM</button></div></div></section>
<section class="panel"><div class="section-head"><div><div class="eyebrow">{{new Date(selected+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}}</div><h3>{{editable ? 'Daily blocks' : 'Preview'}}</h3></div><div v-if="!expired" class="progress-label">{{count}} / {{activitiesFor(selectedRecord, state.settings, gym).length}}</div></div><p v-if="!editable" class="subtle">{{expired ? 'This day is outside the recent history window and is read-only.' : 'Later future dates are previews and are not saved.'}}</p><div v-if="!expired" class="progress"><div :style="{width:pct+'%'}"></div></div><p v-if="expired" class="subtle">No activity saved for this date.</p><div class="activity" v-if="!expired" v-for="a in activitiesFor(selectedRecord, state.settings, gym)" :key="a.id"><label class="checkline"><input type="checkbox" :checked="checked(a.id)" :disabled="!editable" @change="setChecked(a.id,($event.target as HTMLInputElement).checked)"/><span class="custom-check">✓</span><span class="time">{{a.time}}</span><span class="activity-text" :class="{done:checked(a.id)}"><strong>{{a.label}}</strong><small>{{a.category}}</small></span></label><button v-if="editing && editable" class="remove" aria-label="Remove activity" @click="remove(a.id)"><X :size="18" aria-hidden="true" /></button></div><div v-if="editing && editable" class="add-row"><input type="time" v-model="newTime"/><input v-model="newLabel" placeholder="New activity" @keyup.enter="add"/><button class="primary" @click="add">Add</button></div><div class="actions"><button :disabled="!editable" @click="editing=!editing">{{editing?'Done editing':'+ Edit activities'}}</button><button :disabled="!editable" @click="confirmReset=true"><RotateCcw :size="18" aria-hidden="true" />&nbsp;Reset checks</button><button v-if="editing && editable" @click="resetSchedule">Restore default blocks</button></div><div v-if="confirmReset && editable" class="confirm"><span>Clear checkmarks for this day?</span><button @click="resetDay">Yes, reset</button><button @click="confirmReset=false">Cancel</button></div></section>
<section class="panel note-panel"><div class="section-head"><div><div class="eyebrow">OPTIONAL</div><h3>A note to yourself</h3></div></div><textarea :value="selectedRecord.note ?? ''" :readonly="!editable" rows="3" placeholder="What would make today feel a little easier?" @input="setNote"></textarea><p class="subtle">Saved automatically on this device.</p><fieldset class="mood-control" :disabled="!editable"><legend>How did this day feel?</legend><div class="mood-choices"><label v-for="mood in (['low', 'okay', 'good'] as Mood[])" :key="mood" class="mood-choice" :class="[`mood-${mood}`,{selected:selectedRecord.mood===mood}]"><input type="radio" name="day-mood" :value="mood" :checked="selectedRecord.mood===mood" @change="setMood(mood)"/><span>{{mood[0].toUpperCase()+mood.slice(1)}}</span></label><button type="button" class="clear-mood" :disabled="!editable || !selectedRecord.mood" @click="setMood()">Clear</button></div><p class="subtle mood-marker" :class="selectedRecord.mood && `mood-${selectedRecord.mood}`" aria-live="polite">{{selectedRecord.mood ? `Mood marker: ${selectedRecord.mood[0].toUpperCase()+selectedRecord.mood.slice(1)}` : 'No mood marker selected.'}}</p></fieldset></section></main>
<main v-else-if="tab==='social'"><section class="panel"><div class="eyebrow">LESS SCROLLING, MORE SPACE</div><h3>Your 7-day digital break</h3><p class="muted">Mark days you chose to keep your break. Start again anytime.</p><template v-if="socialWindowExpired"><p class="subtle expired-window">This window is outside the recent history period. Start a new window to begin again.</p></template><template v-else><div class="social-count"><strong>{{socialCount}}<span>/7</span></strong><div>days marked<div class="subtle">Progress is yours to define</div></div></div><p v-if="socialDates.some(d=>!canEditDay(d))" class="subtle">Some dates are outside the editable window and are read-only.</p><div class="social-days"><label v-for="(d,i) in socialDates" :key="d" :class="{marked:socialMarked(d)}"><input type="checkbox" :checked="socialMarked(d)" :aria-label="`Digital break mark for ${d}`" :disabled="!canEditDay(d)" @change="setSocialMark(d,($event.target as HTMLInputElement).checked)"/><span>Day {{i+1}}</span><strong>{{socialMarked(d)?'✓':'○'}}</strong><small>{{new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}}</small></label></div></template><button class="quiet" @click="state.settings.sevenDayWindowStartDate=todayKey">Start a new 7-day window today</button></section><section class="panel"><h3>When the urge hits</h3><p class="muted">Wait 10 minutes, then try a small alternative.</p><div class="suggestion"><strong>Bored?</strong><span>Listen to one song or read two pages.</span></div><div class="suggestion"><strong>Lonely?</strong><span>Message a friend directly instead of scrolling.</span></div><div class="suggestion"><strong>Avoiding a task?</strong><span>Try five minutes, then decide what comes next.</span></div><div class="suggestion"><strong>Need rest?</strong><span>Rest is okay. You don't have to earn it.</span></div></section></main>
<main v-else><section class="panel"><div class="eyebrow">YOUR DATA</div><h3>Keep your progress</h3><p class="muted">Your data is saved in this browser only. It won't sync, and clearing browser data may remove it.</p><div class="actions"><button class="primary" @click="exportData"><Download :size="18" aria-hidden="true" />&nbsp;Export backup</button><label class="import"><Upload :size="18" aria-hidden="true" />&nbsp;Import backup<input type="file" accept="application/json" @change="importData"/></label></div><div v-if="pendingImport" class="confirm import-confirm" role="alert"><span>Importing will replace all current local data. Imported days older than the 30-day history window will be discarded.</span><button @click="confirmImport">Replace local data</button><button @click="pendingImport=null">Cancel</button></div></section></main>
<footer>No rush. Start again tomorrow.</footer></div>
</template>
