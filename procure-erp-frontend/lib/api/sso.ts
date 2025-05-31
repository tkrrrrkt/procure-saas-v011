// lib/api/sso.ts
// SSO管理専用API関数

import { apiClient } from './client';
import { ApiResponse } from '../types/api';

// SSO設定関連の型定義
export interface SsoConfig {
  enabled: boolean;
  provider: string;
  tenantId: string;
  callbackUrl: string;
  loginUrl: string;
}

export interface SsoConfigUpdateRequest {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

export interface SsoConnectionTestResult {
  success: boolean;
  message: string;
  endpoints?: {
    authorization: string;
    token: string;
    userinfo: string;
  };
  error?: string;
}

export interface SsoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SsoUsersResponse {
  users: SsoUser[];
  total: number;
  page: number;
  limit: number;
}

/**
 * SSO専用API関数群
 * バックエンドのSSO endpointsと連携
 */
export const ssoApi = {
  /**
   * SSO設定情報を取得
   */
  async getSsoConfig(): Promise<SsoConfig> {
    try {
      const response = await apiClient.get<{ config: SsoConfig }>('/auth/sso/config');
      
      if (response.status === 'success' && response.data?.config) {
        return response.data.config;
      }
      
      throw new Error('SSO設定の取得に失敗しました');
    } catch (error) {
      console.error('SSO設定取得エラー:', error);
      throw error;
    }
  },

  /**
   * SSO設定を更新/保存
   */
  async updateSsoConfig(config: SsoConfigUpdateRequest): Promise<boolean> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/admin/sso/config', config);
      
      if (response.status === 'success' && response.data?.success) {
        return true;
      }
      
      throw new Error(response.data?.message || 'SSO設定の保存に失敗しました');
    } catch (error) {
      console.error('SSO設定保存エラー:', error);
      throw error;
    }
  },

  /**
   * SSO接続テストを実行
   */
  async testSsoConnection(): Promise<SsoConnectionTestResult> {
    try {
      const response = await apiClient.post<SsoConnectionTestResult>('/auth/sso/test');
      
      if (response.status === 'success' && response.data) {
        return response.data;
      }
      
      throw new Error('SSO接続テストの実行に失敗しました');
    } catch (error) {
      console.error('SSO接続テストエラー:', error);
      throw error;
    }
  },

  /**
   * SSO認証状態を確認
   */
  async checkSsoStatus(): Promise<{ authenticated: boolean; user?: any; loginMethod?: string }> {
    try {
      const response = await apiClient.get<{
        authenticated: boolean;
        user?: any;
        loginMethod?: string;
      }>('/auth/sso/status');
      
      if (response.status === 'success' && response.data) {
        return response.data;
      }
      
      return { authenticated: false };
    } catch (error) {
      console.error('SSO状態確認エラー:', error);
      return { authenticated: false };
    }
  },

  /**
   * SSO作成ユーザー一覧を取得
   */
  async getSsoUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<SsoUsersResponse> {
    try {
      const response = await apiClient.get<{ 
        success: boolean; 
        data: SsoUsersResponse;
      }>('/admin/sso/users', params);
      
      if (response.status === 'success' && response.data?.success && response.data?.data) {
        return response.data.data;
      }
      
      throw new Error('SSOユーザー一覧の取得に失敗しました');
    } catch (error) {
      console.error('SSOユーザー取得エラー:', error);
      throw error;
    }
  },

  /**
   * SSO認証でログアウト
   */
  async ssoLogout(): Promise<boolean> {
    try {
      const response = await apiClient.post<{ success: boolean }>('/auth/sso/logout');
      
      if (response.status === 'success' && response.data?.success) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('SSOログアウトエラー:', error);
      return false;
    }
  },

  /**
   * SSO設定の検証
   */
  async validateSsoConfig(config: SsoConfigUpdateRequest): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // 基本的なバリデーション
    if (!config.tenantId || config.tenantId.trim() === '') {
      errors.push('テナントIDは必須です');
    }

    if (!config.clientId || config.clientId.trim() === '') {
      errors.push('クライアントIDは必須です');
    }

    if (!config.clientSecret || config.clientSecret.trim() === '') {
      errors.push('クライアントシークレットは必須です');
    }

    // Azure AD Tenant ID形式チェック（GUID形式）
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (config.tenantId && !guidRegex.test(config.tenantId)) {
      errors.push('テナントIDの形式が正しくありません（GUID形式で入力してください）');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * SSO設定のテンプレート生成
   */
  getSsoConfigTemplate(): SsoConfigUpdateRequest {
    return {
      tenantId: '',
      clientId: '',
      clientSecret: '',
      enabled: true,
    };
  }
};

export default ssoApi;
