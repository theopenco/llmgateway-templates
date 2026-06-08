# Weather Agent

A command-line AI agent that answers weather-related queries using tool-based interactions through LLM Gateway.

## Features

- Natural language weather queries
- Current weather conditions lookup
- 5-day weather forecasts
- Temperature unit support (Celsius/Fahrenheit)
- Tool-based agentic architecture
- Type-safe with Zod validation

## Tech Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Language**: TypeScript 5.7
- **AI**: Vercel AI SDK, LLM Gateway Provider
- **Validation**: Zod

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
cd agents/weather-agent
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
pnpm dev
```

The agent will run with watch mode, automatically restarting on file changes.

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
weather-agent/
├── src/
│   └── index.ts      # Main agent implementation
├── dist/             # Compiled output
├── .env.example      # Environment template
├── tsconfig.json     # TypeScript config
└── package.json
```

## How It Works

The weather agent uses a tool-based architecture:

1. **User Query**: The agent receives a natural language question about weather
2. **Tool Selection**: The LLM decides which tool(s) to use
3. **Tool Execution**: Tools fetch weather data (mock data in this template)
4. **Response Generation**: The LLM synthesizes the data into a natural response

### Available Tools

#### `getWeather`

Get current weather conditions for a location.

**Parameters:**

- `location` (string): City name or location
- `unit` (optional): "celsius" or "fahrenheit"

#### `getForecast`

Get a 5-day weather forecast for a location.

**Parameters:**

- `location` (string): City name or location
- `unit` (optional): "celsius" or "fahrenheit"

## Example Queries

```bash
# Current weather
"What's the weather like in Tokyo?"

# Forecast
"Will it rain in London this week?"

# Comparison
"Compare the weather between New York and Los Angeles"

# With units
"What's the temperature in Paris in Fahrenheit?"
```

## Customization

### Adding New Tools

1. Define the tool schema with Zod:

```typescript
const myTool = {
  description: "Description of what the tool does",
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
  }),
  execute: async ({ param1 }) => {
    // Tool implementation
    return result;
  },
};
```

2. Add it to the `tools` object in the `generateText` call.

### Changing the Model

Update the model in `src/index.ts`:

```typescript
model: llmgateway("your-preferred-model"),
```

### Real Weather Data

Replace the mock data functions with actual API calls:

```typescript
execute: async ({ location, unit }) => {
  const response = await fetch(
    `https://api.weather.com/v1/current?location=${location}`
  );
  return response.json();
},
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Agent     │────▶│ LLM Gateway │
│   Query     │     │   Loop      │     │   (LLM)     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Tools     │
                   │ - getWeather│
                   │ - getForecast│
                   └─────────────┘
```

## License

MIT
