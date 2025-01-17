import { CommandSuggestion } from '@/renderer/services/ai';

export enum AgentResponseStatus {
  THINKING = 'thinking',
  WAITING = 'waiting',
  EXECUTING = 'executing',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum AgentState {
  IDLE = 'idle',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum CommandRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface CommandParameter {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface CommandInfo {
  text: string;
  risk: CommandRiskLevel;
  description: string;
  executed: boolean;
}

export interface MessageContent {
  type: 'analysis' | 'command' | 'output' | 'result';
  content: string;
  timestamp: number;
  analysis?: string;
  commands?: CommandInfo[];
}

export interface AgentResponse {
  status: AgentResponseStatus;
  contents: MessageContent[];
  error?: string;
}

export interface AgentTask {
  id: string;
  goal: string;
  state: AgentState;
  steps: string[];
  currentStep: number;
  error?: string;
  autoExecute: boolean;
  paused: boolean;
  currentMessage?: AgentResponse;
  userInput?: string;
}

export interface AgentModeService {
  getState(): AgentState;
  setState(state: AgentState): void;
  getCurrentTask(): AgentTask | null;
  getCurrentMessage(): AgentResponse | null;
  updateMessageStatus(status: AgentResponseStatus): void;
  appendContent(content: MessageContent): void;
  toggleAutoExecute(): void;
  togglePause(): void;
  handleCommandExecuted(output: string): Promise<void>;
  getNextStep(input: string, isNewUserQuery?: boolean): Promise<void>;
  getAllMessages(): AgentResponse[];
}

export interface AICommandResponse {
  command: string;
  description: string;
  risk: string;
}

export interface AIResponse {
  analysis?: string;
  commands?: AICommandResponse[];
}

export interface CommandInfo {
  text: string;
  risk: CommandRiskLevel;
  description: string;
  executed: boolean;
}

export interface AgentHistory {
  messages: AgentResponse[];
} 