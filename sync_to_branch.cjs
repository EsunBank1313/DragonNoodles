const fs = require('fs');
const path = require('path');

// Sync all updated source files from restaurant_ordering_system to luzhou7_system
const currentDir = __dirname;
const isInsideRepo = fs.existsSync(path.join(currentDir, 'src')) && path.basename(currentDir) === 'restaurant_ordering_system';
const rootDir = isInsideRepo ? path.resolve(currentDir, '..') : currentDir;
const srcDir = path.join(rootDir, 'restaurant_ordering_system');
const dstDir = path.join(rootDir, 'luzhou7_system');

const filesToSync = [
  'src/App.jsx',
  'src/components/CashierView.jsx',
  'src/components/BookkeepingView.jsx',
  'src/components/ManagementView.jsx',
  'src/components/ItemModal.jsx',
  'src/components/CustomerView.jsx',
  'src/components/UnifiedLoginScreen.jsx',
  'src/components/ModuleCenterModal.jsx',
  'src/components/SetupWizardModal.jsx',
  'src/utils/securityConfig.js',
  'src/utils/moduleContext.js',
  'src/utils/storeContext.js',
  'src/data/menuData.js',
  'public/manifest.json',
  'supabase_schema_universal.sql',
  '.env.example',
  'README.md',
  'DEPLOYMENT_GUIDE.md',
  'DEVELOPER_HANDOVER.md',
  'POS機台列印設定.md',
  'vercel_deployment_handover_guide.md',
  'GEMINI.md',
  'backup_database.js'
];

console.log('🔄 開始同步檔案至蘆洲分店 (luzhou7_system)...');

filesToSync.forEach(rel => {
  const srcPath = path.join(srcDir, rel);
  const dstPath = path.join(dstDir, rel);
  if (fs.existsSync(srcPath)) {
    const dir = path.dirname(dstPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    console.log(`  ✓ 同步成功: ${rel}`);
  } else {
    console.warn(`  ⚠️ 來源檔案不存在: ${srcPath}`);
  }
});

console.log('🎉 雙店程式碼同步完成！');
