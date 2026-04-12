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
- Data exposure (including PII leakage)
- Supply chain attacks (dependency vulnerabilities)
- XBRL/SEC data integrity issues

**Out of scope:**
- Issues in third-party dependencies (report upstream)
- Social engineering
- Physical security
- DDoS against protocol wealth infrastructure

## Bug Bounty

We do not currently operate a paid bug bounty program. We will credit reporters in security advisories and our [SECURITY_HALL_OF_FAME.md](SECURITY_HALL_OF_FAME.md) file (coming soon).

## PGP

Public key for sensitive reports available on request.
