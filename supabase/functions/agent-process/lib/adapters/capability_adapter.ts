export interface AdapterContext {
  trace_id: string;
  userId?: string;
  [key: string]: any;
}

export interface AdapterResult {
  result: any;
  confidence: number;
  source: string;
  trace_id: string;
  metadata?: any;
  /**
   * Biaya SESUNGGUHNYA yang ditagihkan provider untuk panggilan ini, dalam USD.
   * Hanya diisi kalau provider melaporkannya — OpenRouter selalu mengirim
   * `usage.cost` di setiap respons (tanpa parameter tambahan, tanpa biaya atau
   * latensi ekstra). Kalau undefined, pemanggil jatuh ke perkiraan tabel tarif.
   */
  usageCostUsd?: number;
  /**
   * Model yang BENAR-BENAR dipakai adapter untuk panggilan ini.
   *
   * Berbeda dari `rctx.model.model`, yang hanya model yang DIMINTA pemanggil.
   * Keduanya kerap berbeda: saat kaskade jatuh ke adapter lain, adapter memakai
   * model bawaannya sendiri (mis. Intent Router meminta `deepseek/...` lalu
   * ditangani GeminiAdapter dengan `gemini-2.5-flash`).
   *
   * Sebelum 2026-09-10, `logApiUsage` mencatat model yang diminta, sehingga
   * `api_usage` memuat baris mustahil seperti provider `gemini` dengan model
   * `deepseek/deepseek-v4-flash-0731`. Tidak terlihat sampai BillingDashboard
   * dipasang (Item 48) dan menampilkannya di layar.
   */
  modelUsed?: string;
}

export interface CapabilityAdapter {
  name: string;
  type: 'AI' | 'DATABASE' | 'SEARCH' | 'TOOL' | 'EMBEDDING';
  
  initialize(): Promise<boolean>;
  execute(input: any, context: AdapterContext): Promise<AdapterResult>;
  stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}
