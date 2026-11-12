import { expect } from "chai";

import { API_PORT_VARIABLE, ApiPort } from "./helpers/api-port";

describe("ApiPort", () => {
  it("serves on 5010 when the variable is unset or empty", () => {
    expect(ApiPort({})).to.equal(5010);
    expect(ApiPort({ [API_PORT_VARIABLE]: "" })).to.equal(5010);
  });
  it("reads the port from the variable", () => {
    expect(ApiPort({ [API_PORT_VARIABLE]: "5011" })).to.equal(5011);
  });
  it("rejects a value that is not a port", () => {
    for (const raw of ["abc", "0", "65536", "50.1", " 5011", "-1"]) {
      expect(() => ApiPort({ [API_PORT_VARIABLE]: raw }), raw).to.throw(
        API_PORT_VARIABLE,
      );
    }
  });
});
