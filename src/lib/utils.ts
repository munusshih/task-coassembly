import { ProjectBudgetCurrency } from "@/lib/types";

export const USD_TO_TWD = 32;

export function cn(...inputs: Array<string | false | null | undefined>): string {
    return inputs.filter(Boolean).join(" ");
}

interface BudgetFields {
    budgetAmount?: number;
    budgetCurrency?: ProjectBudgetCurrency;
    budgetTwd?: number;
    budgetUsd?: number;
}

export function getBudgetSnapshot(fields?: BudgetFields): {
    amount: number;
    currency: ProjectBudgetCurrency;
    budgetTwd: number;
    budgetUsd: number;
} {
    const amount = Number(fields?.budgetAmount);
    const currency = fields?.budgetCurrency === "USD" ? "USD" : "TWD";

    if (Number.isFinite(amount) && amount > 0) {
        const budgetTwd =
            currency === "USD" ? Math.round(amount * USD_TO_TWD) : Math.round(amount);
        const budgetUsd =
            currency === "USD"
                ? Math.round(amount * 100) / 100
                : Math.round((amount / USD_TO_TWD) * 100) / 100;

        return {
            amount: currency === "USD" ? budgetUsd : budgetTwd,
            currency,
            budgetTwd,
            budgetUsd,
        };
    }

    const budgetTwd = Number(fields?.budgetTwd);
    if (Number.isFinite(budgetTwd) && budgetTwd > 0) {
        return {
            amount: Math.round(budgetTwd),
            currency: "TWD",
            budgetTwd: Math.round(budgetTwd),
            budgetUsd: Math.round((budgetTwd / USD_TO_TWD) * 100) / 100,
        };
    }

    const budgetUsd = Number(fields?.budgetUsd);
    if (Number.isFinite(budgetUsd) && budgetUsd > 0) {
        return {
            amount: Math.round(budgetUsd * 100) / 100,
            currency: "USD",
            budgetTwd: Math.round(budgetUsd * USD_TO_TWD),
            budgetUsd: Math.round(budgetUsd * 100) / 100,
        };
    }

    return {
        amount: 0,
        currency,
        budgetTwd: 0,
        budgetUsd: 0,
    };
}

export function formatMoney(
    amount: number,
    currency: ProjectBudgetCurrency,
): string {
    const normalized = Number(amount) || 0;
    const digits = currency === "USD" ? 2 : 0;
    const prefix = currency === "USD" ? "US$" : "NT$";

    return `${prefix}${normalized.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}
