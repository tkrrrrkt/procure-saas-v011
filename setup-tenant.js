// setup-tenant.js - 開発環境用テナント・ドメイン設定スクリプト

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTenant() {
  try {
    console.log('=== 開発環境用テナント設定開始 ===');

    // 既存のhira-t.jpドメインをチェック
    const existingDomain = await prisma.tenantEmailDomain.findFirst({
      where: { domain: 'hira-t.jp' },
      include: { tenant: true }
    });

    if (existingDomain) {
      console.log('✅ hira-t.jp ドメインは既に登録済み:', existingDomain.tenant.name);
      return;
    }

    // 既存のテナントをチェック
    let tenant = await prisma.tenant.findFirst({
      where: { name: 'hira-t' }
    });

    if (!tenant) {
      // 新しいテナントを作成
      console.log('🆕 新しいテナントを作成: hira-t');
      tenant = await prisma.tenant.create({
        data: {
          name: 'hira-t',
          display_name: 'Hira-T Corporation',
          status: 'ACTIVE',
          subscription_status: 'ACTIVE',
          sso_enabled: true,
          trial_ends_at: null, // 無期限
          // その他必要なフィールドがあれば追加
        }
      });
      console.log('✅ テナント作成完了:', tenant.id);
    } else {
      console.log('✅ 既存テナントを使用:', tenant.name);
      
      // SSO有効化を確認・更新
      if (!tenant.sso_enabled) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { 
            sso_enabled: true,
            status: 'ACTIVE',
            subscription_status: 'ACTIVE'
          }
        });
        console.log('✅ テナントのSSO設定を有効化');
      }
    }

    // hira-t.jp ドメインを登録
    console.log('🌐 hira-t.jp ドメインを登録');
    await prisma.tenantEmailDomain.create({
      data: {
        tenant_id: tenant.id,
        domain: 'hira-t.jp',
        is_primary: true,
      }
    });

    console.log('✅ ドメイン登録完了: hira-t.jp');

    // 確認
    const verification = await prisma.tenantEmailDomain.findFirst({
      where: { domain: 'hira-t.jp' },
      include: { tenant: true }
    });

    console.log('🎊 設定完了:');
    console.log(`   テナント: ${verification.tenant.name} (${verification.tenant.display_name})`);
    console.log(`   ドメイン: ${verification.domain}`);
    console.log(`   SSO有効: ${verification.tenant.sso_enabled}`);
    console.log(`   状態: ${verification.tenant.status}`);

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTenant();
