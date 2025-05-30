// app/protected-layout.tsx
"use client";

import React, { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/useAuth";
import { useAuthStore } from "@/stores/authStore";

import Header from "@/components/header";
import Sidebar from "@/components/sidebar";

export default function ProtectedLayout({
  children,
}: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  // 初期化フラグを取得
  const initialized = useAuthStore((state) => state.initialized);

  console.log('Protected Layout:', { loading, user, initialized });

  // リダイレクト関数を定義（useCallbackでメモ化）
  const redirectToLogin = useCallback(() => {
    console.log('未認証状態を検出：ログイン画面へリダイレクト');
    router.replace("/login");
  }, [router]);

  /* ① 認証状態の確認 - すべての条件をuseEffect内で処理 */
  useEffect(() => {
    // 初期化完了かつロード中でない場合のみ評価
    if (initialized && !loading) {
      if (!user) {
        redirectToLogin();
      } else {
        console.log('認証済み状態を確認：保護ページへのアクセス許可');
      }
    }
  }, [initialized, loading, user, redirectToLogin]);

  /* ② 条件付きの追加リダイレクト - Hooks順序の問題を修正 */
  useEffect(() => {
    // このuseEffectは常に実行されるが、条件によって中身が変わる
    if (initialized && !loading && !user) {
      // ここでリダイレクト関数を呼び出し
      redirectToLogin();
    }
  }, [initialized, loading, user, redirectToLogin]);

  /* ③ ローディング状態の表示 */
  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-semibold">認証確認中...</div>
          <div className="text-sm text-gray-500">しばらくお待ちください</div>
        </div>
      </div>
    );
  }

  /* ④ 認証確認 - 初期化と読み込みが完了してもユーザーがない場合 */
  if (!user) {
    // 条件付きuseEffectの代わりに、レンダリング時の表示のみ
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-xl font-semibold">ログイン画面にリダイレクト中...</div>
          <div className="text-sm text-gray-500">認証情報の確認が必要です</div>
        </div>
      </div>
    );
  }

  /* ⑤ 認証済みレイアウト - すべての条件を満たした場合のみ表示 */
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
