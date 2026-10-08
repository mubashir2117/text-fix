"use client";

import {
  AlertCircle,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ListChecks,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import type { NormalizedRecreation } from "@/lib/formats";
import type {
  ImprovementItem,
  ImprovementKind,
  TextAlignment,
  TextAssessmentStatus,
  TextElementAssessment,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Recreate & Compare Post" report (§10, §12, §13):
 *
 *   What improved?          — per-category report, including what was
 *                             deliberately left unchanged (§11)
 *   Text analysis           — original vs. recommended per element,
 *                             with case + alignment status badges (§12)
 *   Design improvement summary — AI-generated assessment (§13)
 *
 * Renders nothing when the model returned no report data, so results
 * produced before this feature still display cleanly.
 */

interface TextReportProps {
  recreation: NormalizedRecreation;
}

const ELEMENT_LABEL: Record<string, string> = {
  headline: "Headline",
  subtitle: "Subtitle",
  body: "Body",
  cta: "CTA",
  label: "Label",
  price: "Price",
  contact: "Contact",
  website: "Website",
  handle: "Handle",
  hashtags: "Hashtags",
  other: "Other",
};

const STATUS_BADGE: Record<TextAssessmentStatus, { label: string; tone: "approve" | "flag" | "pen" }> = {
  correct: { label: "Correct", tone: "approve" },
  improve: { label: "Improve", tone: "flag" },
  incorrect: { label: "Incorrect", tone: "pen" },
};

const STATUS_ICON: Record<TextAssessmentStatus, ComponentType<{ className?: string }>> = {
  correct: Check,
  improve: AlertTriangle,
  incorrect: XMark,
};

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" className={className}>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const KIND_STYLE: Record<ImprovementKind, { icon: ComponentType<{ className?: string }>; className: string }> = {
  correct: { icon: Check, className: "bg-approve-soft text-approve" },
  design_improvement: { icon: Sparkles, className: "bg-flag-soft text-flag" },
  definite_problem: { icon: AlertCircle, className: "bg-pen-soft text-pen" },
};

const CATEGORY_LABEL: Record<string, string> = {
  capitalization: "Capitalization",
  alignment: "Alignment",
  spacing: "Spacing",
  hierarchy: "Hierarchy",
  readability: "Readability",
  cta: "CTA",
  grammar: "Grammar",
  other: "Other",
};

const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function AlignmentNote({ current, recommended }: { current: TextAlignment; recommended: TextAlignment }) {
  const Icon = ALIGN_ICON[current];
  const match = current === recommended;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] leading-tight">
      <Icon className={cn("h-3 w-3", match ? "text-approve" : "text-flag")} aria-hidden="true" />
      <span className={match ? "text-ink-soft" : "text-flag"}>
        {titleCase(current)}
        {match ? " aligned" : ` → ${titleCase(recommended)}`}
      </span>
    </span>
  );
}

function CaseNote({ assessment }: { assessment: TextElementAssessment }) {
  const current = assessment.currentStyle.trim();
  const recommended = assessment.recommendedStyle.trim();
  const unchanged = current.toLowerCase() === recommended.toLowerCase();
  if (!current && !recommended) return null;
  return (
    <span className="text-[11px] leading-tight">
      <span className="text-ink-faint">Case: </span>
      <span className="text-ink-soft">{current || "—"}</span>
      {!unchanged && recommended ? (
        <>
          <span className="text-ink-faint"> → </span>
          <span className="font-medium text-ink">{recommended}</span>
        </>
      ) : (
        <span className="text-approve"> ✓</span>
      )}
    </span>
  );
}

