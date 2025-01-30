export interface ArgumentPattern {
  value: string;
  frequency: number;
  lastUsed: Date;
  successRate: number;
}

export interface DirectoryPattern {
  path: string;
  commands: Record<string, number>;
  lastUsed: Date;
}

export interface FileTypePattern {
  extension: string;
  commands: Record<string, number>;
  lastUsed: Date;
}

export interface ErrorCorrectionPattern {
  originalCommand: string;
  correctedCommand: string;
  frequency: number;
  lastUsed: Date;
  successRate: number;
}

export interface EnhancedPatterns {
  argumentPatterns: ArgumentPattern[];
  directoryPatterns: string[];
  fileTypePatterns: string[];
  errorCorrections: string[];
} 