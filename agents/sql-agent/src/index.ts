import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { ToolLoopAgent, isStepCount, tool } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
	baseURL: process.env.LLMGATEWAY_GATEWAY_URL
		? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
		: undefined,
	apiKey: process.env.LLMGATEWAY_API_KEY,
});

const MODEL = process.env.LLMGATEWAY_MODEL || "gpt-6.1-sol";
const MAX_ROWS = 50;

const DEMO_QUESTIONS = [
	"Who are the top 3 customers by total spend, and how many orders did each place?",
	"Which product category earned the most revenue per month in 2026?",
];

function seedDemo(db: DatabaseSync) {
	db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL, signed_up_at TEXT NOT NULL);
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price_cents INTEGER NOT NULL);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL);
  `);

	let seed = 42;
	const random = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	const pick = <T>(items: readonly T[]) =>
		items[Math.floor(random() * items.length)];

	const names = [
		"Ada",
		"Grace",
		"Linus",
		"Margaret",
		"Alan",
		"Barbara",
		"Ken",
		"Radia",
		"Dennis",
		"Frances",
		"Tim",
		"Sophie",
	];
	const countries = ["US", "DE", "FR", "MA", "JP", "BR"];
	const products: [string, string, number][] = [
		["Mechanical Keyboard", "hardware", 12900],
		["4K Monitor", "hardware", 38900],
		["USB-C Dock", "hardware", 8900],
		["Noise-Cancelling Headphones", "audio", 24900],
		["Studio Microphone", "audio", 15900],
		["Pro Plan (monthly)", "software", 2900],
		["Team Plan (monthly)", "software", 9900],
		["Design Course", "education", 19900],
	];

	const insertCustomer = db.prepare(
		"INSERT INTO customers (name, country, signed_up_at) VALUES (?, ?, ?)",
	);
	names.forEach((name, i) =>
		insertCustomer.run(
			name,
			pick(countries),
			`2025-${String((i % 12) + 1).padStart(2, "0")}-15`,
		),
	);

	const insertProduct = db.prepare(
		"INSERT INTO products (name, category, price_cents) VALUES (?, ?, ?)",
	);
	for (const [name, category, price] of products)
		insertProduct.run(name, category, price);

	const insertOrder = db.prepare(
		"INSERT INTO orders (customer_id, status, created_at) VALUES (?, ?, ?)",
	);
	const insertItem = db.prepare(
		"INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
	);
	for (let i = 0; i < 240; i++) {
		const month = String(Math.floor(random() * 9) + 1).padStart(2, "0");
		const day = String(Math.floor(random() * 28) + 1).padStart(2, "0");
		const status = random() < 0.9 ? "paid" : "refunded";
		const { lastInsertRowid } = insertOrder.run(
			Math.floor(random() * names.length) + 1,
			status,
			`2026-${month}-${day}`,
		);
		const lines = Math.floor(random() * 3) + 1;
		for (let j = 0; j < lines; j++) {
			insertItem.run(
				lastInsertRowid,
				Math.floor(random() * products.length) + 1,
				Math.floor(random() * 3) + 1,
			);
		}
	}
}

function openDatabase(file: string | undefined): {
	db: DatabaseSync;
	label: string;
} {
	if (file) {
		if (!existsSync(file)) throw new Error(`Database not found: ${file}`);
		const db = new DatabaseSync(file, { readOnly: true });
		return { db, label: file };
	}
	const db = new DatabaseSync(":memory:");
	seedDemo(db);
	db.exec("PRAGMA query_only = ON");
	return { db, label: "demo store (in-memory)" };
}

function quoteIdentifier(name: string) {
	return `"${name.replace(/"/g, '""')}"`;
}

function createAgent(db: DatabaseSync) {
	const tableNames = () =>
		(
			db
				.prepare(
					"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
				)
				.all() as { name: string }[]
		).map((row) => row.name);

	return new ToolLoopAgent({
		model: llmgateway(MODEL),
		stopWhen: isStepCount(10),
		tools: {
			listTables: tool({
				description: "List every table in the database with its row count.",
				inputSchema: z.object({}),
				execute: async () =>
					tableNames().map((name) => ({
						name,
						rows: (
							db
								.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdentifier(name)}`)
								.get() as { n: number }
						).n,
					})),
			}),
			describeTable: tool({
				description:
					"Show the columns, types, foreign keys and three sample rows of a table.",
				inputSchema: z.object({ table: z.string() }),
				execute: async ({ table }) => {
					if (!tableNames().includes(table))
						return { error: `Unknown table: ${table}` };
					const id = quoteIdentifier(table);
					return {
						columns: db.prepare(`PRAGMA table_info(${id})`).all(),
						foreignKeys: db.prepare(`PRAGMA foreign_key_list(${id})`).all(),
						sample: db.prepare(`SELECT * FROM ${id} LIMIT 3`).all(),
					};
				},
			}),
			runQuery: tool({
				description: `Run one read-only SQLite query (SELECT or WITH). Returns at most ${MAX_ROWS} rows.`,
				inputSchema: z.object({
					sql: z.string().describe("A single SQLite SELECT statement"),
				}),
				execute: async ({ sql }) => {
					const statement = sql.trim().replace(/;\s*$/, "");
					if (!/^(select|with)\b/i.test(statement) || statement.includes(";")) {
						return {
							error: "Only a single SELECT or WITH statement is allowed.",
						};
					}
					try {
						const rows = db.prepare(statement).all();
						return {
							rowCount: rows.length,
							rows: rows.slice(0, MAX_ROWS),
							truncated: rows.length > MAX_ROWS,
						};
					} catch (error) {
						return {
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			}),
		},
		instructions: `You are a senior data analyst who answers questions with SQLite.

Workflow:
1. Call listTables, then describeTable for every table you might need.
2. Write a query with runQuery. If it errors or the result looks wrong, fix it and run it again.
3. Answer in markdown: one or two sentences with the answer, a small table of the key rows, then the final SQL in a \`\`\`sql block.

Rules: money columns ending in _cents must be divided by 100 and shown in dollars. Never guess numbers that did not come from a query.`,
	});
}

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			db: { type: "string", short: "d" },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	if (values.help) {
		console.log("SQL Agent - Powered by LLM Gateway\n");
		console.log('Usage: pnpm start [--db path/to/file.sqlite] ["question"]\n');
		console.log(
			"Without --db it runs on an in-memory demo store (customers, products, orders, order_items).",
		);
		console.log("File databases are opened read-only.");
		return;
	}

	const { db, label } = openDatabase(values.db);
	const question = positionals.join(" ").trim();
	const questions = question ? [question] : DEMO_QUESTIONS;
	const agent = createAgent(db);

	console.log("SQL Agent - Powered by LLM Gateway\n");
	console.log(`Database: ${label} · Model: ${MODEL}`);

	for (const q of questions) {
		console.log(`\n${"=".repeat(60)}\nQuestion: ${q}\n${"-".repeat(60)}`);
		const result = await agent.generate({
			prompt: q,
			onToolExecutionStart({ toolCall }) {
				const input = toolCall.input as { table?: string; sql?: string };
				const detail = input.sql
					? `\n      ${input.sql.replace(/\s+/g, " ")}`
					: input.table
						? ` ${input.table}`
						: "";
				console.log(`  → ${toolCall.toolName}${detail}`);
			},
		});
		console.log(`\n${result.text}`);
	}

	db.close();
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
