import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://imiqcxklultqjlmmmlve.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXFjeGtsdWx0cWpsbW1tbHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Njk4MTIsImV4cCI6MjA5OTA0NTgxMn0.A1PyeQG_tgpcMBPwIxXg8bMCOP2YO3d911NSDKMI3Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLES = ['orders', 'menu_items', 'purchases', 'fixed_costs'];
const PAGE_SIZE = 500;

async function fetchAllRows(tableName) {
  let allRows = [];
  let page = 0;
  let hasMore = true;

  console.log(`⏳ 正在擷取 ${tableName} 資料表...`);

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`讀取 ${tableName} 失敗: ${error.message}`);
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      console.log(`   已讀取 ${allRows.length} / ${count || '?'} 筆`);
    }

    if (!data || data.length < PAGE_SIZE || allRows.length >= (count || 0)) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allRows;
}

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return "'" + jsonStr + "'::jsonb";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function generateSqlInserts(tableName, rows) {
  if (!rows || rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const lines = [
    `-- 資料表 ${tableName} 備份 (共 ${rows.length} 筆)`,
    `DELETE FROM public.${tableName};`
  ];

  const colList = columns.map(c => `"${c}"`).join(', ');

  // Batch insert in chunks of 50 rows
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valRows = chunk.map(row => {
      const values = columns.map(col => sqlEscape(row[col])).join(', ');
      return `(${values})`;
    });
    lines.push(`INSERT INTO public.${tableName} (${colList}) VALUES\n${valRows.join(',\n')};`);
  }

  return lines.join('\n\n') + '\n';
}

async function runBackup() {
  const startTime = new Date();
  const nowStr = startTime.toISOString().replace(/[:.]/g, '-');
  const taipeiDateStr = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(startTime).replace(/[\/:]/g, '-').replace(/\s+/g, '_');

  const rootDir = path.resolve(__dirname, '..');
  const backupDirName = `backup_${taipeiDateStr}`;
  const targetDir = path.join(rootDir, 'backups', backupDirName);
  const latestDir = path.join(rootDir, 'backups', 'latest');

  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });

  const backupData = {};
  const metadata = {
    backup_timestamp_utc: startTime.toISOString(),
    backup_timestamp_taipei: taipeiDateStr,
    supabase_url: supabaseUrl,
    table_counts: {},
    orders_by_store: {},
    files_generated: []
  };

  let fullSqlScript = `-- ==============================================================================
-- 🚀 智慧 POS 收銀與雲端財務記帳系統 - 完整資料庫還原 SQL
-- 備份時間: ${taipeiDateStr} (台北時間)
-- Supabase URL: ${supabaseUrl}
-- ==============================================================================

BEGIN;
`;

  for (const table of TABLES) {
    const rows = await fetchAllRows(table);
    backupData[table] = rows;
    metadata.table_counts[table] = rows.length;

    // Write individual table JSON
    const tableJson = JSON.stringify(rows, null, 2);
    fs.writeFileSync(path.join(targetDir, `${table}.json`), tableJson, 'utf8');
    fs.writeFileSync(path.join(latestDir, `${table}.json`), tableJson, 'utf8');

    // Also update root directory mock json for local testing
    fs.writeFileSync(path.join(rootDir, `${table}.json`), tableJson, 'utf8');

    // Generate SQL restore statements
    const sqlChunk = generateSqlInserts(table, rows);
    fullSqlScript += '\n' + sqlChunk;
  }

  fullSqlScript += '\nCOMMIT;\n';

  // Write SQL restore script
  fs.writeFileSync(path.join(targetDir, 'restore_database.sql'), fullSqlScript, 'utf8');
  fs.writeFileSync(path.join(latestDir, 'restore_database.sql'), fullSqlScript, 'utf8');

  // Breakdown orders by store
  if (backupData.orders) {
    const storeCounts = {};
    for (const o of backupData.orders) {
      let sc = 'dragon';
      if (o.store_code) {
        sc = o.store_code;
      } else if (o.items) {
        let it = o.items;
        if (typeof it === 'string') {
          try { it = JSON.parse(it); } catch (e) {}
        }
        if (it?.store_code || it?.storeCode) {
          sc = it.store_code || it.storeCode;
        }
      }
      storeCounts[sc] = (storeCounts[sc] || 0) + 1;
    }
    metadata.orders_by_store = storeCounts;
  }

  // Write complete bundle JSON
  fs.writeFileSync(path.join(targetDir, 'full_backup.json'), JSON.stringify(backupData, null, 2), 'utf8');
  fs.writeFileSync(path.join(latestDir, 'full_backup.json'), JSON.stringify(backupData, null, 2), 'utf8');

  // Write markdown summary
  const summaryMd = `# 📦 資料庫備份報告 (Database Backup Report)

* **備份完成時間**：${taipeiDateStr} (台北時間) / ${startTime.toISOString()} (UTC)
* **雲端資料庫**：${supabaseUrl}
* **備份資料夾**：\`backups/${backupDirName}/\` (最新連結指向 \`backups/latest/\`)

---

## 📊 各資料表備份筆數

| 資料表名稱 | 筆數 (Rows) | 說明 |
| :--- | :--- | :--- |
| **orders** | ${metadata.table_counts.orders || 0} 筆 | 現場 POS 與顧客線上點餐訂單記錄 |
| **menu_items** | ${metadata.table_counts.menu_items || 0} 筆 | 菜單商品、自訂規格、系統全域設定 (Key-Value) |
| **purchases** | ${metadata.table_counts.purchases || 0} 筆 | 進貨支出、食材廠商採購明細 (變動成本) |
| **fixed_costs** | ${metadata.table_counts.fixed_costs || 0} 筆 | 門市固定成本 (房租、薪資、固定水電等) |

---

## 🏪 訂單門市分佈 (Orders Breakdown)

${Object.entries(metadata.orders_by_store).map(([k, v]) => `- **${k}**: ${v} 筆`).join('\n')}

---

## 🗂️ 產生檔案清單

1. \`orders.json\` - 訂單獨立 JSON
2. \`menu_items.json\` - 菜單與配置獨立 JSON
3. \`purchases.json\` - 進貨採購獨立 JSON
4. \`fixed_costs.json\` - 固定成本獨立 JSON
5. \`full_backup.json\` - 全庫合一 JSON 快照
6. \`restore_database.sql\` - 1-Click 一鍵還原 SQL 腳本 (直接貼入 Supabase SQL Editor 執行)
7. \`metadata.json\` - 備份環境與統計元資料
`;

  fs.writeFileSync(path.join(targetDir, 'README.md'), summaryMd, 'utf8');
  fs.writeFileSync(path.join(latestDir, 'README.md'), summaryMd, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  fs.writeFileSync(path.join(latestDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

  console.log('\n========================================');
  console.log('🎉 資料庫備份成功完成！');
  console.log(`📂 備份路徑: ${targetDir}`);
  console.log(`📂 最新捷徑: ${latestDir}`);
  console.log('📊 筆數摘要:');
  for (const [tbl, cnt] of Object.entries(metadata.table_counts)) {
    console.log(`   - ${tbl}: ${cnt} 筆`);
  }
  console.log('========================================\n');
}

runBackup().catch(err => {
  console.error('❌ 備份發生嚴重錯誤:', err);
  process.exit(1);
});
