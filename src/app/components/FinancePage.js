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
import { IconDocument, IconFolder, IconUsers } from "./ui/icons";
import { SURFACE_TEXTURES } from "./ui/paperTextures";

const CONFIG_DOC_ID = "company";
const FINANCE_SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1lkDGH44Ut3sBiMe9Jr70hRX-YQSCqAPgUb1ubs82uqc/edit?usp=sharing";

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

function readLocalJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocalJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures.
  }
}

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
  if (
    Number.isFinite(explicitYear) &&
    explicitYear >= 1900 &&
    explicitYear <= 3000
  ) {
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
  const donation =
    budgetTWD != null ? Math.round((budgetTWD * donationPct) / 100) : 0;
  const companyTax =
    d.companyTax && budgetTWD != null ? Math.round(budgetTWD * 0.05) : 0;
  const effectiveBudget =
    budgetTWD != null ? Math.max(0, budgetTWD - donation - companyTax) : null;

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
    projectedCompanyTaxTWD: companyTax,
    projectedCommonPoolTWD: donation + companyTax,
    projectedMemberPayoutTWD: memberPayoutTotal,
    memberPayoutByMemberId,
  };
}

function isGovernmentOrTaxPayee(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /(政府|國稅|稅務|稅捐|稅|tax|gov|勞保|健保)/i.test(text);
}

