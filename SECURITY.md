# Security Policy

## Reporting a Vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Email **security@protocolwealthllc.com** with:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Any proof-of-concept code (if applicable)
- Suggested remediation (if any)

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

This policy applies to code and package artifacts in this repository. Deployed
Protocol Wealth app surfaces live in separate private repositories and should
be reported through the same security contact unless a narrower channel is
documented for that surface.

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
- Denial-of-service attacks

## Bug Bounty

We do not currently operate a paid bug bounty program. We will credit reporters in security advisories unless they prefer to remain anonymous.

## Contact

- Email: **security@protocolwealthllc.com**
- Legal / Compliance: **compliance@protocolwealthllc.com**

Protocol Wealth LLC is an SEC-registered investment adviser (CRD #335298).

## PGP

Public key for sensitive reports available on request.