export function TextReport({ recreation }: TextReportProps) {
  const { textAnalysis, improvementReport, summary, improvements } = recreation;

  const report: ImprovementItem[] =
    improvementReport.length > 0
      ? improvementReport
      : improvements.map((detail) => ({
          category: "other" as const,
          kind: "design_improvement" as const,
          title: "Improvement",
          detail,
        }));

  if (report.length === 0 && textAnalysis.length === 0 && !summary) return null;

  return (
    <div className="space-y-5">
      {/* WHAT IMPROVED — §10 / §11 */}
      {report.length > 0 && (
        <section aria-label="What improved" className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            <h2 className="text-sm font-medium text-ink">What improved?</h2>
          </div>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {report.map((item, index) => {
              const style = KIND_STYLE[item.kind] ?? KIND_STYLE.design_improvement;
              const Icon = style.icon;
              return (
                <li
                  key={`${item.category}-${index}`}
                  className="flex items-start gap-2.5 rounded-[8px] bg-paper-dim/50 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      style.className
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">
                      {item.title.trim() || CATEGORY_LABEL[item.category] || "Improvement"}
                      {item.kind === "correct" && (
                        <span className="ml-1.5 font-normal text-approve">✓</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft">{item.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* TEXT ANALYSIS TABLE — §12 */}
      {textAnalysis.length > 0 && (
        <section aria-label="Text analysis" className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">Text analysis</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Original text vs. the corrected recommendation — status is an AI assessment of each element.
          </p>

          {/* Desktop / tablet: table */}
          <div className="mt-3 hidden overflow-hidden rounded-[8px] border border-line sm:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-paper-dim/70 text-[11px] uppercase tracking-wider text-ink-soft">
                  <th scope="col" className="px-3 py-2 font-semibold">Element</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Original</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Recommendation</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {textAnalysis.map((assessment, index) => {
                  const badge = STATUS_BADGE[assessment.status] ?? STATUS_BADGE.improve;
                  const Icon = STATUS_ICON[assessment.status] ?? AlertTriangle;
                  return (
                    <tr key={`${assessment.element}-${index}`} className="border-t border-line align-top">
                      <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                        {ELEMENT_LABEL[assessment.element] ?? titleCase(assessment.element)}
                        <span className="mt-1 block font-normal">
                          <CaseNote assessment={assessment} />
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-ink-soft">
                        {assessment.original || "—"}
                        <span className="mt-1 block">
                          <AlignmentNote current={assessment.alignment} recommended={assessment.alignment} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink">
                        {assessment.recommended || assessment.original || "—"}
                        <span className="mt-1 block">
                          <AlignmentNote
                            current={assessment.alignment}
                            recommended={assessment.recommendedAlignment}
                          />
                        </span>
                        {assessment.reason.trim() && (
                          <span className="mt-1 block text-[12px] leading-relaxed text-ink-faint">
                            {assessment.reason}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={badge.tone}>
                          <Icon className="h-3 w-3" />
                          {badge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="mt-3 space-y-2.5 sm:hidden">
            {textAnalysis.map((assessment, index) => {
              const badge = STATUS_BADGE[assessment.status] ?? STATUS_BADGE.improve;
              const Icon = STATUS_ICON[assessment.status] ?? AlertTriangle;
              return (
                <li key={`${assessment.element}-mobile-${index}`} className="rounded-[8px] border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {ELEMENT_LABEL[assessment.element] ?? titleCase(assessment.element)}
                    </span>
                    <Badge tone={badge.tone}>
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </Badge>
                  </div>
                  <dl className="mt-2 space-y-1.5 text-[13px]">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">Original</dt>
                      <dd className="text-ink-soft">{assessment.original || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">Recommendation</dt>
                      <dd className="text-ink">{assessment.recommended || assessment.original || "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex flex-col gap-1">
                    <CaseNote assessment={assessment} />
                    <AlignmentNote
                      current={assessment.alignment}
                      recommended={assessment.recommendedAlignment}
                    />
                  </div>
                  {assessment.reason.trim() && (
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{assessment.reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* DESIGN IMPROVEMENT SUMMARY — §13 */}
      {summary && (
        <section aria-label="Design improvement summary" className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">Design improvement summary</h2>
            <Badge tone="muted">AI-generated assessment</Badge>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-[8px] bg-paper-dim/50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">Overall improvement</p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">
                {summary.overallImprovement.trim() || "—"}
              </p>
            </div>
            {typeof summary.textAccuracy === "number" && (
              <div className="rounded-[8px] bg-paper-dim/50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Text accuracy</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-approve"
                      style={{ width: `${Math.round(summary.textAccuracy)}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-ink">{Math.round(summary.textAccuracy)}%</span>
                </div>
              </div>
            )}
          </div>

          <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {[
              { label: "Alignment", value: summary.alignment },
              { label: "Capitalization", value: summary.capitalization },
              { label: "Hierarchy", value: summary.hierarchy },
              { label: "Readability", value: summary.readability },
            ]
              .filter((row) => row.value.trim().length > 0)
              .map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-[8px] border border-line px-3 py-2">
                  <dt className="text-[13px] text-ink-soft">{row.label}</dt>
                  <dd className="text-[13px] font-medium text-ink">{row.value}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
    </div>
  );
}
