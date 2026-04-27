export interface Topic {
  id: number
  name: string
  keywords: string[]
  enabled: boolean
}

export interface LLMConfig {
  api_key: string
  base_url: string
  model: string
  temperature: number
}

export interface OutputConfig {
  output_dir: string
  auto_save: boolean
}

export interface ProxyConfig {
  http: string
  https: string
}

export interface Category {
  id: number
  name: string
  enabled: boolean
}
