"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeCollection } from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import InputField from "./ui/InputField";
import SectionBlock from "./ui/SectionBlock";
import SelectField from "./ui/SelectField";
import StatusStack from "./ui/StatusStack";
import TabPage from "./ui/TabPage";
import { SURFACE_TEXTURES } from "./ui/paperTextures";

const CONFIG_DOC_ID = "company";

const DEFAULT_CONFIG = {
  createdAt: 0,
  updatedAt: 0,
  sheetRange: "日記帳(每日記錄)!A:ZZ",
  columns: {
    member: "member",
    paid: "paid_amount_twd",
    commonPool: "common_pool_twd",
    date: "date",
    year: "year",
  },
  capitalEntries: [],
  recurringCosts: [],
};

function normalizeMemberRole(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (v === "worker-owner" || v === "workerowner") return "worker-owner";
  if (v === "flying-member" || v === "flying") return "flying-member";
  if (v === "external-collaborator" || v === "external") {
    return "external-collaborator";
  }
  return "associate";
}

function formatTWD(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "-";
  return `NT$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n))}`;
}

function parseMoney(value) {
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseYearFromRow(row, columns) {
  const yearText = String(row[columns.year] || "").trim();
  const explicitYear = Number(yearText);
  if (Number.isFinite(explicitYear) && explicitYear >= 1900 && explicitYear <= 3000) {
    return explicitYear;
  }

  const rawDate = String(row[columns.date] || "").trim();
  if (!rawDate) return 0;

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();

  const yMatch = rawDate.match(/(19|20)\d{2}/);
  if (yMatch) return Number(yMatch[0]);

  return 0;
}

function budgetToTWD(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return currency === "USD" ? n * 32 : n;
}

function isInternalOrAdmin(kind) {
  return kind === "Internal" || kind === "Admin";
}

function isPassThrough(kind) {
  return kind === "Pass-through";
}

function projectYear(project) {
  const endDate = String(project?.data?.endDate || "").trim();
  if (endDate) {
    const d = new Date(endDate + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }

  const startDate = String(project?.data?.startDate || "").trim();
  if (startDate) {
    const d = new Date(startDate + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }

  const createdAt = Number(project?.data?.createdAt || 0);
  if (createdAt > 0) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }

  return 0;
}

function computeProjectProjection(project) {
  const d = project?.data || {};
  const year = projectYear(project);
  const internalOrAdmin = isInternalOrAdmin(d.kind);
  const pass = isPassThrough(d.kind);

  const budgetTWD = budgetToTWD(d.budget, d.budgetCurrency);
  const donationPct = Number(d.donationPercent) || 0;
  const donation = budgetTWD != null ? Math.round((budgetTWD * donationPct) / 100) : 0;
  const companyTax = d.companyTax && budgetTWD != null ? Math.round(budgetTWD * 0.05) : 0;
  const effectiveBudget = budgetTWD != null ? Math.max(0, budgetTWD - donation - companyTax) : null;

  const leadBonus =
    !internalOrAdmin && !pass && effectiveBudget != null
      ? Math.round(effectiveBudget * 0.05)
      : 0;
  const distributable =
    effectiveBudget != null ? Math.max(0, effectiveBudget - leadBonus) : null;

  const maxHours = Number(d.maxHours) || 0;
  const projectedHourly = Number(d.projectedHourlyWage) || 0;
  const hourly = internalOrAdmin
    ? projectedHourly || 0
    : distributable != null && maxHours > 0
      ? Math.round(distributable / maxHours)
      : 0;

  const staffing = Array.isArray(d.staffing) ? d.staffing : [];
  const memberPayoutByMemberId = {};

  if (pass && distributable != null && staffing.length > 0) {
    const memberId = staffing[0]?.memberId;
    if (memberId) memberPayoutByMemberId[memberId] = distributable;
  } else {
    for (const entry of staffing) {
      const memberId = entry?.memberId;
      if (!memberId) continue;

      const isLegacy = Boolean(d.legacyMode);
      let payout = 0;
      if (isLegacy) {
        payout = Number(entry?.allocatedAmount) || 0;
      } else {
        const memberHours = Number(entry?.maxHours) || 0;
        payout = hourly > 0 ? Math.round(memberHours * hourly) : 0;
      }

      if ((entry?.roles || []).includes("lead") && leadBonus > 0) {
        payout += leadBonus;
      }

      memberPayoutByMemberId[memberId] =
        (memberPayoutByMemberId[memberId] || 0) + payout;
    }
  }

  const memberPayoutTotal = Object.values(memberPayoutByMemberId).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );

  return {
    projectId: project?.id || "",
    projectName: d.name || "Untitled project",
    year,
    budgetTWD: budgetTWD || 0,
    projectedCommonPoolTWD: donation + companyTax,
    projectedMemberPayoutTWD: memberPayoutTotal,
    memberPayoutByMemberId,
  };
}

function normalizeConfig(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const columns = base.columns && typeof base.columns === "object" ? base.columns : {};
  return {
    createdAt: Number(base.createdAt) || 0,
    updatedAt: Number(base.updatedAt) || 0,
    sheetRange: String(base.sheetRange || ""),
    columns: {
      member: String(columns.member || DEFAULT_CONFIG.columns.member),
      paid: String(columns.paid || DEFAULT_CONFIG.columns.paid),
      commonPool: String(columns.commonPool || DEFAULT_CONFIG.columns.commonPool),
      date: String(columns.date || DEFAULT_CONFIG.columns.date),
      year: String(columns.year || DEFAULT_CONFIG.columns.year),
    },
    capitalEntries: Array.isArray(base.capitalEntries) ? base.capitalEntries : [],
    recurringCosts: Array.isArray(base.recurringCosts) ? base.recurringCosts : [],
  };
}

function nextId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeAliasArray(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
        .split(/[\n,]/)
        .map((item) => item.trim());

  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

const DASHBOARD_HEADER_ROW = 1;
const DASHBOARD_FIRST_DATA_ROW = 3;

const DASHBOARD_COLS = {
  id: "流水號",
  date: "日期",
  description: "敘述",
  category: "分類",
  amount: "金額",
  fromAccount: "轉出帳戶",
  toAccount: "轉入帳戶",
  project: "專案",
  note: "註記",
  yearMonth: "Year Month",
};

const DASHBOARD_ACCOUNT_FIRST_COL = 10;
const DASHBOARD_ACCOUNT_STRIDE = 3;
const DASHBOARD_BANK_NAME = "國泰世華 (公司戶台幣)";
const DASHBOARD_CAPITAL_PATTERN = /Capital|實收資本/i;

function parseSignedAmount(value) {
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function splitCategoryLabel(raw) {
  const text = String(raw || "").trim();
  if (!text) return { en: "Uncategorized", zh: "" };
  const match = text.match(/^([A-Za-z0-9 ,&'\/\-\(\)]+?)\s+([一-鿿].*)$/);
  if (match) return { en: match[1].trim(), zh: match[2].trim() };
  return { en: text, zh: "" };
}

function parseYearMonthLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})[\/\-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}`;
}

function attributeMember(description, memberIdByAlias) {
  if (!memberIdByAlias) return null;
  const text = String(description || "").trim();
  if (!text) return null;

  const parts = text
    .split(/[｜|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const key = part.toLowerCase();
    if (memberIdByAlias[key]) {
      return { memberId: memberIdByAlias[key], matchedPart: part };
    }
  }

  for (const [alias, memberId] of Object.entries(memberIdByAlias)) {
    if (alias.length < 2) continue;
    if (text.toLowerCase().includes(alias)) {
      return { memberId, matchedPart: alias };
    }
  }

  return null;
}

function descriptionWithoutMember(description, matchedPart) {
  const text = String(description || "").trim();
  if (!text) return "(no description)";
  if (!matchedPart) return text;
  const parts = text
    .split(/[｜|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const filtered = parts.filter(
    (p) => p.toLowerCase() !== matchedPart.toLowerCase(),
  );
  return filtered.join(" · ") || text;
}

function computeDashboardData(values, opts = {}) {
  if (!Array.isArray(values) || values.length <= DASHBOARD_FIRST_DATA_ROW) {
    return null;
  }
  const { memberIdByAlias = null, membersById = {} } = opts;

  const headerRow = values[DASHBOARD_HEADER_ROW] || [];
  const headerIndex = {};
  headerRow.forEach((header, i) => {
    const key = String(header || "").trim();
    if (key && headerIndex[key] === undefined) headerIndex[key] = i;
  });

  const idxOf = (label) => headerIndex[label] ?? -1;
  const dateIdx = idxOf(DASHBOARD_COLS.date);
  const amountIdx = idxOf(DASHBOARD_COLS.amount);
  const categoryIdx = idxOf(DASHBOARD_COLS.category);
  const projectIdx = idxOf(DASHBOARD_COLS.project);
  const fromIdx = idxOf(DASHBOARD_COLS.fromAccount);
  const toIdx = idxOf(DASHBOARD_COLS.toAccount);
  const noteIdx = idxOf(DASHBOARD_COLS.note);
  const descIdx = idxOf(DASHBOARD_COLS.description);
  const yearMonthIdx = idxOf(DASHBOARD_COLS.yearMonth);

  const accounts = [];
  for (
    let col = DASHBOARD_ACCOUNT_FIRST_COL;
    col < headerRow.length;
    col += DASHBOARD_ACCOUNT_STRIDE
  ) {
    const name = String(headerRow[col] || "").trim();
    if (!name) continue;
    accounts.push({
      name,
      debitCol: col,
      creditCol: col + 1,
      balanceCol: col + 2,
    });
  }

  const bankAccount = accounts.find((a) => a.name === DASHBOARD_BANK_NAME);
  const dataRows = values.slice(DASHBOARD_FIRST_DATA_ROW);

  const transactions = [];
  for (const row of dataRows) {
    const dateText = String(row[dateIdx] || "").trim();
    if (!dateText) continue;

    const bankIn = bankAccount ? parseSignedAmount(row[bankAccount.creditCol]) : 0;
    const bankOut = bankAccount ? parseSignedAmount(row[bankAccount.debitCol]) : 0;
    const amountFallback = parseSignedAmount(row[amountIdx]);
    const bankImpact = bankIn + bankOut;
    if (bankImpact === 0 && amountFallback === 0) continue;

    transactions.push({
      date: dateText,
      amount: amountFallback,
      bankIn,
      bankOut: -bankOut,
      bankImpact,
      category: String(row[categoryIdx] || "").trim(),
      project: String(row[projectIdx] || "").trim(),
      from: String(row[fromIdx] || "").trim(),
      to: String(row[toIdx] || "").trim(),
      note: String(row[noteIdx] || "").trim(),
      description: String(row[descIdx] || "").trim(),
      yearMonth: parseYearMonthLabel(row[yearMonthIdx]),
    });
  }

  let bankInflowTotal = 0;
  let bankOutflowTotal = 0;
  let capitalInvested = 0;
  const byMonth = {};
  const expenseByCategory = {};
  const incomeByCategory = {};
  const expenseByDescription = {};
  const incomeByDescription = {};
  const byProject = {};
  const byMember = {};

  function ensureMember(memberId) {
    if (!byMember[memberId]) {
      byMember[memberId] = {
        memberId,
        memberName:
          membersById[memberId]?.data?.name || memberId || "Unknown",
        capitalIn: 0,
        paidOut: 0,
        otherIn: 0,
        paidOutByCategory: {},
      };
    }
    return byMember[memberId];
  }

  for (const t of transactions) {
    bankInflowTotal += t.bankIn;
    bankOutflowTotal += t.bankOut;

    const isCapital = DASHBOARD_CAPITAL_PATTERN.test(t.category);
    if (isCapital) capitalInvested += t.bankIn;

    const memberMatch = attributeMember(t.description, memberIdByAlias);
    t.memberId = memberMatch?.memberId || null;
    t.descriptionRest = descriptionWithoutMember(
      t.description,
      memberMatch?.matchedPart,
    );

    if (t.memberId) {
      const m = ensureMember(t.memberId);
      if (t.bankIn > 0) {
        if (isCapital) m.capitalIn += t.bankIn;
        else m.otherIn += t.bankIn;
      }
      if (t.bankOut > 0) {
        m.paidOut += t.bankOut;
        const catKey = t.category || "Uncategorized";
        m.paidOutByCategory[catKey] =
          (m.paidOutByCategory[catKey] || 0) + t.bankOut;
      }
    }

    const monthKey = t.yearMonth || "未知 Unknown";
    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    byMonth[monthKey].income += t.bankIn;
    byMonth[monthKey].expense += t.bankOut;

    if (t.bankIn > 0 && !isCapital) {
      const catKey = t.category || "Uncategorized";
      incomeByCategory[catKey] = (incomeByCategory[catKey] || 0) + t.bankIn;

      const descKey = t.descriptionRest || "(no description)";
      incomeByDescription[descKey] =
        (incomeByDescription[descKey] || 0) + t.bankIn;
    }
    if (t.bankOut > 0) {
      const catKey = t.category || "Uncategorized";
      expenseByCategory[catKey] = (expenseByCategory[catKey] || 0) + t.bankOut;

      const descKey = t.descriptionRest || "(no description)";
      expenseByDescription[descKey] =
        (expenseByDescription[descKey] || 0) + t.bankOut;
    }

    if (t.bankIn > 0 || t.bankOut > 0) {
      const projKey = t.project || "(no project)";
      if (!byProject[projKey]) byProject[projKey] = { income: 0, expense: 0 };
      byProject[projKey].income += t.bankIn;
      byProject[projKey].expense += t.bankOut;
    }
  }

  const operatingRevenue = bankInflowTotal - capitalInvested;
  const operatingExpense = bankOutflowTotal;
  const operatingMargin = operatingRevenue - operatingExpense;
  const netCashChange = bankInflowTotal - bankOutflowTotal;

  const monthlyRows = Object.keys(byMonth)
    .filter((k) => k !== "未知 Unknown" && /^\d{4}-\d{2}$/.test(k))
    .sort()
    .map((key) => ({
      month: key,
      income: byMonth[key].income,
      expense: byMonth[key].expense,
      net: byMonth[key].income - byMonth[key].expense,
    }));

  const expenseRows = Object.entries(expenseByCategory)
    .map(([key, amount]) => ({ key, amount, ...splitCategoryLabel(key) }))
    .sort((a, b) => b.amount - a.amount);

  const incomeRows = Object.entries(incomeByCategory)
    .map(([key, amount]) => ({ key, amount, ...splitCategoryLabel(key) }))
    .sort((a, b) => b.amount - a.amount);

  const expenseDescriptionRows = Object.entries(expenseByDescription)
    .map(([key, amount]) => ({ key, amount, en: key, zh: "" }))
    .sort((a, b) => b.amount - a.amount);

  const incomeDescriptionRows = Object.entries(incomeByDescription)
    .map(([key, amount]) => ({ key, amount, en: key, zh: "" }))
    .sort((a, b) => b.amount - a.amount);

  const memberRows = Object.values(byMember)
    .map((m) => ({
      ...m,
      paidOutByCategory: Object.entries(m.paidOutByCategory)
        .map(([key, amount]) => ({ key, amount, ...splitCategoryLabel(key) }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.paidOut + b.capitalIn - (a.paidOut + a.capitalIn));

  const projectRows = Object.entries(byProject)
    .map(([key, { income, expense }]) => ({
      project: key,
      income,
      expense,
      net: income - expense,
    }))
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  let lastBalanceRow = null;
  for (let i = dataRows.length - 1; i >= 0; i -= 1) {
    const row = dataRows[i] || [];
    const hasAnyBalance = accounts.some(
      (a) => parseSignedAmount(row[a.balanceCol]) !== 0,
    );
    if (hasAnyBalance) {
      lastBalanceRow = row;
      break;
    }
  }

  const accountBalances = accounts.map((a) => ({
    name: a.name,
    balance: lastBalanceRow ? parseSignedAmount(lastBalanceRow[a.balanceCol]) : 0,
  }));

  const bankBalance =
    accountBalances.find((a) => a.name === DASHBOARD_BANK_NAME)?.balance || 0;
  const netAssetPosition = accountBalances.reduce((s, a) => s + a.balance, 0);

  const recentTransactions = [...transactions]
    .filter((t) => t.bankIn > 0 || t.bankOut > 0)
    .reverse()
    .slice(0, 12);

  return {
    transactionCount: transactions.length,
    bankBalance,
    netAssetPosition,
    capitalInvested,
    operatingRevenue,
    operatingExpense,
    operatingMargin,
    netCashChange,
    monthlyRows,
    expenseRows,
    incomeRows,
    expenseDescriptionRows,
    incomeDescriptionRows,
    projectRows,
    accountBalances,
    memberRows,
    recentTransactions,
  };
}

function CategoryBars({ rows, accent, max, formatter, limit = 8 }) {
  const top = rows.slice(0, limit);
  if (top.length === 0) {
    return <p className="finance-dashboard-empty">No entries.</p>;
  }
  return (
    <ul className="finance-bar-list">
      {top.map((row) => {
        const pct = max > 0 ? Math.max(2, Math.round((row.amount / max) * 100)) : 0;
        return (
          <li key={row.key} className="finance-bar-row">
            <div className="finance-bar-label">
              <span className="finance-bar-en">{row.en}</span>
              {row.zh ? <span className="finance-bar-zh">{row.zh}</span> : null}
            </div>
            <div className="finance-bar-track">
              <div
                className="finance-bar-fill"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>
            <div className="finance-bar-amount">{formatter(row.amount)}</div>
          </li>
        );
      })}
    </ul>
  );
}

function FinanceDashboard({ data }) {
  const {
    transactionCount,
    bankBalance,
    netAssetPosition,
    capitalInvested,
    operatingRevenue,
    operatingExpense,
    operatingMargin,
    monthlyRows,
    expenseRows,
    incomeRows,
    expenseDescriptionRows,
    incomeDescriptionRows,
    projectRows,
    accountBalances,
    memberRows,
    recentTransactions,
  } = data;

  const monthlyMax = monthlyRows.reduce(
    (m, r) => Math.max(m, r.income, r.expense),
    0,
  );
  const expenseMax = expenseRows[0]?.amount || 0;
  const incomeMax = incomeRows[0]?.amount || 0;
  const expenseDescMax = expenseDescriptionRows[0]?.amount || 0;
  const incomeDescMax = incomeDescriptionRows[0]?.amount || 0;

  return (
    <div className="finance-dashboard">
      <div className="finance-dashboard-kpis">
        <article className="finance-dashboard-kpi finance-dashboard-kpi--positive">
          <span className="finance-dashboard-kpi-label">Bank cash on hand</span>
          <strong>{formatTWD(bankBalance)}</strong>
          <span className="finance-dashboard-kpi-hint">國泰世華 latest balance</span>
        </article>
        <article
          className={`finance-dashboard-kpi ${
            netAssetPosition >= 0
              ? "finance-dashboard-kpi--positive"
              : "finance-dashboard-kpi--negative"
          }`}
        >
          <span className="finance-dashboard-kpi-label">Net asset position</span>
          <strong>{formatTWD(netAssetPosition)}</strong>
          <span className="finance-dashboard-kpi-hint">bank − payables / receivables</span>
        </article>
        <article className="finance-dashboard-kpi">
          <span className="finance-dashboard-kpi-label">Capital invested</span>
          <strong>{formatTWD(capitalInvested)}</strong>
          <span className="finance-dashboard-kpi-hint">worker-owner contributions</span>
        </article>
        <article className="finance-dashboard-kpi finance-dashboard-kpi--income">
          <span className="finance-dashboard-kpi-label">Operating revenue</span>
          <strong>{formatTWD(operatingRevenue)}</strong>
          <span className="finance-dashboard-kpi-hint">cash in, ex-capital</span>
        </article>
        <article className="finance-dashboard-kpi finance-dashboard-kpi--expense">
          <span className="finance-dashboard-kpi-label">Operating expense</span>
          <strong>{formatTWD(operatingExpense)}</strong>
          <span className="finance-dashboard-kpi-hint">cash out</span>
        </article>
        <article
          className={`finance-dashboard-kpi ${
            operatingMargin >= 0
              ? "finance-dashboard-kpi--positive"
              : "finance-dashboard-kpi--negative"
          }`}
        >
          <span className="finance-dashboard-kpi-label">Operating margin</span>
          <strong>{formatTWD(operatingMargin)}</strong>
          <span className="finance-dashboard-kpi-hint">revenue − expense</span>
        </article>
        <article className="finance-dashboard-kpi">
          <span className="finance-dashboard-kpi-label">Bank-touching transactions</span>
          <strong>{transactionCount.toLocaleString()}</strong>
        </article>
      </div>

      <div className="finance-dashboard-grid">
        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Monthly cash flow</h4>
            <span>income vs expense</span>
          </header>
          {monthlyRows.length === 0 ? (
            <p className="finance-dashboard-empty">No monthly data.</p>
          ) : (
            <div className="finance-month-chart">
              {monthlyRows.map((row) => {
                const incomePct =
                  monthlyMax > 0
                    ? Math.round((row.income / monthlyMax) * 100)
                    : 0;
                const expensePct =
                  monthlyMax > 0
                    ? Math.round((row.expense / monthlyMax) * 100)
                    : 0;
                return (
                  <div key={row.month} className="finance-month-col">
                    <div className="finance-month-bars">
                      <div
                        className="finance-month-bar finance-month-bar--income"
                        style={{ height: `${incomePct}%` }}
                        title={`Income ${formatTWD(row.income)}`}
                      />
                      <div
                        className="finance-month-bar finance-month-bar--expense"
                        style={{ height: `${expensePct}%` }}
                        title={`Expense ${formatTWD(row.expense)}`}
                      />
                    </div>
                    <div className="finance-month-meta">
                      <span className="finance-month-label">{row.month}</span>
                      <span
                        className={
                          row.net >= 0 ? "finance-plus" : "finance-minus"
                        }
                      >
                        {formatTWD(row.net)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="finance-month-legend">
            <span>
              <i className="finance-dot finance-dot--income" /> income
            </span>
            <span>
              <i className="finance-dot finance-dot--expense" /> expense
            </span>
          </div>
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Spending — by category vs by item</h4>
            <span>{expenseRows.length} categories · {expenseDescriptionRows.length} items</span>
          </header>
          <div className="finance-split-cols">
            <div className="finance-split-col">
              <h5 className="finance-split-title">By category (分類)</h5>
              <CategoryBars
                rows={expenseRows}
                accent="#c2543d"
                max={expenseMax}
                formatter={formatTWD}
              />
            </div>
            <div className="finance-split-col">
              <h5 className="finance-split-title">By item / description (敘述)</h5>
              <CategoryBars
                rows={expenseDescriptionRows}
                accent="#c2543d"
                max={expenseDescMax}
                formatter={formatTWD}
                limit={10}
              />
            </div>
          </div>
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Revenue — by category vs by item</h4>
            <span>{incomeRows.length} categories · {incomeDescriptionRows.length} items</span>
          </header>
          <div className="finance-split-cols">
            <div className="finance-split-col">
              <h5 className="finance-split-title">By category (分類)</h5>
              <CategoryBars
                rows={incomeRows}
                accent="#2f7d56"
                max={incomeMax}
                formatter={formatTWD}
              />
            </div>
            <div className="finance-split-col">
              <h5 className="finance-split-title">By item / description (敘述)</h5>
              <CategoryBars
                rows={incomeDescriptionRows}
                accent="#2f7d56"
                max={incomeDescMax}
                formatter={formatTWD}
                limit={10}
              />
            </div>
          </div>
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Per-member cash flow</h4>
            <span>{memberRows.length} matched via aliases</span>
          </header>
          {memberRows.length === 0 ? (
            <p className="finance-dashboard-empty">
              No member-attributable transactions yet. Set the 木木/一豪/etc.
              aliases on member records so the spreadsheet rows match.
            </p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Capital in</th>
                    <th>Paid out by company</th>
                    <th>Other inflows</th>
                    <th>Top category</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((m) => {
                    const top = m.paidOutByCategory[0];
                    return (
                      <tr key={m.memberId}>
                        <td>{m.memberName}</td>
                        <td className={m.capitalIn > 0 ? "finance-plus" : ""}>
                          {formatTWD(m.capitalIn)}
                        </td>
                        <td className={m.paidOut > 0 ? "finance-minus" : ""}>
                          {formatTWD(m.paidOut)}
                        </td>
                        <td>{formatTWD(m.otherIn)}</td>
                        <td>
                          {top ? (
                            <span>
                              {top.en}
                              {top.zh ? (
                                <em className="finance-balance-meta">
                                  {" "}· {top.zh}
                                </em>
                              ) : null}{" "}
                              <em className="finance-balance-meta">
                                ({formatTWD(top.amount)})
                              </em>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="finance-dashboard-card">
          <header className="finance-dashboard-card-header">
            <h4>Account balances</h4>
            <span>latest snapshot</span>
          </header>
          {accountBalances.length === 0 ? (
            <p className="finance-dashboard-empty">No accounts found.</p>
          ) : (
            <ul className="finance-balance-list">
              {accountBalances.map((acc) => (
                <li key={acc.name} className="finance-balance-row">
                  <span className="finance-balance-name">{acc.name}</span>
                  <span
                    className={
                      acc.balance >= 0 ? "finance-plus" : "finance-minus"
                    }
                  >
                    {formatTWD(acc.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Cash flow by project</h4>
            <span>{projectRows.length} projects</span>
          </header>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Income</th>
                  <th>Expense</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.slice(0, 12).map((row) => (
                  <tr key={row.project}>
                    <td>{row.project}</td>
                    <td>{formatTWD(row.income)}</td>
                    <td>{formatTWD(row.expense)}</td>
                    <td
                      className={
                        row.net >= 0 ? "finance-plus" : "finance-minus"
                      }
                    >
                      {formatTWD(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Recent transactions</h4>
            <span>last {recentTransactions.length}</span>
          </header>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Project</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t, i) => (
                  <tr key={`${t.date}-${i}`}>
                    <td>{t.date}</td>
                    <td>{t.description || "—"}</td>
                    <td>{t.category || "—"}</td>
                    <td>{t.project || "—"}</td>
                    <td
                      className={
                        t.amount >= 0 ? "finance-plus" : "finance-minus"
                      }
                    >
                      {formatTWD(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configDraft, setConfigDraft] = useState(DEFAULT_CONFIG);
  const [actualRows, setActualRows] = useState([]);
  const [rawSheetValues, setRawSheetValues] = useState(null);
  const [selectedYear, setSelectedYear] = useState("overall");
  const [loadingActual, setLoadingActual] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;

    const unMembers = subscribeCollection("members", setMembers);
    const unProjects = subscribeCollection("projects", setProjects);
    const unFinance = subscribeCollection("financeConfig", (items) => {
      const doc = items.find((row) => row.id === CONFIG_DOC_ID) || null;
      const normalized = normalizeConfig(doc?.data || DEFAULT_CONFIG);
      setConfig(normalized);
      setConfigDraft(normalized);
    });

    return () => {
      unMembers();
      unProjects();
      unFinance();
    };
  }, []);

  useEffect(() => {
    loadActualRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workerOwners = useMemo(
    () =>
      members.filter(
        (m) => normalizeMemberRole(m?.data?.role) === "worker-owner",
      ),
    [members],
  );

  const membersById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const memberIdByAlias = useMemo(() => {
    const map = {};
    for (const m of members) {
      const id = m.id;
      map[String(id).trim().toLowerCase()] = id;
      const name = String(m?.data?.name || "")
        .trim()
        .toLowerCase();
      if (name) map[name] = id;
      const email = String(m?.data?.email || "")
        .trim()
        .toLowerCase();
      if (email) map[email] = id;

      const aliases = normalizeAliasArray(
        m?.data?.alsoKnownAs || m?.data?.aliases || "",
      );
      for (const alias of aliases) {
        const key = alias.toLowerCase();
        if (key) map[key] = id;
      }
    }
    return map;
  }, [members]);

  async function loadActualRows() {
    try {
      setLoadingActual(true);
      setError("");
      setStatus("");

      const params = new URLSearchParams();
      const range = String(configDraft.sheetRange || "").trim();
      if (range) params.set("range", range);

      const query = params.toString();
      const url = query ? `/api/sheets/values?${query}` : "/api/sheets/values";
      const response = await fetch(url, { method: "GET" });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not load actual cash flow.");
      }

      const values = Array.isArray(payload.values) ? payload.values : [];
      setRawSheetValues(values);
      if (!values.length) {
        setActualRows([]);
        setStatus("Loaded accountant sheet (no rows).");
        return;
      }

      const headers = values[0].map((h) => String(h || "").trim());
      const rows = values.slice(1).map((row) => {
        const out = {};
        for (let i = 0; i < headers.length; i += 1) {
          const key = headers[i];
          if (!key) continue;
          out[key] = row[i] ?? "";
        }
        return out;
      });

      setActualRows(rows);
      setStatus(`Loaded accountant sheet (${rows.length} rows).`);
    } catch (err) {
      setError(err?.message || "Could not load actual cash flow.");
    } finally {
      setLoadingActual(false);
    }
  }

  function addRecurringCost() {
    setConfigDraft((prev) => ({
      ...prev,
      recurringCosts: [
        ...(Array.isArray(prev.recurringCosts) ? prev.recurringCosts : []),
        {
          id: nextId(),
          year: new Date().getFullYear(),
          amountTwd: 0,
          note: "",
        },
      ],
    }));
  }

  function updateRecurringCost(id, patch) {
    setConfigDraft((prev) => ({
      ...prev,
      recurringCosts: (Array.isArray(prev.recurringCosts)
        ? prev.recurringCosts
        : []
      ).map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  }

  function removeRecurringCost(id) {
    setConfigDraft((prev) => ({
      ...prev,
      recurringCosts: (Array.isArray(prev.recurringCosts)
        ? prev.recurringCosts
        : []
      ).filter((row) => row.id !== id),
    }));
  }

  const actualRowsNormalized = useMemo(() => {
    return actualRows.map((row) => {
      const year = parseYearFromRow(row, configDraft.columns);
      const memberRaw = String(row[configDraft.columns.member] || "")
        .trim()
        .toLowerCase();
      const memberId = memberIdByAlias[memberRaw] || "";
      const paidTwd = parseMoney(row[configDraft.columns.paid]);
      const commonPoolTwd = parseMoney(row[configDraft.columns.commonPool]);
      return {
        year,
        memberId,
        paidTwd,
        commonPoolTwd,
      };
    });
  }, [actualRows, configDraft.columns, memberIdByAlias]);

  const projectProjections = useMemo(
    () => projects.map((project) => computeProjectProjection(project)),
    [projects],
  );

  const allYears = useMemo(() => {
    const set = new Set();

    for (const row of actualRowsNormalized) {
      if (row.year > 0) set.add(row.year);
    }
    for (const p of projectProjections) {
      if (p.year > 0) set.add(p.year);
    }
    for (const c of configDraft.recurringCosts || []) {
      const y = Number(c?.year);
      if (Number.isFinite(y) && y > 0) set.add(y);
    }
    for (const c of configDraft.capitalEntries || []) {
      const y = Number(c?.year);
      if (Number.isFinite(y) && y > 0) set.add(y);
    }

    return [...set].sort((a, b) => b - a);
  }, [actualRowsNormalized, projectProjections, configDraft]);

  useEffect(() => {
    if (selectedYear !== "overall" && !allYears.includes(Number(selectedYear))) {
      setSelectedYear(allYears[0] ? String(allYears[0]) : "overall");
    }
  }, [allYears, selectedYear]);

  const actualByYearMember = useMemo(() => {
    const map = {};

    for (const row of actualRowsNormalized) {
      const year = row.year || 0;
      if (!map[year]) map[year] = {};
      if (row.memberId) {
        if (!map[year][row.memberId]) {
          map[year][row.memberId] = { paid: 0, pool: 0 };
        }
        map[year][row.memberId].paid += row.paidTwd;
        map[year][row.memberId].pool += row.commonPoolTwd;
      }
    }

    return map;
  }, [actualRowsNormalized]);

  const recurringByYear = useMemo(() => {
    const map = {};
    for (const row of configDraft.recurringCosts || []) {
      const year = Number(row?.year);
      if (!Number.isFinite(year) || year <= 0) continue;
      map[year] = (map[year] || 0) + (Number(row?.amountTwd) || 0);
    }
    return map;
  }, [configDraft.recurringCosts]);

  const capitalByYearMember = useMemo(() => {
    const map = {};
    for (const row of configDraft.capitalEntries || []) {
      const year = Number(row?.year);
      const memberId = String(row?.memberId || "").trim();
      if (!Number.isFinite(year) || year <= 0 || !memberId) continue;
      if (!map[year]) map[year] = {};
      map[year][memberId] = (map[year][memberId] || 0) + (Number(row?.amountTwd) || 0);
    }
    return map;
  }, [configDraft.capitalEntries]);

  const projectionByYearMember = useMemo(() => {
    const map = {};
    for (const row of projectProjections) {
      const year = Number(row.year) || 0;
      if (!map[year]) {
        map[year] = {
          memberPayoutByMemberId: {},
          commonPool: 0,
          budget: 0,
          payout: 0,
        };
      }
      map[year].commonPool += Number(row.projectedCommonPoolTWD) || 0;
      map[year].budget += Number(row.budgetTWD) || 0;
      map[year].payout += Number(row.projectedMemberPayoutTWD) || 0;

      for (const [memberId, amount] of Object.entries(row.memberPayoutByMemberId || {})) {
        map[year].memberPayoutByMemberId[memberId] =
          (map[year].memberPayoutByMemberId[memberId] || 0) + (Number(amount) || 0);
      }
    }
    return map;
  }, [projectProjections]);

  function aggregateMemberRows(scopeYear) {
    const workerOwnerIds = workerOwners.map((m) => m.id);
    const years =
      scopeYear === "overall"
        ? allYears
        : [Number(scopeYear)].filter((y) => Number.isFinite(y));

    const rows = workerOwnerIds.map((memberId) => {
      let paidActual = 0;
      let contributedPoolActual = 0;
      let contributedCapital = 0;
      let projectedPayout = 0;
      let projectedPoolFromProjects = 0;

      for (const year of years) {
        const actual = actualByYearMember[year]?.[memberId];
        if (actual) {
          paidActual += Number(actual.paid) || 0;
          contributedPoolActual += Number(actual.pool) || 0;
        }

        const cap = capitalByYearMember[year]?.[memberId];
        if (cap) contributedCapital += Number(cap) || 0;

        const projMember = projectionByYearMember[year]?.memberPayoutByMemberId?.[memberId];
        if (projMember) projectedPayout += Number(projMember) || 0;
      }

      for (const year of years) {
        const p = projectionByYearMember[year];
        if (p) projectedPoolFromProjects += Number(p.commonPool) || 0;
      }

      const contributedTotal = contributedPoolActual + contributedCapital;
      const netBalance = contributedTotal - paidActual;

      return {
        memberId,
        memberName: membersById[memberId]?.data?.name || memberId,
        paidActual,
        contributedPoolActual,
        contributedCapital,
        contributedTotal,
        projectedPayout,
        projectedPoolFromProjects,
        netBalance,
      };
    });

    return rows;
  }

  const yearRows = useMemo(
    () =>
      selectedYear === "overall"
        ? []
        : aggregateMemberRows(selectedYear),
    [selectedYear, workerOwners, allYears, actualByYearMember, capitalByYearMember, projectionByYearMember, membersById],
  );

  const overallRows = useMemo(
    () => aggregateMemberRows("overall"),
    [workerOwners, allYears, actualByYearMember, capitalByYearMember, projectionByYearMember, membersById],
  );

  function summarizeScope(scopeYear) {
    const years =
      scopeYear === "overall"
        ? allYears
        : [Number(scopeYear)].filter((y) => Number.isFinite(y));

    let actualPaid = 0;
    let actualCommonPool = 0;
    let projectedBudget = 0;
    let projectedCommonPool = 0;
    let projectedPayout = 0;
    let recurringCost = 0;

    for (const year of years) {
      const byMember = actualByYearMember[year] || {};
      for (const v of Object.values(byMember)) {
        actualPaid += Number(v.paid) || 0;
        actualCommonPool += Number(v.pool) || 0;
      }

      recurringCost += Number(recurringByYear[year] || 0);

      const projection = projectionByYearMember[year];
      if (projection) {
        projectedBudget += Number(projection.budget) || 0;
        projectedCommonPool += Number(projection.commonPool) || 0;
        projectedPayout += Number(projection.payout) || 0;
      }
    }

    return {
      actualPaid,
      actualCommonPool,
      projectedBudget,
      projectedCommonPool,
      projectedPayout,
      recurringCost,
      netCashAfterRecurring:
        actualCommonPool - actualPaid - recurringCost,
    };
  }

  const yearSummary = useMemo(
    () => (selectedYear === "overall" ? null : summarizeScope(selectedYear)),
    [selectedYear, allYears, actualByYearMember, recurringByYear, projectionByYearMember],
  );

  const overallSummary = useMemo(
    () => summarizeScope("overall"),
    [allYears, actualByYearMember, recurringByYear, projectionByYearMember],
  );

  const projectedByProjectRows = useMemo(() => {
    const rows = [...projectProjections].sort((a, b) => {
      if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
      return String(a.projectName).localeCompare(String(b.projectName));
    });
    return rows;
  }, [projectProjections]);

  const dashboard = useMemo(
    () =>
      computeDashboardData(rawSheetValues, {
        memberIdByAlias,
        membersById,
      }),
    [rawSheetValues, memberIdByAlias, membersById],
  );

  return (
    <TabPage
      className="finance-page"
      title="Finance"
      badge={`${projectedByProjectRows.length} projects`}
      subtitle="Actual cash flow from accountant + projected project cash flow"
    >
      <CollectionLayout variant="stack" className="finance-stack">
        <SectionBlock
          className="finance-section"
          texture={SURFACE_TEXTURES.projectLedger}
          title="Cash flow dashboard"
          titleTag="h3"
          actions={
            <div className="finance-actions">
              <Button variant="ghost" onClick={loadActualRows} disabled={loadingActual}>
                {loadingActual ? "Refreshing..." : "Refresh from sheet"}
              </Button>
            </div>
          }
        >
          {dashboard ? (
            <FinanceDashboard data={dashboard} />
          ) : loadingActual ? (
            <EmptyState>Loading accountant sheet…</EmptyState>
          ) : (
            <EmptyState>
              No data yet. Make sure the sheet range is set in Finance setup
              below, then click Refresh.
            </EmptyState>
          )}
        </SectionBlock>


        <SectionBlock
          className="finance-section"
          texture={SURFACE_TEXTURES.projectLedger}
          title="Yearly recurring company cost"
          titleTag="h3"
          actions={<Button variant="ghost" onClick={addRecurringCost}>+ Add cost row</Button>}
        >
          {(configDraft.recurringCosts || []).length === 0 ? (
            <EmptyState>No recurring costs configured.</EmptyState>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Amount (TWD)</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(configDraft.recurringCosts || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <InputField
                          type="number"
                          min="2000"
                          max="3000"
                          step="1"
                          value={row.year ?? ""}
                          onChange={(e) =>
                            updateRecurringCost(row.id, {
                              year: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <InputField
                          type="number"
                          min="0"
                          step="1"
                          value={row.amountTwd ?? ""}
                          onChange={(e) =>
                            updateRecurringCost(row.id, {
                              amountTwd: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <InputField
                          value={row.note || ""}
                          onChange={(e) =>
                            updateRecurringCost(row.id, { note: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <Button variant="ghost" onClick={() => removeRecurringCost(row.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          className="finance-section"
          texture={SURFACE_TEXTURES.projectLedger}
          title="Actual vs projected cash flow"
          titleTag="h3"
          actions={
            <label className="finance-year-picker">
              <span>Year scope</span>
              <SelectField
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="overall">Overall</option>
                {allYears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </SelectField>
            </label>
          }
        >
          {selectedYear !== "overall" && yearSummary && (
            <div className="finance-summary-grid">
              <article className="finance-kpi">
                <h4>Year {selectedYear}</h4>
                <p>Company paid us (actual): {formatTWD(yearSummary.actualPaid)}</p>
                <p>Common pool (actual): {formatTWD(yearSummary.actualCommonPool)}</p>
                <p>Recurring cost: {formatTWD(yearSummary.recurringCost)}</p>
                <p>Projected budget: {formatTWD(yearSummary.projectedBudget)}</p>
                <p>Projected member payout: {formatTWD(yearSummary.projectedPayout)}</p>
                <p>Projected pool from projects: {formatTWD(yearSummary.projectedCommonPool)}</p>
                <p>Net cash after recurring: {formatTWD(yearSummary.netCashAfterRecurring)}</p>
              </article>
              <article className="finance-kpi">
                <h4>Overall</h4>
                <p>Company paid us (actual): {formatTWD(overallSummary.actualPaid)}</p>
                <p>Common pool (actual): {formatTWD(overallSummary.actualCommonPool)}</p>
                <p>Recurring cost: {formatTWD(overallSummary.recurringCost)}</p>
                <p>Projected budget: {formatTWD(overallSummary.projectedBudget)}</p>
                <p>Projected member payout: {formatTWD(overallSummary.projectedPayout)}</p>
                <p>Projected pool from projects: {formatTWD(overallSummary.projectedCommonPool)}</p>
                <p>Net cash after recurring: {formatTWD(overallSummary.netCashAfterRecurring)}</p>
              </article>
            </div>
          )}

          {selectedYear !== "overall" && (
            <>
              <h4 className="finance-subtitle">Per-member balance (Year {selectedYear})</h4>
              {yearRows.length === 0 ? (
                <EmptyState>No member rows for selected year.</EmptyState>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Paid by company (actual)</th>
                        <th>Contributed to common pool (actual)</th>
                        <th>Capital contribution</th>
                        <th>Total contribution</th>
                        <th>Balance (+ owed by company / - member owes)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearRows.map((row) => (
                        <tr key={row.memberId}>
                          <td>{row.memberName}</td>
                          <td>{formatTWD(row.paidActual)}</td>
                          <td>{formatTWD(row.contributedPoolActual)}</td>
                          <td>{formatTWD(row.contributedCapital)}</td>
                          <td>{formatTWD(row.contributedTotal)}</td>
                          <td className={row.netBalance >= 0 ? "finance-plus" : "finance-minus"}>
                            {formatTWD(row.netBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <h4 className="finance-subtitle">Per-member balance (Overall)</h4>
          {overallRows.length === 0 ? (
            <EmptyState>No worker-owner rows found.</EmptyState>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Paid by company (actual)</th>
                    <th>Contributed to common pool (actual)</th>
                    <th>Capital contribution</th>
                    <th>Total contribution</th>
                    <th>Balance (+ owed by company / - member owes)</th>
                  </tr>
                </thead>
                <tbody>
                  {overallRows.map((row) => (
                    <tr key={row.memberId}>
                      <td>{row.memberName}</td>
                      <td>{formatTWD(row.paidActual)}</td>
                      <td>{formatTWD(row.contributedPoolActual)}</td>
                      <td>{formatTWD(row.contributedCapital)}</td>
                      <td>{formatTWD(row.contributedTotal)}</td>
                      <td className={row.netBalance >= 0 ? "finance-plus" : "finance-minus"}>
                        {formatTWD(row.netBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          className="finance-section"
          texture={SURFACE_TEXTURES.projectKanban}
          title="Projected cash flow / budget by project"
          titleTag="h3"
        >
          {projectedByProjectRows.length === 0 ? (
            <EmptyState>No projects found.</EmptyState>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Project</th>
                    <th>Budget (projected)</th>
                    <th>Projected common pool</th>
                    <th>Projected payout to members</th>
                  </tr>
                </thead>
                <tbody>
                  {projectedByProjectRows.map((row) => (
                    <tr key={row.projectId}>
                      <td>{row.year || "-"}</td>
                      <td>{row.projectName}</td>
                      <td>{formatTWD(row.budgetTWD)}</td>
                      <td>{formatTWD(row.projectedCommonPoolTWD)}</td>
                      <td>{formatTWD(row.projectedMemberPayoutTWD)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>

      </CollectionLayout>

      <StatusStack>
        {status ? <p className="message message--ok">{status}</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}
      </StatusStack>
    </TabPage>
  );
}
