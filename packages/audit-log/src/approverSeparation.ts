// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Approver-separation guard.
 *
 * SEC Marketing Rule 206(4)-1 requires that advertisements be reviewed
 * and approved by someone other than the author. The same separation
 * applies generally: the author of a record cannot be the reviewer who
 * approves it. This guard is the application-layer check; pair with a
 * database-side CHECK constraint or trigger for defense in depth.
 */

export class ApproverSeparationError extends Error {
  readonly authorId: string;
  readonly reviewerId: string;
  constructor(authorId: string, reviewerId: string) {
    super(
      `Reviewer "${reviewerId}" cannot approve content authored by themselves.`
    );
    this.name = "ApproverSeparationError";
    this.authorId = authorId;
    this.reviewerId = reviewerId;
  }
}

export interface ApproverSeparationCheck {
  authorId: string;
  reviewerId: string;
  /**
   * Optional case-folding before comparison (recommended for emails).
   * Default true.
   */
  normalize?: boolean;
}

function fold(value: string, normalize: boolean): string {
  return normalize ? value.trim().toLowerCase() : value;
}

/** True if the author and reviewer are different identifiers. */
export function isApprovedByDifferentParty(
  check: ApproverSeparationCheck
): boolean {
  const normalize = check.normalize ?? true;
  return fold(check.authorId, normalize) !== fold(check.reviewerId, normalize);
}

/** Throws `ApproverSeparationError` if author and reviewer match. */
export function assertApprovedByDifferentParty(
  check: ApproverSeparationCheck
): void {
  if (!isApprovedByDifferentParty(check)) {
    throw new ApproverSeparationError(check.authorId, check.reviewerId);
  }
}
