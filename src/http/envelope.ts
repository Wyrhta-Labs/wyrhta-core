export interface Meta {
  total?: number;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  meta: Meta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
