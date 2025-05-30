// src/common/security/services/anomaly-detection.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from '../../notifications/services/notification.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * 異常検知サービス
 * 監査ログを分析して異常を検出し、通知を送信する
 */
@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}
  
  /**
   * 15分ごとに異常検知を実行
   */
  @Cron('0 */15 * * * *') // 15分ごとに実行するクロン式
  async detectAnomalies() {
    this.logger.log('異常検知処理を開始します');
    
    // 以下のパターンをチェック
    await Promise.all([
      this.detectHighValuePurchases(),
      this.detectAuthenticationFailures(),
      this.detectUnusualAccess(),
    ]);
    
    this.logger.log('異常検知処理を完了しました');
  }
  
  /**
   * 高額購入の検出
   * ユーザーの過去の購入額平均と比較して異常に高額な購入を検出
   */
  private async detectHighValuePurchases() {
    // 高額購入の検出ロジックは未実装（testOrder依存のため）
    return;
  }
  
  /**
   * 認証失敗の異常検出
   * 短期間の連続ログイン失敗を検出
   */
  private async detectAuthenticationFailures() {
    this.logger.log('認証失敗の異常検出を開始します');
    
    try {
      // 監査ログから直近のログイン失敗を分析
      const failedLogins = await this.prisma.auditLog.groupBy({
        by: ['ip_address', 'user_id'],
        where: {
          action: {
            contains: 'login'
          },
          response_status: {
            gte: 400 // エラーステータス
          },
          timestamp: {
            gte: new Date(Date.now() - 30 * 60 * 1000) // 過去30分
          }
        },
        _count: {
          id: true
        },
        having: {
          id: {
            _count: {
              gt: 5 // 5回以上の失敗
            }
          }
        }
      });
      
      for (const item of failedLogins) {
        this.logger.warn(`認証失敗の異常を検出: IP ${item.ip_address} からのユーザー ${item.user_id || '不明'} の連続ログイン失敗 (${item._count.id}回)`);
        
        // 通知の対象者を取得（セキュリティ管理者など）
        const admins = await this.getAdministrators('security_admin');
        
        // 通知を送信
        await this.notificationService.sendNotification(
          ['email', 'slack', 'in-app'],
          admins,
          {
            subject: '【警告】連続ログイン失敗を検出',
            message: `IP ${item.ip_address} から${item.user_id ? `ユーザー ${item.user_id} への` : ''}連続ログイン失敗が検出されました。\n\n` +
                     `失敗回数: ${item._count.id}回（過去30分）\n\n` +
                     `不正アクセスの可能性があります。確認してください。`,
            severity: 'high',
            metadata: {
              anomalyType: 'auth_failure',
              userId: item.user_id,
              ipAddress: item.ip_address,
              count: item._count.id,
              timestamp: new Date().toISOString(),
            }
          }
        );
        
        // 異常ログをデータベースに記録
        await this.logAnomaly('auth_failure', 'high', item.user_id, {});
      }
    } catch (error) {
      this.logger.error('認証失敗の異常検出でエラーが発生しました', error.stack);
    }
  }
  
  /**
   * 異常なアクセスパターンの検出
   * 通常と異なる時間帯、場所、リソースへのアクセスを検出
   */
  private async detectUnusualAccess() {
    this.logger.log('異常なアクセスパターンの検出を開始します');
    try {
      const recentLogs = await this.prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          user_id: { not: null }
        },
        orderBy: { timestamp: 'desc' }
      });
      const userAccessMap = new Map<string, { resources: Set<string>, ipAddresses: Set<string>, timestamps: Date[] }>();
      for (const log of recentLogs) {
        if (!log.user_id) continue;
        if (!userAccessMap.has(log.user_id)) {
          userAccessMap.set(log.user_id, { resources: new Set<string>(), ipAddresses: new Set<string>(), timestamps: [] });
        }
        const userAccess = userAccessMap.get(log.user_id);
        if (userAccess) {
          userAccess.resources.add(log.resource);
          userAccess.ipAddresses.add(log.ip_address);
          userAccess.timestamps.push(log.timestamp);
        }
      }
      for (const [userId, recentAccess] of userAccessMap.entries()) {
        const pastUserActivity = await this.prisma.auditLog.findMany({
          where: {
            user_id: userId,
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              lt: new Date(Date.now() - 2 * 60 * 60 * 1000)
            }
          },
          orderBy: { timestamp: 'desc' }
        });
        const commonResources = new Set<string>();
        const ipFrequency: Record<string, number> = {};
        for (const log of pastUserActivity) {
          if (log.resource) commonResources.add(log.resource);
          if (log.ip_address) ipFrequency[log.ip_address] = (ipFrequency[log.ip_address] || 0) + 1;
        }
        const unusualResources = Array.from(recentAccess.resources).filter(resource => !commonResources.has(resource));
        const unusualIps = Array.from(recentAccess.ipAddresses).filter(ip => !ipFrequency[ip]);
        if (unusualResources.length > 0 || unusualIps.length > 0) {
          this.logger.warn(`異常なアクセスパターンを検出: ユーザー ${userId}`);
          const admins = await this.getAdministrators('security_admin');
          let anomalyDetails = '';
          if (unusualResources.length > 0) anomalyDetails += `■ 通常アクセスしないリソース:\n${unusualResources.join(', ')}\n\n`;
          if (unusualIps.length > 0) anomalyDetails += `■ 新しいIPアドレス:\n${unusualIps.join(', ')}\n\n`;
          await this.notificationService.sendNotification(
            ['email', 'slack', 'in-app'],
            admins,
            {
              subject: '【警告】異常なアクセスパターンを検出',
              message: `ユーザー ${userId} による異常なアクセスパターンが検出されました。\n\n` + anomalyDetails + `アカウントが不正利用されている可能性があります。確認してください。`,
              severity: 'medium',
              metadata: {
                anomalyType: 'unusual_access',
                userId: userId,
                unusualResources,
                unusualIps,
                timestamp: new Date().toISOString(),
              }
            }
          );
          await this.logAnomaly('unusual_access', 'medium', userId, {});
        }
      }
    } catch (error) {
      this.logger.error('異常なアクセスパターンの検出でエラーが発生しました', error.stack);
    }
  }
  
  /**
   * 管理者ユーザーの取得
   * @param role 必要な権限ロール
   * @returns 管理者のユーザーID配列
   */
  private async getAdministrators(role: string = 'admin'): Promise<string[]> {
    // 管理者取得ロジックは未実装（testUser依存のため）
    return [];
  }
  
  /**
   * 異常ログをデータベースに記録
   * @param type 異常の種類
   * @param severity 重要度
   * @param userId 関連ユーザーID
   * @param _details 詳細情報
   */
  private async logAnomaly(
    type: string,
    severity: 'low' | 'medium' | 'high',
    userId: string | null,
    _details: Record<string, any>
  ): Promise<void> {
    try {
      await this.prisma.anomalyLogRecord.create({
        data: {
          type,
          severity,
          user_id: userId,
          summary: `[${type}] user=${userId ?? 'unknown'}`,
          detected_at: new Date(),
          is_resolved: false
        }
      });
    } catch (error) {
      this.logger.error('異常ログの保存に失敗しました', error.stack);
    }
  }
}