function normalizeConfig(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const columns =
    base.columns && typeof base.columns === "object" ? base.columns : {};
  return {
    createdAt: Number(base.createdAt) || 0,
    updatedAt: Number(base.updatedAt) || 0,
    sheetRange: String(base.sheetRange || ""),
    columns: {
      member: String(columns.member || DEFAULT_CONFIG.columns.member),
      paid: String(columns.paid || DEFAULT_CONFIG.columns.paid),
      commonPool: String(
        columns.commonPool || DEFAULT_CONFIG.columns.commonPool,
      ),
      date: String(columns.date || DEFAULT_CONFIG.columns.date),
      year: String(columns.year || DEFAULT_CONFIG.columns.year),
    },
    capitalEntries: Array.isArray(base.capitalEntries)
      ? base.capitalEntries
      : [],
    recurringCosts: Array.isArray(base.recurringCosts)
      ? base.recurringCosts
      : [],
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
  payee: "收款人",
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

function parseQuarterKey(dateText, yearMonthText) {
  const yearMonth = parseYearMonthLabel(yearMonthText);
  if (yearMonth) {
    const [y, m] = yearMonth.split("-").map(Number);
    if (y > 0 && m >= 1 && m <= 12) {
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    }
  }

  const rawDate = String(dateText || "").trim();
  if (!rawDate) return "";
  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  }

  const match = rawDate.match(/(\d{4})[\/\-](\d{1,2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (y > 0 && m >= 1 && m <= 12) {
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    }
  }

  return "";
}

function formatQuarterLabel(quarterKey) {
  const match = String(quarterKey || "").match(/^(\d{4})-Q([1-4])$/);
  if (!match) return "Overall";
  return `Q${match[2]} ${match[1]}`;
}

const NON_PROJECT_CATEGORY_KEYS = new Set(
  [
    "Capital",
    "Yearly Internal Cost",
    "Salary",
    "Taxes",
    "Insurance",
    "Other Revenue",
    "Other Expenses",
    "Contractors",
    "外包費用",
    "Bank Charge",
  ].map((value) => normalizeProjectNameKey(value)),
);

const NON_PROJECT_CATEGORY_KEYWORDS = [
  "capital",
  "yearly internal cost",
  "internal cost",
  "salary",
  "tax",
  "taxes",
  "insurance",
  "other revenue",
  "other expenses",
  "other expense",
  "contractor",
  "contractors",
  "outsourcing",
  "外包",
  "外包費用",
  "bank charge",
  "capital",
  "內部成本",
  "年成本",
  "薪資",
  "稅",
  "保險",
  "其他收入",
  "手續費",
  "銀行費",
];

function isNonProjectCategory(categoryName) {
  const normalized = normalizeProjectNameKey(categoryName || "");
  if (!normalized) return false;
  if (NON_PROJECT_CATEGORY_KEYS.has(normalized)) return true;
  return NON_PROJECT_CATEGORY_KEYWORDS.some((token) =>
    normalized.includes(normalizeProjectNameKey(token)),
  );
}

function isCapitalCategory(categoryName) {
  const normalized = normalizeProjectNameKey(categoryName || "");
  if (!normalized) return false;
  return normalized.includes("capital") || normalized.includes("實收資本");
}

function isExpectedActualAlwaysMatchProject(projectName) {
  const normalized = normalizeProjectNameKey(projectName || "");
  if (!normalized) return false;
  return (
    normalized.includes(normalizeProjectNameKey("salary")) ||
    normalized.includes(normalizeProjectNameKey("薪資")) ||
    normalized.includes(normalizeProjectNameKey("台灣設計展"))
  );
}

function normalizeProjectNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()（）\[\]{}【】]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCategoryProjectAndFlow(rawCategory) {
  const text = String(rawCategory || "").trim();
  if (!text) return { projectName: "Uncategorized", flow: null };

  const parts = text
    .split(/[｜|]/)
    .map((p) => String(p || "").trim())
    .filter(Boolean);

  let projectName = text;
  let flowToken = "";

  if (parts.length >= 2) {
    flowToken = parts[parts.length - 1];
    projectName = parts.slice(0, -1).join("｜") || text;
  }

  const flowText = flowToken.toLowerCase();
  let flow = null;
  if (/收入|income|revenue/.test(flowText)) flow = "income";
  if (/成本|支出|expense|cost/.test(flowText)) flow = "expense";

  return {
    projectName: projectName || text,
    flow,
  };
}

function normalizeSpendDescription(description, projectName) {
  const source = String(description || "").trim();
  const project = String(projectName || "").trim();
  if (!source) return "(no description)";
  if (!project) return source;

  const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutProject = source
    .replace(new RegExp(escaped, "gi"), "")
    .replace(/[｜|:\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutProject || "(no description)";
}

function MismatchBars({ expected, actual }) {
  const exp = Math.max(0, Number(expected) || 0);
  const act = Math.max(0, Number(actual) || 0);
  const max = Math.max(exp, act, 1);
  const gap = act - exp;

  return (
    <div className="finance-mismatch-wrap">
      <div className="finance-mismatch-bars">
        <div className="finance-mismatch-row">
          <span className="finance-mismatch-label">預期</span>
          <div className="finance-mismatch-track">
            <div
              className="finance-mismatch-fill finance-mismatch-fill--expected"
              style={{ width: `${Math.round((exp / max) * 100)}%` }}
            />
          </div>
          <span className="finance-mismatch-amount">{formatTWD(exp)}</span>
        </div>
        <div className="finance-mismatch-row">
          <span className="finance-mismatch-label">實際</span>
          <div className="finance-mismatch-track">
            <div
              className="finance-mismatch-fill finance-mismatch-fill--actual"
              style={{ width: `${Math.round((act / max) * 100)}%` }}
            />
          </div>
          <span className="finance-mismatch-amount">{formatTWD(act)}</span>
        </div>
      </div>
      <p className="finance-mismatch-gap">
        差額{" "}
        <span className={gap >= 0 ? "finance-plus" : "finance-minus"}>
          {formatTWD(gap)}
        </span>
      </p>
    </div>
  );
}

function expectedPayeeRowsFromProject(project, membersById) {
  if (!project) return [];
  const projection = computeProjectProjection(project);
  return Object.entries(projection.memberPayoutByMemberId || {})
    .map(([memberId, amount]) => ({
      label: membersById?.[memberId]?.data?.name || memberId,
      amount: Number(amount) || 0,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function upsertCompanyPoolRow(rows, amount) {
  const base = Array.isArray(rows) ? rows : [];
  const filtered = base.filter((row) => String(row?.label || "") !== "公司池");
  filtered.push({ label: "公司池", amount: Math.max(0, Number(amount) || 0) });
  return filtered;
}

function computeCategoryProjectPnl(values) {
  if (!Array.isArray(values) || values.length <= DASHBOARD_FIRST_DATA_ROW) {
    return [];
  }

  const headerRow = values[DASHBOARD_HEADER_ROW] || [];
  const headerIndex = {};
  headerRow.forEach((header, i) => {
    const key = String(header || "").trim();
    if (key && headerIndex[key] === undefined) headerIndex[key] = i;
  });

  const idxOf = (label) => headerIndex[label] ?? -1;
  const dateIdx = idxOf(DASHBOARD_COLS.date);
  const categoryIdx = idxOf(DASHBOARD_COLS.category);

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
    });
  }

  const bankAccount = accounts.find((a) => a.name === DASHBOARD_BANK_NAME);
  const rows = values.slice(DASHBOARD_FIRST_DATA_ROW);
  const byCategory = {};

  function addCategoryRow(category, income, expense) {
    const parsed = parseCategoryProjectAndFlow(category);
    const key = parsed.projectName;
    if (!byCategory[key]) {
      byCategory[key] = { category: key, income: 0, expense: 0 };
    }

    const inVal = Number(income) || 0;
    const outVal = Number(expense) || 0;

    if (parsed.flow === "income") {
      byCategory[key].income += Math.abs(inVal) + Math.abs(outVal);
      return;
    }
    if (parsed.flow === "expense") {
      byCategory[key].expense += Math.abs(inVal) + Math.abs(outVal);
      return;
    }

    byCategory[key].income += inVal;
    byCategory[key].expense += outVal;
  }

  // Primary path: accountant dashboard layout with explicit bank debit/credit columns.
  for (const row of rows) {
    const dateText = String(row[dateIdx] || "").trim();
    if (!dateText) continue;

    const bankIn = bankAccount
      ? parseSignedAmount(row[bankAccount.creditCol])
      : 0;
    const bankOut = bankAccount
      ? -parseSignedAmount(row[bankAccount.debitCol])
      : 0;
    if (bankIn === 0 && bankOut === 0) continue;

    addCategoryRow(row[categoryIdx], bankIn, bankOut);
  }

  let result = Object.values(byCategory)
    .map((row) => ({
      ...row,
      net: row.income - row.expense,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  if (result.length > 0) return result;

  // Fallback path: generic sheet layout where first row is headers and 金額 is signed.
  let headerRowIndex = -1;
  let genericCategoryIdx = -1;
  let genericAmountIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i += 1) {
    const row = values[i] || [];
    const idx = {};
    row.forEach((cell, col) => {
      const key = String(cell || "").trim();
      if (key) idx[key] = col;
    });
    if (idx[DASHBOARD_COLS.category] !== undefined) {
      headerRowIndex = i;
      genericCategoryIdx = idx[DASHBOARD_COLS.category];
      genericAmountIdx = idx[DASHBOARD_COLS.amount] ?? -1;
      break;
    }
  }

  if (headerRowIndex < 0 || genericCategoryIdx < 0) return [];

  const genericByCategory = {};
  for (const row of values.slice(headerRowIndex + 1)) {
    const category = String(row[genericCategoryIdx] || "").trim();
    if (!category) continue;

    const amountRaw = genericAmountIdx >= 0 ? row[genericAmountIdx] : 0;
    const amount = parseSignedAmount(amountRaw);
    if (amount === 0) continue;

    const parsed = parseCategoryProjectAndFlow(category);
    const projectName = parsed.projectName;
    if (!genericByCategory[projectName]) {
      genericByCategory[projectName] = {
        category: projectName,
        income: 0,
        expense: 0,
      };
    }

    if (parsed.flow === "income") {
      genericByCategory[projectName].income += Math.abs(amount);
      continue;
    }
    if (parsed.flow === "expense") {
      genericByCategory[projectName].expense += Math.abs(amount);
      continue;
    }

    if (amount > 0) genericByCategory[projectName].income += amount;
    if (amount < 0) genericByCategory[projectName].expense += Math.abs(amount);
  }

  result = Object.values(genericByCategory)
    .map((row) => ({
      ...row,
      net: row.income - row.expense,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return result;
}

function buildHeaderIndex(row) {
  const idx = {};
  (row || []).forEach((cell, i) => {
    const key = String(cell || "").trim();
    if (key && idx[key] === undefined) idx[key] = i;
  });
  return idx;
}

function isBankAccountText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (text.includes(DASHBOARD_BANK_NAME)) return true;
  return /(銀行|bank|國泰世華)/i.test(text);
}

function isReceivableOrPayableAccountText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /應收帳款|應付帳款|應付帳戶/.test(text);
}

function extractFinanceTransactions(values) {
  if (!Array.isArray(values) || values.length === 0) return [];

  let headerRowIndex = -1;
  let headerIndex = {};
  for (let i = 0; i < Math.min(values.length, 10); i += 1) {
    const candidate = buildHeaderIndex(values[i]);
    if (candidate[DASHBOARD_COLS.category] !== undefined) {
      headerRowIndex = i;
      headerIndex = candidate;
      break;
    }
  }

  if (headerRowIndex < 0) return [];

  const idxOf = (label) => headerIndex[label] ?? -1;
  const categoryIdx = idxOf(DASHBOARD_COLS.category);
  const dateIdx = idxOf(DASHBOARD_COLS.date);
  const idIdx = idxOf(DASHBOARD_COLS.id);
  const descriptionIdx = idxOf(DASHBOARD_COLS.description);
  const amountIdx = idxOf(DASHBOARD_COLS.amount);
  const fromIdx = idxOf(DASHBOARD_COLS.fromAccount);
  const toIdx = idxOf(DASHBOARD_COLS.toAccount);
  const payeeIdx = idxOf(DASHBOARD_COLS.payee);

  const headerRow = values[headerRowIndex] || [];
  let bankDebitCol = -1;
  let bankCreditCol = -1;
  for (
    let col = DASHBOARD_ACCOUNT_FIRST_COL;
    col < headerRow.length;
    col += DASHBOARD_ACCOUNT_STRIDE
  ) {
    const name = String(headerRow[col] || "").trim();
    if (name === DASHBOARD_BANK_NAME) {
      bankDebitCol = col;
      bankCreditCol = col + 1;
      break;
    }
  }

  const rows = values.slice(headerRowIndex + 1);
  const out = [];

  for (const row of rows) {
    const rawCategory = String(row[categoryIdx] || "").trim();
    if (!rawCategory) continue;
    const fromAccount = String(row[fromIdx] || "").trim();
    const toAccount = String(row[toIdx] || "").trim();
    if (!fromAccount && !toAccount) continue;

    const hasArApAccount =
      isReceivableOrPayableAccountText(fromAccount) ||
      isReceivableOrPayableAccountText(toAccount);
    const hasBankAccount =
      isBankAccountText(fromAccount) || isBankAccountText(toAccount);
    // Ignore internal AR/AP reclass rows that do not touch any bank account.
    if (hasArApAccount && !hasBankAccount) continue;

    const parsedCategory = parseCategoryProjectAndFlow(rawCategory);
    const bankIn =
      bankCreditCol >= 0 ? parseSignedAmount(row[bankCreditCol]) : 0;
    const bankOut =
      bankDebitCol >= 0 ? Math.abs(parseSignedAmount(row[bankDebitCol])) : 0;
    const signedAmount = amountIdx >= 0 ? parseSignedAmount(row[amountIdx]) : 0;

    let income = 0;
    let expense = 0;

    if (bankIn > 0 || bankOut > 0) {
      income = bankIn;
      expense = bankOut;
    } else if (signedAmount !== 0) {
      if (parsedCategory.flow === "income") income = Math.abs(signedAmount);
      else if (parsedCategory.flow === "expense")
        expense = Math.abs(signedAmount);
      else if (signedAmount > 0) income = signedAmount;
      else expense = Math.abs(signedAmount);
    } else {
      continue;
    }

    out.push({
      serialNumber: String(row[idIdx] || "").trim(),
      date: String(row[dateIdx] || "").trim(),
      description: String(row[descriptionIdx] || "").trim(),
      projectName: parsedCategory.projectName,
      rawCategory,
      categoryFlow: parsedCategory.flow,
      income,
      expense,
      signedAmount: signedAmount !== 0 ? signedAmount : income - expense,
      amountAbs: Math.abs(signedAmount) || income || expense,
      payee: String(row[payeeIdx] || "").trim() || "(unknown payee)",
      fromAccount,
      toAccount,
    });
  }

  return out;
}

function parseTransactionYear(dateText) {
  const raw = String(dateText || "").trim();
  if (!raw) return 0;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();

  const match = raw.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
}

function transactionMatchesYear(tx, selectedYear) {
  if (selectedYear === "overall") return true;
  const targetYear = Number(selectedYear);
  if (!Number.isFinite(targetYear)) return true;
  return parseTransactionYear(tx?.date) === targetYear;
}

function computeProjectPanels(values, selectedYear = "overall") {
  const txs = extractFinanceTransactions(values).filter((tx) =>
    transactionMatchesYear(tx, selectedYear),
  );
  if (!txs.length) return [];

  const map = {};
  function ensure(projectName) {
    if (!map[projectName]) {
      map[projectName] = {
        projectName,
        income: 0,
        expense: 0,
        receivableMissing: 0,
        payableExpected: 0,
        spendByCategoryMap: {},
        payeeMap: {},
        transactions: [],
      };
    }
    return map[projectName];
  }

  for (const tx of txs) {
    const spendDescription = normalizeSpendDescription(
      tx.description,
      tx.projectName,
    );
    const keys = [tx.projectName, "__ALL__"];
    for (const key of keys) {
      const panel = ensure(key);
      panel.income += tx.income;
      panel.expense += tx.expense;

      if (tx.expense > 0) {
        const spendLabel = spendDescription || "(no description)";
        panel.spendByCategoryMap[spendLabel] =
          (panel.spendByCategoryMap[spendLabel] || 0) + tx.expense;
        panel.payeeMap[tx.payee] = (panel.payeeMap[tx.payee] || 0) + tx.expense;
      }

      panel.transactions.push({
        serialNumber: tx.serialNumber,
        date: tx.date,
        description: tx.description,
        amount: tx.signedAmount,
        payee: tx.payee,
      });

      const toAccount = String(tx.toAccount || "");
      const fromAccount = String(tx.fromAccount || "");

      // Net receivables based on bank-touching AR rows.
      if (toAccount.includes("應收帳款"))
        panel.receivableMissing += tx.amountAbs;
      if (fromAccount.includes("應收帳款"))
        panel.receivableMissing -= tx.amountAbs;

      // Net payables based on bank-touching AP rows (expected minus paid).
      if (fromAccount.includes("應付帳款"))
        panel.payableExpected += tx.amountAbs;
      if (toAccount.includes("應付帳款") || toAccount.includes("應付帳戶")) {
        panel.payableExpected -= tx.amountAbs;
      }
    }
  }

  return Object.values(map)
    .map((panel) => {
      const net = panel.income - panel.expense;
      const spendByCategory = Object.entries(panel.spendByCategoryMap)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);
      if (net > 0) {
        spendByCategory.push({
          label: "公司池",
          amount: net,
        });
      }
      const payeeBreakdown = Object.entries(panel.payeeMap)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);
      if (net > 0) {
        payeeBreakdown.push({
          label: "公司池",
          amount: net,
        });
      }
      return {
        projectName: panel.projectName,
        income: panel.income,
        expense: panel.expense,
        net,
        receivableMissing: Math.max(0, panel.receivableMissing),
        payableExpected: Math.max(0, panel.payableExpected),
        spendByCategory,
        payeeBreakdown,
        transactions: panel.transactions,
      };
    })
    .sort((a, b) => {
      if (a.projectName === "__ALL__") return -1;
      if (b.projectName === "__ALL__") return 1;
      return Math.abs(b.net) - Math.abs(a.net);
    });
}

const RING_CHART_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const RING_LABEL_COLOR_MAP = {
  公司池: "#374151",
  Underpaid: "#b91c1c",
  Overpaid: "#1d4ed8",
  Matched: "#15803d",
};

function ringColorForLabel(label, index) {
  const fixed = RING_LABEL_COLOR_MAP[String(label || "").trim()];
  if (fixed) return fixed;
  return RING_CHART_COLORS[index % RING_CHART_COLORS.length];
}

function PercentageRows({ rows, max = 8 }) {
  const top = (rows || []).slice(0, max);
  const total = top.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  if (!top.length || total <= 0) {
    return <p className="finance-dashboard-empty">No entries.</p>;
  }

  let start = 0;
  const slices = top.map((row, i) => {
    const amount = Number(row.amount) || 0;
    const pct = total > 0 ? (amount / total) * 100 : 0;
    const end = start + pct;
    const color = ringColorForLabel(row.label, i);
    const slice = {
      ...row,
      amount,
      pct,
      start,
      end,
      color,
    };
    start = end;
    return slice;
  });

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
    .join(", ");

  return (
    <div className="finance-ring-wrap">
      <div
        className="finance-ring-chart"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="finance-ring-hole">
          <strong>{formatTWD(total)}</strong>
          <span>Total</span>
        </div>
      </div>
      <ul className="finance-ring-legend">
        {slices.map((slice) => (
          <li key={slice.label} className="finance-ring-legend-row">
            <span
              className="finance-ring-dot"
              style={{ backgroundColor: slice.color }}
            />
            <span className="finance-ring-label">{slice.label}</span>
            <span className="finance-ring-pct">{slice.pct.toFixed(1)}%</span>
            <span className="finance-ring-amount">
              {formatTWD(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommonPoolRingRows({
  rows,
  itemizedRows,
  itemizedKey,
  totalOverride,
  max = 8,
}) {
  const top = (rows || []).slice(0, max);
  const totalAbs = top.reduce(
    (s, r) => s + (Math.abs(Number(r.amount)) || 0),
    0,
  );
  if (!top.length || totalAbs <= 0) {
    return <p className="finance-dashboard-empty">No entries.</p>;
  }

  let start = 0;
  const slices = top.map((row, i) => {
    const amount = Math.abs(Number(row.amount) || 0);
    const pct = totalAbs > 0 ? (amount / totalAbs) * 100 : 0;
    const end = start + pct;
    const color = ringColorForLabel(row.label, i);
    const slice = {
      ...row,
      amount,
      pct,
      start,
      end,
      color,
    };
    start = end;
    return slice;
  });

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
    .join(", ");

  const itemizedTotalAbs = (itemizedRows || []).reduce(
    (sum, row) => sum + Math.abs(Number(row.amount) || 0),
    0,
  );

  const centerTotal =
    typeof totalOverride === "number" && Number.isFinite(totalOverride)
      ? totalOverride
      : totalAbs;

  return (
    <div className="finance-ring-wrap">
      <div
        className="finance-ring-chart"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="finance-ring-hole">
          <strong>{formatTWD(centerTotal)}</strong>
          <span>Total</span>
        </div>
      </div>
      <ul className="finance-ring-legend">
        {slices.flatMap((slice) => {
          const baseRow = (
            <li key={slice.label} className="finance-ring-legend-row">
              <span
                className="finance-ring-dot"
                style={{ backgroundColor: slice.color }}
              />
              <span className="finance-ring-label">{slice.label}</span>
              <span className="finance-ring-pct">{slice.pct.toFixed(1)}%</span>
              <span
                className={
                  Number(slice.displayAmount ?? slice.amount) >= 0
                    ? "finance-ring-amount finance-plus"
                    : "finance-ring-amount finance-minus"
                }
              >
                {formatTWD(slice.displayAmount ?? slice.amount)}
              </span>
            </li>
          );

          const subRows =
            slice.key === itemizedKey
              ? (itemizedRows || []).map((row) => {
                  const amount = Number(row.amount) || 0;
                  const pct =
                    itemizedTotalAbs > 0
                      ? (Math.abs(amount) / itemizedTotalAbs) * 100
                      : 0;
                  return (
                    <li
                      key={`${slice.key || slice.label}--${row.key}`}
                      className="finance-ring-legend-row finance-ring-legend-row--sub"
                    >
                      <span className="finance-ring-dot finance-ring-dot--sub" />
                      <span className="finance-ring-label">{row.label}</span>
                      <span className="finance-ring-pct">
                        {pct.toFixed(1)}%
                      </span>
                      <span
                        className={
                          amount >= 0
                            ? "finance-ring-amount finance-plus"
                            : "finance-ring-amount finance-minus"
                        }
                      >
                        {formatTWD(amount)}
                      </span>
                    </li>
                  );
                })
              : [];

          return [baseRow, ...subRows];
        })}
      </ul>
    </div>
  );
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

function resolveMemberIdFromText(text, memberIdByAlias) {
  if (!memberIdByAlias) return "";
  const raw = String(text || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (memberIdByAlias[raw]) return memberIdByAlias[raw];

  const parts = raw
    .split(/[｜|,;/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (memberIdByAlias[part]) return memberIdByAlias[part];
  }

  for (const [alias, memberId] of Object.entries(memberIdByAlias)) {
    if (!alias || alias.length < 2) continue;
    if (raw.includes(alias)) return memberId;
  }

  return "";
}

function computeDashboardData(values, opts = {}) {
  if (!Array.isArray(values) || values.length <= DASHBOARD_FIRST_DATA_ROW) {
    return null;
  }
  const {
    memberIdByAlias = null,
    membersById = {},
    quarterFilter = "overall",
  } = opts;

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
  const payeeIdx = idxOf(DASHBOARD_COLS.payee);
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

    const bankIn = bankAccount
      ? parseSignedAmount(row[bankAccount.creditCol])
      : 0;
    const bankOut = bankAccount
      ? parseSignedAmount(row[bankAccount.debitCol])
      : 0;
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
      payee: String(row[payeeIdx] || "").trim(),
      from: String(row[fromIdx] || "").trim(),
      to: String(row[toIdx] || "").trim(),
      note: String(row[noteIdx] || "").trim(),
      description: String(row[descIdx] || "").trim(),
      yearMonth: parseYearMonthLabel(row[yearMonthIdx]),
      quarterKey: parseQuarterKey(dateText, row[yearMonthIdx]),
    });
  }

  const availableQuarterKeys = [
    ...new Set(transactions.map((t) => t.quarterKey).filter(Boolean)),
  ].sort((a, b) => String(b).localeCompare(String(a)));

  const filteredTransactions =
    quarterFilter && quarterFilter !== "overall"
      ? transactions.filter((t) => t.quarterKey === quarterFilter)
      : transactions;

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
        memberName: membersById[memberId]?.data?.name || memberId || "Unknown",
        capitalIn: 0,
        paidOut: 0,
        otherIn: 0,
        paidOutByCategory: {},
      };
    }
    return byMember[memberId];
  }

  const projectCategoryMap = {};
  const projectPayeeExpenseMap = {};

  for (const t of filteredTransactions) {
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

      const categoryKey = t.category || "Uncategorized";
      const projectCategoryId = `${projKey}|||${categoryKey}`;
      if (!projectCategoryMap[projectCategoryId]) {
        projectCategoryMap[projectCategoryId] = {
          project: projKey,
          category: categoryKey,
          income: 0,
          expense: 0,
        };
      }
      projectCategoryMap[projectCategoryId].income += t.bankIn;
      projectCategoryMap[projectCategoryId].expense += t.bankOut;

      if (t.bankOut > 0) {
        const payeeKey = t.payee || "(unknown payee)";
        const payeeId = `${projKey}|||${payeeKey}`;
        if (!projectPayeeExpenseMap[payeeId]) {
          projectPayeeExpenseMap[payeeId] = {
            project: projKey,
            payee: payeeKey,
            expense: 0,
          };
        }
        projectPayeeExpenseMap[payeeId].expense += t.bankOut;
      }
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
    .sort((a, b) => b.income + b.expense - (a.income + a.expense));

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
    balance: lastBalanceRow
      ? parseSignedAmount(lastBalanceRow[a.balanceCol])
      : 0,
  }));

  const bankBalance =
    accountBalances.find((a) => a.name === DASHBOARD_BANK_NAME)?.balance || 0;
  const netAssetPosition = accountBalances.reduce((s, a) => s + a.balance, 0);

  const projectCategoryRows = Object.values(projectCategoryMap)
    .map((row) => ({
      ...row,
      net: row.income - row.expense,
    }))
    .sort((a, b) => b.income + b.expense - (a.income + a.expense));

  const projectPayeeRows = Object.values(projectPayeeExpenseMap).sort(
    (a, b) => b.expense - a.expense,
  );

  const recentTransactions = [...filteredTransactions]
    .filter((t) => t.bankIn > 0 || t.bankOut > 0)
    .reverse()
    .slice(0, 12);

  return {
    transactionCount: filteredTransactions.length,
    quarterFilter,
    availableQuarterKeys,
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
    projectCategoryRows,
    projectPayeeRows,
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
        const pct =
          max > 0 ? Math.max(2, Math.round((row.amount / max) * 100)) : 0;
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
    quarterFilter,
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
    projectCategoryRows,
    projectPayeeRows,
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
      <p className="finance-section-note">
        Scope: {formatQuarterLabel(quarterFilter)}
      </p>
      <div className="finance-dashboard-kpis">
        <article className="finance-dashboard-kpi finance-dashboard-kpi--positive">
          <span className="finance-dashboard-kpi-label">Bank cash on hand</span>
          <strong>{formatTWD(bankBalance)}</strong>
          <span className="finance-dashboard-kpi-hint">
            國泰世華 latest balance
          </span>
        </article>
        <article
          className={`finance-dashboard-kpi ${
            netAssetPosition >= 0
              ? "finance-dashboard-kpi--positive"
              : "finance-dashboard-kpi--negative"
          }`}
        >
          <span className="finance-dashboard-kpi-label">
            Net asset position
          </span>
          <strong>{formatTWD(netAssetPosition)}</strong>
          <span className="finance-dashboard-kpi-hint">
            bank − payables / receivables
          </span>
        </article>
        <article className="finance-dashboard-kpi">
          <span className="finance-dashboard-kpi-label">Capital invested</span>
          <strong>{formatTWD(capitalInvested)}</strong>
          <span className="finance-dashboard-kpi-hint">
            worker-owner contributions
          </span>
        </article>
        <article className="finance-dashboard-kpi finance-dashboard-kpi--income">
          <span className="finance-dashboard-kpi-label">Operating revenue</span>
          <strong>{formatTWD(operatingRevenue)}</strong>
          <span className="finance-dashboard-kpi-hint">
            cash in, ex-capital
          </span>
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
          <span className="finance-dashboard-kpi-label">
            Bank-touching transactions
          </span>
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
            <span>
              {expenseRows.length} categories · {expenseDescriptionRows.length}{" "}
              items
            </span>
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
              <h5 className="finance-split-title">
                By item / description (敘述)
              </h5>
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
            <span>
              {incomeRows.length} categories · {incomeDescriptionRows.length}{" "}
              items
            </span>
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
              <h5 className="finance-split-title">
                By item / description (敘述)
              </h5>
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
                                  {" "}
                                  · {top.zh}
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
            <h4>Project synthesis by 分類</h4>
            <span>{projectCategoryRows.length} rows</span>
          </header>
          {projectCategoryRows.length === 0 ? (
            <p className="finance-dashboard-empty">
              No categorized project entries.
            </p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>分類</th>
                    <th>收入</th>
                    <th>支出</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {projectCategoryRows.slice(0, 20).map((row, idx) => (
                    <tr key={`${row.project}-${row.category}-${idx}`}>
                      <td>{row.project}</td>
                      <td>{row.category}</td>
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
          )}
        </section>

        <section className="finance-dashboard-card finance-dashboard-card--wide">
          <header className="finance-dashboard-card-header">
            <h4>Who got paid (收款人) by project</h4>
            <span>{projectPayeeRows.length} payee rows</span>
          </header>
          {projectPayeeRows.length === 0 ? (
            <p className="finance-dashboard-empty">
              No payee data found for expenses.
            </p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>收款人</th>
                    <th>Total 支出</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPayeeRows.slice(0, 20).map((row, idx) => (
                    <tr key={`${row.project}-${row.payee}-${idx}`}>
                      <td>{row.project}</td>
                      <td>{row.payee}</td>
                      <td className="finance-minus">
                        {formatTWD(row.expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  const [tasks, setTasks] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [fxRates, setFxRates] = useState({}); // rates relative to TWD, e.g. { USD: 32.5 }
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configDraft, setConfigDraft] = useState(DEFAULT_CONFIG);
  const [actualRows, setActualRows] = useState([]);
  const [rawSheetValues, setRawSheetValues] = useState(null);
  const [categoryProjectMap, setCategoryProjectMap] = useState(() =>
    readLocalJSON("finance-category-project-map-v1", {}),
  );
  const [selectedQuarter, setSelectedQuarter] = useState("overall");
  const [financeMainView, setFinanceMainView] = useState("project");
  const [financeCategoryTab, setFinanceCategoryTab] = useState("projects");
  const [selectedYear, setSelectedYear] = useState("overall");
  const [mappingEditorCategory, setMappingEditorCategory] = useState("");
  const [loadingActual, setLoadingActual] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;

    const unMembers = subscribeCollection("members", setMembers);
    const unProjects = subscribeCollection("projects", setProjects);
    const unTasks = subscribeCollection("tasks", setTasks);
    const unReimbursements = subscribeCollection(
      "reimbursements",
      setReimbursements,
    );
    const unFinance = subscribeCollection("financeConfig", (items) => {
      const doc = items.find((row) => row.id === CONFIG_DOC_ID) || null;
      const normalized = normalizeConfig(doc?.data || DEFAULT_CONFIG);
      setConfig(normalized);
      setConfigDraft(normalized);
    });

    return () => {
      unMembers();
      unProjects();
      unTasks();
      unReimbursements();
      unFinance();
    };
  }, []);

  useEffect(() => {
    loadActualRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Hardcoded fallback rates (TWD per 1 unit) — used if fetch fails
    const FALLBACK_RATES = {
      USD: 32,
      JPY: 0.21,
      EUR: 35,
      GBP: 41,
      CNY: 4.4,
      HKD: 4.1,
    };
    setFxRates(FALLBACK_RATES);
    // Fetch live rates from open.er-api.com (free, no key required)
    // rates[X] = X per 1 USD, so TWD per 1 X = rates[TWD] / rates[X]
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.rates?.TWD) return;
        const twdPerUsd = data.rates.TWD;
        const rates = { USD: twdPerUsd };
        for (const [code, unitsPerUsd] of Object.entries(data.rates)) {
          if (code === "TWD" || !unitsPerUsd) continue;
          rates[code] = twdPerUsd / unitsPerUsd;
        }
        setFxRates(rates);
      })
      .catch(() => {}); // fallback rates already set above
  }, []);

  useEffect(() => {
    writeLocalJSON("finance-category-project-map-v1", categoryProjectMap || {});
  }, [categoryProjectMap]);

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

    // Include years from transaction dates so year filter works even when
    // rows do not have a dedicated year column filled.
    const txYears = extractFinanceTransactions(rawSheetValues)
      .map((tx) => parseTransactionYear(tx?.date))
      .filter((year) => Number.isFinite(year) && year > 0);
    for (const year of txYears) set.add(year);

    for (const c of configDraft.recurringCosts || []) {
      const y = Number(c?.year);
      if (Number.isFinite(y) && y > 0) set.add(y);
    }
    for (const c of configDraft.capitalEntries || []) {
      const y = Number(c?.year);
      if (Number.isFinite(y) && y > 0) set.add(y);
    }

    return [...set].sort((a, b) => b - a);
  }, [actualRowsNormalized, projectProjections, configDraft, rawSheetValues]);

  useEffect(() => {
    if (
      selectedYear !== "overall" &&
      !allYears.includes(Number(selectedYear))
    ) {
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
      map[year][memberId] =
        (map[year][memberId] || 0) + (Number(row?.amountTwd) || 0);
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

      for (const [memberId, amount] of Object.entries(
        row.memberPayoutByMemberId || {},
      )) {
        map[year].memberPayoutByMemberId[memberId] =
          (map[year].memberPayoutByMemberId[memberId] || 0) +
          (Number(amount) || 0);
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

        const projMember =
          projectionByYearMember[year]?.memberPayoutByMemberId?.[memberId];
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
    () => (selectedYear === "overall" ? [] : aggregateMemberRows(selectedYear)),
    [
      selectedYear,
      workerOwners,
      allYears,
      actualByYearMember,
      capitalByYearMember,
      projectionByYearMember,
      membersById,
    ],
  );

  const overallRows = useMemo(
    () => aggregateMemberRows("overall"),
    [
      workerOwners,
      allYears,
      actualByYearMember,
      capitalByYearMember,
      projectionByYearMember,
      membersById,
    ],
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
      netCashAfterRecurring: actualCommonPool - actualPaid - recurringCost,
    };
  }

  const yearSummary = useMemo(
    () => (selectedYear === "overall" ? null : summarizeScope(selectedYear)),
    [
      selectedYear,
      allYears,
      actualByYearMember,
      recurringByYear,
      projectionByYearMember,
    ],
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

  const dashboardAll = useMemo(
    () =>
      computeDashboardData(rawSheetValues, {
        memberIdByAlias,
        membersById,
        quarterFilter: "overall",
      }),
    [rawSheetValues, memberIdByAlias, membersById],
  );

  const quarterOptions = dashboardAll?.availableQuarterKeys || [];

  useEffect(() => {
    if (
      selectedQuarter !== "overall" &&
      !quarterOptions.includes(selectedQuarter)
    ) {
      setSelectedQuarter("overall");
    }
  }, [quarterOptions, selectedQuarter]);

  const dashboard = useMemo(
    () =>
      computeDashboardData(rawSheetValues, {
        memberIdByAlias,
        membersById,
        quarterFilter: selectedQuarter,
      }),
    [rawSheetValues, memberIdByAlias, membersById, selectedQuarter],
  );

  const projectPanels = useMemo(
    () => computeProjectPanels(rawSheetValues, selectedYear),
    [rawSheetValues, selectedYear],
  );

  const allProjectsPanel = useMemo(
    () =>
      projectPanels.find((panel) => panel.projectName === "__ALL__") || null,
    [projectPanels],
  );

  const singleProjectPanels = useMemo(
    () => projectPanels.filter((panel) => panel.projectName !== "__ALL__"),
    [projectPanels],
  );

  const systemProjectsSorted = useMemo(
    () =>
      [...projects].sort((a, b) =>
        String(a?.data?.name || "").localeCompare(String(b?.data?.name || "")),
      ),
    [projects],
  );

  const systemProjectByNormalizedName = useMemo(() => {
    const map = {};
    for (const project of systemProjectsSorted) {
      const key = normalizeProjectNameKey(project?.data?.name || "");
      if (!key) continue;
      if (!map[key]) map[key] = project;
    }
    return map;
  }, [systemProjectsSorted]);

  const finishedHoursByProjectMember = useMemo(() => {
    const out = {};
    const taskList = Array.isArray(tasks) ? tasks : [];
    for (const t of taskList) {
      const d = t?.data || {};
      const projectId = String(d.projectId || "").trim();
      const memberId = String(d.memberId || "").trim();
      if (!projectId || !memberId) continue;
      if (!d.completed && !d.archived) continue;
      const hours =
        ((Number(d.timeUnits) || 0) + (Number(d.overtimeUnits) || 0)) * 0.25;
      if (hours <= 0) continue;
      const key = `${projectId}::${memberId}`;
      out[key] = (out[key] || 0) + hours;
    }
    return out;
  }, [tasks]);

  const actualRequiredExpenseByCategory = useMemo(() => {
    const out = {};
    const txs = extractFinanceTransactions(rawSheetValues).filter((tx) =>
      transactionMatchesYear(tx, selectedYear),
    );
    for (const tx of txs) {
      const expense = Number(tx.expense) || 0;
      if (expense <= 0) continue;

      const byPayee = resolveMemberIdFromText(tx.payee, memberIdByAlias);
      const byDescription =
        attributeMember(tx.description, memberIdByAlias)?.memberId || "";
      const memberId = byPayee || byDescription;
      const isGovernmentPayment = isGovernmentOrTaxPayee(tx.payee);
      if (!memberId && !isGovernmentPayment) continue;

      const category = String(tx.projectName || "").trim();
      if (!category) continue;
      out[category] = (out[category] || 0) + expense;
    }
    return out;
  }, [rawSheetValues, memberIdByAlias, selectedYear]);

  const actualMemberExpenseByCategory = useMemo(() => {
    const out = {};
    const txs = extractFinanceTransactions(rawSheetValues).filter((tx) =>
      transactionMatchesYear(tx, selectedYear),
    );
    for (const tx of txs) {
      const expense = Number(tx.expense) || 0;
      if (expense <= 0) continue;

      const byPayee = resolveMemberIdFromText(tx.payee, memberIdByAlias);
      const byDescription =
        attributeMember(tx.description, memberIdByAlias)?.memberId || "";
      const memberId = byPayee || byDescription;
      if (!memberId) continue;

      const category = String(tx.projectName || "").trim();
      if (!category) continue;
      out[category] = (out[category] || 0) + expense;
    }
    return out;
  }, [rawSheetValues, memberIdByAlias, selectedYear]);

  const projectCategoryViewRows = useMemo(() => {
    const txRows = singleProjectPanels.map((row) => {
      const categoryName = row.projectName;
      const needsProjectMatch = !isNonProjectCategory(categoryName);
      const autoMatchProject = needsProjectMatch
        ? systemProjectByNormalizedName[
            normalizeProjectNameKey(categoryName)
          ] || null
        : null;
      const manualMatchProjectId = categoryProjectMap?.[categoryName];
      const matchedProjectId =
        needsProjectMatch && manualMatchProjectId !== undefined
          ? manualMatchProjectId
          : autoMatchProject?.id || "";
      const matchedProject =
        systemProjectsSorted.find((p) => p.id === matchedProjectId) || null;
      const isMatched = needsProjectMatch ? Boolean(matchedProject) : true;
      const expectedAmountTwd = matchedProject
        ? budgetToTWD(
            Number(matchedProject?.data?.budget) || 0,
            matchedProject?.data?.budgetCurrency,
          ) || 0
        : 0;
      const projection = matchedProject
        ? computeProjectProjection(matchedProject)
        : null;
      const expectedExpenseTwd = projection
        ? (Number(projection.projectedMemberPayoutTWD) || 0) +
          (Number(projection.projectedCompanyTaxTWD) || 0)
        : 0;
      const actualExpectedExpenseTwd =
        Number(actualRequiredExpenseByCategory[categoryName]) || 0;
      const expectedOutstandingTwd = Math.max(
        0,
        expectedAmountTwd - row.income,
      );
      const receivableDisplayTwd = Math.max(
        Number(row.receivableMissing) || 0,
        expectedOutstandingTwd,
      );

      let hoursEarnedPayableTwd = 0;
      if (matchedProject) {
        const projection = computeProjectProjection(matchedProject);
        const staffing = Array.isArray(matchedProject?.data?.staffing)
          ? matchedProject.data.staffing
          : [];
        for (const entry of staffing) {
          const memberId = String(entry?.memberId || "").trim();
          if (!memberId) continue;
          const maxHours = Number(entry?.maxHours) || 0;
          if (maxHours <= 0) continue;
          const atMax =
            Number(projection.memberPayoutByMemberId?.[memberId]) || 0;
          if (atMax <= 0) continue;
          const finishedHours =
            Number(
              finishedHoursByProjectMember[`${matchedProject.id}::${memberId}`],
            ) || 0;
          if (finishedHours <= 0) continue;
          const ratio = Math.max(0, Math.min(1, finishedHours / maxHours));
          hoursEarnedPayableTwd += atMax * ratio;
        }
      }

      const actualMemberPaidTwd =
        Number(actualMemberExpenseByCategory[categoryName]) || 0;
      const hoursOutstandingPayableTwd = Math.max(
        0,
        Math.round(hoursEarnedPayableTwd - actualMemberPaidTwd),
      );
      const payableDisplayTwd = Math.max(
        Number(row.payableExpected) || 0,
        hoursOutstandingPayableTwd,
      );

      return {
        ...row,
        category: categoryName,
        needsProjectMatch,
        autoMatchProject,
        matchedProject,
        matchedProjectId,
        isMatched,
        isManual: manualMatchProjectId !== undefined,
        expectedAmountTwd,
        expectedExpenseTwd,
        actualExpectedExpenseTwd,
        incomeGapTwd: row.income - expectedAmountTwd,
        expectedOutstandingTwd,
        receivableDisplayTwd,
        hoursEarnedPayableTwd,
        actualMemberPaidTwd,
        payableDisplayTwd,
        noTransactionsYet: false,
      };
    });

    const txCategoryNameSet = new Set(
      txRows.map((row) => normalizeProjectNameKey(row.category)),
    );
    const mappedProjectIdSet = new Set(
      txRows.map((row) => row.matchedProjectId).filter(Boolean),
    );

    const systemOnlyRows = systemProjectsSorted
      .filter((project) => {
        const normalizedProjectName = normalizeProjectNameKey(
          project?.data?.name || "",
        );
        if (!normalizedProjectName) return false;
        if (txCategoryNameSet.has(normalizedProjectName)) return false;
        if (mappedProjectIdSet.has(project.id)) return false;
        return true;
      })
      .map((project) => {
        const expectedAmountTwd =
          budgetToTWD(
            Number(project?.data?.budget) || 0,
            project?.data?.budgetCurrency,
          ) || 0;
        return {
          projectName: project?.data?.name || project.id,
          category: project?.data?.name || project.id,
          income: 0,
          expense: 0,
          net: 0,
          receivableMissing: 0,
          payableExpected: 0,
          spendByCategory: [],
          payeeBreakdown: [],
          transactions: [],
          needsProjectMatch: false,
          autoMatchProject: project,
          matchedProject: project,
          matchedProjectId: project.id,
          isMatched: true,
          isManual: false,
          expectedAmountTwd,
          expectedExpenseTwd: (() => {
            const projection = computeProjectProjection(project);
            return (
              (Number(projection.projectedMemberPayoutTWD) || 0) +
              (Number(projection.projectedCompanyTaxTWD) || 0)
            );
          })(),
          actualExpectedExpenseTwd: 0,
          incomeGapTwd: -expectedAmountTwd,
          expectedOutstandingTwd: Math.max(0, expectedAmountTwd),
          receivableDisplayTwd: Math.max(0, expectedAmountTwd),
          hoursEarnedPayableTwd: 0,
          actualMemberPaidTwd: 0,
          payableDisplayTwd: 0,
          noTransactionsYet: true,
        };
      });

    return [...txRows, ...systemOnlyRows];
  }, [
    singleProjectPanels,
    categoryProjectMap,
    systemProjectByNormalizedName,
    systemProjectsSorted,
    actualRequiredExpenseByCategory,
    actualMemberExpenseByCategory,
    finishedHoursByProjectMember,
  ]);

  const unmatchedProjectCategoryRows = useMemo(
    () =>
      projectCategoryViewRows.filter(
        (row) => row.needsProjectMatch && !row.isMatched,
      ),
    [projectCategoryViewRows],
  );

  const matchRequiredCount = useMemo(
    () => projectCategoryViewRows.filter((row) => row.needsProjectMatch).length,
    [projectCategoryViewRows],
  );

  const projectOnlyRows = useMemo(
    () =>
      projectCategoryViewRows.filter(
        (row) => row.needsProjectMatch || row.noTransactionsYet,
      ),
    [projectCategoryViewRows],
  );

  const nonProjectRows = useMemo(
    () =>
      projectCategoryViewRows.filter(
        (row) => !row.needsProjectMatch && !row.noTransactionsYet,
      ),
    [projectCategoryViewRows],
  );

  const allProjectsCompanyCostRows = useMemo(
    () =>
      nonProjectRows
        .map((row) => ({
          label: row.category || "Uncategorized",
          amount: Math.max(0, Number(row.expense) || 0),
        }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [nonProjectRows],
  );

  // pending = submitted or approved (not yet paid/rejected)
  const reimbursementsByMember = useMemo(() => {
    const map = {};
    for (const row of reimbursements) {
      const mid = row?.data?.memberId;
      const status = row?.data?.status;
      const dir = row?.data?.direction || "owed_to_me";
      if (!mid || status === "rejected" || status === "paid") continue;
      if (!map[mid]) map[mid] = { netTWD: 0, unconverted: [], items: [] };
      const amt = Number(row?.data?.amount) || 0;
      const currency = String(row?.data?.currency || "TWD").toUpperCase();
      let amtTWD = 0;
      if (currency === "TWD") {
        amtTWD = amt;
      } else if (fxRates[currency]) {
        // fxRates[currency] = TWD per 1 unit of that currency
        amtTWD = amt * fxRates[currency];
      } else {
        // Rate not available — track raw amount separately so we can still show it
        const sign = dir === "owed_to_me" ? 1 : -1;
        map[mid].unconverted.push({ amt: sign * amt, currency });
      }
      // owed_to_me = company owes member → positive net; owe_company = member owes company → negative net
      map[mid].netTWD += dir === "owed_to_me" ? amtTWD : -amtTWD;
      map[mid].items.push({ ...row.data, id: row.id, amtTWD, dir });
    }
    return map;
  }, [reimbursements, fxRates]);

  const memberPayoutReconciliationRows = useMemo(() => {
    const expectedByMember = {};
    const expectedByMemberProject = {};
    for (const project of projects) {
      const projection = computeProjectProjection(project);
      if (
        selectedYear !== "overall" &&
        Number(projection.year || 0) !== Number(selectedYear)
      ) {
        continue;
      }
      const projectLabel =
        projection.projectName ||
        project?.data?.name ||
        project?.id ||
        "(unknown project)";
      for (const [memberId, amount] of Object.entries(
        projection.memberPayoutByMemberId || {},
      )) {
        expectedByMember[memberId] =
          (expectedByMember[memberId] || 0) + (Number(amount) || 0);
        if (!expectedByMemberProject[memberId])
          expectedByMemberProject[memberId] = {};
        expectedByMemberProject[memberId][projectLabel] =
          (expectedByMemberProject[memberId][projectLabel] || 0) +
          (Number(amount) || 0);
      }

      // Self-funded contributions are money members need to pay back to company,
      // so they reduce expected payout in Finance by Member.
      if (project?.data?.kind === "Self-funded") {
        const selfFundingRows = Array.isArray(project?.data?.selfFunding)
          ? project.data.selfFunding
          : [];
        for (const funding of selfFundingRows) {
          const memberId = String(funding?.memberId || "").trim();
          if (!memberId) continue;
          const amount = Number(funding?.amount) || 0;
          if (amount <= 0) continue;

          expectedByMember[memberId] =
            (expectedByMember[memberId] || 0) - amount;
          if (!expectedByMemberProject[memberId])
            expectedByMemberProject[memberId] = {};
          const paybackLabel = `${projectLabel} · Self-funding payback`;
          expectedByMemberProject[memberId][paybackLabel] =
            (expectedByMemberProject[memberId][paybackLabel] || 0) - amount;
        }
      }
    }

    const paidByMember = {};
    const paidByMemberProject = {};
    const txs = extractFinanceTransactions(rawSheetValues).filter((tx) =>
      transactionMatchesYear(tx, selectedYear),
    );
    for (const tx of txs) {
      if (DASHBOARD_CAPITAL_PATTERN.test(tx.rawCategory)) continue;
      if ((Number(tx.expense) || 0) <= 0) continue;

      const byPayee = resolveMemberIdFromText(tx.payee, memberIdByAlias);
      const byDescription =
        attributeMember(tx.description, memberIdByAlias)?.memberId || "";
      const memberId = byPayee || byDescription;
      if (!memberId) continue;

      paidByMember[memberId] =
        (paidByMember[memberId] || 0) + (Number(tx.expense) || 0);

      const projectLabel =
        String(tx.projectName || "(unknown project)").trim() ||
        "(unknown project)";
      if (!paidByMemberProject[memberId]) paidByMemberProject[memberId] = {};
      paidByMemberProject[memberId][projectLabel] =
        (paidByMemberProject[memberId][projectLabel] || 0) +
        (Number(tx.expense) || 0);
    }

    const memberIds = new Set([
      ...Object.keys(expectedByMember),
      ...Object.keys(paidByMember),
      ...Object.keys(reimbursementsByMember),
    ]);

    return [...memberIds]
      .map((memberId) => {
        const expectedProjects = expectedByMemberProject[memberId] || {};
        const paidProjects = paidByMemberProject[memberId] || {};
        const projectNames = new Set([
          ...Object.keys(expectedProjects),
          ...Object.keys(paidProjects),
        ]);
        const projectBreakdown = [...projectNames]
          .map((projectName) => {
            const rawExpected = Number(expectedProjects[projectName] || 0);
            const projectPaid = Number(paidProjects[projectName] || 0);
            const projectExpected = isExpectedActualAlwaysMatchProject(
              projectName,
            )
              ? projectPaid
              : rawExpected;
            const projectGap = projectPaid - projectExpected;
            let projectStatus = "Match";
            if (projectGap > 0) projectStatus = "Overpaid";
            if (projectGap < 0) projectStatus = "Underpaid";
            return {
              projectName,
              expected: projectExpected,
              hasPaid: projectPaid,
              gap: projectGap,
              status: projectStatus,
            };
          })
          .filter(
            (row) =>
              Math.abs(Number(row.expected) || 0) > 0 ||
              Math.abs(Number(row.hasPaid) || 0) > 0,
          )
          .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

        const expected = projectBreakdown.reduce(
          (sum, item) => sum + (Number(item.expected) || 0),
          0,
        );
        const hasPaid = projectBreakdown.reduce(
          (sum, item) => sum + (Number(item.hasPaid) || 0),
          0,
        );
        const gap = hasPaid - expected;

        let status = "Match";
        if (gap > 0) status = "Overpaid";
        if (gap < 0) status = "Underpaid";
        return {
          memberId,
          memberName: membersById[memberId]?.data?.name || memberId,
          expected,
          hasPaid,
          gap,
          status,
          projectBreakdown,
        };
      })
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }, [
    projects,
    rawSheetValues,
    memberIdByAlias,
    membersById,
    selectedYear,
    reimbursementsByMember,
  ]);

  const payoutMismatchChartRows = useMemo(() => {
    let underpaid = 0;
    let overpaid = 0;
    let matched = 0;

    for (const row of memberPayoutReconciliationRows) {
      const gap = Number(row.gap) || 0;
      if (gap < 0) underpaid += Math.abs(gap);
      else if (gap > 0) overpaid += gap;
      else matched += Number(row.hasPaid) || 0;
    }

    const out = [];
    if (underpaid > 0) out.push({ label: "Underpaid", amount: underpaid });
    if (overpaid > 0) out.push({ label: "Overpaid", amount: overpaid });
    if (matched > 0) out.push({ label: "Matched", amount: matched });
    return out;
  }, [memberPayoutReconciliationRows]);

  const allProjectsReceivableDisplay = useMemo(() => {
    const fromExpected = projectCategoryViewRows.reduce(
      (sum, row) => sum + (Number(row.expectedOutstandingTwd) || 0),
      0,
    );
    const fromLedger = Number(allProjectsPanel?.receivableMissing || 0);
    return Math.max(fromExpected, fromLedger);
  }, [projectCategoryViewRows, allProjectsPanel]);

  const allProjectsPayableDisplay = useMemo(() => {
    const fromRows = projectCategoryViewRows.reduce(
      (sum, row) => sum + (Number(row.payableDisplayTwd) || 0),
      0,
    );
    const fromLedger = Number(allProjectsPanel?.payableExpected || 0);
    return Math.max(fromRows, fromLedger);
  }, [projectCategoryViewRows, allProjectsPanel]);

  const allProjectsExpectedPayeeRows = useMemo(() => {
    const byLabel = {};
    const seenProjectIds = new Set();

    for (const row of projectOnlyRows) {
      const project = row?.matchedProject;
      const projectId = project?.id;
      if (!project || !projectId || seenProjectIds.has(projectId)) continue;
      seenProjectIds.add(projectId);
      const expectedRows = expectedPayeeRowsFromProject(project, membersById);
      for (const item of expectedRows) {
        byLabel[item.label] =
          (byLabel[item.label] || 0) + (Number(item.amount) || 0);
      }
    }

    return Object.entries(byLabel)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [projectOnlyRows, membersById]);

  const companyCommonPoolCapital = useMemo(
    () =>
      nonProjectRows.reduce((sum, row) => {
        if (!isCapitalCategory(row.category)) return sum;
        const income = Math.max(0, Number(row.income) || 0);
        const expense = Math.max(0, Number(row.expense) || 0);
        const net = Math.abs(Number(row.net) || 0);
        const amount = net > 0 ? net : Math.max(income, expense);
        return sum + amount;
      }, 0),
    [nonProjectRows],
  );

  const companyCommonPoolNetAll = useMemo(() => {
    const allNet = Number(allProjectsPanel?.net || 0);
    const capitalNetInNonProject = nonProjectRows.reduce((sum, row) => {
      if (!isCapitalCategory(row.category)) return sum;
      return sum + (Number(row.net) || 0);
    }, 0);
    return allNet - capitalNetInNonProject;
  }, [allProjectsPanel, nonProjectRows]);

  const companyCommonPoolRows = useMemo(() => {
    const rows = [];
    if (companyCommonPoolCapital > 0) {
      rows.push({
        key: "capital",
        label: "Capital",
        amount: companyCommonPoolCapital,
        displayAmount: companyCommonPoolCapital,
      });
    }
    if (Math.abs(companyCommonPoolNetAll) > 0) {
      rows.push({
        key: "all-net",
        label: "All net (ex-capital)",
        amount: Math.abs(companyCommonPoolNetAll),
        displayAmount: companyCommonPoolNetAll,
      });
    }
    return rows;
  }, [companyCommonPoolCapital, companyCommonPoolNetAll]);

  const companyCommonPoolTotal = useMemo(
    () =>
      (Number(companyCommonPoolCapital) || 0) +
      (Number(companyCommonPoolNetAll) || 0),
    [companyCommonPoolCapital, companyCommonPoolNetAll],
  );

  const companyCommonPoolNetItemizedRows = useMemo(() => {
    const projectItems = projectOnlyRows
      .filter((row) => !row.noTransactionsYet)
      .map((row) => ({
        key: `project-${row.category}`,
        label: `Project · ${row.category}`,
        amount: Number(row.net) || 0,
      }));

    const nonProjectItems = nonProjectRows
      .filter((row) => !isCapitalCategory(row.category))
      .map((row) => ({
        key: `non-project-${row.category}`,
        label: `Non-project · ${row.category}`,
        amount: Number(row.net) || 0,
      }));

    return [...projectItems, ...nonProjectItems].sort(
      (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    );
  }, [projectOnlyRows, nonProjectRows]);

  const netContributionSourceRows = useMemo(() => {
    const projectSources = projectOnlyRows
      .filter((row) => !row.noTransactionsYet)
      .map((row) => ({
        label: `Project · ${row.category}`,
        amount: Math.max(0, Number(row.net) || 0),
      }))
      .filter((row) => row.amount > 0);

    const nonProjectSources = nonProjectRows
      .filter((row) => !isCapitalCategory(row.category))
      .map((row) => ({
        label: `Non-project · ${row.category}`,
        amount: Math.max(0, Number(row.net) || 0),
      }))
      .filter((row) => row.amount > 0);

    return [...projectSources, ...nonProjectSources]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [projectOnlyRows, nonProjectRows]);

  const commonPoolExpectedByProjectRows = useMemo(() => {
    const seenProjectIds = new Set();
    const projectedByLabel = {};
    const existingPositiveByLabel = {};

    for (const row of projectOnlyRows) {
      if (row.noTransactionsYet) continue;
      const label = String(row.category || "").trim();
      if (!label) continue;
      const existingPositive = Math.max(0, Number(row.net) || 0);
      if (existingPositive <= 0) continue;
      existingPositiveByLabel[label] =
        (existingPositiveByLabel[label] || 0) + existingPositive;
    }

    for (const row of projectOnlyRows) {
      const project = row?.matchedProject;
      const projectId = project?.id;
      if (!project || !projectId || seenProjectIds.has(projectId)) continue;
      seenProjectIds.add(projectId);

      const projection = computeProjectProjection(project);
      if (
        selectedYear !== "overall" &&
        Number(projection.year || 0) !== Number(selectedYear)
      ) {
        continue;
      }
      const amount = Number(projection.projectedCommonPoolTWD) || 0;
      if (amount <= 0) continue;

      const label = projection.projectName || project?.data?.name || projectId;
      projectedByLabel[label] = (projectedByLabel[label] || 0) + amount;
    }

    return Object.entries(projectedByLabel)
      .map(([label, projected]) => {
        const existing = Number(existingPositiveByLabel[label] || 0);
        // Expected should represent projects that have not yet contributed net-positive cash.
        // If a project already contributes positively in current data, do not add extra expected amount.
        const additionalExpected =
          existing > 0 ? 0 : Math.max(0, Number(projected || 0));
        return { label, amount: additionalExpected };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [projectOnlyRows, selectedYear]);

  const companyCommonPoolExpectedNetAll = useMemo(
    () =>
      (Number(companyCommonPoolNetAll) || 0) +
      commonPoolExpectedByProjectRows.reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0,
      ),
    [companyCommonPoolNetAll, commonPoolExpectedByProjectRows],
  );

  const companyCommonPoolExpectedRows = useMemo(() => {
    const rows = [];
    if (companyCommonPoolCapital > 0) {
      rows.push({
        key: "capital",
        label: "Capital",
        amount: companyCommonPoolCapital,
        displayAmount: companyCommonPoolCapital,
      });
    }
    if (Math.abs(companyCommonPoolExpectedNetAll) > 0) {
      rows.push({
        key: "all-net",
        label: "All net (ex-capital)",
        amount: Math.abs(companyCommonPoolExpectedNetAll),
        displayAmount: companyCommonPoolExpectedNetAll,
      });
    }
    return rows;
  }, [companyCommonPoolCapital, companyCommonPoolExpectedNetAll]);

  const companyCommonPoolExpectedTotal = useMemo(
    () =>
      (Number(companyCommonPoolCapital) || 0) +
      (Number(companyCommonPoolExpectedNetAll) || 0),
    [companyCommonPoolCapital, companyCommonPoolExpectedNetAll],
  );

  const companyCommonPoolExpectedNetItemizedRows = useMemo(() => {
    const amountByLabel = {};
    const keyByLabel = {};

    for (const row of companyCommonPoolNetItemizedRows) {
      const label = String(row?.label || "").trim();
      if (!label) continue;
      amountByLabel[label] =
        (amountByLabel[label] || 0) + (Number(row.amount) || 0);
      if (!keyByLabel[label]) keyByLabel[label] = row.key || `merged-${label}`;
    }

    for (const row of commonPoolExpectedByProjectRows) {
      const label = `Project · ${row.label}`;
      amountByLabel[label] =
        (amountByLabel[label] || 0) + (Number(row.amount) || 0);
      if (!keyByLabel[label])
        keyByLabel[label] = `expected-project-${row.label}`;
    }

    return Object.entries(amountByLabel)
      .map(([label, amount]) => ({
        key: keyByLabel[label] || `merged-${label}`,
        label,
        amount,
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [companyCommonPoolNetItemizedRows, commonPoolExpectedByProjectRows]);

  const allProjectsPayeeRowsForChart = useMemo(
    () =>
      upsertCompanyPoolRow(
        allProjectsPanel?.payeeBreakdown || [],
        companyCommonPoolNetAll,
      ),
    [allProjectsPanel, companyCommonPoolNetAll],
  );

  function handleMatchCategoryProject(categoryName, projectId) {
    setCategoryProjectMap((prev) => {
      const next = { ...(prev || {}) };
      if (!projectId) {
        next[categoryName] = "";
      } else {
        next[categoryName] = projectId;
      }
      return next;
    });
  }

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
          title="Finance By Project Or Person"
          titleTag="h3"
          actions={
            <div className="finance-actions">
              <Button
                variant="ghost"
                onClick={() =>
                  window.open(
                    FINANCE_SPREADSHEET_URL,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                Open spreadsheet
              </Button>
              <Button
                variant="ghost"
                onClick={loadActualRows}
                disabled={loadingActual}
              >
                {loadingActual ? "Refreshing..." : "Refresh from sheet"}
              </Button>
            </div>
          }
        >
          {projectCategoryViewRows.length === 0 ? (
            <EmptyState>
              No categorized transactions found yet. Refresh the sheet to load
              rows.
            </EmptyState>
          ) : (
            <>
              <div
                className="finance-category-tabs"
                role="tablist"
                aria-label="Finance main view tabs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={financeMainView === "project"}
                  className={`finance-category-tab ${financeMainView === "project" ? "is-active" : ""}`}
                  onClick={() => setFinanceMainView("project")}
                >
                  <IconFolder size={14} />
                  <span>By project</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={financeMainView === "person"}
                  className={`finance-category-tab ${financeMainView === "person" ? "is-active" : ""}`}
                  onClick={() => setFinanceMainView("person")}
                >
                  <IconUsers size={14} />
                  <span>By person</span>
                </button>
              </div>

              {financeMainView === "project" ? (
                <>
                  <div className="finance-controls-inline">
                    <label
                      className="finance-field-label"
                      htmlFor="finance-year-filter"
                    >
                      Year
                    </label>
                    <SelectField
                      id="finance-year-filter"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="overall">All years</option>
                      {allYears.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <p className="finance-section-note">
                    Unmatched categories: {unmatchedProjectCategoryRows.length}{" "}
                    / {matchRequiredCount}
                  </p>

                  <div className="finance-project-list">
                    {allProjectsPanel ? (
                      <details className="project-row finance-project-row" open>
                        <summary className="project-row-summary finance-project-summary">
                          <div className="project-row-main">
                            <span className="project-row-name">
                              ALL projects combined
                            </span>
                            <div className="project-row-badges">
                              <span className="project-row-kind">
                                Finance rollup
                              </span>
                            </div>
                          </div>
                          <div className="project-row-budget-cell">
                            <span className="project-row-budget-twd">
                              {formatTWD(allProjectsPanel.net)}
                            </span>
                            <span className="project-row-budget-orig">net</span>
                          </div>
                          <div className="project-row-hours-cell">
                            <span className="project-row-hours-assigned">
                              {formatTWD(allProjectsReceivableDisplay)}
                            </span>
                            <span className="project-row-hours-max">應收</span>
                          </div>
                          <div className="project-row-wage">
                            {formatTWD(allProjectsPayableDisplay)}
                            <span className="project-row-wage-unit"> 應付</span>
                          </div>
                          <div className="project-row-actions">
                            <span className="project-row-chevron">▾</span>
                          </div>
                        </summary>
                        <div className="project-detail finance-project-detail">
                          <div className="finance-project-charts">
                            <div className="finance-project-chart-block">
                              <h5 className="finance-split-title">
                                Company cost (non-project expenses)
                              </h5>
                              <PercentageRows
                                rows={allProjectsCompanyCostRows}
                              />
                              <h5 className="finance-split-title finance-split-title--spaced">
                                Net income contribution sources
                              </h5>
                              <PercentageRows
                                rows={netContributionSourceRows}
                              />
                            </div>
                            <div className="finance-project-chart-block">
                              <h5 className="finance-split-title">
                                Common pool (Expected vs Actual)
                              </h5>
                              <h5 className="finance-split-title">Expected</h5>
                              <CommonPoolRingRows
                                rows={companyCommonPoolExpectedRows}
                                itemizedRows={
                                  companyCommonPoolExpectedNetItemizedRows
                                }
                                itemizedKey="all-net"
                                totalOverride={companyCommonPoolExpectedTotal}
                              />
                              <h5 className="finance-split-title finance-split-title--spaced">
                                Actual (transaction history)
                              </h5>
                              <CommonPoolRingRows
                                rows={companyCommonPoolRows}
                                itemizedRows={companyCommonPoolNetItemizedRows}
                                itemizedKey="all-net"
                                totalOverride={companyCommonPoolTotal}
                              />
                            </div>
                            <div className="finance-project-chart-block">
                              <h5 className="finance-split-title">
                                Who is getting paid (Expected vs Actual)
                              </h5>
                              <div className="finance-split-cols">
                                <div className="finance-split-col">
                                  <h5 className="finance-split-title">
                                    Expected
                                  </h5>
                                  <PercentageRows
                                    rows={allProjectsExpectedPayeeRows}
                                  />
                                </div>
                                <div className="finance-split-col">
                                  <h5 className="finance-split-title">
                                    Actual (transaction history)
                                  </h5>
                                  <PercentageRows
                                    rows={allProjectsPayeeRowsForChart}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="finance-table-wrap">
                            <table className="finance-table">
                              <thead>
                                <tr>
                                  <th>日期</th>
                                  <th>敘述</th>
                                  <th>金額</th>
                                  <th>收款人</th>
                                  <th>流水號</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(allProjectsPanel.transactions || [])
                                  .length === 0 ? (
                                  <tr>
                                    <td colSpan={5}>No transactions.</td>
                                  </tr>
                                ) : (
                                  [...(allProjectsPanel.transactions || [])]
                                    .slice(-10)
                                    .reverse()
                                    .map((tx, idx) => (
                                      <tr
                                        key={`all-project-tx-${tx.serialNumber || "na"}-${idx}`}
                                      >
                                        <td>{tx.date || "—"}</td>
                                        <td>{tx.description || "—"}</td>
                                        <td
                                          className={
                                            Number(tx.amount) >= 0
                                              ? "finance-plus"
                                              : "finance-minus"
                                          }
                                        >
                                          {formatTWD(tx.amount)}
                                        </td>
                                        <td>{tx.payee || "—"}</td>
                                        <td>{tx.serialNumber || "—"}</td>
                                      </tr>
                                    ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>

                  <div
                    className="finance-category-tabs"
                    role="tablist"
                    aria-label="Finance category tabs"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={financeCategoryTab === "projects"}
                      className={`finance-category-tab ${financeCategoryTab === "projects" ? "is-active" : ""}`}
                      onClick={() => setFinanceCategoryTab("projects")}
                    >
                      <IconFolder size={14} />
                      <span>Projects ({projectOnlyRows.length})</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={financeCategoryTab === "non-projects"}
                      className={`finance-category-tab ${financeCategoryTab === "non-projects" ? "is-active" : ""}`}
                      onClick={() => setFinanceCategoryTab("non-projects")}
                    >
                      <IconDocument size={14} />
                      <span>Non-projects ({nonProjectRows.length})</span>
                    </button>
                  </div>

                  <div className="finance-project-list">
                    {financeCategoryTab === "projects"
                      ? projectOnlyRows.map((row) => (
                          <details
                            key={`project-category-${row.category}`}
                            className="project-row finance-project-row"
                          >
                            <summary className="project-row-summary finance-project-summary">
                              <div className="project-row-main">
                                <span className="project-row-name">
                                  {row.category}
                                </span>
                                <div className="project-row-badges">
                                  <span className="project-row-kind">
                                    {row.noTransactionsYet
                                      ? "No transactions yet"
                                      : row.needsProjectMatch
                                        ? row.isMatched
                                          ? "Matched"
                                          : "Unmatched"
                                        : "No project mapping needed"}
                                  </span>
                                </div>
                              </div>
                              <div className="project-row-budget-cell">
                                <span
                                  className={
                                    row.net >= 0
                                      ? "project-row-budget-twd finance-plus"
                                      : "project-row-budget-twd finance-minus"
                                  }
                                >
                                  {formatTWD(row.net)}
                                </span>
                                <span className="project-row-budget-orig">
                                  net
                                </span>
                              </div>
                              <div className="project-row-hours-cell">
                                <span className="project-row-hours-assigned">
                                  {formatTWD(row.receivableDisplayTwd)}
                                </span>
                                <span className="project-row-hours-max">
                                  應收
                                </span>
                              </div>
                              <div className="project-row-wage">
                                {formatTWD(row.payableDisplayTwd)}
                                <span className="project-row-wage-unit">
                                  {" "}
                                  應付
                                </span>
                              </div>
                              <div className="project-row-actions">
                                <span className="project-row-chevron">▾</span>
                              </div>
                            </summary>
                            <div className="project-detail finance-project-detail">
                              <div className="finance-project-metrics">
                                {row.needsProjectMatch ? (
                                  <div className="finance-map-editor-wrap">
                                    <span className="finance-map-editor-current">
                                      {row.matchedProject?.data?.name ||
                                        "Unmatched"}
                                    </span>
                                    {mappingEditorCategory === row.category ? (
                                      <div className="finance-map-editor-panel">
                                        <SelectField
                                          value={row.matchedProjectId || ""}
                                          onChange={(e) => {
                                            handleMatchCategoryProject(
                                              row.category,
                                              e.target.value,
                                            );
                                            setMappingEditorCategory("");
                                          }}
                                        >
                                          <option value="">Unmatched</option>
                                          {systemProjectsSorted.map(
                                            (project) => (
                                              <option
                                                key={project.id}
                                                value={project.id}
                                              >
                                                {project?.data?.name ||
                                                  project.id}
                                              </option>
                                            ),
                                          )}
                                        </SelectField>
                                        <Button
                                          variant="ghost"
                                          onClick={() =>
                                            setMappingEditorCategory("")
                                          }
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        onClick={() =>
                                          setMappingEditorCategory(row.category)
                                        }
                                      >
                                        Change mapping
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <p>No project mapping needed</p>
                                )}
                              </div>

                              <div className="finance-project-charts">
                                <div className="finance-project-chart-block">
                                  <h5 className="finance-split-title">
                                    Expected vs Actual (Income + Expense)
                                  </h5>
                                  <div className="finance-split-cols">
                                    <div className="finance-split-col">
                                      <h5 className="finance-split-title">
                                        Income
                                      </h5>
                                      <MismatchBars
                                        expected={row.expectedAmountTwd}
                                        actual={row.income}
                                      />
                                    </div>
                                    <div className="finance-split-col">
                                      <h5 className="finance-split-title">
                                        Expense
                                      </h5>
                                      <MismatchBars
                                        expected={row.expectedExpenseTwd}
                                        actual={row.actualExpectedExpenseTwd}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="finance-project-chart-block">
                                  <h5 className="finance-split-title">
                                    Spend breakdown (%)
                                  </h5>
                                  <PercentageRows rows={row.spendByCategory} />
                                </div>
                                <div className="finance-project-chart-block">
                                  <h5 className="finance-split-title">
                                    Who is getting paid (Expected vs Actual)
                                  </h5>
                                  <div className="finance-split-cols">
                                    <div className="finance-split-col">
                                      <h5 className="finance-split-title">
                                        Expected
                                      </h5>
                                      <PercentageRows
                                        rows={expectedPayeeRowsFromProject(
                                          row.matchedProject,
                                          membersById,
                                        )}
                                      />
                                    </div>
                                    <div className="finance-split-col">
                                      <h5 className="finance-split-title">
                                        Actual (transaction history)
                                      </h5>
                                      <PercentageRows
                                        rows={row.payeeBreakdown}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="finance-table-wrap">
                                <table className="finance-table">
                                  <thead>
                                    <tr>
                                      <th>日期</th>
                                      <th>敘述</th>
                                      <th>金額</th>
                                      <th>收款人</th>
                                      <th>流水號</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(row.transactions || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={5}>No transactions.</td>
                                      </tr>
                                    ) : (
                                      (row.transactions || []).map(
                                        (tx, idx) => (
                                          <tr
                                            key={`${row.category}-tx-${tx.serialNumber || "na"}-${idx}`}
                                          >
                                            <td>{tx.date || "—"}</td>
                                            <td>{tx.description || "—"}</td>
                                            <td
                                              className={
                                                Number(tx.amount) >= 0
                                                  ? "finance-plus"
                                                  : "finance-minus"
                                              }
                                            >
                                              {formatTWD(tx.amount)}
                                            </td>
                                            <td>{tx.payee || "—"}</td>
                                            <td>{tx.serialNumber || "—"}</td>
                                          </tr>
                                        ),
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        ))
                      : null}
                  </div>

                  {financeCategoryTab === "non-projects" &&
                  nonProjectRows.length > 0 ? (
                    <>
                      <p className="finance-section-note">
                        Non-project categories (included in ALL projects
                        combined): {nonProjectRows.length}
                      </p>
                      <div className="finance-project-list">
                        {nonProjectRows.map((row) => (
                          <details
                            key={`non-project-category-${row.category}`}
                            className="project-row finance-project-row"
                          >
                            <summary className="project-row-summary finance-project-summary">
                              <div className="project-row-main">
                                <span className="project-row-name">
                                  {row.category}
                                </span>
                                <div className="project-row-badges">
                                  <span className="project-row-kind">
                                    Non-project
                                  </span>
                                </div>
                              </div>
                              <div className="project-row-budget-cell">
                                <span
                                  className={
                                    row.net >= 0
                                      ? "project-row-budget-twd finance-plus"
                                      : "project-row-budget-twd finance-minus"
                                  }
                                >
                                  {formatTWD(row.net)}
                                </span>
                                <span className="project-row-budget-orig">
                                  net
                                </span>
                              </div>
                              <div className="project-row-hours-cell">
                                <span className="project-row-hours-assigned">
                                  {formatTWD(row.receivableMissing)}
                                </span>
                                <span className="project-row-hours-max">
                                  應收
                                </span>
                              </div>
                              <div className="project-row-wage">
                                {formatTWD(row.payableExpected)}
                                <span className="project-row-wage-unit">
                                  {" "}
                                  應付
                                </span>
                              </div>
                              <div className="project-row-actions">
                                <span className="project-row-chevron">▾</span>
                              </div>
                            </summary>
                            <div className="project-detail finance-project-detail">
                              <div className="finance-project-charts">
                                <div className="finance-project-chart-block">
                                  <h5 className="finance-split-title">
                                    Spend breakdown (%)
                                  </h5>
                                  <PercentageRows rows={row.spendByCategory} />
                                </div>
                                <div className="finance-project-chart-block">
                                  <h5 className="finance-split-title">
                                    Who is getting paid (收款人 %)
                                  </h5>
                                  <PercentageRows rows={row.payeeBreakdown} />
                                </div>
                              </div>

                              <div className="finance-table-wrap">
                                <table className="finance-table">
                                  <thead>
                                    <tr>
                                      <th>日期</th>
                                      <th>敘述</th>
                                      <th>金額</th>
                                      <th>收款人</th>
                                      <th>流水號</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(row.transactions || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={5}>No transactions.</td>
                                      </tr>
                                    ) : (
                                      (row.transactions || []).map(
                                        (tx, idx) => (
                                          <tr
                                            key={`${row.category}-tx-${tx.serialNumber || "na"}-${idx}`}
                                          >
                                            <td>{tx.date || "—"}</td>
                                            <td>{tx.description || "—"}</td>
                                            <td
                                              className={
                                                Number(tx.amount) >= 0
                                                  ? "finance-plus"
                                                  : "finance-minus"
                                              }
                                            >
                                              {formatTWD(tx.amount)}
                                            </td>
                                            <td>{tx.payee || "—"}</td>
                                            <td>{tx.serialNumber || "—"}</td>
                                          </tr>
                                        ),
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {financeMainView === "person" ? (
                <div className="finance-table-wrap">
                  <div className="finance-project-chart-block">
                    <h5 className="finance-split-title">Payout mismatch (%)</h5>
                    <PercentageRows rows={payoutMismatchChartRows} />
                  </div>
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Expected (system)</th>
                        <th>Has paid (actual)</th>
                        <th>Gap</th>
                        <th>Net requests</th>
                        <th>Adjusted gap</th>
                        <th>Status</th>
                        <th>Why (by project)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberPayoutReconciliationRows.length === 0 ? (
                        <tr>
                          <td colSpan={8}>No member payout data.</td>
                        </tr>
                      ) : (
                        memberPayoutReconciliationRows.map((row) => {
                          const reqSummary =
                            reimbursementsByMember[row.memberId];
                          // netTWD > 0 → company owes member; < 0 → member owes company
                          const netTWD = reqSummary?.netTWD || 0;
                          const unconverted = reqSummary?.unconverted || [];
                          const hasAnyRequest =
                            netTWD !== 0 || unconverted.length > 0;
                          // adjustedGap: subtract what company owes member (netTWD) from gap
                          const adjustedGap = row.gap - netTWD;
                          return (
                            <tr key={`member-payout-${row.memberId}`}>
                              <td>{row.memberName}</td>
                              <td>{formatTWD(row.expected)}</td>
                              <td>{formatTWD(row.hasPaid)}</td>
                              <td
                                className={
                                  row.gap >= 0
                                    ? "finance-plus"
                                    : "finance-minus"
                                }
                              >
                                {formatTWD(row.gap)}
                              </td>
                              <td
                                className={
                                  !hasAnyRequest
                                    ? ""
                                    : netTWD > 0 ||
                                        (netTWD === 0 &&
                                          unconverted.some((u) => u.amt > 0))
                                      ? "finance-minus"
                                      : "finance-plus"
                                }
                              >
                                {hasAnyRequest ? (
                                  <>
                                    {netTWD !== 0 && (
                                      <span>
                                        {netTWD > 0
                                          ? "co. owes "
                                          : "member owes "}
                                        {formatTWD(Math.abs(netTWD))}
                                      </span>
                                    )}
                                    {unconverted.map((u, i) => (
                                      <em
                                        key={i}
                                        className="finance-balance-meta"
                                        style={{ display: "block" }}
                                      >
                                        {u.amt > 0
                                          ? "co. owes "
                                          : "member owes "}
                                        {Math.abs(u.amt).toFixed(2)}{" "}
                                        {u.currency}
                                      </em>
                                    ))}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td
                                className={
                                  adjustedGap >= 0
                                    ? "finance-plus"
                                    : "finance-minus"
                                }
                              >
                                {formatTWD(adjustedGap)}
                              </td>
                              <td>{row.status}</td>
                              <td>
                                {row.projectBreakdown?.length ? (
                                  <ul className="finance-balance-list">
                                    {row.projectBreakdown.map((item) => (
                                      <li
                                        key={`${row.memberId}-${item.projectName}`}
                                        className="finance-balance-row"
                                      >
                                        <span className="finance-balance-name">
                                          {item.projectName}
                                          <em className="finance-balance-meta">
                                            {` expected ${formatTWD(item.expected)} · actual ${formatTWD(item.hasPaid)}`}
                                          </em>
                                        </span>
                                        <span
                                          className={
                                            item.gap >= 0
                                              ? "finance-plus"
                                              : "finance-minus"
                                          }
                                        >
                                          {formatTWD(item.gap)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
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
