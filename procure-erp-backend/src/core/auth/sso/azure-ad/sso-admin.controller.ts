// src/core/auth/sso/azure-ad/sso-admin.controller.ts
// SSO管理専用コントローラー

import { 
  Controller, 
  Get, 
  Post, 
  Body,
  Req, 
  Res, 
  Logger,
  HttpStatus,
  UseGuards,
  Query
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

// DTOs
interface SsoConfigUpdateDto {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

interface SsoUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

@Controller('admin/sso')
export class SsoAdminController {
  private readonly logger = new Logger(SsoAdminController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * SSO設定を更新/保存
   * POST /api/admin/sso/config
   */
  @Post('config')
  @UseGuards(JwtAuthGuard) // 認証必須
  async updateSsoConfig(
    @Body() configDto: SsoConfigUpdateDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log('SSO設定更新開始');

      // バリデーション
      const validationResult = this.validateSsoConfig(configDto);
      if (!validationResult.valid) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'バリデーションエラー',
          errors: validationResult.errors,
        });
        return;
      }

      // 環境変数更新（実際には設定ファイルまたはデータベースに保存）
      // 注意: 本番環境では適切な設定管理を実装してください
      
      // テナント設定の更新（データベース）
      const userInfo = (req as any).user; // JWT認証で取得されたユーザー情報
      const tenantId = userInfo?.tenant_id;

      if (!tenantId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'テナント情報が取得できません',
        });
        return;
      }

      // テナント設定を更新
      await this.prismaService.tenant.update({
        where: { id: tenantId },
        data: {
          sso_enabled: configDto.enabled,
          // 注意: 機密情報は暗号化して保存することを推奨
          // azure_tenant_id: encrypt(configDto.tenantId),
          // azure_client_id: encrypt(configDto.clientId),
          // azure_client_secret: encrypt(configDto.clientSecret),
        },
      });

      // 監査ログ記録
      await this.prismaService.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: userInfo.sub,
          action: 'SSO_CONFIG_UPDATE',
          resource: 'SsoConfig',
          resource_id: tenantId,
          ip_address: req.ip || '127.0.0.1',
          log_type: 'CONFIGURATION',
          severity: 'INFO',
          additional_info: JSON.stringify({
            enabled: configDto.enabled,
            tenantId: configDto.tenantId,
            // シークレット情報はログに記録しない
          }),
        },
      });

      res.json({
        success: true,
        message: 'SSO設定が正常に更新されました',
      });

      this.logger.log('SSO設定更新完了');

    } catch (error) {
      this.logger.error(`SSO設定更新エラー: ${error.message}`, error.stack);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'SSO設定の更新に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * SSO作成ユーザー一覧を取得
   * GET /api/admin/sso/users
   */
  @Get('users')
  @UseGuards(JwtAuthGuard) // 認証必須
  async getSsoUsers(
    @Query() query: SsoUserListQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log('SSOユーザー一覧取得開始');

      const userInfo = (req as any).user;
      const tenantId = userInfo?.tenant_id;

      if (!tenantId) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'テナント情報が取得できません',
        });
        return;
      }

      // ページネーション設定
      const page = Math.max(1, query.page || 1);
      const limit = Math.min(100, Math.max(1, query.limit || 20));
      const skip = (page - 1) * limit;

      // 検索条件
      const where: any = {
        tenant_id: tenantId,
        deleted_at: null,
        // SSO作成ユーザーを識別する条件
        // 例: 特定のステータスやフラグで識別
        OR: [
          { employee_code: { startsWith: 'SSO_' } }, // SSO作成ユーザーの識別例
          { 
            login_accounts: {
              some: {
                auth_method: 'SSO',
              }
            }
          }
        ],
      };

      // 検索文字列がある場合
      if (query.search && query.search.trim()) {
        const searchTerm = query.search.trim();
        where.OR = [
          { first_name: { contains: searchTerm, mode: 'insensitive' } },
          { last_name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // ユーザー一覧取得
      const [users, total] = await Promise.all([
        this.prismaService.empAccount.findMany({
          where,
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            login_accounts: {
              where: {
                auth_method: 'SSO',
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prismaService.empAccount.count({ where }),
      ]);

      // レスポンス形式に変換
      const responseUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        jobTitle: user.job_title,
        status: user.status,
        createdAt: user.created_at.toISOString(),
        lastLoginAt: user.login_accounts[0]?.last_login_at?.toISOString() || null,
        roles: user.roles.map(r => r.role.name),
      }));

      res.json({
        success: true,
        data: {
          users: responseUsers,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });

      this.logger.log(`SSOユーザー一覧取得完了: ${responseUsers.length}件`);

    } catch (error) {
      this.logger.error(`SSOユーザー取得エラー: ${error.message}`, error.stack);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'SSOユーザー一覧の取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * SSO設定のバリデーション
   */
  private validateSsoConfig(config: SsoConfigUpdateDto): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基本的なバリデーション
    if (!config.tenantId || config.tenantId.trim() === '') {
      errors.push('Azure ADテナントIDは必須です');
    }

    if (!config.clientId || config.clientId.trim() === '') {
      errors.push('アプリケーション（クライアント）IDは必須です');
    }

    if (!config.clientSecret || config.clientSecret.trim() === '') {
      errors.push('クライアントシークレットは必須です');
    }

    // Azure AD Tenant ID形式チェック（GUID形式）
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (config.tenantId && !guidRegex.test(config.tenantId)) {
      errors.push('Azure ADテナントIDの形式が正しくありません（GUID形式で入力してください）');
    }

    if (config.clientId && !guidRegex.test(config.clientId)) {
      errors.push('アプリケーション（クライアント）IDの形式が正しくありません（GUID形式で入力してください）');
    }

    // クライアントシークレットの最小長チェック
    if (config.clientSecret && config.clientSecret.length < 10) {
      errors.push('クライアントシークレットが短すぎます（10文字以上で入力してください）');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
