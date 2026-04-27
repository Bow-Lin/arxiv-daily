export interface AnalysisResult {
  analysis: string;
}

export interface DeepAnalysisResult {
  analysis: string;
}

const SYSTEM_PROMPT = '你是一个学术论文分析专家。请客观分析论文的创新性和贡献，使用 Markdown 格式输出。';

/**
 * Extract JSON from LLM response, handling ```json code blocks.
 */
export class LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private temperature: number;

  constructor(apiKey: string, model: string, baseUrl: string, temperature: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.temperature = temperature;
  }

  private buildUrl(): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  /**
   * Analyze a paper using the LLM.
   */
  async analyzePaper(title: string, abstractText: string, topics: string[], signal?: AbortSignal): Promise<AnalysisResult> {
    const topicsStr = topics.join(', ');
    const prompt = `请分析以下学术论文，主要关注以下方面：

1. 关键问题：文章解决的核心问题是什么？
2. 主要方法：文章采用的技术方法或框架是什么？
3. 指标效果：文章的主要实验结果和性能指标如何？
4. 创新性评估（严格评价）

创新性评估要求严格，请参考以下标准：
- 1-3分：增量改进，仅在已有方法上做微调或组合，没有实质性新贡献
- 4-6分：有一定创新性，提出了新的视角或改进方案，但整体框架仍是常规思路
- 7-8分：较为显著的创新，提出了新的方法、架构或理论，且有扎实的实验支撑
- 9-10分：突破性工作，开辟了新的研究方向或解决了长期未解决的核心难题
注意：大多数论文的评分应在4-7分之间，8分及以上应有充分的理由。不要因为论文发表在顶级会议就给高分。

论文标题：${title}

论文摘要：${abstractText}

相关话题：${topicsStr}

要求：
1. 语言简洁，每个要点一个段落。
2. 不要使用括号进行备注。
3. 不允许使用列表和表格。

输出格式参考：
**1. 关键问题**

[文章解决的核心问题是什么]

**2. 主要方法**

[文章采用的技术方法或框架是什么]

**3. 指标效果**

[文章的主要实验结果和性能指标如何]

**4. 创新性评估**

**评分：[X/10]**

**评估依据：**[评估的依据是什么，有哪些优点和缺点]`;

    const request = {
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: this.temperature,
    };
    const url = this.buildUrl();
    const requestJson = JSON.stringify(request);
    const timeoutSignal = AbortSignal.timeout(120000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestJson,
      signal: combinedSignal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${body.slice(0, 200)}`);
    }

    let chatResp: { choices?: { message?: { content?: string } }[] };
    try {
      chatResp = await response.json();
    } catch (e) {
      throw new Error(`Parse response error: ${e}`);
    }

    const content = chatResp.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    return { analysis: content.trim() };
  }

  /**
   * Test connection by sending a simple "Hello" message.
   */
  async testConnection(): Promise<string> {
    const request = {
      model: this.model,
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 1.0,
    };
    const url = this.buildUrl();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      return 'Connection successful';
    }

    const body = await response.text().catch(() => '');
    const detail = body.length > 200 ? `${body.slice(0, 200)}...` : body;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  /**
   * Deep-analyze a full paper (title + extracted PDF text).
   */
  async analyzeFullPaper(title: string, fullText: string, signal?: AbortSignal): Promise<DeepAnalysisResult> {
    const prompt = `Please perform a deep analysis of the following paper, focusing on these aspects:

1. Core Problem & Motivation: What problem does the paper address? Why is it important?
2. Methodology Details: What are the specific technical approaches, architecture design, and algorithmic pipelines?
3. Experimental Conclusions: What is the experimental setup? Which methods are compared? What are the key performance metrics?
4. Strengths: What are the novel contributions? What is the practical value? How generalizable is the approach?
5. Weaknesses: What are the limitations? Which scenarios are not covered? What potential issues exist?
6. Key Conclusions: What are the core findings? What key conclusions are supported by data? What does the author emphasize?

Paper Title: ${title}

Full Text:
${fullText}`;

    const request = {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are an expert in academic paper analysis. Carefully read the full text of the paper and provide a thorough, accurate analysis. Respond in English using Markdown format.' },
        { role: 'user', content: prompt },
      ],
      temperature: this.temperature,
    };
    const url = this.buildUrl();
    const requestJson = JSON.stringify(request);
    const timeoutSignal = AbortSignal.timeout(300000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestJson,
      signal: combinedSignal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${body.slice(0, 200)}`);
    }

    let chatResp: { choices?: { message?: { content?: string } }[] };
    try {
      chatResp = await response.json();
    } catch (e) {
      throw new Error(`Parse response error: ${e}`);
    }

    const content = chatResp.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    return {
      analysis: content.trim(),
    };
  }
}
