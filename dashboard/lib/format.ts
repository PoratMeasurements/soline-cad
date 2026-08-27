// Formatting helpers for ILS currency, percentages, numbers and time.

export function formatCurrency(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 0 } = opts;
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat("he-IL", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/** Minutes -> "1ש׳ 45ד׳" style label. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 ד׳";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} ד׳`;
  if (m === 0) return `${h} ש׳`;
  return `${h}ש׳ ${m}ד׳`;
}

export function formatKm(value: number): string {
  return `${formatNumber(value, value < 10 ? 1 : 0)} ק״מ`;
}
