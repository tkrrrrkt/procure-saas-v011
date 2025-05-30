// src/core/auth/sso/azure-ad/azure-ad-oauth2.strategy.ts
// 企業ネットワーク制限回避: OAuth2Strategy実装

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
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
export class AzureAdOAuth2Strategy extends PassportStrategy(OAuth2Strategy, 'azure-ad') {
  private readonly logger = new Logger(AzureAdOAuth2Strategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly jitProvisioningService: JitProvisioningService,
    private readonly tenantResolverService: TenantResolverService,
  ) {
    const tenantId = configService.get<string>('AZURE_AD_TENANT_ID');
    
    super({
      // v2.0エンドポイント使用：Microsoft Graph API互換のaudienceを取得
      authorizationURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      
      // クライアント認証設定
      clientID: configService.get<string>('AZURE_AD_CLIENT_ID'),
      clientSecret: configService.get<string>('AZURE_AD_CLIENT_SECRET'),
      callbackURL: configService.get<string>('SSO_CALLBACK_URL'),
      
      // OAuth2パラメータ（Microsoft Graph API v2.0用）
      scope: ['https://graph.microsoft.com/User.Read'], // Graph API用の完全なスコープ指定
      
      // Azure AD固有パラメータ
      customHeaders: {
        'User-Agent': 'ProcureERP-SSO/1.0',
      },
      
      // 追加のOAuth2パラメータ
      skipUserProfile: true, // 手動でGraph APIを呼び出すため
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<void> {
    try {
      this.logger.log('Azure AD OAuth2認証開始');

      // Microsoft Graph APIを使用してユーザー情報を取得
      const userProfile = await this.getUserProfileFromGraph(accessToken);
      
      // OIDCプロファイル形式に変換
      const oidcProfile = this.convertToOIDCProfile(userProfile);
      
      // 既存のvalidateロジックを再利用
      const azureAdUser = await this.processUserValidation(oidcProfile, accessToken);
      
      this.logger.log(`Azure AD OAuth2認証成功: ${azureAdUser.email}`);
      done(null, azureAdUser);
      
    } catch (error) {
      this.logger.error(`Azure AD OAuth2認証エラー: ${error.message}`, error.stack);
      done(error);
    }
  }

  /**
   * Microsoft Graph APIを使用してユーザー情報を取得
   */
  private async getUserProfileFromGraph(accessToken: string): Promise<any> {
    const axios = require('axios');
    
    try {
      this.logger.debug('Microsoft Graph APIからユーザー情報を取得');
      this.logger.debug(`アクセストークン: ${accessToken?.substring(0, 50)}...`);
      
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      this.logger.debug(`Graph API応答: ${JSON.stringify(response.data)}`);
      return response.data;
      
    } catch (error) {
      // 詳細なエラー情報をログ出力
      this.logger.error(`Graph API呼び出しエラー: ${error.message}`);
      if (error.response) {
        this.logger.error(`Graph APIエラーレスポンス: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`ステータスコード: ${error.response.status}`);
      }
      this.logger.error(`完全なエラー: ${JSON.stringify(error)}`);
      throw new UnauthorizedException('Failed to get user profile from Microsoft Graph');
    }
  }

  /**
   * Graph APIレスポンスをOIDCプロファイル形式に変換
   */
  private convertToOIDCProfile(graphProfile: any): any {
    return {
      oid: graphProfile.id,
      sub: graphProfile.id,
      upn: graphProfile.userPrincipalName,
      _json: {
        email: graphProfile.mail || graphProfile.userPrincipalName,
        preferred_username: graphProfile.userPrincipalName,
        given_name: graphProfile.givenName,
        family_name: graphProfile.surname,
        name: graphProfile.displayName,
        job_title: graphProfile.jobTitle,
        tid: this.configService.get<string>('AZURE_AD_TENANT_ID'), // 正しいテナントIDを設定
      },
    };
  }

  /**
   * 既存のvalidationロジックを再利用
   */
  private async processUserValidation(profile: any, accessToken: string): Promise<AzureAdUser> {
    // 1. セキュリティ検証（簡略版）
    const email = profile.upn || profile._json?.email || profile._json?.preferred_username;
    if (!email) {
      throw new UnauthorizedException('Email information is required');
    }

    // 2. テナント識別
    const tenant = await this.tenantResolverService.resolveTenantByEmail(email);
    if (!tenant) {
      throw new UnauthorizedException('認可されていないドメインです');
    }

    // 3. JITプロビジョニング
    const user = await this.jitProvisioningService.provisionUser(profile, tenant.id);

    // 4. LoginAccount更新
    await this.updateSsoLoginAccount(user.id, profile, accessToken);

    // 5. 既存JWT形式でユーザー情報返却
    return {
      id: user.id,
      username: user.employee_code || user.email,
      email: user.email,
      role: user.roles?.[0]?.role?.name || 'USER',
      tenant_id: user.tenant_id,
      firstName: user.first_name,
      lastName: user.last_name,
      jobTitle: user.job_title,
    };
  }

  /**
   * SSO LoginAccount情報の更新/作成
   */
  private async updateSsoLoginAccount(
    empAccountId: string,
    profile: any,
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
            last_login_ip: '127.0.0.1',
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
            last_login_ip: '127.0.0.1',
          },
        });
      }

    } catch (error) {
      this.logger.error(`LoginAccount更新エラー: ${error.message}`);
      // LoginAccount更新エラーは致命的ではないため、認証は継続
    }
  }
}