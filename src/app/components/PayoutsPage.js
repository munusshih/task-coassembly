"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDocument,
  deleteDocument,
  subscribeCollection,
  updateDocument,
} from "../../firestore";
import { isWorkerOwner } from "../../authAccess";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON } from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import SelectField from "./ui/SelectField";
import TabPage from "./ui/TabPage";

const CURRENCY_OPTIONS = ["TWD", "USD", "JPY", "EUR"];

// type encodes both the kind and the direction
// reimbursement + payout → company owes member
// repayment → member owes company
const ENTRY_TYPES = [
  { value: "reimbursement", label: "Reimbursement", dir: "owed_to_me",  hint: "I paid out of pocket — company owes me", receiptRequired: true },
  { value: "repayment",     label: "Repayment",     dir: "owe_company", hint: "I owe the company (returning advance, etc.)", receiptRequired: false },
];

function normalizeMoneyAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100) / 100);
}

function formatMoney(amount, currency) {
  const value = Number(amount) || 0;
  const code = String(currency || "TWD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function sortMembersByName(items) {
  return [...items].sort((a, b) =>
    String(a?.data?.name || "").localeCompare(String(b?.data?.name || ""), "en"),
  );
}

function toLinkHref(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatReceiptLabel(rawUrl) {
  const href = toLinkHref(rawUrl);
  if (!href) return "";
  try {
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const value = `${host}${path}`;
    return value.length > 32 ? `${value.slice(0, 29)}...` : value;
  } catch {
    const text = String(rawUrl || "").trim();
    return text.length > 32 ? `${text.slice(0, 29)}...` : text;
  }
}

function formatDate(ts) {
  const value = Number(ts);
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(ts) {
  const value = Number(ts);
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Generates a short receipt-style ID from a Firestore doc ID
function shortId(id) {
  return String(id || "").slice(-6).toUpperCase();
}

// ─── ThermalReceipt ───────────────────────────────────────────────────────────

function ThermalReceipt({ row, isAdmin, onApprove, onReject, onMarkPaid, onDelete }) {
  const type = row?.data?.type || "reimbursement";
  const status = row?.data?.status || "submitted";
  const href = toLinkHref(row?.data?.receiptUrl || "");
  const receiptLabel = formatReceiptLabel(row?.data?.receiptUrl || "");
  const isPending = status === "submitted";
  const isApproved = status === "approved";
  const typeDef = ENTRY_TYPES.find((t) => t.value === type) || ENTRY_TYPES[0];
  const typeLabel = typeDef.label.toUpperCase();
  const dirLabel = typeDef.dir === "owed_to_me" ? "CO. → ME" : "ME → CO.";

  return (
    <li className={`thermal thermal--${status}`}>
      <div className="thermal-paper">

        {/* store name / org header */}
        <div className="thermal-org">CoAssembly</div>
        <div className="thermal-org-sub">Internal Request</div>

        <div className="thermal-rule" />

        {/* receipt metadata */}
        <div className="thermal-meta-grid">
          <span className="thermal-meta-key">DATE</span>
          <span className="thermal-meta-val">{formatDate(row?.data?.createdAt)}</span>
          <span className="thermal-meta-key">TIME</span>
          <span className="thermal-meta-val">{formatTime(row?.data?.createdAt)}</span>
          <span className="thermal-meta-key">REF#</span>
          <span className="thermal-meta-val">{shortId(row.id)}</span>
          <span className="thermal-meta-key">TYPE</span>
          <span className="thermal-meta-val">{typeLabel}</span>
          <span className="thermal-meta-key">DIR</span>
          <span className="thermal-meta-val">{dirLabel}</span>
        </div>

        <div className="thermal-rule thermal-rule--dashed" />

        {/* item description */}
        <div className="thermal-item-label">DESCRIPTION</div>
        <div className="thermal-item-desc">{row?.data?.title || "Untitled"}</div>

        {row?.data?.notes ? (
          <div className="thermal-item-notes">{row.data.notes}</div>
        ) : null}

        <div className="thermal-rule thermal-rule--dashed" />

        {/* total */}
        <div className="thermal-total-row">
          <span className="thermal-total-label">TOTAL</span>
          <span className="thermal-total-amount">{formatMoney(row?.data?.amount, row?.data?.currency)}</span>
        </div>

        {/* receipt link */}
        {href ? (
          <>
            <div className="thermal-rule thermal-rule--dashed" />
            <div className="thermal-ref-row">
              <span className="thermal-ref-label">RECEIPT REF</span>
              <a className="thermal-ref-link" href={href} target="_blank" rel="noreferrer">
                {receiptLabel}
              </a>
            </div>
          </>
        ) : null}

        <div className="thermal-rule" />

        {/* status stamp + actions */}
        <div className="thermal-footer">
          <span className={`thermal-stamp thermal-stamp--${status}`}>
            {status === "submitted" ? "PENDING" :
             status === "approved" ? "APPROVED" :
             status === "paid" ? "PAID" : "VOID"}
          </span>

          <div className="thermal-actions">
            {isAdmin && isPending && (
              <>
                <button type="button" className="thermal-btn" onClick={() => onApprove(row)}>
                  Approve
                </button>
                <button type="button" className="thermal-btn thermal-btn--danger" onClick={() => onReject(row)}>
                  Reject
                </button>
              </>
            )}
            {isAdmin && isApproved && (
              <button type="button" className="thermal-btn" onClick={() => onMarkPaid(row)}>
                Mark paid
              </button>
            )}
            {isAdmin && (
              <IconButton type="button" variant="delete" title="Delete" onClick={() => onDelete(row)}>
                {DELETE_ICON}
              </IconButton>
            )}
          </div>
        </div>

        {/* barcode decoration */}
        <div className="thermal-barcode" aria-hidden="true">
          <div className="thermal-barcode-lines" />
          <div className="thermal-barcode-num">{shortId(row.id)}</div>
        </div>

      </div>

      {/* torn bottom */}
      <div className="thermal-tear" aria-hidden="true" />
    </li>
  );
}

// ─── MemberRequestCard ────────────────────────────────────────────────────────

function MemberRequestCard({
  member,
  requests,
  isOwn,
  isAdmin,
  onSubmit,
  onApprove,
  onReject,
  onMarkPaid,
  onDelete,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [entryType, setEntryType] = useState("reimbursement");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TWD");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...requests].sort((a, b) => Number(b?.data?.createdAt || 0) - Number(a?.data?.createdAt || 0)),
    [requests],
  );

  const pendingCount = requests.filter((r) => r?.data?.status === "submitted").length;
  const currentTypeDef = ENTRY_TYPES.find((t) => t.value === entryType) || ENTRY_TYPES[0];
  const receiptRequired = currentTypeDef.receiptRequired;
  const canSubmit =
    Boolean(title.trim()) &&
    normalizeMoneyAmount(amount) > 0 &&
    (!receiptRequired || Boolean(receiptUrl.trim()));

  async function handleAdd() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const typeDef = ENTRY_TYPES.find((t) => t.value === entryType) || ENTRY_TYPES[0];
      await onSubmit(member.id, {
        type: entryType,
        direction: typeDef.dir,
        title: title.trim(),
        amount: normalizeMoneyAmount(amount),
        currency,
        receiptUrl: receiptUrl.trim(),
        notes: notes.trim(),
      });
      setTitle("");
      setAmount("");
      setReceiptUrl("");
      setNotes("");
      setAddOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityCard as="article" className="member-card">
      <div className="member-card-header">
        <div className="member-card-head-main">
          <h3 className="card-name">{member?.data?.name || "Unknown"}</h3>
          <div className="member-card-meta">
            <span className="member-card-meta-chip">
              {requests.length} request{requests.length !== 1 ? "s" : ""}
            </span>
            {pendingCount > 0 && (
              <span className="member-card-meta-chip member-card-meta-chip--pending">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="req-receipts-area">
        {sorted.length === 0 && !addOpen && (
          <p className="todo-empty" style={{ padding: "8px 12px" }}>No requests yet.</p>
        )}
        <ul className="req-receipt-list">
          {sorted.map((row) => (
            <ThermalReceipt
              key={row.id}
              row={row}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onReject={onReject}
              onMarkPaid={onMarkPaid}
              onDelete={onDelete}
            />
          ))}
        </ul>

        {(isOwn || isAdmin) && (
          addOpen ? (
            <div className="req-add-form">
              <div className="req-add-row">
                <SelectField
                  className="meta-select"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                >
                  {ENTRY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </SelectField>
                <span className="req-type-hint">
                  {ENTRY_TYPES.find((t) => t.value === entryType)?.hint}
                </span>
              </div>
              <div className="req-add-row">
                <input
                  className="notepad-add-input"
                  style={{ flex: 1 }}
                  value={title}
                  autoFocus
                  placeholder="Description / reason…"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setAddOpen(false); }}
                />
              </div>
              <div className="req-add-row">
                <SelectField
                  className="meta-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </SelectField>
                <input
                  className="notepad-add-input req-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  placeholder="0.00"
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="req-add-row">
                <input
                  className="notepad-add-input req-receipt-input"
                  value={receiptUrl}
                  placeholder={receiptRequired ? "Receipt URL (required)" : "Receipt URL (optional)"}
                  required={receiptRequired}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                />
              </div>
              <textarea
                className="req-notes-input"
                value={notes}
                placeholder="Notes (optional)"
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="notepad-add-actions req-add-actions">
                <Button type="button" size="small" onClick={handleAdd} disabled={!canSubmit || submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
                <Button type="button" variant="ghost" size="small" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button className="notepad-add-trigger" onClick={() => setAddOpen(true)}>
              <span className="notepad-add-plus">+</span>
              <span className="notepad-add-placeholder">New request…</span>
            </button>
          )
        )}
      </div>
    </EntityCard>
  );
}

// ─── PayoutsPage ──────────────────────────────────────────────────────────────

export default function PayoutsPage({
  viewerMemberId = "",
  viewerRole = "associate",
  sharedMembers = [],
}) {
  const [rows, setRows] = useState([]);

  const isAdmin = useMemo(() => isWorkerOwner({ role: viewerRole }), [viewerRole]);

  const activeMembers = useMemo(
    () => sortMembersByName((sharedMembers || []).filter((m) => m?.data?.active !== false)),
    [sharedMembers],
  );

  useEffect(() => {
    const unsub = subscribeCollection("reimbursements", setRows);
    return () => unsub();
  }, []);

  const requestsByMember = useMemo(() => {
    const map = {};
    for (const row of rows) {
      const mid = row?.data?.memberId;
      if (!mid) continue;
      if (!map[mid]) map[mid] = [];
      map[mid].push(row);
    }
    return map;
  }, [rows]);

  const totalPending = rows.filter((r) => r?.data?.status === "submitted").length;

  async function handleSubmit(memberId, data) {
    const now = Date.now();
    const memberName = activeMembers.find((m) => m.id === memberId)?.data?.name || "";
    await createDocument("reimbursements", {
      memberId,
      memberName,
      ...data,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
      submittedBy: viewerMemberId || null,
    });
  }

  async function handleApprove(row) {
    await updateDocument("reimbursements", row.id, { status: "approved", updatedAt: Date.now() });
  }

  async function handleReject(row) {
    await updateDocument("reimbursements", row.id, { status: "rejected", updatedAt: Date.now() });
  }

  async function handleMarkPaid(row) {
    await updateDocument("reimbursements", row.id, { status: "paid", updatedAt: Date.now() });
  }

  async function handleDelete(row) {
    await deleteDocument("reimbursements", row.id);
  }

  const visibleMembers = isAdmin
    ? activeMembers
    : activeMembers.filter((m) => m.id === viewerMemberId);

  return (
    <TabPage
      title="Requests"
      subtitle={`Reimbursements & payouts · ${totalPending} pending`}
      badge={`${rows.length} total`}
    >
      {visibleMembers.length === 0 ? (
        <EmptyState title="No members" text="No active members found." />
      ) : (
        <CollectionLayout variant="grid" className="members-grid">
          {visibleMembers.map((member) => (
            <MemberRequestCard
              key={member.id}
              member={member}
              requests={requestsByMember[member.id] || []}
              isOwn={member.id === viewerMemberId}
              isAdmin={isAdmin}
              onSubmit={handleSubmit}
              onApprove={handleApprove}
              onReject={handleReject}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
            />
          ))}
        </CollectionLayout>
      )}
    </TabPage>
  );
}
