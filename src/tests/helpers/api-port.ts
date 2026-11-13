/** The environment variable that sets the port the `@antelopejs/api` module serves the model tests on. */
export const API_PORT_VARIABLE = "DECORATORS_TEST_API_PORT";

const DEFAULT_API_PORT = 5010;
const MAX_PORT = 65_535;

/**
 * The port the model tests fetch their routes from: `DECORATORS_TEST_API_PORT`, or 5010 when it is
 * unset or empty. A backend serves `@antelopejs/api` on this port, so two suites on one machine run
 * side by side when each sets its own.
 *
 * @throws When the variable is set to anything but a port number from 1 to 65535.
 */
export function ApiPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[API_PORT_VARIABLE];
  if (raw === undefined || raw === "") {
    return DEFAULT_API_PORT;
  }
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > MAX_PORT) {
    throw new Error(
      `${API_PORT_VARIABLE} must be a port from 1 to ${MAX_PORT}, got "${raw}"`,
    );
  }
  return port;
}
