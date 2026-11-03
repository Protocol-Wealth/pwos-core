// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  CredentialBindingError,
  WorkspaceMismatchError,
  assertWorkspace,
  assertWorkspaceFromEnv,
  fingerprintCredential,
} from "../src/zdrAssertion.js";

const ENROLLED_KEY = "synthetic-enrolled-key";
const ROTATED_KEY = "synthetic-rotated-key";

describe("assertWorkspace", () => {
  it("returns ok on match as a configuration assertion, not verified retention", () => {
    const r = assertWorkspace({ expected: "ws_zdr", actual: "ws_zdr" });
    expect(r.ok).toBe(true);
    expect(r.posture).toBe("block");
    expect(r.assurance).toBe("configuration");
    expect(r.retentionVerified).toBe(false);
    expect(r.credentialFingerprint).toBe("not-provided");
    expect(r.message.toLowerCase()).not.toContain("retention policy was verified");
  });

  it("throws WorkspaceMismatchError on mismatch with default posture", () => {
    expect(() =>
      assertWorkspace({ expected: "ws_zdr", actual: "ws_other" })
    ).toThrow(WorkspaceMismatchError);
  });

  it("throws when actual is undefined", () => {
    expect(() =>
      assertWorkspace({ expected: "ws_zdr", actual: undefined })
    ).toThrow(/expected "ws_zdr", got "<unset>"/);
  });

  it("returns ok:false in warn posture instead of throwing", () => {
    const r = assertWorkspace({
      expected: "ws_zdr",
      actual: "ws_other",
      posture: "warn",
    });
    expect(r.ok).toBe(false);
    expect(r.posture).toBe("warn");
    expect(r.message).toContain("ws_other");
  });
});

describe("credential binding", () => {
  it("does not treat a changed signing credential as retention compliance when workspace config is unchanged", () => {
    const allowed = fingerprintCredential(ENROLLED_KEY);
    const rotated = fingerprintCredential(ROTATED_KEY);
    expect(rotated).not.toBe(allowed);

    let thrown: unknown;
    try {
      assertWorkspace({
        expected: "ws_zdr",
        actual: "ws_zdr",
        credential: { source: "env:SYNTHETIC_API_KEY", fingerprint: rotated },
        allowedCredentialFingerprints: [allowed],
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CredentialBindingError);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).not.toContain(ENROLLED_KEY);
    expect(message).not.toContain(ROTATED_KEY);
    expect(message).not.toContain(rotated);
    expect(message.toLowerCase()).not.toContain("retention compliance verified");
  });

  it("passes a matching fingerprint without claiming the provider verified retention", () => {
    const fingerprint = fingerprintCredential(ENROLLED_KEY);
    const r = assertWorkspace({
      expected: "ws_zdr",
      actual: "ws_zdr",
      credential: { source: "env:SYNTHETIC_API_KEY", fingerprint },
      allowedCredentialFingerprints: [fingerprint],
    });
    expect(r.ok).toBe(true);
    expect(r.assurance).toBe("configuration-and-credential");
    expect(r.retentionVerified).toBe(false);
    expect(r.credentialFingerprint).toBe("allowed");
    expect(r.message).not.toContain(ENROLLED_KEY);
  });

  it("leaves an unbound credential unchecked instead of marking it allowed", () => {
    const r = assertWorkspace({
      expected: "ws_zdr",
      actual: "ws_zdr",
      credential: {
        source: "env:SYNTHETIC_API_KEY",
        fingerprint: fingerprintCredential(ROTATED_KEY),
      },
    });
    expect(r.ok).toBe(true);
    expect(r.assurance).toBe("configuration");
    expect(r.retentionVerified).toBe(false);
    expect(r.credentialFingerprint).toBe("unchecked");
  });

  it("fails closed when an allowlist is set and no credential is supplied", () => {
    expect(() =>
      assertWorkspace({
        expected: "ws_zdr",
        actual: "ws_zdr",
        allowedCredentialFingerprints: [],
      }),
    ).toThrow(CredentialBindingError);
  });

  it("returns ok:false in warn posture when the fingerprint is not listed", () => {
    const r = assertWorkspace({
      expected: "ws_zdr",
      actual: "ws_zdr",
      posture: "warn",
      credential: {
        source: "env:SYNTHETIC_API_KEY",
        fingerprint: fingerprintCredential(ROTATED_KEY),
      },
      allowedCredentialFingerprints: [fingerprintCredential(ENROLLED_KEY)],
    });
    expect(r.ok).toBe(false);
    expect(r.posture).toBe("warn");
    expect(r.retentionVerified).toBe(false);
    expect(r.credentialFingerprint).toBe("rejected");
    expect(r.assurance).toBe("configuration");
  });
});

describe("assertWorkspaceFromEnv", () => {
  it("reads from process.env on success", () => {
    const key = "PWOS_TEST_WORKSPACE_ID_OK";
    process.env[key] = "ws_zdr";
    try {
      const r = assertWorkspaceFromEnv("ws_zdr", key);
      expect(r.ok).toBe(true);
    } finally {
      delete process.env[key];
    }
  });

  it("throws when env is unset", () => {
    const key = "PWOS_TEST_WORKSPACE_ID_UNSET";
    delete process.env[key];
    expect(() => assertWorkspaceFromEnv("ws_zdr", key)).toThrow(
      WorkspaceMismatchError
    );
  });

  it("rejects a rotated credential while the workspace env value is unchanged", () => {
    const key = "PWOS_TEST_WORKSPACE_ID_ROTATED_KEY";
    process.env[key] = "ws_zdr";
    try {
      expect(() =>
        assertWorkspaceFromEnv("ws_zdr", key, "block", {
          credential: {
            source: "env:SYNTHETIC_API_KEY",
            fingerprint: fingerprintCredential(ROTATED_KEY),
          },
          allowedCredentialFingerprints: [fingerprintCredential(ENROLLED_KEY)],
        }),
      ).toThrow(CredentialBindingError);
    } finally {
      delete process.env[key];
    }
  });
});
