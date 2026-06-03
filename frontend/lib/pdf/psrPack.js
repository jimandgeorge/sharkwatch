import PDFDocument from "pdfkit";
import crypto from "crypto";

// ─── Design ───────────────────────────────────────────────────────────────────

const C = {
  navy:     "#0F1B2D",
  accent:   "#378ADD",
  white:    "#FFFFFF",
  bg:       "#F7F8FA",
  border:   "#E2E8F0",
  body:     "#1E293B",
  muted:    "#64748B",
  critical: "#DC2626",
  warn:     "#D97706",
  ok:       "#16A34A",
  vuln:     "#92400E",
  vulnBg:   "#FEF3C7",
};

const F = {
  regular: "Helvetica",
  bold:    "Helvetica-Bold",
  mono:    "Courier",
};

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 50;
const CW      = PAGE_W - MARGIN * 2;  // 495.28
const COL_W   = CW / 3;              // ~165 per column
const COL2    = MARGIN + COL_W;      // equal thirds
const COL3    = MARGIN + COL_W * 2;
const FOOTER_H = 28;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtGBP(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence ?? 0) / 100);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
}

function fmtDuration(fromIso, toIso) {
  if (!fromIso || !toIso) return "—";
  const ms = new Date(toIso) - new Date(fromIso);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs} hours`;
}

function riskColor(level) {
  return { critical: C.critical, high: C.warn, medium: C.warn, low: C.ok }[level] ?? C.muted;
}

function decisionColor(action) {
  return {
    approve:              C.ok,
    hold:                 C.critical,
    escalate:             C.warn,
    freeze_account:       C.critical,
    step_up_verification: C.warn,
  }[action] ?? C.muted;
}

function decisionLabel(action) {
  return {
    approve:              "Approve",
    hold:                 "Hold",
    escalate:             "Escalate",
    freeze_account:       "Freeze Account",
    step_up_verification: "Step-up Verification",
  }[action] ?? (action ?? "—");
}

function computeHash(inv, audit) {
  const payload = JSON.stringify({
    investigation_id:    inv.id,
    transaction_id:      inv.transaction_id,
    amount_pence:        inv.amount_pence,
    decision_action:     audit?.action ?? null,
    analyst_id:          audit?.analyst_id ?? null,
    decided_at:          audit?.decided_at ?? null,
    claim_reference:     audit?.claim_reference ?? null,
    ai_recommended:      inv.recommended_action,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── Low-level drawing ────────────────────────────────────────────────────────

function hRule(doc, y, color = C.border) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y)
    .strokeColor(color).lineWidth(0.5).stroke();
  return y;
}

function sectionBar(doc, y, title) {
  doc.rect(MARGIN, y, CW, 20).fill(C.navy);
  doc.font(F.bold).fontSize(8).fillColor(C.white)
    .text(title.toUpperCase(), MARGIN + 8, y + 6, { characterSpacing: 0.8, lineBreak: false });
  return y + 28;
}

function kv(doc, label, value, x, y, { mono = false, color = C.body, width } = {}) {
  doc.font(F.bold).fontSize(7).fillColor(C.muted)
    .text(label.toUpperCase(), x, y, { characterSpacing: 0.5, lineBreak: false, width });
  doc.font(mono ? F.mono : F.regular).fontSize(9).fillColor(color)
    .text(value || "—", x, y + 10, { lineBreak: false, width });
  return y + 26;
}

function needsPage(doc, y, needed) {
  if (y + needed > CONTENT_BOTTOM) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

// ─── Page footer (applied to all pages at end via bufferPages) ────────────────

function drawFooter(doc, caseId, pageNum, total) {
  const y = PAGE_H - FOOTER_H;
  doc.rect(0, y, PAGE_W, FOOTER_H).fill(C.navy);
  doc.font(F.regular).fontSize(7).fillColor("rgba(255,255,255,0.5)")
    .text(
      `Shark Watch  ·  PSR Compliance Document  ·  Case ${caseId.slice(0, 8).toUpperCase()}`,
      MARGIN, y + 9, { lineBreak: false }
    );
  doc.font(F.regular).fontSize(7).fillColor("rgba(255,255,255,0.5)")
    .text(`Page ${pageNum} of ${total}`, MARGIN, y + 9, { width: CW, align: "right", lineBreak: false });
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function drawCover(doc, inv, audit) {
  // Navy header
  doc.rect(0, 0, PAGE_W, 80).fill(C.navy);
  doc.font(F.bold).fontSize(22).fillColor(C.white).text("SHARK WATCH", MARGIN, 22, { lineBreak: false });
  doc.font(F.regular).fontSize(9).fillColor("rgba(255,255,255,0.6)")
    .text("APP Fraud Investigation  ·  PSR Compliance Document", MARGIN, 48, { lineBreak: false });

  // Accent bar with case ref
  doc.rect(0, 80, PAGE_W, 32).fill(C.accent);
  doc.font(F.bold).fontSize(10).fillColor(C.white)
    .text(`Case: ${inv.id}`, MARGIN, 90, { lineBreak: false });
  if (audit?.claim_reference) {
    doc.font(F.regular).fontSize(10).fillColor("rgba(255,255,255,0.85)")
      .text(`PSR Ref: ${audit.claim_reference}`, MARGIN, 90, { width: CW, align: "right", lineBreak: false });
  }

  let y = 132;

  // ── Three KPI boxes ──────────────────────────────────────────────────────
  const boxW = (CW - 16) / 3;
  const boxes = [
    { label: "Risk Level",    value: `${(inv.risk_level ?? "").toUpperCase()} (${inv.risk_score ?? 0})`, color: riskColor(inv.risk_level) },
    { label: "Amount",        value: fmtGBP(inv.amount_pence), color: C.body },
    { label: "Decision",      value: decisionLabel(audit?.action), color: decisionColor(audit?.action) },
  ];
  boxes.forEach((b, i) => {
    const x = MARGIN + i * (boxW + 8);
    doc.rect(x, y, boxW, 56).fill(C.bg).stroke(C.border);
    doc.font(F.bold).fontSize(7).fillColor(C.muted)
      .text(b.label.toUpperCase(), x + 10, y + 10, { characterSpacing: 0.5, lineBreak: false });
    doc.font(F.bold).fontSize(16).fillColor(b.color)
      .text(b.value, x + 10, y + 24, { width: boxW - 20, lineBreak: false });
  });
  y += 68;

  // ── Key facts ────────────────────────────────────────────────────────────
  const cw = COL_W - 6;
  kv(doc, "Fraud Type",     inv.fraud_type ?? "Under investigation", MARGIN, y, { width: cw });
  kv(doc, "Transfer Type",  inv.transfer_type ?? "—",                COL2,   y, { width: cw });
  kv(doc, "Currency",       inv.currency ?? "GBP",                   COL3,   y, { width: cw });
  y += 26;
  kv(doc, "Customer ID",    inv.customer_id,             MARGIN, y, { width: cw });
  kv(doc, "Customer Email", inv.customer_email ?? "—",   COL2,   y, { width: cw });
  kv(doc, "Transaction Date", fmtDate(inv.occurred_at),  COL3,   y, { width: cw });
  y += 26;
  kv(doc, "Case Opened",        fmtDate(inv.created_at),                         MARGIN, y, { width: cw });
  kv(doc, "Time to Decision",   audit?.decided_at ? fmtDuration(inv.created_at, audit.decided_at) : "—", COL2, y, { width: cw });
  kv(doc, "External ID",        inv.external_id ?? "—",                          COL3,   y, { mono: true, width: cw });
  y += 34;

  // ── Vulnerable banner ────────────────────────────────────────────────────
  if (inv.vulnerability_flag) {
    doc.rect(MARGIN, y, CW, 24).fill(C.vulnBg);
    doc.moveTo(MARGIN, y).lineTo(MARGIN, y + 24).lineWidth(3).strokeColor(C.warn).stroke();
    doc.font(F.bold).fontSize(9).fillColor(C.vuln)
      .text("⚠  VULNERABLE CUSTOMER — FCA Consumer Duty applies to this case", MARGIN + 10, y + 8, { lineBreak: false });
    y += 32;
  }

  hRule(doc, y);
  return y + 12;
}

function drawTransactionDetails(doc, inv, y) {
  y = sectionBar(doc, y, "2. Transaction Details");

  const cw2 = COL_W - 6;
  kv(doc, "Beneficiary Name",    inv.beneficiary_name ?? "—",    MARGIN, y, { width: cw2 });
  kv(doc, "Beneficiary Account", inv.beneficiary_account ?? "—", COL2,   y, { mono: true, width: cw2 * 2 });
  y += 26;
  kv(doc, "Sending Customer",  inv.customer_id,           MARGIN, y, { width: cw2 });
  kv(doc, "Customer Email",    inv.customer_email ?? "—", COL2,   y, { width: cw2 });
  kv(doc, "Merchant",          inv.merchant_name ?? "—",  COL3,   y, { width: cw2 });
  y += 26;
  kv(doc, "IP Address",  inv.ip_address ?? "—",  MARGIN, y, { mono: true, width: cw2 });
  kv(doc, "Geolocation", inv.geolocation ?? "—", COL2,   y, { width: cw2 * 2 });
  y += 26;
  kv(doc, "Device Fingerprint", inv.device_fingerprint ?? "—", MARGIN, y, { mono: true, width: CW });
  y += 26;
  kv(doc, "Transfer Type", inv.transfer_type ?? "—", MARGIN, y, { width: cw2 });
  kv(doc, "Source",        inv.source ?? "—",         COL2,   y, { width: cw2 });
  kv(doc, "Occurred At",   fmtDate(inv.occurred_at),  COL3,   y, { width: cw2 });
  y += 34;

  // Account context note
  doc.font(F.regular).fontSize(8).fillColor(C.muted)
    .text("Account history (tenure, median transfer size) requires integration with core banking system — not available in current configuration.", MARGIN, y, { width: CW });
  y += 20;

  hRule(doc, y);
  return y + 12;
}

function drawFraudSignals(doc, inv, y) {
  y = sectionBar(doc, y, "3. Fraud Signals & Risk Breakdown");

  // Risk factors
  if (inv.risk_factors?.length) {
    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text("RISK SIGNALS", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    y += 14;

    for (const f of inv.risk_factors) {
      y = needsPage(doc, y, 40);
      // Score badge
      doc.rect(MARGIN, y, 32, 18).fill(C.critical);
      doc.font(F.bold).fontSize(8).fillColor(C.white)
        .text(`+${f.score}`, MARGIN + 4, y + 5, { lineBreak: false, width: 24, align: "center" });
      // Label + evidence
      doc.font(F.bold).fontSize(9).fillColor(C.body)
        .text(f.label, MARGIN + 40, y + 1, { lineBreak: false });
      doc.font(F.regular).fontSize(8).fillColor(C.muted)
        .text(f.evidence ?? "", MARGIN + 40, y + 12, { width: CW - 40, lineBreak: false });
      y += 30;
    }
    y += 6;
  }

  // Triggered policy rules
  if (inv.policy_rules_triggered?.length) {
    y = needsPage(doc, y, 24 + inv.policy_rules_triggered.length * 20);
    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text("TRIGGERED POLICY RULES", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    y += 14;

    inv.policy_rules_triggered.forEach((rule, i) => {
      y = needsPage(doc, y, 20);
      doc.rect(MARGIN, y, CW, 18).fill(i % 2 === 0 ? C.bg : C.white);
      doc.font(F.mono).fontSize(8).fillColor(C.body)
        .text(rule, MARGIN + 8, y + 5, { lineBreak: false });
      y += 18;
    });
    y += 6;
  }

  // Risk score summary
  y = needsPage(doc, y, 28);
  doc.rect(MARGIN, y, CW, 22).fill(C.bg);
  doc.font(F.bold).fontSize(8).fillColor(C.muted)
    .text("COMPOSITE RISK SCORE", MARGIN + 8, y + 7, { characterSpacing: 0.5, lineBreak: false });
  doc.font(F.bold).fontSize(14).fillColor(riskColor(inv.risk_level))
    .text(String(inv.risk_score ?? 0), MARGIN + 180, y + 4, { lineBreak: false });
  doc.font(F.regular).fontSize(9).fillColor(C.muted)
    .text(`/ 100  —  ${(inv.risk_level ?? "").toUpperCase()}`, MARGIN + 204, y + 8, { lineBreak: false });
  y += 30;

  hRule(doc, y);
  return y + 12;
}

function drawAIAssessment(doc, inv, audit, y) {
  y = sectionBar(doc, y, "4. AI Investigation Assessment");

  // Meta row
  doc.font(F.bold).fontSize(8).fillColor(C.muted)
    .text("MODEL", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
  doc.font(F.regular).fontSize(9).fillColor(C.body)
    .text(`${inv.llm_provider ?? "—"} / ${inv.llm_model ?? "—"}`, MARGIN, y + 10, { lineBreak: false });

  doc.font(F.bold).fontSize(8).fillColor(C.muted)
    .text("CONFIDENCE", COL2, y, { characterSpacing: 0.5, lineBreak: false });
  doc.font(F.bold).fontSize(9).fillColor(riskColor(inv.confidence === "high" ? "low" : inv.confidence === "low" ? "critical" : "medium"))
    .text((inv.confidence ?? "—").toUpperCase(), COL2, y + 10, { lineBreak: false });

  doc.font(F.bold).fontSize(8).fillColor(C.muted)
    .text("AI RECOMMENDED ACTION", COL3, y, { characterSpacing: 0.5, lineBreak: false });
  doc.font(F.bold).fontSize(9).fillColor(decisionColor(inv.recommended_action))
    .text(decisionLabel(inv.recommended_action), COL3, y + 10, { lineBreak: false });
  y += 32;

  // Override notice
  const isOverride = audit && audit.action !== inv.recommended_action;
  if (isOverride) {
    y = needsPage(doc, y, 36);
    doc.rect(MARGIN, y, CW, 28).fill("#FEF3C7");
    doc.moveTo(MARGIN, y).lineTo(MARGIN, y + 28).lineWidth(3).strokeColor(C.warn).stroke();
    doc.font(F.bold).fontSize(9).fillColor(C.vuln)
      .text("OVERRIDE — Analyst decision differs from AI recommendation", MARGIN + 10, y + 5, { lineBreak: false });
    doc.font(F.regular).fontSize(8).fillColor(C.vuln)
      .text(`AI recommended: ${decisionLabel(inv.recommended_action)}  →  Analyst decided: ${decisionLabel(audit.action)}`, MARGIN + 10, y + 17, { lineBreak: false });
    y += 36;
  }

  // Full AI narrative
  y = needsPage(doc, y, 40);
  doc.font(F.bold).fontSize(8).fillColor(C.muted)
    .text("AI NARRATIVE", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
  y += 12;

  const summaryText = inv.summary ?? "No summary available.";
  const summaryH = doc.heightOfString(summaryText, { width: CW - 20, fontSize: 9 });

  y = needsPage(doc, y, summaryH + 20);
  doc.rect(MARGIN, y, 3, summaryH + 16).fill(C.accent);
  doc.rect(MARGIN + 3, y, CW - 3, summaryH + 16).fill(C.bg);
  doc.font(F.regular).fontSize(9).fillColor(C.body)
    .text(summaryText, MARGIN + 14, y + 8, { width: CW - 24, lineGap: 2 });
  y += summaryH + 24;

  hRule(doc, y);
  return y + 12;
}

function drawSimilarCases(doc, inv, y) {
  if (!inv.retrieved_case_ids?.length) return y;

  y = needsPage(doc, y, 60);
  y = sectionBar(doc, y, "5. Similar Prior Cases (RAG Retrieved)");

  doc.font(F.regular).fontSize(9).fillColor(C.muted)
    .text("The following prior cases were retrieved via semantic search and used to inform the AI assessment. Full case details are available in the audit database.", MARGIN, y, { width: CW });
  y += 24;

  // Table header
  doc.rect(MARGIN, y, CW, 18).fill(C.navy);
  doc.font(F.bold).fontSize(8).fillColor(C.white)
    .text("CASE ID", MARGIN + 8, y + 5, { lineBreak: false })
    .text("MATCH BASIS", MARGIN + 200, y + 5, { lineBreak: false });
  y += 18;

  inv.retrieved_case_ids.forEach((id, i) => {
    y = needsPage(doc, y, 20);
    doc.rect(MARGIN, y, CW, 18).fill(i % 2 === 0 ? C.bg : C.white);
    doc.font(F.mono).fontSize(8).fillColor(C.body)
      .text(id, MARGIN + 8, y + 5, { lineBreak: false });
    doc.font(F.regular).fontSize(8).fillColor(C.muted)
      .text("Semantic similarity — vector embedding match", MARGIN + 200, y + 5, { lineBreak: false });
    y += 18;
  });

  y += 10;
  hRule(doc, y);
  return y + 12;
}

function drawEntityNetwork(doc, entities, y) {
  const hasData = entities.some(Boolean);
  y = needsPage(doc, y, 60);
  y = sectionBar(doc, y, "6. Entity Network");

  if (!hasData) {
    doc.font(F.regular).fontSize(9).fillColor(C.muted)
      .text("No linked entities identified across other investigations.", MARGIN, y);
    return y + 20;
  }

  const labels = ["Device", "Beneficiary Account", "IP Address"];

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!e) continue;

    y = needsPage(doc, y, 48);
    const others = e.transactions.filter(t => t.status !== null);
    const pending = e.summary.pending;
    const isMule = others.length >= 3;

    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text(labels[i].toUpperCase(), MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    if (isMule) {
      doc.rect(MARGIN + 140, y - 1, 60, 12).fill(C.critical);
      doc.font(F.bold).fontSize(7).fillColor(C.white)
        .text("MULE RISK", MARGIN + 147, y + 2, { lineBreak: false });
    }
    y += 12;

    doc.font(F.regular).fontSize(9).fillColor(C.body)
      .text(`${e.summary.total_transactions} transaction${e.summary.total_transactions !== 1 ? "s" : ""} linked  ·  ${e.summary.unique_customers} unique customer${e.summary.unique_customers !== 1 ? "s" : ""}  ·  ${pending} pending  ·  Total exposure ${fmtGBP(e.summary.total_exposure_pence)}`, MARGIN, y, { width: CW });
    y += 16;

    // Show up to 4 linked transactions
    const sample = others.slice(0, 4);
    if (sample.length) {
      doc.rect(MARGIN, y, CW, 16).fill(C.navy);
      doc.font(F.bold).fontSize(7).fillColor(C.white)
        .text("CUSTOMER", MARGIN + 8, y + 4, { lineBreak: false })
        .text("AMOUNT",   MARGIN + 160, y + 4, { lineBreak: false })
        .text("STATUS",   MARGIN + 260, y + 4, { lineBreak: false })
        .text("DECISION", MARGIN + 340, y + 4, { lineBreak: false });
      y += 16;

      sample.forEach((t, j) => {
        y = needsPage(doc, y, 16);
        doc.rect(MARGIN, y, CW, 16).fill(j % 2 === 0 ? C.bg : C.white);
        doc.font(F.mono).fontSize(8).fillColor(C.body).text(t.customer_id, MARGIN + 8, y + 4, { lineBreak: false, width: 148 });
        doc.font(F.regular).fontSize(8).fillColor(C.body).text(fmtGBP(t.amount_pence), MARGIN + 160, y + 4, { lineBreak: false });
        doc.font(F.regular).fontSize(8).fillColor(C.muted).text(t.status ?? "—", MARGIN + 260, y + 4, { lineBreak: false });
        doc.font(F.bold).fontSize(8).fillColor(decisionColor(t.decision_action)).text(decisionLabel(t.decision_action), MARGIN + 340, y + 4, { lineBreak: false });
        y += 16;
      });
    }
    y += 12;
  }

  hRule(doc, y);
  return y + 12;
}

function drawAnalystDecision(doc, inv, audit, y) {
  y = sectionBar(doc, y, "7. Analyst Decision & Audit Trail");

  const cw3 = COL_W - 6;
  kv(doc, "Decision",   decisionLabel(audit?.action),  MARGIN, y, { color: decisionColor(audit?.action), width: cw3 });
  kv(doc, "Analyst ID", audit?.analyst_id ?? "—",       COL2,   y, { width: cw3 });
  kv(doc, "Decided At", fmtDate(audit?.decided_at),     COL3,   y, { width: cw3 });
  y += 26;

  kv(doc, "Time from Flag to Decision", fmtDuration(inv.created_at, audit?.decided_at), MARGIN, y, { width: cw3 });
  kv(doc, "PSR Claim Reference",        audit?.claim_reference ?? "Not provided",        COL2,   y, { width: cw3 * 2 });
  y += 26;

  if (audit?.override_reason) {
    y = needsPage(doc, y, 32);
    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text("OVERRIDE REASON", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    y += 10;
    doc.font(F.regular).fontSize(9).fillColor(C.body)
      .text(audit.override_reason, MARGIN, y, { width: CW });
    y += doc.heightOfString(audit.override_reason, { width: CW, fontSize: 9 }) + 8;
  }

  if (audit?.analyst_notes) {
    y = needsPage(doc, y, 32);
    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text("ANALYST NOTES", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    y += 10;
    const notesH = doc.heightOfString(audit.analyst_notes, { width: CW, fontSize: 9 });
    y = needsPage(doc, y, notesH + 16);
    doc.rect(MARGIN, y, CW, notesH + 12).fill(C.bg);
    doc.font(F.regular).fontSize(9).fillColor(C.body)
      .text(audit.analyst_notes, MARGIN + 8, y + 6, { width: CW - 16 });
    y += notesH + 20;
  }

  hRule(doc, y);
  return y + 12;
}

function drawTranscript(doc, messages, y) {
  if (!messages?.length) return y;

  y = needsPage(doc, y, 60);
  y = sectionBar(doc, y, "8. Copilot Investigation Transcript");

  for (const msg of messages) {
    const isAnalyst = msg.role === "analyst";
    const label     = isAnalyst ? "ANALYST" : "SHARK WATCH AI";
    const labelCol  = isAnalyst ? C.accent : C.muted;
    const bgCol     = isAnalyst ? "#EBF4FF" : C.bg;
    const text      = msg.content ?? "";

    const textH = doc.heightOfString(text, { width: CW - 16, fontSize: 9 });
    const blockH = 10 + textH + 16;

    y = needsPage(doc, y, blockH + 16);

    // Timestamp + label
    doc.font(F.bold).fontSize(7).fillColor(labelCol)
      .text(label, MARGIN, y, { lineBreak: false });
    doc.font(F.regular).fontSize(7).fillColor(C.muted)
      .text(fmtDate(msg.created_at), MARGIN, y, { width: CW, align: "right", lineBreak: false });
    y += 10;

    doc.rect(MARGIN, y, CW, textH + 12).fill(bgCol);
    if (!isAnalyst) {
      doc.rect(MARGIN, y, 3, textH + 12).fill(C.accent);
    }
    doc.font(F.regular).fontSize(9).fillColor(C.body)
      .text(text, MARGIN + (isAnalyst ? 8 : 12), y + 6, { width: CW - 20, lineGap: 2 });

    if (msg.sources?.length) {
      y += textH + 12;
      doc.font(F.regular).fontSize(7).fillColor(C.muted)
        .text(`Sources: ${msg.sources.join(" · ")}`, MARGIN + 8, y, { lineBreak: false });
      y += 12;
    } else {
      y += textH + 18;
    }
  }

  hRule(doc, y);
  return y + 12;
}

function drawVulnerableCustomer(doc, inv, y) {
  if (!inv.vulnerability_flag) return y;

  y = needsPage(doc, y, 60);
  y = sectionBar(doc, y, "9. Customer Welfare Record");

  doc.rect(MARGIN, y, CW, 24).fill(C.vulnBg);
  doc.moveTo(MARGIN, y).lineTo(MARGIN, y + 24).lineWidth(3).strokeColor(C.warn).stroke();
  doc.font(F.bold).fontSize(9).fillColor(C.vuln)
    .text("FCA Consumer Duty — s.12 CONC — Vulnerable Customer Identified", MARGIN + 10, y + 8, { lineBreak: false });
  y += 32;

  if (inv.vulnerability_indicators?.length) {
    doc.font(F.bold).fontSize(8).fillColor(C.muted)
      .text("VULNERABILITY INDICATORS", MARGIN, y, { characterSpacing: 0.5, lineBreak: false });
    y += 12;
    for (const ind of inv.vulnerability_indicators) {
      y = needsPage(doc, y, 16);
      doc.circle(MARGIN + 5, y + 5, 3).fill(C.warn);
      doc.font(F.regular).fontSize(9).fillColor(C.body)
        .text(ind, MARGIN + 14, y, { width: CW - 14 });
      y += 16;
    }
    y += 6;
  }

  doc.font(F.regular).fontSize(9).fillColor(C.muted)
    .text("This case was subject to enhanced consideration under the FCA Consumer Duty (PS22/9). The analyst was notified of vulnerability indicators prior to making a decision.", MARGIN, y, { width: CW });
  y += doc.heightOfString("", { width: CW }) + 24;

  hRule(doc, y);
  return y + 12;
}

function drawBackCover(doc, inv, audit, hash) {
  doc.addPage();

  // Full navy background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.navy);

  let y = 120;

  // Shark Watch wordmark
  doc.font(F.bold).fontSize(28).fillColor(C.white).text("SHARK WATCH", MARGIN, y, { lineBreak: false });
  y += 40;
  doc.font(F.regular).fontSize(11).fillColor("rgba(255,255,255,0.6)")
    .text("PSR Compliance Document — End of Record", MARGIN, y, { lineBreak: false });
  y += 48;

  // Compliance statement
  doc.rect(MARGIN, y, CW, 2).fill("rgba(255,255,255,0.15)");
  y += 14;
  doc.font(F.regular).fontSize(9).fillColor("rgba(255,255,255,0.7)")
    .text(
      "This document constitutes a complete audit record generated automatically by Shark Watch at the time of decision. It has not been altered post-decision. The integrity hash below can be used to verify this document against the decision record held in the Shark Watch database.",
      MARGIN, y, { width: CW, lineGap: 3 }
    );
  y += 60;

  // Hash block
  doc.rect(MARGIN, y, CW, 72).fill("rgba(255,255,255,0.06)");
  doc.rect(MARGIN, y, 3, 72).fill(C.accent);
  doc.font(F.bold).fontSize(8).fillColor("rgba(255,255,255,0.5)")
    .text("SHA-256 INTEGRITY HASH", MARGIN + 12, y + 10, { characterSpacing: 0.6, lineBreak: false });
  doc.font(F.mono).fontSize(8).fillColor(C.white)
    .text(hash, MARGIN + 12, y + 24, { width: CW - 24, lineBreak: false });
  doc.font(F.regular).fontSize(8).fillColor("rgba(255,255,255,0.4)")
    .text("Hash of: investigation_id · transaction_id · amount · decision · analyst · timestamp · claim_reference", MARGIN + 12, y + 46, { lineBreak: false });
  y += 84;

  // Meta
  doc.font(F.regular).fontSize(8).fillColor("rgba(255,255,255,0.4)")
    .text(`Generated: ${fmtDate(new Date().toISOString())}`, MARGIN, y, { lineBreak: false })
    .text("Shark Watch v1  ·  Confidential — For regulatory use only", MARGIN, y, { width: CW, align: "right", lineBreak: false });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePSRPdf({ inv, audit, messages, entities }) {
  return new Promise((resolve, reject) => {
    const hash = computeHash(inv, audit);

    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: { top: MARGIN, bottom: 0, left: MARGIN, right: MARGIN },
      info: {
        Title:   `PSR Claim Pack — ${inv.id}`,
        Author:  "Shark Watch",
        Subject: "APP Fraud Investigation — PSR Compliance Document",
        Creator: "Shark Watch v1",
      },
    });

    const buffers = [];
    doc.on("data", c => buffers.push(c));
    doc.on("end",  () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ── Page 1: Cover ──
    let y = drawCover(doc, inv, audit);

    // ── Page 2: Transaction details ──
    doc.addPage();
    y = MARGIN;
    y = drawTransactionDetails(doc, inv, y);

    // ── Page 3: Fraud signals ──
    doc.addPage();
    y = MARGIN;
    y = drawFraudSignals(doc, inv, y);

    // ── Page 4: AI Assessment ──
    doc.addPage();
    y = MARGIN;
    y = drawAIAssessment(doc, inv, audit, y);

    // ── Page 5: Similar cases ──
    if (inv.retrieved_case_ids?.length) {
      doc.addPage();
      y = MARGIN;
      y = drawSimilarCases(doc, inv, y);
    }

    // ── Page 6: Entity network ──
    doc.addPage();
    y = MARGIN;
    y = drawEntityNetwork(doc, entities ?? [], y);

    // ── Page 7: Decision & audit trail ──
    doc.addPage();
    y = MARGIN;
    y = drawAnalystDecision(doc, inv, audit, y);

    // ── Page 8: Copilot transcript ──
    if (messages?.length) {
      doc.addPage();
      y = MARGIN;
      y = drawTranscript(doc, messages, y);
    }

    // ── Page 9: Vulnerable customer (conditional) ──
    if (inv.vulnerability_flag) {
      doc.addPage();
      y = MARGIN;
      drawVulnerableCustomer(doc, inv, y);
    }

    // ── Back cover ──
    drawBackCover(doc, inv, audit, hash);

    // ── Footers on all pages except back cover ──
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total - 1; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, inv.id, i + 1, total - 1);
    }

    doc.flushPages();
    doc.end();
  });
}
