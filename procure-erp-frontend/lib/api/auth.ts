// src/lib/api/auth.ts

import { apiClient } from './client';
import { User, ApiResponse } from '../types/api';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export interface LoginResponse {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export const authApi = {
  async login(username: string, password: string, rememberMe: boolean): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<{
        user: User;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', {
        username,
        password,
        rememberMe,
      });
      
      if (response.status === 'success' && response.data) {
        // STEP 2: アクセストークンとリフレッシュトークンはCookieに自動保存される
        return {
          user: response.data.user,
          // 後方互換性のためにレスポンスのトークンを含める（実際は使用しない）
          accessToken: response.data.accessToken || null,
          refreshToken: null, // 安全のためリフレッシュトークンはクライアントに返さない
        };
      }
      
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
      };
    } catch (error) {
      console.error('ログインエラー:', error);
      throw error;
    }
  },
  
  async refreshToken(refreshTokenValue?: string): Promise<LoginResponse> {
    // リフレッシュトークンはCookieにすでに保存されている場合がほとんど
    // ただし後方互換性のため、パラメータからも受け付ける
    const requestBody = refreshTokenValue ? { refreshToken: refreshTokenValue } : {};
    
    const response = await apiClient.post<{
      user: User;
      accessToken: string;
      refreshToken?: string;
    }>('/auth/refresh', requestBody);
    
    if (response.status === 'success' && response.data) {
      return {
        user: response.data.user,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken || null,
      };
    }
    
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
    };
  },
  
  async logout(): Promise<void> {
    try {
      console.log('[DEBUG] ログアウト処理開始');
      // デバッグ: 現在のCookieを表示
      console.log('[DEBUG] ログアウトAPI呼び出し前のCookies:', document.cookie);
      
      // STEP 3: バックエンドAPI呼び出し
      // トークンはCookieにあるので自動的に送信される
      // バックエンドでトークンがブラックリストに追加され、Cookieも削除される
      const response = await apiClient.post<void>('/auth/logout');
      console.log('[DEBUG] ログアウトAPIレスポンス:', response);
      
      // デバッグ: レスポンス後のCookieを表示
      console.log('[DEBUG] ログアウトAPI呼び出し後のCookies:', document.cookie);
    } catch (error) {
      console.error('[DEBUG] ログアウトAPI呼び出しエラー:', error);
    } finally {
      // auth-utils.tsの共通関数を利用した確実なクリーンアップ処理
      try {
        // デバッグ: クリーンアップ処理前のCookieを表示
        console.log('[DEBUG] クリーンアップ処理前のCookies:', document.cookie);
        
        // 動的インポートを使用してユーティリティ関数をロード
        const { clearAllAuthData, debugCookies } = await import('@/utils/auth-utils');
        
        // デバッグ用: 削除前のCookie状態をログ
        debugCookies('[DEBUG] logout cleanup 前');
        
        // 認証関連データを完全にクリア
        clearAllAuthData();
        
        // デバッグ用: 削除後のCookie状態をログ
        debugCookies('[DEBUG] logout cleanup 後');
        
        // デバッグ: クリーンアップ処理後のCookieを表示
        console.log('[DEBUG] クリーンアップ処理後のCookies:', document.cookie);
        
        // 最後に強制リダイレクト（少し遅延を入れてクリーンアップ処理を確実に完了させる）
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // デバッグ用クエリパラメータを追加
            console.log('[DEBUG] ログインページへリダイレクト');
            window.location.href = '/login?clear=1&debug=1&t=' + new Date().getTime();
          }
        }, 300); // 遅延を300msに増加
      } catch (cleanupError) {
        console.error('[DEBUG] ログアウトクリーンアップエラー:', cleanupError);
        // エラーが発生した場合でも最低限のリダイレクトは実行
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
  },
  
  async checkAuth(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ authenticated: boolean }>('/auth/check');
      return response.status === 'success' && response.data?.authenticated === true;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * ユーザープロファイル情報を取得
   * JWTAuthGuardで保護されたエンドポイントを使用
   */
  async getProfile(): Promise<User | null> {
    try {
      // トークンはCookieから自動送信される
      const response = await apiClient.get<{ user: User }>('/auth/profile');
      
      if (response.status === 'success' && response.data?.user) {
        return response.data.user;
      }
      return null;
    } catch (error: any) {
      console.error('プロファイル取得エラー:', error);
      // 認証エラー(401/403)の場合、ローカルストレージもクリア
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          localStorage.removeItem('auth-storage');
        }
      }
      return null;
    }
  }
};

export const loginWithoutCsrf = async (username: string, password: string) => {
  try {
    // 直接Axiosを使用し、CSRFトークンなしでリクエスト
    const response = await axios.post(
      `${API_URL}/auth/login`, 
      { username, password },
      { withCredentials: true }
    );
    
    if (response.data.status === 'success') {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '認証に失敗しました');
  } catch (error) {
    console.error('ログインエラー:', error);
    throw error;
  }
};