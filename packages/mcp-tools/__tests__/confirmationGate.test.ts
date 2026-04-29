// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONFIRM_TOKEN_LENGTH,
  computeConfirmToken,
  confirmGate,
  formatPreviewMessage,
  stableJsonString,
} from "../src/index.js";

describe("stableJsonString", () => {
  it("sorts keys recursively so reordered objects serialize equally", () => {
    expect(stableJsonString({ a: 1, b: { y: 2, x: 3 } })).toBe(
      stableJsonString({ b: { x: 3, y: 2 }, a: 1 }),
    );
  });

  it("preserves array order — arrays are ordered, objects are not", () => {
    expect(stableJsonString([1, 2, 3])).not.toBe(stableJsonString([3, 2, 1]));
  });

  it("handles null, undefined, and primitives", () => {
    expect(stableJsonString(null)).toBe("null");
    expect(stableJsonString(undefined)).toBe("null");
    expect(stableJsonString("s")).toBe('"s"');
    expect(stableJsonString(7)).toBe("7");
    expect(stableJsonString(true)).toBe("true");
  });

  it("recurses through nested arrays of objects", () => {
    const a = stableJsonString([{ b: 2, a: 1 }, { d: 4, c: 3 }]);
    const b = stableJsonString([{ a: 1, b: 2 }, { c: 3, d: 4 }]);
    expect(a).toBe(b);
  });
});

describe("computeConfirmToken", () => {
  it("returns 16 hex chars by default", () => {
    expect(computeConfirmToken({ x: 1 })).toMatch(/^[0-9a-f]{16}$/);
    expect(CONFIRM_TOKEN_LENGTH).toBe(16);
  });

  it("is stable across key reorderings", () => {
    expect(computeConfirmToken({ a: 1, b: 2 })).toBe(
      computeConfirmToken({ b: 2, a: 1 }),
    );
  });

  it("changes when any field changes", () => {
    expect(computeConfirmToken({ a: 1 })).not.toBe(
      computeConfirmToken({ a: 2 }),
    );
    expect(computeConfirmToken({ a: 1 })).not.toBe(
      computeConfirmToken({ a: 1, b: 2 }),
    );
  });

  it("distinguishes array order changes", () => {
    expect(computeConfirmToken([1, 2, 3])).not.toBe(
      computeConfirmToken([3, 2, 1]),
    );
  });
});

describe("formatPreviewMessage", () => {
  it("includes label, body, and confirm_token", () => {
    const msg = formatPreviewMessage({
      operationLabel: "create record",
      previewBody: 'Will create "Acme" with amount 100.',
      confirmToken: "abcd1234abcd1234",
    });
    expect(msg).toContain("Preview — create record");
    expect(msg).toContain('Will create "Acme" with amount 100.');
    expect(msg).toContain('confirm_token: "abcd1234abcd1234"');
  });
});

describe("confirmGate", () => {
  const renderPreview = (p: { name: string; amount: number }): string =>
    `Will create record "${p.name}" with amount ${p.amount}.`;
  const execute = vi.fn();

  beforeEach(() => execute.mockReset());

  it("returns preview phase + token on first call (no execute)", async () => {
    const payload = { name: "Acme", amount: 100 };
    const r = await confirmGate({
      payload,
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("preview");
    if (r.phase === "preview") {
      expect(r.previewMessage).toContain("Preview — create record");
      expect(r.previewMessage).toContain('"Acme"');
      expect(r.previewMessage).toContain("amount 100");
      expect(r.confirmToken).toBe(computeConfirmToken(payload));
      expect(r.previewMessage).toContain(`confirm_token: "${r.confirmToken}"`);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes when correct token + same payload provided", async () => {
    const payload = { name: "Acme", amount: 100 };
    execute.mockResolvedValueOnce({ id: "rec_1" });

    const r = await confirmGate({
      payload,
      confirmToken: computeConfirmToken(payload),
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("executed");
    if (r.phase === "executed") expect(r.result).toEqual({ id: "rec_1" });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(payload);
  });

  it("executes when payload key order differs from preview turn", async () => {
    // Model may emit fields in a different order on the second turn.
    // Stable hashing must absorb that.
    const previewPayload = { name: "Acme", amount: 100 };
    const confirmPayload = { amount: 100, name: "Acme" };
    const tok = computeConfirmToken(previewPayload);
    execute.mockResolvedValueOnce({ id: "rec_1" });

    const r = await confirmGate({
      payload: confirmPayload,
      confirmToken: tok,
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("executed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects when payload changed between preview and confirm", async () => {
    const previewToken = computeConfirmToken({ name: "Acme", amount: 100 });
    const r = await confirmGate({
      payload: { name: "Acme", amount: 999 }, // model fudged the amount
      confirmToken: previewToken,
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("rejected");
    if (r.phase === "rejected") {
      expect(r.code).toBe("confirm_token_mismatch");
      expect(r.error).toContain("payload changed");
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects when confirm_token is from a totally different operation", async () => {
    const r = await confirmGate({
      payload: { name: "Acme", amount: 100 },
      confirmToken: "deadbeefdeadbeef",
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("rejected");
    if (r.phase === "rejected") expect(r.code).toBe("confirm_token_mismatch");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not call renderPreview during execute path", async () => {
    // The renderer is for the preview turn only. On confirm, we run
    // execute() — the renderer should not influence the execution.
    const renderSpy = vi.fn(renderPreview);
    execute.mockResolvedValueOnce({ id: "rec_1" });
    const payload = { name: "Acme", amount: 100 };

    await confirmGate({
      payload,
      confirmToken: computeConfirmToken(payload),
      renderPreview: renderSpy,
      execute,
      operationLabel: "create record",
    });
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("propagates execute() result unchanged in the executed phase", async () => {
    execute.mockResolvedValueOnce({
      ok: false,
      error: "upstream 500",
      code: "upstream_error",
    });
    const payload = { name: "Acme", amount: 100 };
    const r = await confirmGate({
      payload,
      confirmToken: computeConfirmToken(payload),
      renderPreview,
      execute,
      operationLabel: "create record",
    });
    expect(r.phase).toBe("executed");
    if (r.phase === "executed") {
      expect(r.result).toEqual({
        ok: false,
        error: "upstream 500",
        code: "upstream_error",
      });
    }
  });

  it("supports a custom formatPreview override", async () => {
    const r = await confirmGate({
      payload: { x: 1 },
      renderPreview: () => "body",
      execute,
      operationLabel: "x",
      formatPreview: ({ confirmToken }) => `TOKEN=${confirmToken}`,
    });
    expect(r.phase).toBe("preview");
    if (r.phase === "preview") {
      expect(r.previewMessage).toBe(`TOKEN=${r.confirmToken}`);
    }
  });
});
