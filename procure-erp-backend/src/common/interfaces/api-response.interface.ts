export interface ApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
    meta?: {
      total?: number;
      page?: number;
      limit?: number;
    };
  }