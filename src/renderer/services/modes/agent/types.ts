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

export interface MessageContent {
  type: 'analysis' | 'command' | 'output' | 'result';
  content: string;
  timestamp: number;
  command?: {
    text: string;
    risk: CommandRiskLevel;
    executed: boolean;
  };
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
}

export interface AgentModeService {
  getNextStep: (input: string) => Promise<void>;
  toggleAutoExecute: () => void;
  togglePause: () => void;
  getCurrentTask: () => AgentTask | null;
  getState: () => AgentState;
  setState: (state: AgentState) => void;
  handleCommandExecuted: (output: string) => Promise<void>;
  getCurrentMessage: () => AgentResponse | null;
  updateMessageStatus: (status: AgentResponseStatus) => void;
  appendContent: (content: MessageContent) => void;
} 