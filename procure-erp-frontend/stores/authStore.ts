import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  role: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  loading: boolean
  initialized: boolean // 追加：初期化完了フラグ
  /** ログイン成功時に呼び出す */
  login: (u: User, at: string) => void
  /** ログアウト時に呼び出す */
  logout: () => void
  /** スピナー制御などに利用 */
  setLoading: (v: boolean) => void
  /** 初期化完了フラグを設定 */
  setInitialized: (v: boolean) => void // 追加：初期化設定メソッド
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      loading: false,
      initialized: false, // 追加：初期値はfalse

      login: (user, accessToken) =>
        set({
          user,
          // セキュリティ対策: HTTPOnly Cookie経由で認証を行うため、
          // アクセストークンはストアに保存せず、空文字列を設定します
          accessToken: '',
          loading: false,
        }),

      logout: () => set({ user: null, accessToken: null, loading: false }),

      setLoading: (v) => set({ loading: v }),
      
      // 追加：初期化フラグ設定メソッド
      setInitialized: (v) => set({ initialized: v }),
    }),
    {
      name: 'auth-storage',                            // LocalStorage のキー
      storage: createJSONStorage(() => localStorage), // LocalStorage に永続化
      partialize: (s) => ({
        user: s.user,
        // セキュリティ対策: HTTPOnly Cookie経由で認証を行うため、
        // アクセストークンはストアに永続化しません
        accessToken: '',
        // 注：initializedフラグは永続化しない（セッションごとに初期化）
      }),
    },
  ),
)
