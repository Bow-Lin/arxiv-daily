export interface AnalysisResult {
  analysis: string;
}

export interface DeepAnalysisResult {
  analysis: string;
}

const SYSTEM_PROMPT = '你是一个学术论文快速评估专家。你擅长从论文摘要中精准提炼关键信息，并给出严格、客观的质量评估。使用 Markdown 格式输出，语言简洁，避免空洞的修饰词。数学公式使用 LaTeX 格式，行内公式用 $...$，独立公式用 $$...$$。';

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

  private async doFetch(url: string, body: string, signal?: AbortSignal): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal,
      });
      if (!response.ok) {
        const resBody = await response.text().catch(() => '');
        const statusMsg = response.status === 401
          ? 'API Key 无效或已过期 (HTTP 401)'
          : response.status === 429
            ? '请求频率过高 (HTTP 429)'
            : response.status === 500
              ? '服务端内部错误 (HTTP 500)'
              : `HTTP ${response.status}`;
        throw new Error(`${statusMsg}: ${resBody.slice(0, 200)}`);
      }
      return response;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP ')) throw e;
      if (e instanceof DOMException && e.name === 'TimeoutError') {
        throw new Error('请求超时');
      }
      throw new Error(`连接失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async parseResponse(response: Response): Promise<string> {
    let chatResp: { choices?: { message?: { content?: string } }[] };
    try {
      chatResp = await response.json();
    } catch (e) {
      throw new Error(`响应解析失败: ${e}`);
    }
    const content = chatResp.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('返回了空响应');
    }
    return content.trim();
  }

  /**
   * Analyze a paper using the LLM.
   */
  async analyzePaper(title: string, abstractText: string, topics: string[], signal?: AbortSignal): Promise<AnalysisResult> {
    const topicsStr = topics.join(', ');
    const prompt = `请分析以下学术论文，主要关注文章的关键问题、主要方法、指标效果，并评估文章的创新性。

要求：
1. 每个要点控制在1-3句以内，直击要点，不要铺垫。
2. 不要使用括号进行备注，不允许使用列表和表格。
3. 如果摘要中未提及某方面的信息，直接说明"摘要中未提及"，不要臆造内容。

输出格式：
**1. 关键问题**

[概括论文解决的核心问题]

**2. 主要方法**

[概括核心技术方法或框架]

**3. 指标效果**

[概括主要实验结果和关键性能数据]

**4. 创新性评估**

**评分：[X/10]**

**评估依据：**[具体说明优点和不足]

创新性评分标准：
- 1-3分：增量改进，仅在已有方法上做微调或组合，无实质性新贡献
- 4-6分：有一定创新，提出新视角或改进方案，但整体框架仍是常规思路
- 7-8分：显著创新，提出新方法、架构或理论，且有扎实实验支撑
- 9-10分：突破性工作，开辟新研究方向或解决长期悬而未决的核心难题

注意：大多数论文评分应在4-7分之间，8分及以上需充分理由，不要因发表在顶级会议就给高分。

以下是论文的信息：

论文标题：${title}

论文摘要：${abstractText}

相关话题：${topicsStr}`;

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

    const response = await this.doFetch(url, requestJson, combinedSignal);
    const content = await this.parseResponse(response);

    return { analysis: content };
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

    await this.doFetch(url, JSON.stringify(request), AbortSignal.timeout(30000));
    return 'Connection successful';
  }

  /**
   * Deep-analyze a full paper (title + extracted PDF text).
   */
  async analyzeFullPaper(title: string, fullText: string, signal?: AbortSignal): Promise<DeepAnalysisResult> {
    const prompt = `Please perform a deep analysis of the following academic paper. Be specific and grounded in the paper's content — cite specific methods, numbers, and claims rather than giving vague descriptions.

Output template:

## 1. Core Problem & Motivation

[What specific problem does the paper address? What are the limitations of existing approaches that motivate this work?]

## 2. Methodology Details

[Describe the technical approach in detail: architecture, key components, loss functions, training strategies. What design choices were made and why?]

## 3. Experimental Conclusions

[Benchmarks used, baselines compared, key quantitative results. Are the improvements consistent across datasets/tasks? Are ablation studies included?]

## 4. Strengths

[Novel contributions, practical value, generalizability. What would be hard to replicate without this paper?]

## 5. Weaknesses

[Limitations, unsupported claims, missing baselines, potential biases in evaluation. Under what conditions might the method fail?]

## 6. Key Conclusions

[Core findings, whether the claims are well-supported by evidence, and what future directions are suggested.]

Paper Title: ${title}

Full Text:
${fullText}`;

    const request = {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are an expert in academic paper deep analysis. Read the full text carefully and provide a rigorous, objective analysis. Focus on technical soundness, experimental rigor, and practical significance. Respond in English using Markdown format. Use LaTeX for mathematical expressions: inline math with $...$ and display math with $$...$$.' },
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

    const response = await this.doFetch(url, requestJson, combinedSignal);
    const content = await this.parseResponse(response);

    return { analysis: content };
  }
}
