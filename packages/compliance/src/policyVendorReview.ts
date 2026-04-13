// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Policy and vendor review status evaluators.
 *
 * SEC Rule 206(4)-7 requires advisers to review written policies at
 * least annually and to maintain adequate vendor oversight for any
 * third party handling client data. These helpers compute review
 * status ("current", "review_due", "overdue") given the review cadence
 * and the last reviewed date.
 */

import type { PolicyReview, VendorAssessment } from "./types.js";

/** Classify a policy's review status against ``asOf``. */
export function policyStatus(
  policy: Pick<PolicyReview, "lastReviewedAt" | "reviewCadenceMonths">,
  asOf: Date = new Date(),
): "current" | "review_due" | "overdue" {
  if (!policy.lastReviewedAt) return "overdue";
  const last = new Date(policy.lastReviewedAt);
  const cadenceMs = policy.reviewCadenceMonths * 30 * 24 * 60 * 60 * 1000;
  const reviewDueAt = new Date(last.getTime() + cadenceMs);
  if (asOf >= reviewDueAt) return "overdue";
  const warnWindow = cadenceMs / 12; // 1 cadence month before due
  const warnAt = new Date(reviewDueAt.getTime() - warnWindow);
  if (asOf >= warnAt) return "review_due";
  return "current";
}

/** Classify a vendor assessment's status. Same semantics as policyStatus. */
export function vendorStatus(
  vendor: Pick<VendorAssessment, "lastReviewedAt" | "reviewCadenceMonths">,
  asOf: Date = new Date(),
): "current" | "review_due" | "overdue" {
  // Same algorithm — re-export under a narrower name for readability.
  return policyStatus(
    {
      lastReviewedAt: vendor.lastReviewedAt,
      reviewCadenceMonths: vendor.reviewCadenceMonths,
    },
    asOf,
  );
}

/** Policies that are either overdue or have review due within the warn window. */
export function policiesNeedingReview(
  policies: readonly PolicyReview[],
  asOf: Date = new Date(),
): PolicyReview[] {
  return policies
    .map((p) => ({ ...p, status: policyStatus(p, asOf) }))
    .filter((p) => p.status !== "current");
}

/** Vendors that are either overdue or due for review in the warn window. */
export function vendorsNeedingReview(
  vendors: readonly VendorAssessment[],
  asOf: Date = new Date(),
): VendorAssessment[] {
  return vendors
    .map((v) => ({ ...v, status: vendorStatus(v, asOf) }))
    .filter((v) => v.status !== "current");
}
