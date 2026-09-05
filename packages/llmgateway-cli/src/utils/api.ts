import prompts from "prompts";
import { logger } from "./logger.js";
import {
  getApiUrl,
  getConfig,
  getDashboardUrl,
  sessionHeaders,
} from "./config.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Node's fetch sends `Origin: null` on POST, which Better Auth's CSRF
 * check rejects — so we send the matching dashboard origin instead.
 */
async function getTrustedOrigin(apiUrl: string): Promise<string> {
  if (process.env.LLMGATEWAY_ORIGIN_URL) {
    return new URL(await getDashboardUrl()).origin;
  }
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname) &&
    !(await getConfig()).dashboardUrl
  ) {
    return "http://localhost:3002";
  }
  return new URL(await getDashboardUrl()).origin;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    return JSON.stringify(data);
  } catch {
    return response.statusText || `Request failed (${response.status})`;
  }
}

/**
 * Call a management API endpoint using the stored session cookie.
 * Exits with a hint to run `auth login` when not authenticated.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = await sessionHeaders();

  if (Object.keys(headers).length === 0) {
    throw new ApiError(
      401,
      "Not signed in. Run `llmgateway auth login` to authenticate in your browser.",
    );
  }

  const apiUrl = await getApiUrl();
  const url = new URL(apiUrl + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...headers,
      Origin: await getTrustedOrigin(apiUrl),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });

  if (response.status === 401) {
    throw new ApiError(
      401,
      "Session expired or invalid. Run `llmgateway auth login` to sign in again.",
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

/**
 * Sign in with email & password against the Better Auth endpoint and
 * return the session cookie to persist.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ cookie: string; user: { email: string; name?: string | null } }> {
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: await getTrustedOrigin(apiUrl),
    },
    body: JSON.stringify({ email, password }),
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  const setCookies = response.headers.getSetCookie();
  const sessionCookie = setCookies
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair.includes("session_token"))
    .join("; ");

  if (!sessionCookie) {
    throw new ApiError(
      500,
      "Sign-in succeeded but no session cookie was returned.",
    );
  }

  const data = (await response.json()) as {
    user: { email: string; name?: string | null };
  };

  return { cookie: sessionCookie, user: data.user };
}

/**
 * Validate the stored session and return the current user, or null.
 */
export async function getSessionUser(): Promise<{
  email: string;
  name?: string | null;
} | null> {
  const headers = await sessionHeaders();
  if (Object.keys(headers).length === 0) {
    return null;
  }

  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/auth/get-session`, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });

  if (response.status === 401) return null;
  if (!response.ok)
    throw new ApiError(response.status, await extractErrorMessage(response));

  const data = (await response.json()) as {
    user?: { email: string; name?: string | null };
  } | null;

  return data?.user ?? null;
}

export interface Organization {
  id: string;
  name: string;
  credits: string;
  plan: string;
  isPersonal?: boolean;
}

export interface Project {
  id: string;
  name: string;
  organizationId: string;
  mode?: string;
}

export async function listOrganizations(): Promise<Organization[]> {
  const data = await apiRequest<{ organizations: Organization[] }>("/orgs");
  return data.organizations;
}

export async function listProjects(orgId: string): Promise<Project[]> {
  const data = await apiRequest<{ projects: Project[] }>(
    `/orgs/${encodeURIComponent(orgId)}/projects`,
  );
  return data.projects;
}

export async function resolveOrgId(explicit?: string): Promise<string> {
  const id = explicit ?? (await getConfig()).defaultOrgId;
  const orgs = await listOrganizations();
  if (id) {
    const matches = orgs.filter((org) => org.id === id || org.name === id);
    if (matches.length !== 1)
      throw new Error(
        `Organization "${id}" was not found or is ambiguous. Use its ID.`,
      );
    return matches[0].id;
  }
  if (orgs.length === 1) return orgs[0].id;
  if (!process.stdin.isTTY)
    throw new Error("Specify --org <id> or run `llmgateway orgs use <id>`.");
  if (!orgs.length) throw new Error("No organizations found for this account.");
  const answer = await prompts({
    type: "select",
    name: "org",
    message: "Select an organization:",
    choices: orgs.map((org) => ({ title: org.name, value: org.id })),
  });
  if (!answer.org) throw new Error("Organization selection cancelled.");
  return answer.org;
}

/**
 * Resolve a project id: explicit option > configured default >
 * interactive picker across the user's orgs.
 */
export async function resolveProjectId(
  explicit?: string,
  { interactive = true }: { interactive?: boolean } = {},
): Promise<string> {
  if (explicit) {
    return explicit;
  }

  const config = await getConfig();
  if (config.defaultProjectId) {
    return config.defaultProjectId;
  }

  if (!interactive) {
    logger.error(
      "No project specified. Pass --project <id> or set a default with `llmgateway projects use <id>`.",
    );
    process.exit(1);
  }

  const orgId = await resolveOrgId();

  const projects = await listProjects(orgId);
  if (projects.length === 0) {
    logger.error("No projects found in this organization.");
    process.exit(1);
  }
  if (projects.length === 1) {
    return projects[0].id;
  }

  if (!process.stdin.isTTY)
    throw new Error(
      "Specify --project <id> or set a default with llmgateway projects use <id>.",
    );
  const projectAnswer = await prompts({
    type: "select",
    name: "projectId",
    message: "Select a project:",
    choices: projects.map((project) => ({
      title: project.name,
      value: project.id,
    })),
  });
  if (!projectAnswer.projectId) {
    process.exit(1);
  }
  return projectAnswer.projectId;
}

/**
 * Wrap a command action so ApiErrors print cleanly instead of stack traces.
 */
export function withApiErrors<A extends unknown[]>(
  action: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await action(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  };
}
