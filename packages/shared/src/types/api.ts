export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const ok = <T>(data: T): ApiSuccess<T> => ({ ok: true, data });

export const fail = (code: string, message: string, details?: unknown): ApiFailure => ({
  ok: false,
  error: { code, message, details }
});
