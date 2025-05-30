// src/core/auth/auth.module.ts
// 既存ファイルの修正版 - SSOモジュール統合

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// 既存コンポーネント
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenBlacklistService } from './token-blacklist.service';

// 既存モジュール
import { DatabaseModule } from '../database/database.module';
import { ThrottlerModule } from '../../common/throttler/throttler.module';
import { RedisModule } from '../redis/redis.module';

// 🆕 SSO統合は削除（循環参照回避）
// import { SsoModule } from './sso/sso.module';

@Module({
  imports: [
    PassportModule,
    RedisModule,
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
    DatabaseModule,
    ThrottlerModule,
    
    // 🆕 SSO機能統合は削除（循環参照回避）
    // SsoModule,
  ],
  controllers: [
    AuthController, // 既存の認証コントローラー
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    TokenBlacklistService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    AuthService,
    TokenBlacklistService,
  ],
})
export class AuthModule {}