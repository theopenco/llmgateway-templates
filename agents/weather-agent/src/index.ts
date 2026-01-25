import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const weatherTool = tool({
  description: "Get the current weather for a specific location",
  inputSchema: z.object({
    location: z.string().describe("The city and country, e.g., 'London, UK'"),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .default("celsius")
      .describe("Temperature unit"),
  }),
  execute: async ({ location, unit }) => {
    // Simulated weather data - in production, call a real weather API
    const mockWeatherData: Record<
      string,
      { temp: number; condition: string; humidity: number; wind: number }
    > = {
      "london, uk": { temp: 12, condition: "Cloudy", humidity: 78, wind: 15 },
      "new york, usa": { temp: 8, condition: "Sunny", humidity: 45, wind: 20 },
      "tokyo, japan": { temp: 18, condition: "Partly Cloudy", humidity: 60, wind: 10 },
      "paris, france": { temp: 14, condition: "Rainy", humidity: 85, wind: 12 },
      "sydney, australia": { temp: 25, condition: "Sunny", humidity: 55, wind: 18 },
    };

    const normalizedLocation = location.toLowerCase();
    const weather = mockWeatherData[normalizedLocation];

    if (!weather) {
      // Generate random weather for unknown locations
      const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Windy"];
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      const randomTemp = Math.floor(Math.random() * 35) - 5;

      return {
        location,
        temperature: unit === "fahrenheit" ? Math.round(randomTemp * 1.8 + 32) : randomTemp,
        unit,
        condition: randomCondition,
        humidity: Math.floor(Math.random() * 60) + 30,
        windSpeed: Math.floor(Math.random() * 30) + 5,
      };
    }

    return {
      location,
      temperature: unit === "fahrenheit" ? Math.round(weather.temp * 1.8 + 32) : weather.temp,
      unit,
      condition: weather.condition,
      humidity: weather.humidity,
      windSpeed: weather.wind,
    };
  },
});

const forecastTool = tool({
  description: "Get a 5-day weather forecast for a specific location",
  inputSchema: z.object({
    location: z.string().describe("The city and country, e.g., 'London, UK'"),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .default("celsius")
      .describe("Temperature unit"),
  }),
  execute: async ({ location, unit }) => {
    const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Windy", "Stormy"];
    const forecast = [];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const tempCelsius = Math.floor(Math.random() * 25) + 5;
      forecast.push({
        date: date.toISOString().split("T")[0],
        temperature: unit === "fahrenheit" ? Math.round(tempCelsius * 1.8 + 32) : tempCelsius,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity: Math.floor(Math.random() * 50) + 40,
      });
    }

    return {
      location,
      unit,
      forecast,
    };
  },
});

async function runWeatherAgent(query: string): Promise<string> {
  const result = await generateText({
    model: llmgateway("openai/gpt-4o"),
    tools: {
      getWeather: weatherTool,
      getForecast: forecastTool,
    },
    stopWhen: stepCountIs(5),
    system: `You are a helpful weather assistant. You can provide current weather conditions and forecasts for any location.
When users ask about weather, use the appropriate tool to get the information.
Always provide helpful context about the weather conditions, such as clothing suggestions or activity recommendations.
Format your responses in a clear, easy-to-read way.`,
    prompt: query,
  });

  return result.text;
}

async function main() {
  console.log("Weather Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));

  const queries = [
    "What's the weather like in London?",
    "Give me a 5-day forecast for Tokyo, Japan in Fahrenheit",
    "Should I bring an umbrella if I'm going to Paris today?",
  ];

  for (const query of queries) {
    console.log(`\nUser: ${query}`);
    console.log("-".repeat(50));

    const response = await runWeatherAgent(query);
    console.log(`Assistant: ${response}`);
    console.log("=".repeat(50));
  }
}

main().catch(console.error);
