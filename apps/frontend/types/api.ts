export interface SessionInfo {
  sessionId: number;
  expiresAt: string;
  lastSeenAt: string;
}

export interface SetupStatus {
  initialized: boolean;
  authMode: string;
}

export interface AppSettings {
  id: number;
  appName: string;
  timezone: string;
  locale: string;
  defaultLanguage: string;
  authMode: string;
  sessionDurationMinutes: number;
  defaultAiProviderId: number | null;
  defaultSchedulingCron: string | null;
  ownerTelegramChatId: string | null;
  telegramBotUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiProvider {
  id: number;
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  timeoutSeconds: number;
  maxTokens: number;
  temperature: number;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiPreferencesProfile {
  id: number;
  name: string;
  language: string;
  tone: string;
  formality: number;
  harshness: number;
  softness: number;
  creativity: number;
  bravery: number;
  professionalism: number;
  emotionalIntensity: number;
  readingLevel: string;
  audienceType: string;
  technicalDepth: number;
  storytelling: number;
  persuasiveness: number;
  objectivity: number;
  seoEnabled: boolean;
  hashtagsEnabled: boolean;
  markdownEnabled: boolean;
  callToActionEnabled: boolean;
  emojiLevel: number;
  sentenceLength: string;
  paragraphLength: string;
  brandConsistency: number;
  customPreferencesJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowChat {
  id: number;
  telegramChatId: string;
  title: string;
  username: string | null;
  type: string;
}

export interface WorkflowState {
  workflowId: number;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  currentExecutionId: number | null;
  lastSuccessfulRunAt: string | null;
  lastError: string | null;
}

export interface WorkflowExecutionSummary {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  collectedMessageCount: number;
  detectedTopicCount: number;
  selectedTopicCount: number;
  generatedDraftCount: number;
  publishedDraftCount: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface Workflow {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  publishMode: string;
  publishIntervalMinutes: number;
  aiProviderId: number | null;
  aiPreferencesId: number | null;
  userPrompt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sources: WorkflowChat[];
  destinations: WorkflowChat[];
  state: WorkflowState | null;
  lastExecution: WorkflowExecutionSummary | null;
}

export interface Draft {
  id: number;
  topicId: number;
  workflowId: number;
  title: string;
  body: string;
  manuallyEdited: boolean;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ExecutionDetails extends WorkflowExecutionSummary {
  workflowId: number;
  errorMessage: string | null;
  topics: Topic[];
  drafts: Draft[];
  aiLogs: AiLog[];
  publications: Publication[];
}

export interface Topic {
  id: number;
  executionId: number;
  title: string;
  summary: string;
  importanceScore: number;
  confidenceScore: number;
  sourceMessageCount: number;
  approved: boolean;
  rejected: boolean;
  regenerated: number;
  createdAt: string;
  deletedAt: string | null;
  generatedDraftId?: number;
}

export interface Publication {
  id: number;
  draftId: number;
  destinationId: number;
  telegramMessageId: string | null;
  status: string;
  sentAt: string | null;
  errorMessage: string | null;
  destinationTitle?: string;
  destinationChatId?: string;
}

export interface AiLog {
  id: number;
  executionId: number | null;
  workflowId: number | null;
  providerId: number | null;
  purpose: string;
  model: string;
  prompt: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  createdAt: string;
}

export interface CostSummary {
  totalRequests: number;
  totalTokens: number;
  estimatedSpending: number;
  byProvider: Array<{ providerName: string; requestCount: number; totalTokens: number; estimatedCost: number }>;
  byModel: Array<{ model: string; requestCount: number; totalTokens: number; estimatedCost: number }>;
}

export interface TelegramStatus {
  telegramApiConfigured: boolean;
  telegramSessionConfigured: boolean;
  telegramBotConfigured: boolean;
  telegramApiId: number | null;
  ownerTelegramChatId: string | null;
  telegramBotUsername: string | null;
}

export interface HealthStatus {
  api: string;
  database: string;
  scheduler: {
    activeWorkflowCount: number;
    nextRuns: Array<{ workflowId: number; status: string; nextRunAt: string | null }>;
    mode: string;
  };
  telegram: TelegramStatus;
  aiProviders: string;
}
