import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { ToolLoopAgent, isStepCount, tool } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  baseURL: process.env.LLMGATEWAY_GATEWAY_URL
    ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
    : undefined,
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

const describe = (code: number) => WEATHER_CODES[code] ?? `Code ${code}`;

const unitSchema = z
  .enum(["celsius", "fahrenheit"])
  .default("celsius")
  .describe("Temperature unit");

type Place = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

async function geocode(location: string, signal?: AbortSignal): Promise<Place> {
  const city = location.split(",")[0].trim();
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  const { results } = (await response.json()) as { results?: Place[] };
  if (!results?.length) throw new Error(`Unknown location: ${location}`);
  return results[0];
}

async function forecastApi(
  place: Place,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("timezone", place.timezone || "auto");
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Weather API failed: ${response.status}`);
  return response.json();
}

const getWeather = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    location: z
      .string()
      .describe("City and optional country, e.g. 'London, UK'"),
    unit: unitSchema,
  }),
  execute: async ({ location, unit }, { abortSignal }) => {
    const place = await geocode(location, abortSignal);
    const data = await forecastApi(
      place,
      {
        current:
          "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        temperature_unit: unit,
      },
      abortSignal,
    );
    const c = data.current;
    return {
      location: `${place.name}, ${place.country}`,
      localTime: c.time,
      unit,
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      condition: describe(c.weather_code),
      humidity: c.relative_humidity_2m,
      precipitationMm: c.precipitation,
      windKmh: c.wind_speed_10m,
    };
  },
});

const getForecast = tool({
  description: "Get a daily weather forecast (up to 7 days) for a city",
  inputSchema: z.object({
    location: z
      .string()
      .describe("City and optional country, e.g. 'Tokyo, Japan'"),
    days: z.number().min(1).max(7).default(5).describe("Number of days"),
    unit: unitSchema,
  }),
  execute: async ({ location, days, unit }, { abortSignal }) => {
    const place = await geocode(location, abortSignal);
    const data = await forecastApi(
      place,
      {
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        forecast_days: String(days),
        temperature_unit: unit,
      },
      abortSignal,
    );
    const d = data.daily;
    return {
      location: `${place.name}, ${place.country}`,
      unit,
      forecast: (d.time as string[]).map((date, i) => ({
        date,
        condition: describe(d.weather_code[i]),
        high: d.temperature_2m_max[i],
        low: d.temperature_2m_min[i],
        rainChance: d.precipitation_probability_max[i],
      })),
    };
  },
});

const weatherAgent = new ToolLoopAgent({
  model: llmgateway(process.env.LLMGATEWAY_MODEL || "gpt-6-luna"),
  tools: { getWeather, getForecast },
  stopWhen: isStepCount(5),
  instructions: `You are a helpful weather assistant with live weather data.
Use getWeather for current conditions and getForecast for upcoming days.
Add practical advice such as what to wear or whether to take an umbrella.
Keep answers short and easy to scan.`,
});

async function main() {
  const input = process.argv.slice(2).join(" ").trim();
  const queries = input
    ? [input]
    : [
        "What's the weather like in London right now?",
        "Give me a 5-day forecast for Tokyo, Japan in Fahrenheit",
        "Should I bring an umbrella if I'm going to Paris today?",
      ];

  console.log("Weather Agent - Powered by LLM Gateway\n");

  for (const query of queries) {
    console.log("=".repeat(50));
    console.log(`User: ${query}`);
    console.log("-".repeat(50));
    const result = await weatherAgent.stream({ prompt: query });
    process.stdout.write("Assistant: ");
    for await (const chunk of result.textStream) process.stdout.write(chunk);
    process.stdout.write("\n");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
