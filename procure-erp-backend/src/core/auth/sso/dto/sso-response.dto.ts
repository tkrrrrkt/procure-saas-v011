// src/core/auth/sso/dto/sso-response.dto.ts

export class SsoAuthResponseDto {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    tenant_id: string;
  };
  access_token?: string;
  redirect_url?: string;
}

export class SsoConfigResponseDto {
  success: boolean;
  config?: {
    enabled: boolean;
    provider: string;
    tenant_id: string;
    callback_url: string;
    login_url: string;
  };
  message?: string;
}

export class SsoTestResponseDto {
  success: boolean;
  message: string;
  endpoints?: {
    authorization: string;
    token: string;
    userinfo: string;
  };
  error?: string;
}

export class SsoStatusResponseDto {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
    tenant_id: string;
  };
  login_method?: string;
  message?: string;
}