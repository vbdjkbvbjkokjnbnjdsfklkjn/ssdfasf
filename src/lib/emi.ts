export type EmiBreakdown = {
  monthlyPayment: number;
  totalPayable: number;
  totalInterest: number;
  monthlyRate: number;
  months: number;
};

export const DEFAULT_EMI_RATE = 8.5;

export function calculateEmi({
  principal,
  months,
  annualRate = DEFAULT_EMI_RATE,
}: {
  principal: number;
  months: number;
  annualRate?: number;
}): EmiBreakdown {
  const safePrincipal = Math.max(0, Number.isFinite(principal) ? principal : 0);
  const safeMonths = Math.max(1, Math.floor(months) || 1);
  const rate = Math.max(0, annualRate);
  const monthlyRate = rate / 12 / 100;

  if (monthlyRate === 0) {
    const monthlyPayment = safePrincipal / safeMonths;
    return {
      monthlyPayment,
      totalPayable: monthlyPayment * safeMonths,
      totalInterest: 0,
      monthlyRate,
      months: safeMonths,
    };
  }

  const factor = (1 + monthlyRate) ** safeMonths;
  const monthlyPayment = (safePrincipal * monthlyRate * factor) / (factor - 1);
  const totalPayable = monthlyPayment * safeMonths;

  return {
    monthlyPayment,
    totalPayable,
    totalInterest: totalPayable - safePrincipal,
    monthlyRate,
    months: safeMonths,
  };
}
