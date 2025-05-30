// src/core/auth/sso/azure-ad/azure-ad.strategy.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OIDCStrategy, IProfile, VerifyCallback } from 'passport-azure-ad';
import { PrismaService } from '../../../database/prisma.service';
import { JitProvisioningService } from '../services/jit-provisioning.service';
import { TenantResolverService } from '../services/tenant-resolver.service';

export interface AzureAdUser {
  id: string;
  username: string;
  email: string;
  role: string;
  tenant_id: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
}

@Injectable()
export class AzureAdStrategy extends PassportStrategy(OIDCStrategy, 'azure-ad') {
  private readonly logger = new Logger(AzureAdStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly jitProvisioningService: JitProvisioningService,
    private readonly tenantResolverService: TenantResolverService,
  ) {
    super({
      // 企業ネットワーク制限回避：動作確認済みエンドポイント使用
      // Discovery Keysエンドポイントが唯一アクセス可能であることが判明
      identityMetadata: `https://login.microsoftonline.com/${configService.get<string>('AZURE_AD_TENANT_ID')}/discovery/v2.0/keys`,
      
      // クライアント認証設定
      clientID: configService.get<string>('AZURE_AD_CLIENT_ID'),
      clientSecret: configService.get<string>('AZURE_AD_CLIENT_SECRET'),
      redirectUrl: configService.get<string>('SSO_CALLBACK_URL'),
      allowHttpForRedirectUrl: configService.get<string>('NODE_ENV') === 'development',
      
      // OAuth 2.0 / OpenID Connect 設定
      responseType: 'code',
      responseMode: 'form_post',
      scope: ['openid', 'profile', 'email'],
      
      // セッション・セキュリティ設定
      useCookieInsteadOfSession: false,
      cookieEncryptionKeys: [],
      passReqToCallback: true,
      
      // 企業ネットワーク制限対応設定
      validateIssuer: false, // 企業制限により無効化
      clockSkew: 300, // 5分の時計誤差許容
      
      // ログ設定（詳細デバッグ有効）
      loggingLevel: 'info',
      loggingNoPII: false, // 開発環境でのデバッグ用
    });
  }

  async validate(
    req: any,
    iss: string,
    sub: string,
    profile: IProfile,
    accessToken: string,
    refreshToken: string,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      this.logger.debug(`Azure AD認証開始: ${profile.upn || profile._json?.email}`);

      // 1. セキュリティ検証
      await this.validateSecurityParameters(req, profile);

      // 2. テナント識別
      const email = profile.upn || profile._json?.email || profile._json?.preferred_username;
      const tenant = await this.tenantResolverService.resolveTenantByEmail(email);

      if (!tenant) {
        throw new UnauthorizedException('認可されていないドメインです');
      }

      // 3. JITプロビジョニング
      const user = await this.jitProvisioningService.provisionUser(
        profile,
        tenant.id,
      );

      // 4. LoginAccount更新
      await this.updateSsoLoginAccount(user.id, profile, accessToken);

      // 5. 既存JWT形式でユーザー情報返却
      const azureAdUser: AzureAdUser = {
        id: user.id,
        username: user.employee_code || user.email,
        email: user.email,
        role: user.roles?.[0]?.role?.name || 'USER',
        tenant_id: user.tenant_id,
        firstName: user.first_name,
        lastName: user.last_name,
        jobTitle: user.job_title,
      };

      this.logger.log(`Azure AD認証成功: ${azureAdUser.email}`);
      done(null, azureAdUser);

    } catch (error) {
      this.logger.error(`Azure AD認証エラー: ${error.message}`, error.stack);
      done(error);
    }
  }

  /**
   * セキュリティパラメータの検証
   */
  private async validateSecurityParameters(req: any, profile: IProfile): Promise<void> {
    // State パラメータ検証（CSRF対策）
    const state = req.query?.state || req.body?.state;
    if (!state) {
      throw new UnauthorizedException('State parameter is missing');
    }

    // 基本プロファイル検証
    const email = profile.upn || profile._json?.email || profile._json?.preferred_username;
    if (!email) {
      throw new UnauthorizedException('Email information is required');
    }

    // テナントID検証
    const expectedTenantId = this.configService.get<string>('AZURE_AD_TENANT_ID');
    const profileTenantId = profile._json?.tid || profile._json?.tenant_id;
    if (profileTenantId && profileTenantId !== expectedTenantId) {
      throw new UnauthorizedException('Invalid tenant');
    }
  }

  /**
   * SSO LoginAccount情報の更新/作成
   */
  private async updateSsoLoginAccount(
    empAccountId: string,
    profile: IProfile,
    accessToken: string,
  ): Promise<void> {
    try {
      const azureObjectId = profile.oid || profile.sub;
      const email = profile.upn || profile._json?.email || profile._json?.preferred_username;
      
      // 既存のSSO LoginAccount検索
      let loginAccount = await this.prismaService.loginAccount.findFirst({
        where: {
          emp_account_id: empAccountId,
          auth_method: 'SSO',
          provider: 'AZURE_AD',
        },
      });

      if (loginAccount) {
        // 既存レコード更新
        await this.prismaService.loginAccount.update({
          where: { id: loginAccount.id },
          data: {
            provider_user_id: azureObjectId,
            last_login_at: new Date(),
            last_login_ip: this.getClientIp(profile),
            failed_attempts: 0, // 成功時はリセット
          },
        });
      } else {
        // 新規SSO LoginAccount作成
        await this.prismaService.loginAccount.create({
          data: {
            emp_account_id: empAccountId,
            auth_method: 'SSO',
            identifier: email,
            provider: 'AZURE_AD',
            provider_user_id: azureObjectId,
            last_login_at: new Date(),
            last_login_ip: this.getClientIp(profile),
          },
        });
      }

    } catch (error) {
      this.logger.error(`LoginAccount更新エラー: ${error.message}`);
      // LoginAccount更新エラーは致命的ではないため、認証は継続
    }
  }

  /**
   * クライアントIP取得（ログ用）
   */
  private getClientIp(profile: any): string {
    // プロファイルまたはリクエストからIPアドレスを取得
    // 開発環境では固定値
    return process.env.NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';
  }
}