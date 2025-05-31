"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/stores/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormField } from "@/components/ui/form-field"
import { useForm } from "@/hooks/use-form"
import { loginSchema, LoginFormValues } from "@/lib/validations/auth"
import { Checkbox } from "@/components/ui/checkbox"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { toast } = useToast()

  // SSO認証開始ハンドラー
  const handleSsoLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
    console.log("SSO認証開始:", apiUrl)
    window.location.href = `${apiUrl}/auth/sso/login`
  }

  // ページロード時にURLパラメータをチェック
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      // ?clear=1 パラメータがある場合は認証データの追加クリーンアップを実行
      if (params.get('clear') === '1') {
        console.log('ログインページで認証クリアパラメータを検出');
        
        // 履歴を修正（クリアパラメータを削除）
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        // 認証データクリーンアップを実行
        import('@/utils/auth-utils').then(({ clearAllAuthData, debugCookies }) => {
          debugCookies('Login page - before cleanup');
          clearAllAuthData();
          debugCookies('Login page - after cleanup');
          
          // クリーンアップ完了通知
          toast({
            description: "ログアウト処理が完了しました",
          });
        }).catch(err => {
          console.error('ログインページでのクリーンアップエラー:', err);
        });
      }
    }
  }, [toast]);

  // useFormフックでフォーム状態を管理
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    watch,
    setValue,
    submitForm,
    serverErrors
  } = useForm(loginSchema, {
    username: "",
    password: "",
    rememberMe: false
  })

  // フォーム送信処理
  const onSubmit = async (data: LoginFormValues) => {
    try {
      // フォーム送信関数を使用して処理を行う
      await submitForm(async (formData) => {
        console.log("ログイン試行:", { username: formData.username, rememberMe: formData.rememberMe })
        console.log("API URL:", process.env.NEXT_PUBLIC_API_URL)
        
        // テスト用の仮の認証処理（本番環境では削除すること）
        if (formData.username === "admin" && formData.password === "password") {
          const testUser = {
            id: "1",
            username: "admin",
            role: "ADMIN"
          };
          
          localStorage.setItem("user", JSON.stringify(testUser));
          localStorage.setItem("accessToken", "test-token");
          
          console.log("認証情報を保存しました:", {
            user: localStorage.getItem("user"),
            token: localStorage.getItem("accessToken")
          });
          
          toast({
            title: "ログイン成功",
            description: "ダッシュボードにリダイレクトします",
          });
          
          router.push("/dashboard");
          return true;
        }
        
        // 実際のAPI呼び出し
        const success = await login(formData.username, formData.password, formData.rememberMe)
        
        if (success) {
          toast({
            title: "ログイン成功",
            description: "ダッシュボードにリダイレクトします",
          })
          router.push("/dashboard")
          return success
        } else {
          // 認証失敗
          throw new Error("ユーザー名またはパスワードが正しくありません")
        }
      });
    } catch (err) {
      // エラー処理はuseFormフックで行われますが、
      // 一般的なエラーに対してはここで処理
      console.error("ログインエラー:", err)
      
      toast({
        title: "ログイン失敗",
        description: err instanceof Error ? err.message : "ログイン処理中にエラーが発生しました",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">ProcureERP ログイン</CardTitle>
          <CardDescription>
            購買管理システムにログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* APIからの一般的なエラーメッセージ表示 */}
          {serverErrors && serverErrors["_error"] && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverErrors["_error"][0]}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* ユーザー名フィールド */}
            <FormField
              label="ユーザー名"
              name="username"
              error={errors.username}
              serverErrors={serverErrors}
              required
            >
              <Input
                id="username"
                {...register("username")}
                placeholder="ユーザー名を入力"
                autoComplete="username"
                aria-invalid={errors.username ? "true" : "false"}
              />
            </FormField>
            
            {/* パスワードフィールド */}
            <FormField
              label="パスワード"
              name="password"
              error={errors.password}
              serverErrors={serverErrors}
              required
            >
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                aria-invalid={errors.password ? "true" : "false"}
              />
            </FormField>
            
            {/* ログイン状態保持チェックボックス */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={watch("rememberMe")}
                onCheckedChange={(checked) => setValue("rememberMe", checked as boolean)}
              />
              <label 
                htmlFor="rememberMe" 
                className="text-sm font-normal cursor-pointer"
              >
                ログイン状態を保持する
              </label>
            </div>
            
            {/* ログインボタン */}
            <Button 
              type="submit"
              className="w-full mt-6" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </Button>

            {/* または */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">または</span>
              </div>
            </div>

            {/* SSO認証ボタン */}
            <Button 
              type="button"
              onClick={handleSsoLogin}
              variant="outline" 
              className="w-full"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M23.3 12.3c0-.8-.1-1.6-.3-2.3H12v4.4h6.4c-.3 1.5-1.1 2.8-2.3 3.7v3.1h3.7c2.2-2 3.5-5 3.5-8.9z"/>
                <path fill="currentColor" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-3.1c-1.1.7-2.5 1.2-4.2 1.2-3.2 0-5.9-2.2-6.9-5.1H1.4v3.2C3.4 21.4 7.4 24 12 24z"/>
                <path fill="currentColor" d="M5.1 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V6.7H1.4C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.3l3.7-3.2z"/>
                <path fill="currentColor" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5C18 1.1 15.3 0 12 0 7.4 0 3.4 2.6 1.4 6.7l3.7 3.2c1-2.9 3.7-5.1 6.9-5.1z"/>
              </svg>
              Microsoftでログイン
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            テスト用アカウント: admin / password
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}