# Third-Party Licenses

PWOS Core bundles or derives from the following open-source software. Each
section contains the upstream copyright notice and license text verbatim.

If you find an omission or error, please open an issue.

---

## MIT License

The following components are distributed under the MIT License:

**Web Framework & Runtime:**
- Hono — Copyright (c) 2022 Yusuke Wada
- React — Copyright (c) Meta Platforms, Inc.
- Vite — Copyright (c) 2019-present VoidZero Inc. and Vite contributors
- Zustand — Copyright (c) 2019 Paul Henschel
- Tailwind CSS — Copyright (c) Tailwind Labs, Inc.
- jose — Copyright (c) 2018 Filip Skokan

**Document Generation:**
- pdfme — Copyright (c) 2022 pdfme contributors
- @react-pdf/renderer — Copyright (c) 2017 Diego Muracciole
- pdf-lib — Copyright (c) 2017 Andrew Dillon
- pdfmake — Copyright (c) 2014 bpampuch
- docx — Copyright (c) 2016 Dolan Miu
- pptxgenjs — Copyright (c) 2015 Brent Ely
- pdfkit — Copyright (c) 2014 Devon Govett

**Onchain:**
- Viem — Copyright (c) 2022 wevm
- Wagmi — Copyright (c) 2022 wevm
- Ox — Copyright (c) 2024 wevm

**Workflow:**
- BullMQ — Copyright (c) 2018 Taskforce.sh
- Temporal TypeScript SDK — Copyright (c) 2020 Temporal Technologies Inc.
- Trigger.dev — Copyright (c) 2022 Trigger.dev
- Activepieces — Copyright (c) 2022 Activepieces

**AI & LLM:**
- @anthropic-ai/sdk — Copyright (c) 2023 Anthropic, PBC

**File & Data Processing:**
- csv-parse — Copyright (c) 2010 Adaltas
- pdf-parse — Copyright (c) Modesty Zhang
- exceljs — Copyright (c) 2016 ExcelJS Contributors

**Validation:**
- Zod — Copyright (c) 2020 Colin McDonnell

### MIT License Text

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Apache License, Version 2.0

The following components are distributed under the Apache License, Version 2.0:

- Drizzle ORM — Copyright (c) 2024 Drizzle Team

Full text available at: https://www.apache.org/licenses/LICENSE-2.0

Key terms:
- You must give any other recipients of the Work or Derivative Works a copy of this License
- You must cause any modified files to carry prominent notices stating that You changed the files
- You must retain all copyright, patent, trademark, and attribution notices
- If the Work includes a NOTICE file, the Derivative Works must include a readable copy of the attribution notices

---

## Reference Architecture (AGPL-3.0 — Not Bundled)

The following projects are AGPL-licensed and inform our architecture but
contain no copied code. Each has its own license:

- **Twenty CRM** (AGPL-3.0) — https://github.com/twentyhq/twenty/blob/main/LICENSE
  We reference their custom object system and workflow patterns.

- **Ghostfolio** (AGPL-3.0) — https://github.com/ghostfolio/ghostfolio/blob/main/LICENSE
  We reference their Prisma schema for portfolio data modeling.

- **Wealthfolio** (AGPL-3.0) — https://github.com/afadil/wealthfolio/blob/main/LICENSE
  We reference their React+Vite UI patterns for financial dashboards.

- **Sure (Maybe Finance fork)** (AGPL-3.0) — https://github.com/we-promise/sure
  We reference their MCP tool exposure patterns.

- **Firefly III** (AGPL-3.0) — https://github.com/firefly-iii/firefly-iii
  We reference their double-entry bookkeeping API patterns.

---

## Dormant Projects (Ported, not copied)

- **Wealthbot** (MIT, dormant PHP) — https://github.com/wealthbot-io/wealthbot
  Their RIA rebalancing and billing algorithms inform our TypeScript
  implementations. The PHP code is MIT-licensed; our TypeScript port is
  original work with attribution to their algorithmic approach.

---

## Reporting License Issues

If you believe this project infringes any third-party license or intellectual
property right, please open an issue at
https://github.com/Protocol-Wealth/pwos-core/issues or email
legal@protocolwealthllc.com. We take attribution seriously and will respond
promptly.
