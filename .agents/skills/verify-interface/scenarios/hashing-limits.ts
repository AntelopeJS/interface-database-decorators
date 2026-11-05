import { HASH_HELPERS } from "./hashing-format.ts";

export const LIMITS = `${HASH_HELPERS}
  const seed = async (id, password, extra = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } }, ...extra }).run();
  const cases = {
    cheap: [10, 8, 1], boundaryMemory: [17, 8, 1], tooMuchMemory: [18, 8, 1],
    parallelBoundary: [8, 8, 16], parallelTooMany: [8, 8, 17], costBelow16TimesR: [15, 1, 1],
  };
  const verdicts = {};
  for (const [name, [ln, r, p]] of Object.entries(cases)) {
    await seed(name, scryptString("pw", ln, r, p));
    const row = await accounts.get(name);
    verdicts[name] = [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")];
  }
  const sizes = { shortSalt: scryptString("pw", 8, 8, 1, 8, 32), longKey: scryptString("pw", 8, 8, 1, 16, 64), tooLongKey: scryptString("pw", 8, 8, 1, 16, 80), shortKey: scryptString("pw", 8, 8, 1, 16, 8), threeDigitP: scryptString("pw", 4, 1, 100) };
  for (const [name, stored] of Object.entries(sizes)) {
    await seed(name, stored);
    verdicts[name] = await (await accounts.get(name)).testHashAsync("password", "pw");
  }
  return verdicts;
`;

export const BOUNDS = `${HASH_HELPERS}
  const seed = async (id, password) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } } }).run();
  const attempt = async (id, stored) => {
    await seed(id, stored);
    const row = await accounts.get(id);
    try { return [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")]; } catch (error) { return "threw " + error.name; }
  };
  const fake = (ln, r, p) => "$" + "scrypt" + "$ln=" + ln + ",r=" + r + ",p=" + p + "$" + b64(Buffer.alloc(16, 1)) + "$" + b64(Buffer.alloc(32, 2));
  return {
    r1: await attempt("r1", scryptString("pw", 4, 1, 1)),
    r10: await attempt("r10", scryptString("pw", 4, 10, 1)),
    r99: await attempt("r99", scryptString("pw", 4, 99, 1)),
    r100: await attempt("r100", scryptString("pw", 4, 100, 1)),
    r0: await attempt("r0", fake(4, 0, 1)),
    ln0: await attempt("ln0", fake(0, 8, 1)),
    p0: await attempt("p0", fake(4, 8, 0)),
    p99: await attempt("p99", scryptString("pw", 4, 8, 99)),
    ln16r1: await attempt("ln16r1", fake(16, 1, 1)),
    salt65: await attempt("salt65", scryptString("pw", 4, 8, 1, 65, 32)),
    ln1: await attempt("ln1", scryptString("pw", 1, 8, 1)),
    ln2: await attempt("ln2", scryptString("pw", 2, 8, 1)),
    ln99: await attempt("ln99", fake(99, 8, 1)),
    ln100: await attempt("ln100", fake(100, 8, 1)),
    p1: await attempt("p1", scryptString("pw", 4, 8, 1)),
    p16: await attempt("p16", scryptString("pw", 4, 8, 16)),
    salt16: await attempt("salt16", scryptString("pw", 4, 8, 1, 16, 32)),
    salt64: await attempt("salt64", scryptString("pw", 4, 8, 1, 64, 32)),
    salt80: await attempt("salt80", scryptString("pw", 4, 8, 1, 80, 32)),
    salt15: await attempt("salt15", scryptString("pw", 4, 8, 1, 15, 32)),
    key16: await attempt("key16", scryptString("pw", 4, 8, 1, 16, 16)),
    key64: await attempt("key64", scryptString("pw", 4, 8, 1, 16, 64)),
    key15: await attempt("key15", scryptString("pw", 4, 8, 1, 16, 15)),
    key65: await attempt("key65", scryptString("pw", 4, 8, 1, 16, 65)),
  };
`;

export const MEMORY = `${HASH_HELPERS}
  const seed = async (id, password) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } } }).run();
  const attempt = async (id, stored) => {
    await seed(id, stored);
    const row = await accounts.get(id);
    try { return [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")]; } catch (error) { return "threw " + error.name; }
  };
  return {
    exactR64: await attempt("a", scryptString("pw", 14, 64, 1)),
    overR65: await attempt("b", scryptString("pw", 14, 65, 1)),
    exactR2: await attempt("c", scryptString("pw", 19, 2, 1)),
    underR3: await attempt("d", scryptString("pw", 18, 3, 1)),
    overR5: await attempt("e", scryptString("pw", 18, 5, 1)),
    overR9: await attempt("f", scryptString("pw", 17, 9, 1)),
  };
`;

