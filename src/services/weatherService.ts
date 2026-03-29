import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface WeatherData {
  temperature: string;
  maxTemp: string;
  minTemp: string;
  precipitation: string;
  windSpeed: string;
  status: string;
}

export async function fetchWeather(location: string, date?: string): Promise<WeatherData | null> {
  if (!location) return null;

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the weather for the location: ${location} on the date: ${targetDate}. 
      Return the data in the following JSON format:
      {
        "temperature": "current temperature with unit",
        "maxTemp": "maximum temperature with unit",
        "minTemp": "minimum temperature with unit",
        "precipitation": "precipitation with unit",
        "windSpeed": "wind speed with unit",
        "status": "short description of weather status in Korean"
      }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            temperature: { type: Type.STRING },
            maxTemp: { type: Type.STRING },
            minTemp: { type: Type.STRING },
            precipitation: { type: Type.STRING },
            windSpeed: { type: Type.STRING },
            status: { type: Type.STRING }
          },
          required: ["temperature", "maxTemp", "minTemp", "precipitation", "windSpeed", "status"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as WeatherData;
    }
  } catch (error) {
    console.error("Error fetching weather:", error);
  }

  return null;
}
