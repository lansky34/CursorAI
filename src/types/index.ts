export interface Business {
  _id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  sentimentScore: number;
  visitCount: number;
  badges: string[];
  aspectSentiment: Map<string, {
    score: number;
    count: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ErrorResponse {
  status: string;
  message: string;
  errorId?: string;
  stack?: string;
} 