export type ModelBackend = 'onnx' | 'tfjs';

export type PendingStyle = 'pulse' | 'hidden';

/** 登録済みモデル */
export interface StoredModel {
  id: string;
  name: string;
  labels: Record<string, string>; // e.g. { "0": "komondor", "1": "mop" }
  backend: ModelBackend;
  imageSize?: number; // for TF.js, e.g. 224
}

/** フィルタルール */
export interface FilterRule {
  id: string;
  name: string;
  sitePattern: string; // regex string
  modelId: string;
  weights: Record<string, number>; // label name to weight, from -1.0 to 1.0
  pendingStyle: PendingStyle;
  blockThreshold: number; // 0.0–1.0; score >= this value triggers full block + click-to-reveal
  blockEnabled: boolean; // true = block images above threshold; false = opacity-only
  enabled: boolean;
  priority: number; // lower value means higher priority, 0 is default
}

/** グローバル設定 */
export interface Settings {
  globalEnabled: boolean;
  models: StoredModel[];
  rules: FilterRule[];
}

/** Content Script → Background: 分類リクエスト */
export interface ClassifyRequest {
  type: 'classify';
  imageUrl: string;
  ruleId: string;
  pixels: ArrayBuffer;
  width: number;
  height: number;
}

/** Background → Content Script: 分類レスポンス(成功) */
export interface ClassifySuccessResponse {
  type: 'classify-result';
  probabilities: Record<string, number>; // label name to probability
}

/** Background → Content Script: 分類レスポンス(エラー) */
export interface ClassifyErrorResponse {
  type: 'classify-error';
  error: string;
}

export type ClassifyResponse = ClassifySuccessResponse | ClassifyErrorResponse;

/** Popup / Options → Background: 設定変更通知 */
export interface SettingsChangedMessage {
  type: 'settings-changed';
}

/** Popup → Background: 現在タブのルール取得 */
export interface GetActiveRuleRequest {
  type: 'get-active-rule';
  url: string;
}

export interface GetActiveRuleResponse {
  type: 'active-rule-result';
  rule: FilterRule | null;
  otherMatched: FilterRule[];
}

export type Message =
  | ClassifyRequest
  | SettingsChangedMessage
  | GetActiveRuleRequest;
