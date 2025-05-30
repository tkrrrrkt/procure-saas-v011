const bcrypt = require('bcrypt');

// パスワードとソルトラウンド（コスト）を設定
const password = 'ktkrr0714';
const saltRounds = 12; // セキュリティレベル（10-12が推奨）

// async/awaitを使用してハッシュ化
async function generateHashAndSQL() {
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('生成されたハッシュ:', hash);
        console.log('\n=== UPDATE SQL文 ===');
        console.log(`UPDATE "v000"."login_account" 
SET 
    "password_hash" = '${hash}',
    "updated_at" = CURRENT_TIMESTAMP
WHERE 
    "identifier" = 'koizumi@sint.co.jp';`);
        
        // 検証
        const isValid = await bcrypt.compare(password, hash);
        console.log('\n=== 検証結果 ===');
        console.log('パスワード検証:', isValid);
        
    } catch (error) {
        console.error('ハッシュ化エラー:', error);
    }
}

// 実行
generateHashAndSQL();