// src/core/auth/sso/sso.module.ts

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// 既存モジュールのインポート
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';

// 🆕 既存のAuthServiceを直接import（循環参照回避）
import { AuthService } from '../auth.service';
import { TokenBlacklistService } from '../token-blacklist.service';

// SSO関連のコンポーネント
import { AzureAdOAuth2Strategy } from './azure-ad/azure-ad-oauth2.strategy'; // OAuth2Strategy実装
import { AzureAdController } from './azure-ad/azure-ad.controller';
import { SsoAdminController } from './azure-ad/sso-admin.controller'; // 🆕 SSO管理コントローラー
import { JitProvisioningService } from './services/jit-provisioning.service';
import { TenantResolverService } from './services/tenant-resolver.service';

@Module({
  imports: [
    // 既存モジュールを活用
    PassportModule,
    ConfigModule,
    DatabaseModule,
    RedisModule, // 🆕 AuthService依存関係
    
    // JWT設定（既存システムと統一）
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '4h'),
        },
      }),
    }),
  ],
  controllers: [
    AzureAdController,
    SsoAdminController, // 🆕 SSO管理コントローラー
  ],
  providers: [
    // 🆕 既存AuthService（AppModuleでAuthModuleが先にロード済み）
    AuthService,
    TokenBlacklistService,
    
    // Passport戦略
    AzureAdOAuth2Strategy, // OAuth2Strategy実装（企業制限対応）
    
    // SSO専用サービス
    JitProvisioningService,
    TenantResolverService,
  ],
  exports: [
    // 他のモジュールから利用可能にする
    JitProvisioningService,
    TenantResolverService,
    AzureAdOAuth2Strategy, // OAuth2Strategy実装
  ],
})
export class SsoModule {}