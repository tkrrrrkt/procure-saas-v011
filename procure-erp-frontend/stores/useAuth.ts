// procure-erp-frontend/stores/useAuth.ts
"use client";

import { useAuthStore, User } from "./authStore";
import { authApi } from "@/lib/api/auth";          // ← 既存の API ラッパー

/** 画面から見える型 */
export interface UseAuthReturn {
  /** 画面用ラッパー – 成功すれば true */
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => void;
  user: User | null;
  loading: boolean;
}

export const useAuth = (): UseAuthReturn => {
  /** store の setter／state を個別に取得 */
  const setLoading = useAuthStore((s) => s.setLoading);
  const writeLogin = useAuthStore((s) => s.login);
  const logout     = useAuthStore((s) => s.logout);
  const user       = useAuthStore((s) => s.user);
  const loading    = useAuthStore((s) => s.loading);

  /** 画面用ラッパー */
  const login = async (username: string, password: string, rememberMe: boolean): Promise<boolean> => {
    try {
      setLoading(true);
      const res = await authApi.login(username, password, rememberMe);

      if (res.user) {
        // STEP 2: トークンはCookieに自動保存される
        // 後方互換性のためにアクセストークンをストアに渡すが、
        // 実際にはCookieから自動送信されるため使用されない
        writeLogin(res.user, res.accessToken || '');
        return true;
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: ログアウト処理は authApi.logout を使用
  const handleLogout = async () => {
    try {
      // デバッグ情報の記録 - ログアウト開始
      console.log('useAuth: ログアウト処理を開始');
      
      // 認証APIを通じたログアウト処理を呼び出し
      await authApi.logout(); // 強化されたログアウト処理を呼び出し
      
      // デバッグ情報の記録 - ログアウト完了（成功時）
      console.log('useAuth: ログアウト処理が完了しました');
    } catch (error) {
      // エラー時のフォールバック処理
      console.error('useAuth: ログアウト処理でエラーが発生しました', error);
      
      // ストア状態のクリア（最低限のクリーンアップ）
      logout();
      
      // 自力でクリーンアップを試みる
      try {
        const { clearAllAuthData } = await import('@/utils/auth-utils');
        clearAllAuthData();
      } catch (cleanupError) {
        console.error('useAuth: フォールバッククリーンアップでエラーが発生', cleanupError);
      }
      
      // 最後にリダイレクト
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  return { login, logout: handleLogout, user, loading };
};
