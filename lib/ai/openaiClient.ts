import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

type AiMode = "default" | "premium" | "vision";

let client: OpenAI | null = null;

function buildModelList(mode: AiMode): string[] {
  const primary =
    mode === "premium"
      ? process.env.OPENAI_MODEL_PREMIUM
      : mode === "vision"
        ? process.env.OPENAI_MODEL_VISION ?? process.env.OPENAI_MODEL_DEFAULT
        : process.env.OPENAI_MODEL_DEFAULT;

  return [
    primary,
    process.env.OPENAI_MODEL_FALLBACK,
    "gpt-4.1",
  ].filter((value): value is string => Boolean(value));
}

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

export async function runStructuredResponse<TSchema extends z.ZodTypeAny>(input: {
  mode?: AiMode;
  schema: TSchema;
  schemaName: string;
  responseInput: unknown;
}) {
  const aiClient = getOpenAIClient();
  const models = buildModelList(input.mode ?? "default");

  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await aiClient.responses.parse({
        model,
        input: input.responseInput as never,
        text: {
          format: zodTextFormat(input.schema, input.schemaName),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI returned no parsed output.");
      }

      return response.output_parsed as z.infer<TSchema>;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed.");
}
