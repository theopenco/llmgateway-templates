import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, stepCountIs, tool } from "ai";
import { BrowserManager } from "agent-browser/dist/browser.js";
import { z } from "zod";

export const maxDuration = 120;

function createBrowserTools(browser: BrowserManager) {
  return {
    browser_navigate: tool({
      description: "Navigate the browser to a URL",
      inputSchema: z.object({ url: z.string().describe("The URL to navigate to") }),
      execute: async ({ url }) => {
        const page = browser.getPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return { url, title: await page.title() };
      },
    }),
    browser_snapshot: tool({
      description:
        "Get an accessibility snapshot of the current page. Returns a text tree with element refs (e.g. [ref=e1]) that you can use with browser_click and browser_type.",
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await browser.getSnapshot({ interactive: true });
        const tree = typeof snapshot.tree === "string" ? snapshot.tree : JSON.stringify(snapshot.tree);
        // Truncate to avoid blowing up context — 30K chars ≈ ~8K tokens
        const maxChars = 30_000;
        if (tree.length > maxChars) {
          return { snapshot: tree.slice(0, maxChars) + "\n... (truncated)" };
        }
        return { snapshot: tree };
      },
    }),
    browser_click: tool({
      description: "Click an element on the page using its ref from a snapshot (e.g. @e1)",
      inputSchema: z.object({
        ref: z.string().describe("The ref of the element to click, e.g. @e1"),
      }),
      execute: async ({ ref }) => {
        const locator = browser.getLocator(ref);
        await locator.click();
        return { clicked: ref };
      },
    }),
    browser_type: tool({
      description: "Type text into an input field using its ref from a snapshot",
      inputSchema: z.object({
        ref: z.string().describe("The ref of the input element, e.g. @e3"),
        text: z.string().describe("The text to type"),
        clear: z.boolean().optional().describe("Clear the field before typing (default: true)"),
      }),
      execute: async ({ ref, text, clear = true }) => {
        const locator = browser.getLocator(ref);
        if (clear) {
          await locator.fill(text);
        } else {
          await locator.pressSequentially(text);
        }
        return { typed: text, into: ref };
      },
    }),
    browser_hover: tool({
      description: "Hover over an element using its ref",
      inputSchema: z.object({
        ref: z.string().describe("The ref of the element to hover"),
      }),
      execute: async ({ ref }) => {
        const locator = browser.getLocator(ref);
        await locator.hover();
        return { hovered: ref };
      },
    }),
    browser_select_option: tool({
      description: "Select an option from a dropdown using its ref",
      inputSchema: z.object({
        ref: z.string().describe("The ref of the select element"),
        value: z.string().describe("The value to select"),
      }),
      execute: async ({ ref, value }) => {
        const locator = browser.getLocator(ref);
        await locator.selectOption(value);
        return { selected: value, from: ref };
      },
    }),
    browser_press_key: tool({
      description: "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown)",
      inputSchema: z.object({
        key: z.string().describe("The key to press"),
      }),
      execute: async ({ key }) => {
        const page = browser.getPage();
        await page.keyboard.press(key);
        return { pressed: key };
      },
    }),
    browser_scroll: tool({
      description: "Scroll the page in a direction",
      inputSchema: z.object({
        direction: z.enum(["up", "down", "left", "right"]).describe("Scroll direction"),
        amount: z.number().optional().describe("Scroll amount in pixels (default: 500)"),
      }),
      execute: async ({ direction, amount = 500 }) => {
        const page = browser.getPage();
        const deltaX = direction === "left" ? -amount : direction === "right" ? amount : 0;
        const deltaY = direction === "up" ? -amount : direction === "down" ? amount : 0;
        await page.mouse.wheel(deltaX, deltaY);
        return { scrolled: direction, amount };
      },
    }),
    browser_go_back: tool({
      description: "Go back to the previous page",
      inputSchema: z.object({}),
      execute: async () => {
        const page = browser.getPage();
        await page.goBack();
        return { url: page.url() };
      },
    }),
    browser_go_forward: tool({
      description: "Go forward to the next page",
      inputSchema: z.object({}),
      execute: async () => {
        const page = browser.getPage();
        await page.goForward();
        return { url: page.url() };
      },
    }),
    browser_take_screenshot: tool({
      description: "Take a screenshot of the current page for visual verification. The screenshot is streamed to the user via the live preview — you will get a confirmation, not the image data.",
      inputSchema: z.object({}),
      execute: async () => {
        // Screenshot is already visible to the user via the live screencast.
        // Don't return base64 data — it would consume ~100K+ tokens per call.
        return { status: "screenshot_captured", note: "The screenshot is visible in the live preview stream." };
      },
    }),
  };
}

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  const { instruction, model, targetUrl } = await request.json();

  const llmgateway = createLLMGateway({ apiKey });
  const encoder = new TextEncoder();

  const browser = new BrowserManager();
  let stepCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      try {
        emit({ type: "status", message: "Launching headless browser..." });

        await browser.launch({ id: "qa", action: "launch", headless: true });

        // Start screencast to stream frames via NDJSON
        await browser.startScreencast(
          (frame) => {
            emit({ type: "screenshot", imageData: frame.data });
          },
          { format: "jpeg", quality: 50, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2 }
        );

        emit({ type: "status", message: "Browser ready. Running test..." });

        const tools = createBrowserTools(browser);

        const result = await generateText({
          model: llmgateway(model || "anthropic/claude-sonnet-4-5"),
          tools,
          stopWhen: stepCountIs(25),
          system: `You are a QA testing agent. Your task is to test a web application by interacting with it through a browser.

INSTRUCTIONS:
1. First, navigate to: ${targetUrl}
2. Use browser_snapshot to read the current page state before interacting
3. Execute the test described by the user step by step
4. Use browser_click to click elements (use the ref attribute from snapshots, e.g. @e1)
5. Use browser_type to type text into input fields
6. Use browser_take_screenshot for visual verification when needed
7. After completing the test, provide a clear summary of results — what passed, what failed, and why

Be methodical: always snapshot the page before acting so you know what elements are available.`,
          prompt: instruction,
          onStepFinish({ toolCalls, text }) {
            if (toolCalls && toolCalls.length > 0) {
              for (const call of toolCalls) {
                stepCount++;
                emit({
                  type: "action",
                  step: stepCount,
                  tool: call.toolName,
                  args: call.input,
                  status: "done",
                });
              }
            }

            if (text) {
              emit({ type: "text", content: text });
            }
          },
        });

        emit({ type: "result", summary: result.text });
      } catch (err) {
        let message = err instanceof Error ? err.message : String(err);

        // Extract detailed error info from AI SDK APICallError
        if (err && typeof err === "object") {
          const apiErr = err as Record<string, unknown>;
          if (apiErr.responseBody) {
            try {
              const body =
                typeof apiErr.responseBody === "string"
                  ? JSON.parse(apiErr.responseBody)
                  : apiErr.responseBody;
              message =
                body?.error?.message || body?.message || message;
            } catch {
              message = String(apiErr.responseBody);
            }
          } else if (apiErr.data) {
            const data = apiErr.data as Record<string, unknown>;
            message = String(data.message || data.error || message);
          }
        }

        emit({
          type: "error",
          message,
        });
      } finally {
        await browser.stopScreencast();
        await browser.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
