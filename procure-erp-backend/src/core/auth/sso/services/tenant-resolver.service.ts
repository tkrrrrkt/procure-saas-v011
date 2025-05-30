// src/core/auth/sso/services/tenant-resolver.service.ts

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface ResolvedTenant {
  id: string;
  name: string;
  display_name: string;
  sso_enabled: boolean;
  status: string;
  subscription_status: string;
}

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * メールアドレスのドメインからテナントを特定
   */
  async resolveTenantByEmail(email: string): Promise<ResolvedTenant | null> {
    if (!email) {
      throw new BadRequestException('Email address is required');
    }

    const domain = this.extractDomain(email);
    this.logger.debug(`テナント識別開始: ${email} -> ${domain}`);

    try {
      // ドメインからテナント検索
      const tenantDomain = await this.prismaService.tenantEmailDomain.findFirst({
        where: { 
          domain: domain,
        },
        include: { 
          tenant: true,
        },
      });

      if (!tenantDomain || !tenantDomain.tenant) {
        this.logger.warn(`テナントが見つかりません: ${domain}`);
        return null;
      }

      const tenant = tenantDomain.tenant;

      // テナント状態検証
      await this.validateTenantStatus(tenant, domain);

      this.logger.log(`テナント識別成功: ${domain} -> ${tenant.name}`);
      
      return {
        id: tenant.id,
        name: tenant.name,
        display_name: tenant.display_name,
        sso_enabled: tenant.sso_enabled,
        status: tenant.status,
        subscription_status: tenant.subscription_status,
      };

    } catch (error) {
      this.logger.error(`テナント識別エラー: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * テナントに許可ドメインを登録
   */
  async registerTenantDomain(
    tenantId: string, 
    domain: string, 
    isPrimary: boolean = false
  ): Promise<void> {
    const normalizedDomain = domain.toLowerCase().trim();
    
    this.logger.debug(`ドメイン登録: ${tenantId} -> ${normalizedDomain}`);

    try {
      // 既存ドメイン確認
      const existingDomain = await this.prismaService.tenantEmailDomain.findFirst({
        where: { domain: normalizedDomain },
      });

      if (existingDomain) {
        throw new BadRequestException(`Domain ${normalizedDomain} is already registered`);
      }

      // ドメイン登録
      await this.prismaService.tenantEmailDomain.create({
        data: {
          tenant_id: tenantId,
          domain: normalizedDomain,
          is_primary: isPrimary,
        },
      });

      this.logger.log(`ドメイン登録完了: ${normalizedDomain}`);

    } catch (error) {
      this.logger.error(`ドメイン登録エラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * テナントの許可ドメイン一覧取得
   */
  async getTenantDomains(tenantId: string): Promise<Array<{
    domain: string;
    isPrimary: boolean;
    createdAt: Date;
  }>> {
    const domains = await this.prismaService.tenantEmailDomain.findMany({
      where: { tenant_id: tenantId },
      orderBy: [
        { is_primary: 'desc' },  // プライマリドメインを先頭に
        { created_at: 'asc' },   // 作成日順
      ],
    });

    return domains.map(domain => ({
      domain: domain.domain,
      isPrimary: domain.is_primary,
      createdAt: domain.created_at,
    }));
  }

  /**
   * ドメイン削除
   */
  async removeTenantDomain(tenantId: string, domain: string): Promise<void> {
    const normalizedDomain = domain.toLowerCase().trim();
    
    this.logger.debug(`ドメイン削除: ${tenantId} -> ${normalizedDomain}`);

    try {
      const deletedDomain = await this.prismaService.tenantEmailDomain.deleteMany({
        where: {
          tenant_id: tenantId,
          domain: normalizedDomain,
        },
      });

      if (deletedDomain.count === 0) {
        throw new BadRequestException(`Domain ${normalizedDomain} not found for tenant`);
      }

      this.logger.log(`ドメイン削除完了: ${normalizedDomain}`);

    } catch (error) {
      this.logger.error(`ドメイン削除エラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * メールアドレスからドメイン抽出
   */
  private extractDomain(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Invalid email format');
    }

    const parts = email.toLowerCase().trim().split('@');
    
    if (parts.length !== 2 || !parts[1]) {
      throw new BadRequestException('Invalid email format');
    }

    const domain = parts[1];

    // ドメイン形式の基本検証
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      throw new BadRequestException('Invalid domain format');
    }

    return domain;
  }

  /**
   * テナント状態の検証
   */
  private async validateTenantStatus(tenant: any, domain: string): Promise<void> {
    // テナント削除確認
    if (tenant.deleted_at) {
      throw new UnauthorizedException(`Tenant for domain ${domain} has been deleted`);
    }

    // テナント状態確認
    if (tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Tenant for domain ${domain} is not active: ${tenant.status}`);
    }

    // サブスクリプション状態確認
    if (tenant.subscription_status !== 'ACTIVE') {
      throw new UnauthorizedException(
        `Tenant subscription for domain ${domain} is not active: ${tenant.subscription_status}`
      );
    }

    // SSO機能有効性確認
    if (!tenant.sso_enabled) {
      throw new UnauthorizedException(`SSO is not enabled for domain ${domain}`);
    }

    // トライアル期間確認
    if (tenant.trial_ends_at && new Date() > tenant.trial_ends_at) {
      if (tenant.subscription_status === 'TRIAL') {
        throw new UnauthorizedException(`Trial period has expired for domain ${domain}`);
      }
    }

    this.logger.debug(`テナント状態検証完了: ${domain} -> ${tenant.status}`);
  }

  /**
   * ドメインの重複チェック
   */
  async isDomainAvailable(domain: string): Promise<boolean> {
    const normalizedDomain = domain.toLowerCase().trim();
    
    const existingDomain = await this.prismaService.tenantEmailDomain.findFirst({
      where: { domain: normalizedDomain },
    });

    return !existingDomain;
  }

  /**
   * ワイルドカードドメインマッチング（将来的な拡張用）
   */
  private matchWildcardDomain(email: string, pattern: string): boolean {
    // 基本実装：完全一致のみ
    // 将来的にワイルドカード（*.example.com）対応可能
    const domain = this.extractDomain(email);
    return domain === pattern.toLowerCase();
  }
}