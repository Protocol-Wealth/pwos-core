// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConfirmGateConfigError,
  InMemoryConfirmTokenStore,
  confirmGate,
  formatPreviewMessage,
  issueConfirmToken,
  stableJsonString,
  type ConfirmAuthorization,
  type ConfirmGateOutcome,
} from "../src/index.js";

const SECRET = "synthetic-confirm-secret-not-a-real-key";
const FIXED_NOW = 1_700_000_000_000;

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

describe("formatPreviewMessage", () => {
  it("includes label, body, and confirm_token", () => {
    const msg = formatPreviewMessage({
      operationLabel: "create record",
      previewBody: 'Will create "Acme" with amount 100.',
      confirmToken: "abcd1234abcd1234",
      expiresAtMs: Date.parse("2026-01-01T00:00:00.000Z"),
    });
    expect(msg).toContain("Preview — create record");
    expect(msg).toContain('Will create "Acme" with amount 100.');
    expect(msg).toContain('confirm_token: "abcd1234abcd1234"');
    expect(msg).toContain("2026-01-01T00:00:00.000Z");
    expect(msg).toContain("used once");
  });
});

describe("confirmGate", () => {
  const renderPreview = (p: { name: string; amount: number }): string =>
    `Will create record "${p.name}" with amount ${p.amount}.`;
  const execute = vi.fn();
  let store: InMemoryConfirmTokenStore;
  let now = FIXED_NOW;

  function authorization(overrides: Partial<ConfirmAuthorization> = {}): ConfirmAuthorization {
    return {
      secret: SECRET,
      principalId: "principal_synthetic",
      store,
      ttlMs: 60_000,
      now: () => now,
      ...overrides,
    };
  }

  beforeEach(() => {
    execute.mockReset();
    store = new InMemoryConfirmTokenStore();
    now = FIXED_NOW;
  });

  async function preview(payload: { name: string; amount: number } = { name: "Acme", amount: 100 }) {
    const outcome = await confirmGate({
      payload,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(outcome.phase).toBe("preview");
    return outcome as Extract<ConfirmGateOutcome<unknown>, { phase: "preview" }>;
  }

  it("returns preview phase + token on first call (no execute)", async () => {
    const payload = { name: "Acme", amount: 100 };
    const r = await preview(payload);
    expect(r.previewMessage).toContain("Preview — create record");
    expect(r.previewMessage).toContain('"Acme"');
    expect(r.previewMessage).toContain("amount 100");
    expect(r.confirmToken.startsWith("v1.")).toBe(true);
    expect(r.previewMessage).toContain(`confirm_token: "${r.confirmToken}"`);
    expect(r.expiresAtMs).toBe(FIXED_NOW + 60_000);
    expect(r.confirmToken).not.toContain(SECRET);
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes when the issued token and the same payload are presented", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    execute.mockResolvedValueOnce({ id: "rec_1" });

    const r = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(r.phase).toBe("executed");
    if (r.phase === "executed") expect(r.result).toEqual({ id: "rec_1" });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(payload);
  });

  it("executes when payload key order differs from the preview turn", async () => {
    const issued = await preview({ name: "Acme", amount: 100 });
    execute.mockResolvedValueOnce({ id: "rec_1" });

    const r = await confirmGate({
      payload: { amount: 100, name: "Acme" },
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(r.phase).toBe("executed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects when the payload changed between preview and confirm", async () => {
    const issued = await preview({ name: "Acme", amount: 100 });
    const r = await confirmGate({
      payload: { name: "Acme", amount: 999 },
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(r.phase).toBe("rejected");
    if (r.phase === "rejected") expect(r.code).toBe("confirm_token_mismatch");
    expect(execute).not.toHaveBeenCalled();

    execute.mockResolvedValueOnce({ id: "rec_1" });
    const retry = await confirmGate({
      payload: { name: "Acme", amount: 100 },
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(retry.phase).toBe("executed");
  });

  it("rejects a fabricated token and an unkeyed payload hash without previewing", async () => {
    const payload = { operation: "synthetic", value: 1 };
    const callerComputed = createHash("sha256")
      .update(stableJsonString(payload))
      .digest("hex")
      .slice(0, 16);
    const renderSpy = vi.fn(() => {
      throw new Error("preview never requested");
    });
    const run = (confirmToken: string) =>
      confirmGate({
        payload,
        confirmToken,
        operationLabel: "synthetic",
        authorization: authorization(),
        renderPreview: renderSpy,
        execute,
      });

    const legacy = await run(callerComputed);
    const again = await run(callerComputed);
    const garbage = await run("deadbeefdeadbeef");
    expect(legacy.phase).toBe("rejected");
    expect(again.phase).toBe("rejected");
    expect(garbage.phase).toBe("rejected");
    if (legacy.phase === "rejected") expect(legacy.code).toBe("confirm_token_mismatch");
    expect(execute).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different secret without consuming the real one", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    const other = issueConfirmToken({
      payload,
      operation: "create record",
      principalId: "principal_synthetic",
      secret: "synthetic-other-secret",
      expiresAtMs: FIXED_NOW + 60_000,
      jti: "not-the-issued-jti",
    });

    const mismatch = await confirmGate({
      payload,
      confirmToken: other.token,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(mismatch.phase).toBe("rejected");
    if (mismatch.phase === "rejected") expect(mismatch.code).toBe("confirm_token_mismatch");

    execute.mockResolvedValueOnce({ id: "rec_1" });
    const ok = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(ok.phase).toBe("executed");
  });

  it("rejects cross-operation and cross-principal reuse", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);

    const otherOperation = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "delete record",
      authorization: authorization(),
    });
    const otherPrincipal = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization({ principalId: "principal_other" }),
    });
    expect(otherOperation.phase).toBe("rejected");
    expect(otherPrincipal.phase).toBe("rejected");
    if (otherOperation.phase === "rejected") {
      expect(otherOperation.code).toBe("confirm_token_mismatch");
    }
    expect(execute).not.toHaveBeenCalled();

    execute.mockResolvedValueOnce({ id: "rec_1" });
    const ok = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(ok.phase).toBe("executed");
  });

  it("rejects an expired token and does not execute", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await confirmGate({
      payload,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization({ ttlMs: 1_000 }),
    });
    expect(issued.phase).toBe("preview");
    if (issued.phase !== "preview") return;
    now = FIXED_NOW + 1_000;

    const r = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization({ ttlMs: 1_000 }),
    });
    expect(r.phase).toBe("rejected");
    if (r.phase === "rejected") expect(r.code).toBe("confirm_token_expired");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a second use of the same token", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    execute.mockResolvedValue({ id: "rec_1" });

    const first = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    const second = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(first.phase).toBe("executed");
    expect(second.phase).toBe("rejected");
    if (second.phase === "rejected") expect(second.code).toBe("confirm_token_replayed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("consumes a token once when two confirmations race", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    execute.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: "rec_1" };
    });

    const [a, b] = await Promise.all([
      confirmGate({
        payload,
        confirmToken: issued.confirmToken,
        renderPreview,
        execute,
        operationLabel: "create record",
        authorization: authorization(),
      }),
      confirmGate({
        payload,
        confirmToken: issued.confirmToken,
        renderPreview,
        execute,
        operationLabel: "create record",
        authorization: authorization(),
      }),
    ]);
    const phases = [a.phase, b.phase].sort();
    expect(phases).toEqual(["executed", "rejected"]);
    const rejected = a.phase === "rejected" ? a : b;
    if (rejected.phase === "rejected") expect(rejected.code).toBe("confirm_token_replayed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects a signed token that was never issued into the store", async () => {
    const payload = { name: "Acme", amount: 100 };
    const forged = issueConfirmToken({
      payload,
      operation: "create record",
      principalId: "principal_synthetic",
      secret: SECRET,
      expiresAtMs: FIXED_NOW + 60_000,
    });
    const r = await confirmGate({
      payload,
      confirmToken: forged.token,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(r.phase).toBe("rejected");
    if (r.phase === "rejected") expect(r.code).toBe("confirm_token_not_issued");
    expect(execute).not.toHaveBeenCalled();
  });

  it("spends the token when execute fails so the same token cannot retry", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    execute.mockRejectedValueOnce(new Error("upstream down"));
    await expect(
      confirmGate({
        payload,
        confirmToken: issued.confirmToken,
        renderPreview,
        execute,
        operationLabel: "create record",
        authorization: authorization(),
      }),
    ).rejects.toThrow("upstream down");

    execute.mockResolvedValueOnce({ id: "rec_1" });
    const retry = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(retry.phase).toBe("rejected");
    if (retry.phase === "rejected") expect(retry.code).toBe("confirm_token_replayed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not call renderPreview during the execute path", async () => {
    const renderSpy = vi.fn(renderPreview);
    const payload = { name: "Acme", amount: 100 };
    const issued = await confirmGate({
      payload,
      renderPreview: renderSpy,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(issued.phase).toBe("preview");
    renderSpy.mockClear();
    execute.mockResolvedValueOnce({ id: "rec_1" });
    if (issued.phase !== "preview") return;

    await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview: renderSpy,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
    });
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("propagates execute() result unchanged in the executed phase", async () => {
    const payload = { name: "Acme", amount: 100 };
    const issued = await preview(payload);
    execute.mockResolvedValueOnce({
      ok: false,
      error: "upstream 500",
      code: "upstream_error",
    });
    const r = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization(),
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
      authorization: authorization(),
      formatPreview: ({ confirmToken }) => `TOKEN=${confirmToken}`,
    });
    expect(r.phase).toBe("preview");
    if (r.phase === "preview") {
      expect(r.previewMessage).toBe(`TOKEN=${r.confirmToken}`);
    }
  });

  it("refuses to issue a token without a secret or a positive ttl", async () => {
    await expect(
      confirmGate({
        payload: { name: "Acme", amount: 100 },
        renderPreview,
        execute,
        operationLabel: "create record",
        authorization: authorization({ secret: "" }),
      }),
    ).rejects.toBeInstanceOf(ConfirmGateConfigError);
    await expect(
      confirmGate({
        payload: { name: "Acme", amount: 100 },
        renderPreview,
        execute,
        operationLabel: "create record",
        authorization: authorization({ ttlMs: 0 }),
      }),
    ).rejects.toBeInstanceOf(ConfirmGateConfigError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("accepts a Buffer secret", async () => {
    const payload = { name: "Acme", amount: 100 };
    const secret = Buffer.from(SECRET);
    const issued = await confirmGate({
      payload,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization({ secret }),
    });
    expect(issued.phase).toBe("preview");
    if (issued.phase !== "preview") return;
    execute.mockResolvedValueOnce({ id: "rec_1" });
    const r = await confirmGate({
      payload,
      confirmToken: issued.confirmToken,
      renderPreview,
      execute,
      operationLabel: "create record",
      authorization: authorization({ secret }),
    });
    expect(r.phase).toBe("executed");
  });
});
