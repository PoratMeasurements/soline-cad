// Pure business calculations. Kept side-effect free and unit-testable.

export function operatingMargin(operatingProfit: number, revenue: number): number {
  return revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
}

export function revenuePerMeasurement(revenue: number, measurements: number): number {
  return measurements > 0 ? revenue / measurements : 0;
}

export function revenuePerWorkday(revenue: number, workdays: number): number {
  return workdays > 0 ? revenue / workdays : 0;
}

export function avgDealSize(revenue: number, dealsWon: number): number {
  return dealsWon > 0 ? revenue / dealsWon : 0;
}

export function runwayMonths(cashBalance: number, avgMonthlyExpenses: number): number {
  return avgMonthlyExpenses > 0 ? cashBalance / avgMonthlyExpenses : 0;
}

export function firstPassRate(successfulFirstPass: number, totalMeasurements: number): number {
  return totalMeasurements > 0 ? (successfulFirstPass / totalMeasurements) * 100 : 0;
}

export function grossMargin(grossProfit: number, revenue: number): number {
  return revenue > 0 ? (grossProfit / revenue) * 100 : 0;
}

export function growthPct(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}
