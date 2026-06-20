const ianaTimezones = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC'];

export const timezoneOptions = Array.from(
  new Set([
    'UTC',
    ...ianaTimezones,
  ]),
).sort((left, right) => left.localeCompare(right));

export function normalizeTimezoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalizedOffset = trimmed
    .replace(/\s+/g, '')
    .replace(/^GMT/i, 'UTC')
    .replace(/^UTC([+-]\d{1,2})(?::?(\d{2}))?$/i, (_match, hours: string, minutes?: string) => {
      const normalizedMinutes = minutes ?? '00';
      const paddedHours = `${hours[0]}${hours.slice(1).padStart(2, '0')}`;
      return `UTC${paddedHours}:${normalizedMinutes}`;
    });

  return normalizedOffset;
}

export function isValidTimezone(value: string): boolean {
  const normalized = normalizeTimezoneInput(value);
  if (!normalized) {
    return false;
  }

  if (timezoneOptions.includes(normalized)) {
    return true;
  }

  return /^UTC[+-](0\d|1\d|2[0-3]):([0-5]\d)$/.test(normalized);
}
