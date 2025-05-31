"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle, Settings, TestTube, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ssoApi, SsoConfig, SsoConfigUpdateRequest, SsoConnectionTestResult } from "@/lib/api/sso"

export default function SsoAdminPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 状態管理
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [currentConfig, setCurrentConfig] = useState<SsoConfig | null>(null)
  const [formData, setFormData] = useState<SsoConfigUpdateRequest>(ssoApi.getSsoConfigTemplate())
  const [testResult, setTestResult] = useState<SsoConnectionTestResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  // 初期データ読み込み
  useEffect(() => {
    loadSsoConfig()
  }, [])

  const loadSsoConfig = async () => {
    try {
      setLoading(true)
      const config = await ssoApi.getSsoConfig()
      setCurrentConfig(config)
      
      // フォームデータに反映（セキュリティ上、シークレットは表示しない）
      setFormData({
        tenantId: config.tenantId,
        clientId: '', // 現在のクライアントIDは取得できないため空白
        clientSecret: '', // セキュリティ上、シークレットは表示しない
        enabled: config.enabled,
      })
    } catch (error) {
      console.error('SSO設定読み込みエラー:', error)
      toast({
        title: "エラー",
        description: "SSO設定の読み込みに失敗しました",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setErrors([])

      // バリデーション実行
      const validation = await ssoApi.validateSsoConfig(formData)
      if (!validation.valid) {
        setErrors(validation.errors)
        return
      }

      // 設定保存
      await ssoApi.updateSsoConfig(formData)
      
      toast({
        title: "保存完了",
        description: "SSO設定が正常に保存されました",
      })

      // 設定を再読み込み
      await loadSsoConfig()

    } catch (error) {
      console.error('SSO設定保存エラー:', error)
      toast({
        title: "保存失敗",
        description: error instanceof Error ? error.message : "設定の保存に失敗しました",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConnectionTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)

      const result = await ssoApi.testSsoConnection()
      setTestResult(result)

      if (result.success) {
        toast({
          title: "接続テスト成功",
          description: "Azure ADとの接続が確認できました",
        })
      } else {
        toast({
          title: "接続テスト失敗",
          description: result.message || "Azure ADとの接続に失敗しました",
          variant: "destructive",
        })
      }

    } catch (error) {
      console.error('接続テストエラー:', error)
      const errorResult: SsoConnectionTestResult = {
        success: false,
        message: error instanceof Error ? error.message : "接続テストでエラーが発生しました",
        error: error instanceof Error ? error.message : "Unknown error"
      }
      setTestResult(errorResult)

      toast({
        title: "接続テスト失敗",
        description: errorResult.message,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">SSO設定を読み込み中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SSO管理</h1>
        <p className="text-muted-foreground mt-2">
          Azure Active Directory シングルサインオンの設定と管理
        </p>
      </div>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* タブナビゲーション */}
      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            基本設定
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            接続テスト
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            ユーザー管理
          </TabsTrigger>
        </TabsList>

        {/* 基本設定タブ */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Azure AD設定</CardTitle>
              <CardDescription>
                Azure Active Directoryとの連携に必要な設定を行います
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SSO有効/無効 */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sso-enabled" className="text-base font-medium">
                    SSO認証を有効にする
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    ユーザーがMicrosoftアカウントでログインできるようになります
                  </p>
                </div>
                <Switch
                  id="sso-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {/* Azure AD Tenant ID */}
              <div className="space-y-2">
                <Label htmlFor="tenant-id">Azure AD テナントID *</Label>
                <Input
                  id="tenant-id"
                  type="text"
                  placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={formData.tenantId}
                  onChange={(e) => 
                    setFormData(prev => ({ ...prev, tenantId: e.target.value }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Azure PortalのAzure Active Directory → 概要から確認できます
                </p>
              </div>

              {/* Azure AD Client ID */}
              <div className="space-y-2">
                <Label htmlFor="client-id">アプリケーション (クライアント) ID *</Label>
                <Input
                  id="client-id"
                  type="text"
                  placeholder="例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={formData.clientId}
                  onChange={(e) => 
                    setFormData(prev => ({ ...prev, clientId: e.target.value }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Azure Portalのアプリ登録 → 概要から確認できます
                </p>
              </div>

              {/* Azure AD Client Secret */}
              <div className="space-y-2">
                <Label htmlFor="client-secret">クライアントシークレット *</Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder="Azure ADで生成されたクライアントシークレット"
                  value={formData.clientSecret}
                  onChange={(e) => 
                    setFormData(prev => ({ ...prev, clientSecret: e.target.value }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Azure Portalのアプリ登録 → 証明書とシークレットで生成・確認できます
                </p>
              </div>

              {/* 現在の設定情報（読み取り専用） */}
              {currentConfig && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">現在の設定情報</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">プロバイダー:</span>
                      <span className="ml-2 font-mono">{currentConfig.provider}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ステータス:</span>
                      <span className={`ml-2 font-mono ${currentConfig.enabled ? 'text-green-600' : 'text-red-600'}`}>
                        {currentConfig.enabled ? '有効' : '無効'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">コールバックURL:</span>
                      <span className="ml-2 font-mono break-all">{currentConfig.callbackUrl}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-4 pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? "保存中..." : "設定を保存"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={loadSsoConfig}
                  disabled={loading}
                >
                  設定を再読み込み
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 接続テストタブ */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Azure AD接続テスト</CardTitle>
              <CardDescription>
                現在の設定でAzure Active Directoryに正常に接続できるかテストします
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleConnectionTest} 
                disabled={testing}
                className="w-full"
              >
                {testing ? "テスト実行中..." : "接続テストを実行"}
              </Button>

              {/* テスト結果表示 */}
              {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">
                        {testResult.success ? "接続テスト成功" : "接続テスト失敗"}
                      </p>
                      <p>{testResult.message}</p>
                      
                      {testResult.success && testResult.endpoints && (
                        <div className="mt-4 space-y-1">
                          <p className="font-medium">確認されたエンドポイント:</p>
                          <ul className="text-sm space-y-1">
                            <li>認証: {testResult.endpoints.authorization}</li>
                            <li>トークン: {testResult.endpoints.token}</li>
                            <li>ユーザー情報: {testResult.endpoints.userinfo}</li>
                          </ul>
                        </div>
                      )}

                      {!testResult.success && testResult.error && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">
                            エラー詳細: {testResult.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ユーザー管理タブ */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SSOユーザー管理</CardTitle>
              <CardDescription>
                SSO認証で作成されたユーザーアカウントの管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  ユーザー管理機能は次のバージョンで実装予定です
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
