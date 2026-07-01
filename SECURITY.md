# Security Policy

## Reporting a Vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Email **security@protocolwealthllc.com** with:
- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any proof-of-concept code (if applicable)

We will:
1. Acknowledge your report within **48 hours**
2. Confirm the issue and determine severity within **5 business days**
3. Release a patch and public advisory within **30 days** (faster for critical issues)
4. Credit you in the advisory unless you prefer to remain anonymous

## Supported Versions

| Version | Supported |
|---------|-----------|
| main branch | ✅ Active development |
| latest release | ✅ Security patches |
| older releases | ❌ Please upgrade |

## Scope

**In scope:**
- Code execution vulnerabilities
- Authentication/authorization bypass
- Data exposure (including PII leakage through the `@protocolwealthos/pii-guard` pipeline)
- Tamper-evidence bypasses of the `@protocolwealthos/audit-log` hash chain
- Confirmation-gate bypasses in `@protocolwealthos/mcp-tools` (write-tool two-turn gate)
- Cryptographic weaknesses in `@protocolwealthos/auth` (JWT) or `@protocolwealthos/webhooks` (HMAC)
- Supply chain attacks (dependency vulnerabilities)

**Out of scope:**
- Issues in third-party dependencies (report upstream)
- Social engineering
- Physical security
- DDoS against protocol wealth infrastructure

## Bug Bounty

We do not currently operate a paid bug bounty program. We will credit reporters in security advisories unless they prefer to remain anonymous.

## PGP

Public key for sensitive reports available on request.
