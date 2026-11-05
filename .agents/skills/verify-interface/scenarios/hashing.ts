import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";
import { DIGEST, OUTDATED, STORAGE, UPGRADE, VERIFY } from "./hashing-format.ts";
import { BOUNDS, COST, LIMITS, MEMORY, SYNC_ASYNC } from "./hashing-limits.ts";

export const HASH_JOURNEYS = {
  "hash-storage": scenario({
    title: "a hashed field stores a salted scrypt hash of the JSON-encoded value",
    body: STORAGE,
    printed: "{\"format\":[true,16,32,false,false],\"hashesTheJsonText\":true,\"plaintextAbsent\":true,\"freshSaltEachWrite\":true,\"lockKeepsTheHash\":true,\"assigningTheStoredHashKeepsIt\":true,\"undefinedStoresNothing\":true}",
    stored: [{ name: "the stored hash", expression: "$DB.getCollection('hash__accounts').find({ name: 'Ann' }).toArray().map((r) => [Object.keys(r._internal.data), /^\\$scrypt\\$ln=15,r=8,p=3\\$[A-Za-z0-9+/]{22}\\$[A-Za-z0-9+/]{43}$/.test(r._internal.data.password)])", expected: "[[[\"password\"],true]]" }],
  }),
  "hash-verify": scenario({ title: "testHash, testHashAsync and isHashOutdated answer for a hashed field and refuse another", body: VERIFY, printed: "{\"asyncRight\":true,\"asyncWrong\":false,\"syncRight\":[\"boolean\",true],\"syncWrong\":false,\"fresh\":false,\"notHashedAsync\":\"Field name is not hashed\",\"notHashedOutdated\":\"Field name is not hashed\",\"nothingStored\":[false,false]}" }),
  "hash-limits": scenario({ title: "a stored scrypt string verifies only inside the documented limits", body: LIMITS, printed: "{\"cheap\":[true,false],\"boundaryMemory\":[true,false],\"tooMuchMemory\":[false,false],\"parallelBoundary\":[true,false],\"parallelTooMany\":[false,false],\"costBelow16TimesR\":[true,false],\"shortSalt\":false,\"longKey\":true,\"tooLongKey\":false,\"shortKey\":false,\"threeDigitP\":false}" }),
  "hash-upgrade": scenario({
    title: "older hash formats still verify, are flagged, and are rewritten by assigning the tested value",
    body: UPGRADE,
    printed: "{\"before\":[true,true,true,true],\"wrongLegacy\":false,\"afterRewrite\":[true,false,true],\"keptByNameUpdate\":true,\"keptByObjectUpdate\":true,\"viaUpdate\":true}",
  }),
  "hash-bounds": scenario({ title: "a stored scrypt string verifies at each edge of the documented ranges and is refused just outside", body: BOUNDS, printed: "{\"r1\":[true,false],\"r10\":[true,false],\"r99\":[true,false],\"r100\":[false,false],\"r0\":[false,false],\"ln0\":[false,false],\"p0\":[false,false],\"p99\":[false,false],\"ln16r1\":[false,false],\"salt65\":[false,false],\"ln1\":[true,false],\"ln2\":[true,false],\"ln99\":[false,false],\"ln100\":[false,false],\"p1\":[true,false],\"p16\":[true,false],\"salt16\":[true,false],\"salt64\":[true,false],\"salt80\":[false,false],\"salt15\":[false,false],\"key16\":[true,false],\"key64\":[true,false],\"key15\":[false,false],\"key65\":[false,false]}" }),
  "hash-memory": scenario({ title: "a stored scrypt string verifies up to 128 MiB of memory (128 x N x r) and is refused above it", body: MEMORY, printed: "{\"exactR64\":[true,false],\"overR65\":[false,false],\"exactR2\":[true,false],\"underR3\":[true,false],\"overR5\":[false,false],\"overR9\":[false,false]}" }),
  "hash-sync-async": scenario({ title: "testHash answers exactly what testHashAsync answers, for every kind of stored value", body: SYNC_ASYNC, printed: "{\"fresh:password\":[[true,true,true],[false,false,true],[false,false,true]],\"fresh:pin\":[[true,true,true],[false,false,true],[false,false,true]],\"legacy:password\":[[true,true,true],[false,false,true],[false,false,true]],\"lowcost:password\":[[true,true,true],[false,false,true],[false,false,true]],\"junk:password\":[[false,false,true],[false,false,true],[false,false,true]],\"empty:password\":[[false,false,true],[false,false,true],[false,false,true]],\"digest:pin\":[[true,true,true],[false,false,true],[false,false,true]],\"scryptOnDigest:pin\":[[true,true,true],[false,false,true],[false,false,true]]}" }),
  "hash-cost": scenario({ title: "a test spends one scrypt run whatever the row holds, a digest field spends none, testHashAsync leaves the event loop running and testHash spends the scrypt run inside the call, none for a digest", body: COST, printed: "{\"emptyVsHashed\":true,\"junkVsHashed\":true,\"digestCheaper\":true,\"syncSpendsOneRun\":[true,true,true],\"syncDigestCheaper\":true,\"asyncKeepsLoopRunning\":true}" }),
  "hash-outdated": scenario({ title: "isHashOutdated flags any scrypt string whose ln, r or p differs from the current cost", body: OUTDATED, printed: "{\"fresh\":[true,false],\"sameCost\":[true,false],\"lowerP\":[true,true],\"higherR\":[true,true],\"lowerLn\":[true,true],\"notScrypt\":[false,true]}" }),
  "hash-digest": scenario({ title: "a field with an algorithm stores a salted digest with the row's shared salt", body: DIGEST, printed: "{\"algorithms\":[true,true,false,88,24],\"others\":[true,true],\"algorithmTests\":[true,true,false],\"wrongDigest\":false,\"storedDigest\":true,\"sharedSalt\":true,\"saltIsText\":true,\"freshSaltPerRow\":true,\"saltReusedOnLaterWrite\":[true,true],\"testDigest\":[true,false,true],\"digestNeverOutdated\":false,\"scryptOnDigestField\":[true,false],\"otherDigestRefused\":false}" }),
} satisfies { [id: string]: Journey };
