import { Controller, Post, Body, Req, Res, Logger, Get, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse as SwaggerResponse, 
  ApiBearerAuth, 
  ApiBody, 
  ApiCookieAuth 
} from '@nestjs/swagger';
import { PrivilegedOperation } from '../../common/decorators/privileged-operation.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

/**
 * Authentication controller
 *
 * All endpoints return a unified ApiResponse structure.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Login endpoint
   * レート制限: 10リクエスト/分（デフォルトよりも厳しく）
   */
  @ApiOperation({ summary: 'ユーザーログイン', description: 'ユーザー名とパスワードでログイン認証を行い、JWTトークンを発行します' })
  @ApiBody({ type: LoginDto })
  @SwaggerResponse({ 
    status: 200, 
    description: 'ログイン成功', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: { 
          type: 'object',
          properties: {
            user: { 
              type: 'object', 
              properties: {
                id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                username: { type: 'string', example: 'user123' },
                role: { type: 'string', example: 'USER' }
              }
            },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1...' }
          }
        }
      }
    }
  })
  @SwaggerResponse({ 
    status: 401, 
    description: '認証失敗', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { 
          type: 'object',
          properties: {
            code: { type: 'string', example: 'INVALID_CREDENTIALS' },
            message: { type: 'string', example: 'ユーザー名またはパスワードが正しくありません' }
          }
        }
      }
    }
  })
  @PrivilegedOperation('ユーザーログイン認証')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<{ user: any; accessToken: string; refreshToken?: string }>> {
    this.logger.log(`Login request received for user: ${loginDto.username}`);

    try {
      // AuthService に委譲
      const result = await this.authService.login(loginDto);

      if (!result.success) {
        this.logger.warn(`Invalid credentials for user: ${loginDto.username}`);
        return {
          status: 'error',
          error: {
            code: result.code ?? 'INVALID_CREDENTIALS',
            message: result.message ?? 'ユーザー名またはパスワードが正しくありません',
          },
        };
      }

      // 一元管理された方法でCookieを設定（AuthServiceの共通メソッドを使用）
      
      // アクセストークンのCookie設定（新しい名前）
      this.authService.setCookie(
        response,
        'access_token',
        result.accessToken,
        'access'
      );

      // 後方互換性のため、古い名前のCookieも設定
      this.authService.setCookie(
        response,
        'token',
        result.accessToken,
        'access'
      );

      // リフレッシュトークンがあれば設定
      if (result.refreshToken) {
        this.authService.setCookie(
          response,
          'refresh_token',
          result.refreshToken,
          'refresh'
        );
      }

      this.logger.log(`Login succeeded for user: ${loginDto.username}`);
      
      // 後方互換性のためにトークンをレスポンスボディにも含める
      return {
        status: 'success',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          // refreshToken: result.refreshToken // セキュリティのため除外
        },
      };
    } catch (error) {
      this.logger.error('Login error', error instanceof Error ? error.stack : undefined);
      return {
        status: 'error',
        error: {
          code: 'LOGIN_FAILED',
          message: 'ログインに失敗しました',
        },
      };
    }
  }

  /**
   * Refresh JWT tokens using a refresh token.
   * レート制限: 30リクエスト/分（デフォルトよりも緩く）
   */
  @ApiOperation({ summary: 'トークンのリフレッシュ', description: 'リフレッシュトークンを使用して新しいアクセストークンを取得します' })
  @ApiCookieAuth('refresh_token')
  @ApiBody({ type: RefreshTokenDto, required: false, description: 'Cookieがない場合にリクエストボディでリフレッシュトークンを指定可能' })
  @SwaggerResponse({ 
    status: 200, 
    description: 'トークンリフレッシュ成功', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: { 
          type: 'object',
          properties: {
            user: { 
              type: 'object', 
              properties: {
                id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                username: { type: 'string', example: 'user123' },
                role: { type: 'string', example: 'USER' }
              }
            },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1...' }
          }
        }
      }
    }
  })
  @SwaggerResponse({ 
    status: 401, 
    description: 'リフレッシュトークンが無効', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { 
          type: 'object',
          properties: {
            code: { type: 'string', example: 'TOKEN_REFRESH_FAILED' },
            message: { type: 'string', example: 'トークンの更新に失敗しました' }
          }
        }
      }
    }
  })
  @PrivilegedOperation('認証トークンの更新')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<{ user: any; accessToken: string }>> {
    this.logger.log('Token refresh request received');

    try {
      // Cookieからリフレッシュトークンを取得（リクエストボディより優先）
      const cookieRefreshToken = request.cookies['refresh_token'];
      const tokenToUse = cookieRefreshToken || refreshTokenDto.refreshToken;
      
      if (!tokenToUse) {
        return {
          status: 'error',
          error: {
            code: 'REFRESH_TOKEN_MISSING',
            message: 'リフレッシュトークンが見つかりません',
          },
        };
      }
      
      const result = await this.authService.refreshToken(tokenToUse);

      if (!result.success) {
        return {
          status: 'error',
          error: {
            code: result.code ?? 'TOKEN_REFRESH_FAILED',
            message: result.message ?? 'トークンの更新に失敗しました',
          },
        };
      }

      // 一元管理された方法でCookieを設定
      
      // アクセストークンのCookie設定（新しい名前）
      this.authService.setCookie(
        response,
        'access_token',
        result.accessToken,
        'access'
      );

      // 後方互換性のため、古い名前のCookieも設定
      this.authService.setCookie(
        response,
        'token',
        result.accessToken,
        'access'
      );

      // リフレッシュトークンがあれば設定
      if (result.refreshToken) {
        this.authService.setCookie(
          response,
          'refresh_token',
          result.refreshToken,
          'refresh'
        );
      }

      // 後方互換性のためにトークンをレスポンスボディにも含める
      return {
        status: 'success',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          // リフレッシュトークンは含めない
        },
      };
    } catch (error) {
      this.logger.error('Token refresh error', error instanceof Error ? error.stack : undefined);
      return {
        status: 'error',
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'トークンの更新に失敗しました',
        },
      };
    }
  }

  /**
   * Logout endpoint – invalidates tokens and clears authentication cookies.
   * レート制限を適用しない
   */
  @ApiOperation({ summary: 'ログアウト', description: 'トークンを無効化し、認証用Cookieを削除してログアウト状態にします' })
  @ApiCookieAuth('access_token')
  @SwaggerResponse({ 
    status: 200, 
    description: 'ログアウト成功', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: { 
          type: 'object',
          properties: {
            message: { type: 'string', example: 'ログアウトしました' }
          }
        }
      }
    }
  })
  @PrivilegedOperation('ユーザーログアウト')
  @SkipThrottle()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      // 環境が本番でない場合のみデバッグログを表示
      if (this.configService.get('NODE_ENV') !== 'production') {
        this.logger.debug(`[DEBUG] ログアウト前のCookies: ${JSON.stringify(request.cookies)}`);
      }
      
      // 現在のトークンを取得（新旧両方のCookie名に対応）
      const token = request.cookies['access_token'] || request.cookies['token'];
      
      // トークンが存在する場合、ブラックリストに追加（無効化）
      if (token) {
        await this.authService.logout(token);
        
        if (this.configService.get('NODE_ENV') !== 'production') {
          this.logger.debug(`[DEBUG] トークンをブラックリストに追加: ${token.substring(0, 10)}...`);
        }
      }

      // 一元管理された方法でCookieを削除
      const cookieNames = ['access_token', 'token', 'refresh_token', 'csrf_token'];
      
      // 各Cookieタイプに合わせて削除処理
      cookieNames.forEach(name => {
        // 適切なCookieタイプを判断
        let cookieType: 'access' | 'refresh' | 'csrf' = 'access';
        if (name === 'refresh_token') cookieType = 'refresh';
        if (name === 'csrf_token') cookieType = 'csrf';
        
        // 一元管理されたメソッドを使用してCookieを削除
        this.authService.clearCookie(response, name, cookieType);
      });
      
      // 環境が本番でない場合のみデバッグログ
      if (this.configService.get('NODE_ENV') !== 'production') {
        this.logger.debug(`[DEBUG] レスポンスヘッダー: ${JSON.stringify(response.getHeaders())}`);
      }
      
      this.logger.log('User logged out');

      return {
        status: 'success',
        data: {
          message: 'ログアウトしました',
        },
        // 開発環境でのみデバッグ情報を追加（本番環境では表示しない）
        ...(this.configService.get('NODE_ENV') !== 'production' ? {
          debug: {
            cookies_removed: true,
            timestamp: new Date().toISOString()
          }
        } : {})
      };
    } catch (error) {
      this.logger.error(`[DEBUG] ログアウトエラー: ${error.message}`, error.stack);
      return {
        status: 'success', // エラーでもユーザーにはログアウト成功と表示
        data: {
          message: 'ログアウトしました',
        },
      };
    }
  }

  /**
   * Check auth status endpoint
   */
  @ApiOperation({ summary: '認証状態の確認', description: '現在のユーザーの認証状態を確認します' })
  @ApiBearerAuth('access-token')
  @SwaggerResponse({ 
    status: 200, 
    description: '認証状態確認成功', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: { 
          type: 'object',
          properties: {
            authenticated: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @SwaggerResponse({ 
    status: 401, 
    description: '未認証', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { 
          type: 'object',
          properties: {
            code: { type: 'string', example: 'UNAUTHORIZED' },
            message: { type: 'string', example: '認証されていません' }
          }
        }
      }
    }
  })
  @SkipThrottle()
  @Get('check')
  async checkAuth(
    @Req() request: Request,
  ): Promise<ApiResponse<{ authenticated: boolean }>> {
    // 両方のCookie名をチェック（新旧互換性）
    const isAuthenticated = !!request.cookies['access_token'] || !!request.cookies['token'];

    return {
      status: 'success',
      data: {
        authenticated: isAuthenticated
      },
    };
  }

  /**
   * Get user profile endpoint
   */
  @ApiOperation({ summary: 'ユーザープロファイル取得', description: '認証済みユーザーの詳細情報を取得します' })
  @ApiBearerAuth('access-token')
  @SwaggerResponse({ 
    status: 200, 
    description: 'プロファイル取得成功', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: { 
          type: 'object',
          properties: {
            user: { 
              type: 'object', 
              properties: {
                id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                username: { type: 'string', example: 'user123' },
                role: { type: 'string', example: 'USER' }
              }
            }
          }
        }
      }
    }
  })
  @SwaggerResponse({ 
    status: 401, 
    description: '未認証', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { 
          type: 'object',
          properties: {
            code: { type: 'string', example: 'UNAUTHORIZED' },
            message: { type: 'string', example: '認証されていません' }
          }
        }
      }
    }
  })
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('profile')
  getProfile(@Req() req) {
    return {
      status: 'success',
      data: { user: req.user },
    };
  }

  // FOR DEBUG ONLY - テスト用のCookieデバッグエンドポイント
  @Get('debug-cookies')
  @SkipThrottle()
  async debugCookies(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<any> {
    // 本番環境の場合はこのエンドポイントを無効化
    if (this.configService.get('NODE_ENV') === 'production') {
      return {
        message: 'Debug endpoint is disabled in production',
      };
    }
    
    // 現在のCookieをログに記録
    this.logger.debug(`[DEBUG] 現在のCookies: ${JSON.stringify(request.cookies)}`);
    
    // テスト用Cookieを設定と削除（一元管理されたメソッドを使用）
    // 設定
    this.authService.setCookie(
      response,
      'test_cookie',
      'test_value',
      'access'
    );
    
    // 削除
    this.authService.clearCookie(
      response,
      'test_cookie',
      'access'
    );
    
    return {
      cookies: request.cookies,
      message: 'Cookies logged and test cookie set/cleared',
      headers: response.getHeaders()
    };
  }

  /**
   * JWT有効期限文字列をパースして秒数に変換
   * 例: "1h" -> 3600, "2d" -> 172800
   */
  private parseExpiry(expiry: string): number {
    if (!expiry) return 14400; // デフォルト4時間（秒）
    
    const match = expiry.match(/^(\d+)([smhdw])$/);
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