export const SYNC_ASYNC = `${HASH_HELPERS}
  const seedRow = async (id, data, meta = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta, data } }).run();
  await seedRow("legacy", { password: digest("sha256", "old-salt", "hunter2") }, { HashModifier: { salt: "old-salt" } });
  await seedRow("lowcost", { password: scryptString("hunter2", 10, 8, 1) });
  await seedRow("junk", { password: "plain text" });
  await seedRow("empty", {});
  await seedRow("digest", { pin: digest("sha256", "pin-salt", "hunter2") }, { HashModifier: { salt: "pin-salt" } });
  await seedRow("scryptOnDigest", { pin: scryptString("hunter2", 10, 8, 1) });
  const [fresh] = await accounts.insert({ name: "fresh", password: "hunter2", pin: "hunter2" });
  const matrix = {};
  for (const [id, field] of [[fresh, "password"], [fresh, "pin"], ["legacy", "password"], ["lowcost", "password"], ["junk", "password"], ["empty", "password"], ["digest", "pin"], ["scryptOnDigest", "pin"]]) {
    const row = await accounts.get(id);
    const answers = [];
    for (const candidate of ["hunter2", "wrong", ""]) {
      const sync = row.testHash(field, candidate);
      const asynchronous = await row.testHashAsync(field, candidate);
      answers.push([sync, asynchronous, sync === asynchronous]);
    }
    matrix[(id === fresh ? "fresh" : id) + ":" + field] = answers;
  }
  return matrix;
`;

export const COST = `${HASH_HELPERS}
  const seedRow = async (id, data, meta = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta, data } }).run();
  await seedRow("junk", { password: "plain text" });
  await seedRow("empty", {});
  await seedRow("digest", { pin: digest("sha256", "pin-salt", "hunter2") }, { HashModifier: { salt: "pin-salt" } });
  const [fresh] = await accounts.insert({ name: "fresh", password: "hunter2" });
  const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const timed = async (id, field) => { const row = await accounts.get(id); const runs = []; for (let i = 0; i < 3; i += 1) { const start = process.hrtime.bigint(); await row.testHashAsync(field, "wrong"); runs.push(Number(process.hrtime.bigint() - start) / 1e6); } return median(runs); };
  const timedSync = async (id, field) => { const row = await accounts.get(id); const runs = []; for (let i = 0; i < 3; i += 1) { const start = process.hrtime.bigint(); const answer = row.testHash(field, "wrong"); runs.push(answer === false ? Number(process.hrtime.bigint() - start) / 1e6 : -1); } return median(runs); };
  const allPass = (value) => Object.values(value).every((entry) => (Array.isArray(entry) ? entry.every(Boolean) : Boolean(entry)));
  const measure = async () => {
    const hashed = await timed(fresh, "password");
    const empty = await timed("empty", "password");
    const junk = await timed("junk", "password");
    const digest = await timed("digest", "pin");
    const syncHashed = await timedSync(fresh, "password");
    const syncEmpty = await timedSync("empty", "password");
    const syncJunk = await timedSync("junk", "password");
    const syncDigest = await timedSync("digest", "pin");
    return { emptyVsHashed: empty / hashed >= 0.5, junkVsHashed: junk / hashed >= 0.5, digestCheaper: digest / hashed < 0.5, syncSpendsOneRun: [syncHashed / hashed >= 0.5, syncEmpty / hashed >= 0.5, syncJunk / hashed >= 0.5], syncDigestCheaper: syncDigest / hashed < 0.5 };
  };
  let cost = await measure();
  for (let attempt = 0; attempt < 2 && !allPass(cost); attempt += 1) cost = await measure();
  const row = await accounts.get(fresh);
  const loopTicks = async (work) => { let ticks = 0; const timer = setInterval(() => { ticks += 1; }, 1); try { await work(); } finally { clearInterval(timer); } return ticks; };
  let asyncTicks = 0;
  for (let attempt = 0; attempt < 3 && asyncTicks <= 2; attempt += 1) asyncTicks = await loopTicks(() => row.testHashAsync("password", "hunter2"));
  return { ...cost, asyncKeepsLoopRunning: asyncTicks > 2 };
`;
