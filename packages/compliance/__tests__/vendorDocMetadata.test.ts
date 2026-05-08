// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  isVendorDocCurrent,
  vendorDocsExpiringSoon,
} from "../src/vendorDocMetadata.js";
import type { VendorDocMetadata } from "../src/vendorDocMetadata.js";

const base: VendorDocMetadata = {
  id: "d1",
  vendorId: "v1",
  kind: "soc2_type2",
  provenance: "ai_advisory",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("isVendorDocCurrent", () => {
  it("documents without expiresAt are current", () => {
    expect(isVendorDocCurrent(base, "2026-05-08T00:00:00Z")).toBe(true);
  });

  it("expired documents are not current", () => {
    expect(
      isVendorDocCurrent(
        { ...base, expiresAt: "2026-01-01T00:00:00Z" },
        "2026-05-08T00:00:00Z"
      )
    ).toBe(false);
  });

  it("future-expiring documents are current", () => {
    expect(
      isVendorDocCurrent(
        { ...base, expiresAt: "2027-01-01T00:00:00Z" },
        "2026-05-08T00:00:00Z"
      )
    ).toBe(true);
  });
});

describe("vendorDocsExpiringSoon", () => {
  it("returns documents whose expiry is within the horizon", () => {
    const docs: VendorDocMetadata[] = [
      { ...base, id: "d1", expiresAt: "2026-05-15T00:00:00Z" },
      { ...base, id: "d2", expiresAt: "2026-12-01T00:00:00Z" },
      { ...base, id: "d3" }, // no expiry
    ];
    const out = vendorDocsExpiringSoon(docs, "2026-05-08T00:00:00Z", 14);
    expect(out.map((d) => d.id)).toEqual(["d1"]);
  });

  it("excludes already-expired documents", () => {
    const docs: VendorDocMetadata[] = [
      { ...base, id: "d1", expiresAt: "2026-05-01T00:00:00Z" },
    ];
    expect(vendorDocsExpiringSoon(docs, "2026-05-08T00:00:00Z", 30)).toEqual([]);
  });
});
