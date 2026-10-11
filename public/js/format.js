// Display formatting.
//
// brewed_at is the literal wall-clock string 'YYYY-MM-DDTHH:MM' (docs/SPEC.md
// §7). It is formatted by reading those digits — never by building a local Date
// from them — so a displayed brew time can never shift through a timezone
// conversion. The one Date used here reads UTC parts only, to get a weekday.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BREWED_AT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const EMPTY = '—';

const ROAST_LABELS = { light: 'Light', medium: 'Medium', dark: 'Dark' };

function parse(brewedAt) {
  const match = BREWED_AT.exec(String(brewedAt ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return { year: Number(year), month: Number(month), day: Number(day), hour, minute };
}

/** 'Sat 11 Oct 2026 · 07:35' — or the raw value if it is not in the stored shape. */
export function formatBrewedAt(brewedAt) {
  const value = parse(brewedAt);
  if (!value) return String(brewedAt ?? '');
  const weekday = WEEKDAYS[new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay()];
  return `${weekday} ${value.day} ${MONTHS[value.month - 1]} ${value.year} · ${value.hour}:${value.minute}`;
}

/** Current local time as the 'YYYY-MM-DDTHH:MM' value a datetime-local input wants. */
export function localDateTimeValue(now = new Date()) {
  const pad = (part) => String(part).padStart(2, '0');
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-') +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** '1:16.0' — the server's ratio, shown with one decimal — or null when unset. */
export function ratioText(note) {
  if (!note || !note.ratio_display) return null;
  const value = Number(String(note.ratio_display).split(':')[1]);
  return Number.isFinite(value) ? `1:${value.toFixed(1)}` : null;
}

export function grams(value) {
  return value === null || value === undefined ? EMPTY : `${value} g`;
}

export function grindSize(value) {
  return value === null || value === undefined ? EMPTY : String(value);
}

export function text(value) {
  return value === null || value === undefined || value === '' ? EMPTY : String(value);
}

export function roastLabel(value) {
  return ROAST_LABELS[value] ?? (value ? String(value) : EMPTY);
}

export function noteCountLabel(count) {
  return `${count} note${count === 1 ? '' : 's'}`;
}
