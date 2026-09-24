import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

export default antelopeKnipConfig({
  entry: [
    // `ajs module test` runs the compiled suites out of this tree, and reads
    // src/antelope.test.ts (package.json antelopeJs.test) to build the test
    // project; the preset only knows the `src/test/` spelling. The whole
    // compiled tree ships in the package, fixtures included, so the modules
    // implementing this interface can run it as their conformance suite — that
    // makes src/tests/codec_helpers.ts an outside-reachable surface of its own
    // rather than an internal module Knip can trace every export of.
    "src/tests/**/*.ts",
    "src/antelope.test.ts",
  ],
});
