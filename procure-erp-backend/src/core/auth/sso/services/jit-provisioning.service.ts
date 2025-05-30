// src/core/auth/sso/services/jit-provisioning.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IProfile } from 'passport-azure-ad';

export interface JitUser {
  id: string;
  tenant_id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department_id: string | null;
  manager_id: string | null;
  approval_limit: any | null;
  status: string;
  roles?: Array<{
    role: {
      name: string;
    };
  }>;
}

@Injectable()
export class JitProvisioningService {
  private readonly logger = new Logger(JitProvisioningService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Azure ADプロファイルからユーザーをプロビジョニング
   */
  async provisionUser(profile: IProfile, tenantId: string): Promise<JitUser> {
    const email = this.extractEmail(profile).toLowerCase();
    
    this.logger.debug(`JITプロビジョニング開始: ${email}`);

    try {
      // 既存ユーザー確認（自動統合）
      let user = await this.findExistingUser(email, tenantId);

      if (user) {
        // 既存ユーザーの情報更新（ログイン時自動同期）
        user = await this.updateExistingUser(user, profile);
        this.logger.log(`既存ユーザー更新完了: ${email}`);
      } else {
        // 新規ユーザー作成（基本マッピング）
        user = await this.createNewUser(profile, tenantId);
        this.logger.log(`新規ユーザー作成完了: ${email}`);
        
        // 管理者通知（新規ユーザー作成）
        await this.notifyNewUserCreated(user);
      }

      return user;

    } catch (error) {
      this.logger.error(`JITプロビジョニングエラー: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 既存ユーザー検索
   */
  private async findExistingUser(email: string, tenantId: string): Promise<JitUser | null> {
    const user = await this.prismaService.empAccount.findFirst({
      where: {
        tenant_id: tenantId,
        email: email,
        deleted_at: null, // 削除されていないユーザーのみ
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user as JitUser | null;
  }

  /**
   * 新規ユーザー作成（基本マッピング - 安全重視）
   */
  private async createNewUser(profile: IProfile, tenantId: string): Promise<JitUser> {
    const email = this.extractEmail(profile).toLowerCase();
    
    // Azure ADプロファイルから基本情報抽出
    const firstName = this.extractFirstName(profile);
    const lastName = this.extractLastName(profile);
    const jobTitle = this.extractJobTitle(profile);
    const employeeCode = this.extractEmployeeCode(profile);

    const userData = {
      tenant_id: tenantId,
      // 基本マッピング（安全重視） - 直接マッピング可能な項目のみ
      first_name: firstName,
      last_name: lastName,
      email: email,
      job_title: jobTitle,
      employee_code: employeeCode,
      
      // 手動設定項目（セキュリティ上未設定）
      department_id: null,        // 手動設定必要
      manager_id: null,          // 手動設定必要
      approval_limit: null,      // 手動設定必要
      
      // 初期状態
      status: 'PENDING_SETUP',   // 管理者による設定待ち
      preferred_language: 'ja',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const user = await this.prismaService.empAccount.create({
      data: userData,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // デフォルトロール割り当て（基本ユーザー権限）
    await this.assignDefaultRole(user.id, tenantId);

    return user as JitUser;
  }

  /**
   * 既存ユーザー情報更新（ログイン時自動同期）
   */
  private async updateExistingUser(user: JitUser, profile: IProfile): Promise<JitUser> {
    const firstName = this.extractFirstName(profile);
    const lastName = this.extractLastName(profile);
    const jobTitle = this.extractJobTitle(profile);

    const updatedUser = await this.prismaService.empAccount.update({
      where: { id: user.id },
      data: {
        // ログイン時自動同期（基本情報のみ）
        first_name: firstName || user.first_name,
        last_name: lastName || user.last_name,
        job_title: jobTitle || user.job_title,
        
        // 重要な設定は更新しない（セキュリティ上）
        // department_id, manager_id, approval_limit は既存値維持
        
        updated_at: new Date(),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return updatedUser as JitUser;
  }

  /**
   * デフォルトロール割り当て
   */
  private async assignDefaultRole(empAccountId: string, tenantId: string): Promise<void> {
    try {
      // 基本ユーザーロールを検索
      const defaultRole = await this.prismaService.role.findFirst({
        where: {
          OR: [
            { tenant_id: null, name: 'USER', is_system: true }, // システムデフォルト
            { tenant_id: tenantId, name: 'USER' },              // テナント固有
          ],
        },
      });

      if (defaultRole) {
        await this.prismaService.empAccountRole.create({
          data: {
            emp_account_id: empAccountId,
            role_id: defaultRole.id,
          },
        });
        
        this.logger.debug(`デフォルトロール割り当て完了: ${defaultRole.name}`);
      } else {
        this.logger.warn('デフォルトロールが見つかりません');
      }

    } catch (error) {
      this.logger.error(`ロール割り当てエラー: ${error.message}`);
      // ロール割り当てエラーは致命的ではないため、処理継続
    }
  }

  /**
   * 新規ユーザー作成通知
   */
  private async notifyNewUserCreated(user: JitUser): Promise<void> {
    try {
      // 監査ログ記録
      await this.prismaService.auditLog.create({
        data: {
          tenant_id: user.tenant_id,
          user_id: user.id,
          action: 'SSO_USER_CREATED',
          resource: 'EmpAccount',
          resource_id: user.id,
          ip_address: '127.0.0.1', // 開発環境
          log_type: 'USER_MANAGEMENT',
          severity: 'INFO',
          additional_info: JSON.stringify({
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            job_title: user.job_title,
            status: user.status,
          }),
        },
      });

      this.logger.log(`新規ユーザー作成ログ記録: ${user.email}`);

    } catch (error) {
      this.logger.error(`通知エラー: ${error.message}`);
      // 通知エラーは致命的ではないため、処理継続
    }
  }

  /**
   * Azure ADプロファイルからメールアドレス抽出
   */
  private extractEmail(profile: IProfile): string {
    return profile.upn || 
           profile._json?.email || 
           profile._json?.preferred_username ||
           profile._json?.mail ||
           '';
  }

  /**
   * Azure ADプロファイルから名前（名）抽出
   */
  private extractFirstName(profile: IProfile): string {
    return profile._json?.given_name || 
           profile._json?.givenName ||
           this.parseDisplayName(profile)?.firstName || 
           '名前未設定';
  }

  /**
   * Azure ADプロファイルから名前（姓）抽出
   */
  private extractLastName(profile: IProfile): string {
    return profile._json?.family_name || 
           profile._json?.familyName ||
           profile._json?.surname ||
           this.parseDisplayName(profile)?.lastName || 
           '姓未設定';
  }

  /**
   * Azure ADプロファイルから役職抽出
   */
  private extractJobTitle(profile: IProfile): string | null {
    return profile._json?.jobTitle || 
           profile._json?.job_title || 
           null;
  }

  /**
   * Azure ADプロファイルから従業員コード抽出
   */
  private extractEmployeeCode(profile: IProfile): string | null {
    return profile._json?.employeeId || 
           profile._json?.employee_id ||
           profile._json?.extensionAttribute1 ||
           null;
  }

  /**
   * 表示名から姓名を解析（フォールバック）
   */
  private parseDisplayName(profile: IProfile): { firstName: string; lastName: string } | null {
    const displayName = profile._json?.displayName || profile.displayName;
    
    if (!displayName) return null;

    // 日本語名の場合（姓名の順）
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(displayName)) {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          lastName: parts[0],   // 姓
          firstName: parts.slice(1).join(' '), // 名
        };
      }
    }

    // 英語名の場合（名姓の順）
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],  // 名
        lastName: parts.slice(1).join(' '), // 姓
      };
    }

    return {
      firstName: displayName,
      lastName: '',
    };
  }
}