#!/usr/bin/env node
/**
 * End-to-end verification for the embeddable end-user wallet flow (Phase 1).
 *
 * Exercises the full walking skeleton against a running LLM Gateway stack
 * (api + gateway + worker + Postgres + Redis):
 *
 *   1. Mint an ephemeral end-user session   (server SDK, secret key)
 *   2. Seed the wallet with credits          (server SDK, secret key)
 *   3. Stream a chat completion as the end-user (client SDK, session token)
 *   4. Poll the wallet balance until the worker debits it
 *
 * Prereqs:
 *   - Run the migration: `pnpm --filter @llmgateway/db migrate` in the openllm repo.
 *   - Create a project, enable end-user sessions on it
 *       (project.endUserEnabled = true), and create a platform_secret apiKey
 *       row on it (keyType = 'platform_secret'). Use its token as the secret key.
 *
 * Env:
 *   LLMGATEWAY_SECRET_KEY   (required)  the platform_secret token (sk_…)
 *   LLMGATEWAY_API_URL      default http://localhost:4002
 *   LLMGATEWAY_GATEWAY_URL  default http://localhost:4001
 *   MODEL                   default openai/gpt-4o-mini
 *
 * Usage:  node scripts/verify-wallet-flow.mjs
 */
import { LLMGatewayClient } from "../packages/client/dist/index.js";
import { LLMGateway } from "../packages/server/dist/index.js";

const secretKey = process.env.LLMGATEWAY_SECRET_KEY;
if (!secretKey) {
	console.error("Set LLMGATEWAY_SECRET_KEY to your platform_secret token.");
	process.exit(1);
}

const apiBaseUrl = process.env.LLMGATEWAY_API_URL ?? "http://localhost:4002";
const gatewayBaseUrl =
	process.env.LLMGATEWAY_GATEWAY_URL ?? "http://localhost:4001";
const model = process.env.MODEL ?? "openai/gpt-4o-mini";

const lg = new LLMGateway({ secretKey, apiBaseUrl });

function log(step, value) {
	console.log(`\n▸ ${step}`);
	if (value !== undefined) console.log(value);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	log("1. Minting end-user session");
	const session = await lg.sessions.create({
		customer: { externalId: `verify-${Date.now()}` },
		scope: { models: [model] },
		ttlSeconds: 900,
	});
	log("   session", {
		walletId: session.walletId,
		endCustomerId: session.endCustomerId,
		expiresAt: session.expiresAt,
	});

	log("2. Seeding wallet with $5");
	await lg.wallets.credit({
		walletId: session.walletId,
		amount: 5,
		reason: "verification seed",
	});
	const before = await lg.wallets.retrieve(session.walletId);
	log("   balance before", before.balance);

	log("3. Streaming a chat completion as the end-user");
	const client = new LLMGatewayClient({
		session: { token: session.sessionToken, expiresAt: session.expiresAt },
		gatewayBaseUrl,
	});
	let out = "";
	for await (const delta of client.stream({
		model,
		messages: [{ role: "user", content: "Say hello in exactly five words." }],
	})) {
		out += delta;
		process.stdout.write(delta);
	}
	console.log();
	log("   completion length", out.length);

	log("4. Polling wallet balance until the worker debits it (up to 30s)");
	const beforeNum = Number(before.balance);
	let after = before;
	for (let i = 0; i < 15; i++) {
		await sleep(2000);
		after = await lg.wallets.retrieve(session.walletId);
		if (Number(after.balance) < beforeNum) break;
		process.stdout.write(".");
	}
	console.log();
	log("   balance after", after.balance);

	const debited = Number(before.balance) - Number(after.balance);
	if (debited > 0) {
		console.log(`\n✅ PASS — wallet debited $${debited.toFixed(6)} for AI usage.`);
	} else {
		console.log(
			"\n⚠️  Balance unchanged. Ensure the worker is running and processing the LOG_QUEUE.",
		);
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error("\n❌ Verification failed:", err);
	process.exit(1);
});
