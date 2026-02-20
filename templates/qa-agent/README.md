# QA Agent Template

An AI-powered QA testing agent that uses Playwright to interact with your running web app. Give it natural language test instructions and watch it execute step-by-step with a real-time action timeline and live browser preview.

## Demo

[![QA Agent Demo](https://img.youtube.com/vi/-ai9eVvXvZE/0.jpg)](https://www.youtube.com/watch?v=-ai9eVvXvZE)

## Features

- Natural language test instructions — describe what to test in plain English
- Playwright MCP integration — the agent controls a headless browser to navigate, click, type, and screenshot
- Real-time action timeline — see each step as the agent executes it
- Live iframe preview of the target application
- Model selector to switch between LLM providers
- Runs on port 3001 so it doesn't conflict with your app on port 3000

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui
- **AI**: Vercel AI SDK (`generateText` + MCP tools), LLM Gateway Provider
- **Browser Automation**: Playwright MCP (headless)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- [LLM Gateway API Key](https://llmgateway.io)

### Installation

```bash
# From the root of the monorepo
pnpm install

# Or standalone
cd templates/qa-agent
pnpm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API key:

```env
LLMGATEWAY_API_KEY=your_api_key_here
```

### Development

```bash
# Start your app on port 3000 (or any port)
# Then start the QA tester on port 3001
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Usage

1. Enter the URL of the app you want to test (default: `http://localhost:3000`)
2. Write a test instruction in natural language, e.g.:
   - "Test the signup flow and verify a confirmation message appears"
   - "Navigate to the login page, enter invalid credentials, and verify an error is shown"
   - "Add an item to the cart and verify the cart count updates"
3. Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`)
4. Watch the agent actions appear step-by-step in the timeline
5. Review the test summary when complete

### Production Build

```bash
pnpm build
pnpm start
```

## API Reference

### POST /api/test

Run an AI-powered QA test.

**Request Body:**

```json
{
  "instruction": "Test the signup flow",
  "model": "anthropic/claude-sonnet-4-5",
  "targetUrl": "http://localhost:3000"
}
```

**Response:** NDJSON stream of events:

```jsonl
{"type":"status","message":"Launching headless browser..."}
{"type":"status","message":"Browser ready. Running test..."}
{"type":"action","step":1,"tool":"browser_navigate","args":{"url":"http://localhost:3000"},"status":"done"}
{"type":"action","step":2,"tool":"browser_snapshot","args":{},"status":"done"}
{"type":"action","step":3,"tool":"browser_click","args":{"ref":"signup-link"},"status":"done"}
{"type":"text","content":"I can see the signup form with email and password fields."}
{"type":"result","summary":"Test passed: signup flow works correctly."}
```

## License

MIT
