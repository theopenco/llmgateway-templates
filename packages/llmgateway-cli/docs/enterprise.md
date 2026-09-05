# Enterprise deployment contract

The CLI uses three independent service URLs: the management API (`LLMGATEWAY_API_URL`), dashboard (`LLMGATEWAY_ORIGIN_URL`), and inference gateway (`LLMGATEWAY_GATEWAY_URL`, without `/v1`). Browser login saves the URLs passed with `--api-url`, `--dashboard-url`, and `--gateway-url`. HTTPS is required except for loopback development servers.

## Browser authentication

Deploy the companion LLM Gateway device authorization integration before using browser login. It adds Better Auth's `deviceAuthorization` and `bearer` plugins, the `device_code` database table and generated migration, and the dashboard's `/connect/device` approval page. Deploy the migration before the API and dashboard. SSO uses the existing dashboard SAML/SSO configuration; no CLI client secret is needed.

The CLI is a first-party client with ID `llmgateway-cli`:

1. `POST /auth/device/code` with JSON `{ "client_id": "llmgateway-cli" }` returns `device_code`, `user_code`, `verification_uri`, optional `verification_uri_complete`, `expires_in`, and `interval` (seconds).
2. The user signs into the configured dashboard and explicitly approves the matching terminal code. The CLI rejects verification URLs outside that dashboard's origin. `--sso [email]` opens `/sso` with a relative `redirect` back to the approval page.
3. `POST /auth/device/token` with `client_id`, `device_code`, and `grant_type: "urn:ietf:params:oauth:grant-type:device_code"` returns an `access_token` after approval. Pending responses use `authorization_pending`; the CLI backs off on `slow_down` or HTTP 429 and stops on denial or expiry.
4. `GET /auth/get-session` accepts `Authorization: Bearer <access_token>` and returns the authenticated user. The CLI verifies this response before saving any credential.
5. Management routes accept that bearer session under the same authorization rules as dashboard cookies. `POST /auth/sign-out` revokes it. Inference routes still require a project API key.

Sessions must remain revocable, deactivated users must be rejected, and a device code must be consumed only once. Rate-limit code creation and verification. The approval screen must show the account and ask the user to compare the displayed code. Never send a session token in a redirect URL. Device issuance derives from an already authenticated browser; password/social/passkey login must still respect enforced SSO.

The CLI stores private session data in `~/.llmgateway/config.json` (or `LLMGATEWAY_CONFIG_DIR`), bound to the issuing management URL. It refuses to forward a saved session to a different API instance. Existing email/password sessions remain readable. Deployments without the device endpoints can use `auth login --email` or `auth login --key`; email/password is unavailable when the organization enforces SSO.

## Organization skill catalog

Deploy LLM Gateway's organization skills API on the management service. These routes require a dashboard session and organization membership. Catalog management is restricted to enterprise organization owners/admins by the server.

| Method and path                    | Response or body                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /orgs`                        | `{ "organizations": [{ "id": "…", "name": "…" }] }` for the current user                 |
| `GET /orgs/:orgId/skills`          | `{ "skills": [summary] }`                                                                |
| `GET /orgs/:orgId/skills/:skillId` | `{ "skill": detail }`                                                                    |
| `POST /orgs/:orgId/skills`         | Body `{ "content": "<complete SKILL.md>", "files": [] }`; response `{ "skill": detail }` |

A summary contains `id`, `name`, `description`, and `enabled`. A detail adds `content` (the complete `SKILL.md`, including frontmatter) and `files`, an array of `{ path, content, encoding? }`. Encoding is `utf-8` by default or `base64`. Supporting paths are relative to the skill folder. The CLI accepts portable lowercase skill names up to 64 characters, at most 100 supporting files, and at most 1 MiB per decoded bundle.

`skills add` downloads enabled skills only and validates every bundle before writing. It stages each skill directory, rejects traversal and symlink destinations, and requires `--force` to replace existing directories. Files are never executed by installation. Access errors, missing enterprise entitlement, and disabled skills remain explicit failures.

## Custom launchers and automation

Distribute a trusted JSON definition like [company-agent.json](../examples/company-agent.json), then run `llmgateway agents add <file>`. Registration writes the user's separate `agents.json`; logout retains it. Definitions are never discovered or executed implicitly from a repository.

Use `LLMGATEWAY_API_KEY` for unattended launches and keep credentials out of argument lists. `${apiKey}` is accepted only in environment values. Arguments and executable names are passed without a shell. `--dry-run` previews the launch offline without writing agent files, and `--check-key` opts into a potentially billable inference probe. Scripts should specify the template/directory, agent, and organization explicitly when multiple choices exist.

CLI templates accept `LLMGATEWAY_MODEL`. AI templates and generated routes accept `LLMGATEWAY_GATEWAY_URL`; the gateway's `/v1` path is added by their provider setup.
