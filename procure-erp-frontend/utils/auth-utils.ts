/**
 * 認証関連のユーティリティ関数
 */

/**
 * すべての認証関連Cookieを確実に削除する
 * 複数のパスとドメインの組み合わせでCookieを削除（網羅的アプローチ）
 */
export function clearAuthCookies(): void {
  if (typeof window === 'undefined') return;

  const domain = window.location.hostname;
  // ローカル開発環境（localhost）の場合は特別な処理も必要
  const isLocalhost = domain === 'localhost';
  
  // 複数のパスとドメインの組み合わせを試す
  const paths = ['/', '/api', '/api/auth', '/auth', ''];
  // ドットありなしの両方と、空文字列（特にlocalhostの場合）も試す
  const domains = isLocalhost 
    ? ['', 'localhost', '.localhost'] 
    : [domain, `.${domain}`, ''];
  
  // 削除対象のCookie名
  const cookieNames = ['access_token', 'token', 'refresh_token', 'csrf_token'];
  
  console.log('[DEBUG] clearAuthCookies: 削除開始 - domains:', domains, 'paths:', paths);
  
  // 網羅的にすべての組み合わせでCookieを削除
  cookieNames.forEach(name => {
    paths.forEach(path => {
      domains.forEach(dom => {
        // ドメイン指定ありの場合
        if (dom) {
          // 標準的な属性指定 - SameSite=Strict（大文字始まり）
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${dom}; SameSite=Strict;`;
          // セキュア属性も試す（HTTPSの場合のみ有効）
          if (window.location.protocol === 'https:') {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${dom}; SameSite=Strict; Secure;`;
          }
          
          // 小文字バージョンも試す（sameSite=strict）
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${dom}; sameSite=strict;`;
          if (window.location.protocol === 'https:') {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${dom}; sameSite=strict; secure;`;
          }
        } 
        // ドメイン指定なしの場合（特にlocalhostで有効な場合がある）
        else {
          // 大文字バージョン
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=Strict;`;
          // セキュア属性も試す
          if (window.location.protocol === 'https:') {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=Strict; Secure;`;
          }
          
          // 小文字バージョン
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; sameSite=strict;`;
          if (window.location.protocol === 'https:') {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; sameSite=strict; secure;`;
          }
        }
      });
    });
  });
  
  console.log('[DEBUG] clearAuthCookies: 削除後のCookies:', document.cookie);
}

/**
 * すべての認証関連ストレージをクリアする
 * ログアウト時に呼び出す
 */
export function clearAllAuthData(): void {
  console.log('[DEBUG] clearAllAuthData: クリーンアップ開始');
  clearAuthCookies();
  if (typeof window !== 'undefined') {
    const localStorageKeys = [
      'auth_state',
      'auth_user',
      'auth_token',
      'auth_session',
      'user_data',
      'token_data',
      'accessToken',
      'user',
      'auth-storage'
    ];
    const sessionStorageKeys = [
      'auth_session',
      'current_user',
      'session_data',
      'token_data'
    ];
    localStorageKeys.forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.error(`[DEBUG] LocalStorageの削除でエラー: ${key}`, e);
      }
    });
    sessionStorageKeys.forEach(key => {
      try {
        window.sessionStorage.removeItem(key);
      } catch (e) {
        console.error(`[DEBUG] SessionStorageの削除でエラー: ${key}`, e);
      }
    });
  }
  console.log('[DEBUG] clearAllAuthData: すべての認証データをクリア完了');
}

/**
 * デバッグ用: 現在のCookie情報をコンソールに表示
 */
export function debugCookies(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`--- ${message} ---`);
    console.log('Current cookies:', document.cookie);
    // Note: httpOnly Cookieは表示できないので、開発者ツールで確認必要
  }
}
