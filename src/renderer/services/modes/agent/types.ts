import { CommandSuggestion } from '@/renderer/services/ai';

export enum AgentResponseStatus {
  THINKING = 'thinking',
  WAITING = 'waiting',
  EXECUTING = 'executing',
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

export interface AgentResponse {
  status: AgentResponseStatus;
  message?: string;
  commands?: CommandSuggestion[];
  error?: string;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: AgentResponseStatus;
  steps: string[];
  currentStep: number;
  error?: string;
}

export interface AgentModeService {
  getNextStep: (input: string) => Promise<string | CommandSuggestion[]>;
} 