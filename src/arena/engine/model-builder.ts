/**
 * Shared AI SDK model builder for Arena engine.
 *
 * Extracted from text-generator.ts pattern to avoid duplication.
 * All three Arena roles (Gatekeeper, Challenger, Grader) use this
 * to build LanguageModel instances through the unified provider
 * resolution path (per INTG-01).
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { resolveProvider, toAiSdkConfig } from '@/lib/provider-resolver';
import type { LanguageModel } from 'ai';

/**
 * Build an AI SDK LanguageModel instance.
 *
 * Logic extracted from text-generator.ts, maintaining identical
 * provider resolution path (resolveProvider + toAiSdkConfig).
 *
 * @param providerId - provider ID (empty string uses default)
 * @param modelId - model ID (empty string uses provider default)
 * @returns AI SDK LanguageModel instance
 */
export function buildAiModel(providerId: string, modelId: string): LanguageModel {
  const resolved = resolveProvider({ providerId: providerId || undefined });

  if (!resolved.hasCredentials && !resolved.provider) {
    throw new Error('No provider available. Please configure a provider in Settings.');
  }

  const config = toAiSdkConfig(resolved, modelId || undefined);

  // Inject process env if needed (bedrock/vertex)
  for (const [k, v] of Object.entries(config.processEnvInjections)) {
    process.env[k] = v;
  }

  // Build headers object for SDK clients (only if non-empty)
  const hasHeaders = config.headers && Object.keys(config.headers).length > 0;

  // Switch-case matching text-generator.ts lines 48-96
  switch (config.sdkType) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        // apiKey and authToken are mutually exclusive in @ai-sdk/anthropic
        ...(config.authToken
          ? { authToken: config.authToken }
          : { apiKey: config.apiKey }),
        baseURL: config.baseUrl,
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return anthropic(config.modelId);
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return openai(config.modelId);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return google(config.modelId);
    }
    case 'bedrock': {
      // Auth via process.env (AWS_REGION, AWS_ACCESS_KEY_ID, etc.) -- already injected above
      const bedrock = createAmazonBedrock({
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return bedrock(config.modelId);
    }
    case 'vertex': {
      // Anthropic-on-Vertex: auth via process.env (CLOUD_ML_REGION, GOOGLE_APPLICATION_CREDENTIALS, etc.)
      const vertex = createVertexAnthropic({
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return vertex(config.modelId);
    }
    default: {
      // Fallback to anthropic (same as text-generator.ts default)
      const fallback = createAnthropic({
        ...(config.authToken
          ? { authToken: config.authToken }
          : { apiKey: config.apiKey }),
        baseURL: config.baseUrl,
        ...(hasHeaders ? { headers: config.headers } : {}),
      });
      return fallback(config.modelId);
    }
  }
}
