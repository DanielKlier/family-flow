import type { Transaction } from "../transactions/transaction.js";

export type MonthlyForecast = {
  bookedFixedCents: number;
  openPlannedFixedCents: number;
  bookedVariableCents: number;
  extrapolatedBookedVariableCents: number;
  totalCents: number;
  elapsedDays: number;
  daysInMonth: number;
};

export function calculateMonthlyForecast(
  transactions: Transaction[],
  input: { month: string; currentDate: string },
): MonthlyForecast {
  assertGregorianMonth(input.month);
  const [year, month] = input.month.split("-").map(Number);
  const currentMonth = input.currentDate.slice(0, 7);
  if (currentMonth !== input.month) {
    throw new Error("Forecast month must match the current month");
  }

  const elapsedDays = Number(input.currentDate.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!Number.isInteger(elapsedDays) || elapsedDays < 1 || elapsedDays > daysInMonth) {
    throw new Error("Forecast current date must be a Gregorian date");
  }

  const eligible = transactions.filter(
    (transaction) =>
      !transaction.internalTransfer && transaction.date.startsWith(`${input.month}-`),
  );
  const bookedFixedCents = magnitudeTotal(
    eligible.filter((transaction) => transaction.status === "booked" && transaction.fixedCost),
  );
  const openPlannedFixedCents = magnitudeTotal(
    eligible.filter((transaction) => transaction.status === "planned" && transaction.fixedCost),
  );
  const bookedVariableCents = magnitudeTotal(
    eligible.filter((transaction) => transaction.status === "booked" && !transaction.fixedCost),
  );
  const extrapolatedBookedVariableCents = multiplyAndRoundHalfUp(
    bookedVariableCents,
    daysInMonth,
    elapsedDays,
  );
  const totalCents = safeSum(
    [bookedFixedCents, openPlannedFixedCents, extrapolatedBookedVariableCents],
    "Forecast total must be a safe integer",
  );

  return {
    bookedFixedCents,
    openPlannedFixedCents,
    bookedVariableCents,
    extrapolatedBookedVariableCents,
    totalCents,
    elapsedDays,
    daysInMonth,
  };
}

export function roundHalfUp(dividend: number, divisor: number): number {
  if (
    !Number.isSafeInteger(dividend) ||
    dividend < 0 ||
    !Number.isSafeInteger(divisor) ||
    divisor <= 0
  ) {
    throw new Error("Rounded amount inputs must be safe integers");
  }
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend % divisor;
  return quotient + (remainder >= Math.ceil(divisor / 2) ? 1 : 0);
}

function multiplyAndRoundHalfUp(value: number, multiplier: number, divisor: number): number {
  const quotientPart = value - (value % divisor);
  const whole = (quotientPart / divisor) * multiplier;
  const remainderProduct = (value % divisor) * multiplier;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(remainderProduct)) {
    throw new Error("Forecast amount must be a safe integer");
  }
  return safeSum(
    [whole, roundHalfUp(remainderProduct, divisor)],
    "Forecast amount must be a safe integer",
  );
}

function magnitudeTotal(transactions: Transaction[]): number {
  return safeSum(
    transactions.map((transaction) => -transaction.amountCents),
    "Forecast component must be a safe integer",
  );
}

function safeSum(values: number[], message: string): number {
  return values.reduce((total, value) => {
    const next = total + value;
    if (!Number.isSafeInteger(next)) throw new Error(message);
    return next;
  }, 0);
}

function assertGregorianMonth(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("Month must use YYYY-MM");
  }
}
