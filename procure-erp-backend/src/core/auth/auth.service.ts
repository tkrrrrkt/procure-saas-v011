import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, TokenResponseDto } from './dto/auth.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcrypt';
import { TokenBlacklistService } from './token-blacklist.service';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly useMockDb: boolean;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    this.useMockDb = process.env.USE_MOCK_DB === 'true';
  }

  /**
   * Validate user credentials.
   */
  async validateUser(username: string, password: string): Promise<{ id: string; username: string; role: string; tenant_id?: string } | null> {
    try {
      // LoginAccountから認証情報を取得
      const loginAccount = await this.prismaService.loginAccount.findFirst({
        where: {
          auth_method: 'LOCAL',
          identifier: username,
        },
        include: {
          emp_account: {
            include: {
              roles: {
                include: { role: true }
              }
            }
          },
        },
      });

      if (!loginAccount || !loginAccount.password_hash) return null;

      const isPasswordValid = await bcrypt.compare(password, loginAccount.password_hash);
      if (!isPasswordValid) return null;

      // 最終ログイン時刻を更新
      await this.prismaService.loginAccount.update({
        where: { id: loginAccount.id },
        data: {
          last_login_at: new Date(),
        },
      });

      return {
        id: loginAccount.emp_account.id,
        username: loginAccount.emp_account.employee_code,
        role: loginAccount.emp_account.roles[0]?.role.name ?? '',
        tenant_id: loginAccount.emp_account.tenant_id,
      };
    } catch (error) {
      this.logger.error(`認証エラー: ${error.message}`);
      return null;
    }
  }

  /**
   * Login – returns JWT & user info inside a TokenResponseDto
   */
  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      return {
        success: false,
        message: 'ユーザー名またはパスワードが正しくありません',
        code: 'INVALID_CREDENTIALS',
        user: null,
        accessToken: null,
        refreshToken: null,
      };
    }

    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role,
      tenant_id: user.tenant_id 
    };

    const accessToken = this.jwtService.sign(payload, { 
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '4h') 
    });
    
    const refreshToken = loginDto.rememberMe 
      ? this.jwtService.sign(
          { sub: user.id },
          { 
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d') 
          }
        ) 
      : null;

    return {
      success: true,
      accessToken,
      refreshToken,
      user,
    };
  }

  /**
   * Generate new JWTs using a refresh token.
   */
  async refreshToken(token: string): Promise<RefreshTokenResponseDto> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      
      const loginAccount = await this.prismaService.loginAccount.findFirst({
        where: { emp_account_id: decoded.sub },
        include: {
          emp_account: {
            include: {
              roles: {
                include: { role: true }
              }
            }
          },
        },
      });

      if (!loginAccount) {
        throw new UnauthorizedException('無効なユーザーです');
      }

      const payload = { 
        sub: loginAccount.emp_account.id,
        username: loginAccount.emp_account.employee_code,
        role: loginAccount.emp_account.roles[0]?.role.name ?? '',
        tenant_id: loginAccount.emp_account.tenant_id
      };

      const accessToken = this.jwtService.sign(payload, { 
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '4h') 
      });
      
      const refreshToken = this.jwtService.sign(
        { sub: loginAccount.emp_account.id },
        { 
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d') 
        }
      );

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: loginAccount.emp_account.id,
          username: loginAccount.emp_account.employee_code,
          role: loginAccount.emp_account.roles[0]?.role.name ?? '',
        },
      };
    } catch (error) {
      this.logger.error(`トークンのリフレッシュに失敗しました: ${error.message}`);
      
      return {
        success: false,
        message: 'リフレッシュトークンが無効です',
        code: 'INVALID_REFRESH_TOKEN',
        accessToken: null,
        refreshToken: null,
        user: null,
      };
    }
  }

  /**
   * Logout by blacklisting the token.
   * This is a new method for token invalidation.
   */
  async logout(token: string) {
    try {
      // トークンをブラックリストに追加
      await this.tokenBlacklistService.blacklistToken(token);
      return { success: true };
    } catch (error) {
      this.logger.error(`ログアウト処理に失敗しました: ${error.message}`);
      return { 
        success: false, 
        message: 'ログアウト処理に失敗しました',
        code: 'LOGOUT_FAILED' 
      };
    }
  }

  /**
   * 認証用Cookieの設定情報を取得する
   * アプリケーション全体でCookie設定を一元管理するためのメソッド
   */
  getCookieSettings(
    cookieType: 'access' | 'refresh' | 'csrf' = 'access'
  ): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: boolean | 'lax' | 'strict' | 'none'; // Express.jsの型定義に合わせる
    path: string;
    domain?: string;
    maxAge?: number;
  } {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const domainConfig = this.configService.get('COOKIE_DOMAIN');
    
    // 基本設定（デフォルトはアクセストークン用）
    const baseSettings = {
      httpOnly: true,
      secure: isProduction, // 本番環境ではセキュア属性を有効化
      sameSite: 'strict', // 小文字に変更（Express.jsの要求に合わせる）
      path: '/',
      domain: isProduction && domainConfig ? domainConfig : undefined
    };
    
    // トークンタイプに応じた設定
    switch (cookieType) {
      case 'refresh':
        // リフレッシュトークンはより制限されたパスに設定
        return {
          httpOnly: baseSettings.httpOnly,
          secure: baseSettings.secure,
          sameSite: baseSettings.sameSite as 'strict', // 明示的に型を指定
          path: '/api/auth', // 認証エンドポイントのみに制限
          domain: baseSettings.domain,
          maxAge: this.parseExpiry(this.configService.get('JWT_REFRESH_EXPIRATION', '30d')) * 1000
        };
      case 'csrf':
        // CSRFトークンは非HTTPOnly（JavaScriptからアクセス可能）
        return {
          httpOnly: false,
          secure: baseSettings.secure,
          sameSite: baseSettings.sameSite as 'strict', // 明示的に型を指定
          path: '/',
          domain: baseSettings.domain,
          maxAge: 86400000 // 24時間
        };
      case 'access':
      default:
        // アクセストークン（デフォルト）
        return {
          httpOnly: baseSettings.httpOnly,
          secure: baseSettings.secure,
          sameSite: baseSettings.sameSite as 'strict', // 明示的に型を指定
          path: '/',
          domain: baseSettings.domain,
          maxAge: this.parseExpiry(this.configService.get('JWT_EXPIRATION', '4h')) * 1000
        };
    }
  }

  /**
   * Cookie設定をレスポンスに適用する
   * 既存のCookieを置き換え、トークンをセットする
   */
  setCookie(
    response: Response,
    name: string,
    value: string,
    cookieType: 'access' | 'refresh' | 'csrf' = 'access'
  ): void {
    const settings = this.getCookieSettings(cookieType);
    response.cookie(name, value, settings);
    
    // デバッグ用：環境がproductionでない場合のみログ出力
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.logger.debug(`Cookie設定: ${name}, path=${settings.path}, secure=${settings.secure}, sameSite=${settings.sameSite}`);
    }
  }

  /**
   * Cookieを削除する
   * 複数のパスで削除を試行し、確実に削除する
   */
  clearCookie(
    response: Response,
    name: string,
    cookieType: 'access' | 'refresh' | 'csrf' = 'access'
  ): void {
    // 基本設定を取得
    const settings = this.getCookieSettings(cookieType);
    
    // まず基本パスでクリア
    response.clearCookie(name, settings);
    
    // 環境が本番でない場合のみデバッグログ
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.logger.debug(`Cookie削除: ${name}, path=${settings.path}, secure=${settings.secure}, sameSite=${settings.sameSite}`);
    }
    
    // すべての可能性のあるパスで網羅的に削除を試みる（互換性のため）
    const fallbackPaths = ['/', '/api', '/api/auth', ''];
    
    // 基本設定のパスがfallbackPathsにない場合のみ追加で削除
    if (!fallbackPaths.includes(settings.path)) {
      fallbackPaths.forEach(path => {
        if (path !== settings.path) {
          const altSettings = { ...settings, path };
          response.clearCookie(name, altSettings);
          
          if (this.configService.get('NODE_ENV') !== 'production') {
            this.logger.debug(`Cookie追加削除: ${name}, path=${path}`);
          }
        }
      });
    }
  }

  /**
   * JWT有効期限文字列をパースして秒数に変換
   * 例: "1h" -> 3600, "2d" -> 172800
   */
  parseExpiry(expiry: string): number {
    if (!expiry) return 14400; // デフォルト4時間（秒）
    
    const match = expiry.match(/^(\\d+)([smhdw])$/);
    if (!match) return 14400; // デフォルト4時間（秒）
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value; // 秒
      case 'm': return value * 60; // 分→秒
      case 'h': return value * 60 * 60; // 時間→秒
      case 'd': return value * 24 * 60 * 60; // 日→秒
      case 'w': return value * 7 * 24 * 60 * 60; // 週→秒
      default: return 14400; // デフォルト4時間（秒）
    }
  }
}