import type { Database as SqlJsDatabase } from 'sql.js';
import { LLMClient } from '../services/llm-client';
import { loadLLMConfig } from './config';

export async function testLLMConnection(settingsDb: SqlJsDatabase): Promise<{
  success: boolean;
  message: string;
}> {
  const llmConfig = loadLLMConfig(settingsDb);
  const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
  const result = await client.testConnection();
  return {
    success: true,
    message: `${result} (model=${llmConfig.model}, temp=${llmConfig.temperature})`,
  };
}
