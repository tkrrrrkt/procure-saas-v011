// src/core/auth/sso/azure-ad/azure-ad.controller.ts

import { 
  Controller, 
  Get, 
  Post, 
  Req, 
  Res, 
  UseGuards, 
  Logger,
  Query,
  UnauthorizedException,
  HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth.service';
import { JwtService } from '@nestjs/jwt';
import { AzureAdUser } from './azure-ad.strategy';

@Controller('auth/sso')
export class AzureAdController {
  private readonly logger = new Logger(AzureAdController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * SSO認証開始エンドポイント
   * フロントエンドから呼び出される
   */
  @Get('login')
  @UseGuards(AuthGuard('azure-ad'))
  async initiateLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state?: string,
  ): Promise<void> {
    // このエンドポイントは直接実行されない
    // AuthGuard('azure-ad')によってAzure ADにリダイレクトされる
    this.logger.debug('SSO認証開始 - Azure ADにリダイレクト');
  }

  /**
   * Azure ADからのコールバックエンドポイント
   * Azure AD認証完了後にここに戻ってくる
   */
  @Get('callback')
  @UseGuards(AuthGuard('azure-ad'))
  async handleCallback(
    @Req() req: Request & { user: AzureAdUser },
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(`SSO認証コールバック: ${req.user.email}`);

      // JWTトークン生成（既存のAuthServiceを活用）
      const payload = {
        sub: req.user.id,
        username: req.user.username,
        role: req.user.role,
        tenant_id: req.user.tenant_id,
      };

      // アクセストークン生成（既存JWT設定に合わせる）
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '4h'),
      });

      // リフレッシュトークン生成
      const refreshToken = this.jwtService.sign(
        { sub: req.user.id },
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        }
      );

      // セキュアなCookie設定（既存のAuthServiceメソッドを活用）
      this.authService.setCookie(res, 'access_token', accessToken, 'access');
      this.authService.setCookie(res, 'refresh_token', refreshToken, 'refresh');

      // 後方互換性のため、古い名前のCookieも設定
      this.authService.setCookie(res, 'token', accessToken, 'access');

      // フロントエンドにリダイレクト（認証成功）
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const redirectUrl = `${frontendUrl}/dashboard?sso=success`;
      
      this.logger.log(`SSO認証成功 - リダイレクト: ${redirectUrl}`);
      res.redirect(redirectUrl);

    } catch (error) {
      this.logger.error(`SSO認証エラー: ${error.message}`, error.stack);
      
      // エラー時はログインページにリダイレクト
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const errorUrl = `${frontendUrl}/login?error=sso_failed&message=${encodeURIComponent(error.message)}`;
      
      res.redirect(errorUrl);
    }
  }

  /**
   * SSO認証状態確認エンドポイント
   * フロントエンドから認証状態を確認する際に使用
   */
  @Get('status')
  async checkSsoStatus(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      // Cookieからアクセストークンを取得（新旧両方に対応）
      const accessToken = req.cookies?.access_token || req.cookies?.token;
      
      if (!accessToken) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          authenticated: false,
          message: 'No access token found',
        });
      }

      // JWTトークン検証
      const payload = this.jwtService.verify(accessToken, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // ユーザー情報取得
      const userInfo = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        tenant_id: payload.tenant_id,
      };

      res.json({
        authenticated: true,
        user: userInfo,
        loginMethod: 'SSO',
      });

    } catch (error) {
      this.logger.debug(`SSO状態確認エラー: ${error.message}`);
      
      res.status(HttpStatus.UNAUTHORIZED).json({
        authenticated: false,
        message: 'Invalid or expired token',
      });
    }
  }

  /**
   * SSO ログアウトエンドポイント
   * 既存のログアウト機能を拡張
   */
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log('SSO ログアウト開始');

      // アクセストークンを取得（新旧両方に対応）
      const accessToken = req.cookies?.access_token || req.cookies?.token;
      
      if (accessToken) {
        // 既存のログアウト処理を活用（トークンブラックリスト化）
        await this.authService.logout(accessToken);
      }

      // Cookieクリア（既存システムと統一）
      this.authService.clearCookie(res, 'access_token', 'access');
      this.authService.clearCookie(res, 'refresh_token', 'refresh');
      this.authService.clearCookie(res, 'token', 'access'); // 後方互換性

      // ログアウト成功レスポンス
      res.json({
        success: true,
        message: 'SSO logout successful',
      });

      this.logger.log('SSO ログアウト完了');

    } catch (error) {
      this.logger.error(`SSO ログアウトエラー: ${error.message}`);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Logout failed',
        error: error.message,
      });
    }
  }

  /**
   * SSO設定情報取得（管理者用）
   */
  @Get('config')
  async getSsoConfig(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 基本的なSSO設定情報を返す（機密情報は除外）
      const config = {
        enabled: this.configService.get<boolean>('SSO_ENABLED', false),
        provider: 'Azure AD',
        tenantId: this.configService.get<string>('AZURE_AD_TENANT_ID'),
        callbackUrl: this.configService.get<string>('SSO_CALLBACK_URL'),
        loginUrl: this.configService.get<string>('SSO_LOGIN_URL'),
      };

      res.json({
        success: true,
        config: config,
      });

    } catch (error) {
      this.logger.error(`SSO設定取得エラー: ${error.message}`);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get SSO configuration',
      });
    }
  }

  /**
   * SSO接続テスト（管理者用）
   */
  @Post('test')
  async testSsoConnection(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log('SSO接続テスト開始');

      // Azure ADの.well-knownエンドポイントに接続テスト
      const tenantId = this.configService.get<string>('AZURE_AD_TENANT_ID');
      const discoveryUrl = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid_configuration`;
      
      const axios = require('axios');
      const response = await axios.get(discoveryUrl, { timeout: 10000 });

      if (response.status === 200 && response.data.authorization_endpoint) {
        res.json({
          success: true,
          message: 'Azure AD connection test successful',
          endpoints: {
            authorization: response.data.authorization_endpoint,
            token: response.data.token_endpoint,
            userinfo: response.data.userinfo_endpoint,
          },
        });
      } else {
        throw new Error('Invalid response from Azure AD');
      }

    } catch (error) {
      this.logger.error(`SSO接続テストエラー: ${error.message}`);
      
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Azure AD connection test failed',
        error: error.message,
      });
    }
  }
}