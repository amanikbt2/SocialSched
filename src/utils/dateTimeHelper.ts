export function smartNormalizeDate(val: string): string {
  if (!val) return val;
  const trimmed = val.trim();
  const parts = trimmed.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 4) {
      const d = p1.padStart(2, '0');
      const m = p2.padStart(2, '0');
      return `${p3}-${m}-${d}`;
    } else if (p1.length === 4) {
      const m = p2.padStart(2, '0');
      const d = p3.padStart(2, '0');
      return `${p1}-${m}-${d}`;
    }
  }
  return trimmed;
}

export function smartNormalizeTime(val: string): string {
  if (!val) return val;
  const trimmed = val.trim();
  if (/^\d{1,2}$/.test(trimmed)) {
    return `${trimmed.padStart(2, '0')}:00`;
  }
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return trimmed;
}

export function validateScheduledDateTime(
  dStr: string,
  tStr: string
): { valid: boolean; error?: string } {
  const normD = smartNormalizeDate(dStr);
  const normT = smartNormalizeTime(tStr);
  const parsed = Date.parse(`${normD}T${normT}:00`);

  if (isNaN(parsed)) {
    return { valid: false, error: 'Invalid Date/Time format. Use YYYY-MM-DD and HH:MM' };
  }

  const diffMinutes = (parsed - Date.now()) / (1000 * 60);
  if (diffMinutes < 10) {
    return {
      valid: false,
      error:
        diffMinutes <= 0
          ? '⏰ Scheduled time is in the past! Pick a time at least 10 minutes in future.'
          : '⏰ Time must be at least 10 minutes in the future for Meta Server scheduling.',
    };
  }

  return { valid: true };
}
