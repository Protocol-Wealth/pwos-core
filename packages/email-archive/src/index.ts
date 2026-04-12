/**
 * @pwos/email-archive
 *
 * SEC Rule 17a-4 email archiving with encrypted storage, full-text
 * search/eDiscovery, retention policy management, and file hash
 * integrity verification.
 *
 * Integrates with OpenArchiver as the archival backend.
 *
 * Third-party:
 * - OpenArchiver (check license) - https://github.com/LogicLabs-OU/OpenArchiver
 *   TypeScript-native email archiving for Google Workspace, M365,
 *   PST, IMAP. Directly addresses SEC Rule 17a-4 / 204-2.
 *
 * Our original work: integration layer with PWOS audit trail, per-advisor
 * retention policies, compliance export format.
 *
 * Copyright 2026 Protocol Wealth, LLC
 * Licensed under Apache 2.0
 */

export const VERSION = "0.1.0";
