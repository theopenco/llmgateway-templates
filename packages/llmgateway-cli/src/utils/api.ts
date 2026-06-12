import prompts from "prompts";
import { logger, highlight, dim } from "./logger.js";
import { getApiUrl, getConfig } from "./config.js";

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
function getTrustedOrigin(apiUrl: string): string {
  if (process.env.LLMGATEWAY_ORIGIN_URL) {
    return process.env.LLMGATEWAY_ORIGIN_URL;
  }
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return "http://localhost:3002";
  }
  return "https://llmgateway.io";
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
  const config = await getConfig();

  if (!config.sessionCookie) {
    logger.error("Not signed in to LLM Gateway.");
    logger.log(
      dim(
        `Run ${highlight("llmgateway auth login")} and sign in with email & password.`,
      ),
    );
    logger.log(
      dim(
        "Key management and usage commands need a dashboard session (an API key is not enough).",
      ),
    );
    process.exit(1);
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
      Cookie: config.sessionCookie,
      Origin: getTrustedOrigin(apiUrl),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    logger.error("Session expired or invalid.");
    logger.log(
      dim(`Run ${highlight("llmgateway auth login")} to sign in again.`),
    );
    process.exit(1);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  return (await response.json()) as T;
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
      Origin: getTrustedOrigin(apiUrl),
    },
    body: JSON.stringify({ email, password }),
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
  const config = await getConfig();
  if (!config.sessionCookie) {
    return null;
  }

  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/auth/get-session`, {
    headers: { Cookie: config.sessionCookie },
  });

  if (!response.ok) {
    return null;
  }

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
    `/orgs/${orgId}/projects`,
  );
  return data.projects;
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

  const orgs = await listOrganizations();
  if (orgs.length === 0) {
    logger.error("No organizations found for this account.");
    process.exit(1);
  }

  let orgId = orgs[0].id;
  if (orgs.length > 1) {
    const orgAnswer = await prompts({
      type: "select",
      name: "orgId",
      message: "Select an organization:",
      choices: orgs.map((org) => ({
        title: `${org.name} ${org.isPersonal ? "(personal)" : ""}`.trim(),
        value: org.id,
      })),
    });
    if (!orgAnswer.orgId) {
      process.exit(1);
    }
    orgId = orgAnswer.orgId;
  }

  const projects = await listProjects(orgId);
  if (projects.length === 0) {
    logger.error("No projects found in this organization.");
    process.exit(1);
  }
  if (projects.length === 1) {
    return projects[0].id;
  }

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
