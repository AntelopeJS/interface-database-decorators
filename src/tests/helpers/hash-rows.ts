export const PASSWORD = "correct horse battery staple";

const SCRYPT_SUITE_TIMEOUT_MS = 30_000;

/**
 * `describe` for tests that spend several scrypt runs. One run takes hundreds of
 * milliseconds on a busy machine, which passes mocha's 2 s limit in a few runs.
 */
export function scryptSuite(title: string, body: () => void) {
  describe(title, function () {
    this.timeout(SCRYPT_SUITE_TIMEOUT_MS);
    body();
  });
}

/** A row as `@Hashed()` stored it in the published 0.1.11: a bare salted SHA-256. */
export const ROW_FROM_0_1_11 = {
  _id: "row-from-0.1.11",
  email: "legacy@example.test",
  name: "Legacy",
  _internal: {
    meta: { HashModifier: { salt: "BMNyCHwpLNt2tkqkyB5rwOj1q2wfDIo6" } },
    data: { password: "nPamXXaKC8N+8W7xqxTSo8r+pS9jXMkjJu2XMZtUR+A=" },
  },
};

/**
 * A row as the published 0.1.11 stored `@Hashed({ algorithm: "sha256" })` on
 * `password` and `@Hashed({ algorithm: "md5" })` on `checksum`, set to `{ a: 1 }`.
 */
export const FINGERPRINT_ROW_FROM_0_1_11 = {
  _id: "fingerprint-from-0.1.11",
  _internal: {
    meta: { HashModifier: { salt: "lGSUI2bFDjUE9tTMDmgi4epfFNLsU0xY" } },
    data: {
      password: "UsoNNNsm8q4tIZffzzw9QX58b98ksdLC6JN+a1FN93g=",
      checksum: "NbsXtgSCNhwxQV/eBQ+LKA==",
    },
  },
};
