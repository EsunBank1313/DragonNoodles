import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure pdfjs worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

export default function DeliveryStatementsPanel({ supabase, storeName }) {
  const [activePlatform, setActivePlatform] = useState('all'); // 'all', 'uber', 'panda'
  const [statements, setStatements] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('delivery_statements_history') || '[]');
    } catch {
      return [];
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [importModalData, setImportModalData] = useState(null);
  const [activeDetailItem, setActiveDetailItem] = useState(null);

  // Default sample/seeded statements if empty (9月、10月帳單已解析資料)
  useEffect(() => {
    if (statements.length === 0) {
      const defaultData = [
        {
          id: 'stmt_uber_202610',
          platform: 'uber',
          platformName: 'Uber Eats',
          periodName: '2026年10月 (10/01 - 10/31)',
          statementNumber: '#913E7CA2',
          orderCount: 72,
          grossSales: 23485,
          platformFee: 5907,
          promoDiscount: 4360,
          adExpense: 920, // 2,693 - 1,773
          adjustments: 340,
          netPayout: 11286,
          status: '已撥款',
          payoutDate: '2026/10/27',
          importedAt: '2026-11-01',
          details: {
            feeRate: '25.2%',
            adGross: 2693,
            adCredit: 1773,
            cycles: [
              { period: 'Sep 28 - Oct 11', sales: 14241, orders: 46, fee: 3556, net: 7429, date: 'Oct 13, 2026' },
              { period: 'Oct 12 - Oct 25', sales: 10122, orders: 27, fee: 2647, net: 5129, date: 'Oct 27, 2026' }
            ]
          }
        },
        {
          id: 'stmt_panda_202610_2',
          platform: 'panda',
          platformName: 'Foodpanda (熊貓)',
          periodName: '2026年10月下半月 (10/16 - 10/31)',
          statementNumber: '200721233692',
          orderCount: 23,
          grossSales: 7349,
          platformFee: 2013,
          promoDiscount: 1420,
          adExpense: 1246,
          adjustments: 300, // 平台期租費
          netPayout: 2370,
          status: '已撥款',
          payoutDate: '2026/11/09',
          importedAt: '2026-11-09',
          details: {
            feeRate: '34.0%',
            rentalFee: 300,
            adFees: 1246,
            ordersSummary: '共 23 筆外送訂單，無取消未付款項'
          }
        },
        {
          id: 'stmt_panda_202610_1',
          platform: 'panda',
          platformName: 'Foodpanda (熊貓)',
          periodName: '2026年10月上半月 (10/01 - 10/15)',
          statementNumber: '200372976604',
          orderCount: 23,
          grossSales: 7356,
          platformFee: 2017,
          promoDiscount: 1414,
          adExpense: 584,
          adjustments: 449, // 300 期租 + 149 前期沖抵
          netPayout: 2892,
          status: '已撥款',
          payoutDate: '2026/10/23',
          importedAt: '2026-10-23',
          details: {
            feeRate: '34.0%',
            rentalFee: 300,
            adFees: 584,
            prevOffset: -149
          }
        },
        {
          id: 'stmt_uber_202609',
          platform: 'uber',
          platformName: 'Uber Eats',
          periodName: '2026年09月 (09/01 - 09/30)',
          statementNumber: '#80ED21C3',
          orderCount: 103,
          grossSales: 26790,
          platformFee: 7079,
          promoDiscount: 5350,
          adExpense: 1255, // 2,312 - 1,057
          adjustments: 195,
          netPayout: 13703,
          status: '已撥款',
          payoutDate: '2026/09/29',
          importedAt: '2026-10-01',
          details: {
            feeRate: '26.4%',
            adGross: 2312,
            adCredit: 1057,
            cycles: [
              { period: 'Sep 06 - Sep 13', sales: 6470, orders: 27, fee: 2010, net: 4265, date: 'Sep 15, 2026' },
              { period: 'Sep 14 - Sep 27', sales: 17366, orders: 68, fee: 4243, net: 7654, date: 'Sep 29, 2026' }
            ]
          }
        },
        {
          id: 'stmt_panda_202609_2',
          platform: 'panda',
          platformName: 'Foodpanda (熊貓)',
          periodName: '2026年09月下半月 (09/16 - 09/30)',
          statementNumber: '200431144992',
          orderCount: 6,
          grossSales: 1989,
          platformFee: 540,
          promoDiscount: 398,
          adExpense: 200,
          adjustments: 1000, // 設備租借
          netPayout: -149,
          status: '自下期扣抵',
          payoutDate: '2026/10/05',
          importedAt: '2026-10-05',
          details: {
            feeRate: '27.1%',
            deviceFee: 1000,
            note: '本期因設備設定費 $1,000，扣抵後淨額 -$149 已於 10月上半月沖抵完成'
          }
        }
      ];
      setStatements(defaultData);
      localStorage.setItem('delivery_statements_history', JSON.stringify(defaultData));
    }
  }, [statements.length]);

  const saveStatements = (newList) => {
    setStatements(newList);
    localStorage.setItem('delivery_statements_history', JSON.stringify(newList));
  };

  // --- File Parsing Handlers ---

  // 1. Parse Excel (Foodpanda 附件1, 附件2, 附件3)
  const parseFoodpandaWorkbook = (wb, sourceFilename = '') => {
    const ws1 = wb.Sheets['附件1'] || wb.Sheets[Object.keys(wb.Sheets)[0]];
    const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1 });
    if (!rows1 || rows1.length < 2) throw new Error('找不到有效的附件1訂單明細');

    const dataRows = rows1.slice(1).filter(r => r && r[2]);
    const orderCount = dataRows.length;
    const grossSales = dataRows.reduce((sum, r) => sum + (parseFloat(r[6]) || 0), 0);
    const promoDiscount = dataRows.reduce((sum, r) => sum + (parseFloat(r[9]) || 0), 0);
    const platformFee = dataRows.reduce((sum, r) => sum + (parseFloat(r[19]) || 0), 0);
    const orderNet = dataRows.reduce((sum, r) => sum + (parseFloat(r[23]) || 0), 0);

    let otherFees = 0;
    let feeBreakdown = [];
    if (wb.Sheets['附件2']) {
      const rows2 = XLSX.utils.sheet_to_json(wb.Sheets['附件2'], { header: 1 });
      rows2.slice(1).forEach(r => {
        if (r && r[2]) {
          const amt = parseFloat(r[2]) || 0;
          otherFees += amt;
          feeBreakdown.push({ item: r[0], desc: r[1], amt });
        }
      });
    }

    let prevOffset = 0;
    if (wb.Sheets['附件3']) {
      const rows3 = XLSX.utils.sheet_to_json(wb.Sheets['附件3'], { header: 1 });
      rows3.slice(1).forEach(r => {
        if (r && r[3]) {
          prevOffset += parseFloat(r[3]) || 0;
        }
      });
    }

    const netPayout = Math.round((orderNet - otherFees + prevOffset) * 100) / 100;
    const dates = dataRows.map(r => String(r[4] || '')).filter(Boolean).sort();
    const minDate = dates[0] || '';
    const maxDate = dates[dates.length - 1] || '';
    const stmtNum = sourceFilename.replace(/[^0-9]/g, '').slice(-12) || Date.now().toString().slice(-8);

    return {
      platform: 'panda',
      platformName: 'Foodpanda (熊貓)',
      periodName: `Foodpanda 結帳週期 (${minDate} ~ ${maxDate})`,
      statementNumber: stmtNum,
      orderCount,
      grossSales: Math.round(grossSales),
      platformFee: Math.round(platformFee),
      promoDiscount: Math.round(promoDiscount),
      adExpense: Math.round(otherFees),
      adjustments: prevOffset,
      netPayout: Math.round(netPayout),
      status: netPayout >= 0 ? '已撥款' : '結餘負數(抵扣)',
      payoutDate: maxDate,
      sourceFilename,
      details: {
        dateRange: `${minDate} ~ ${maxDate}`,
        feeBreakdown,
        prevOffset
      }
    };
  };

  // 2. Parse PDF (Uber Eats Monthly Statement)
  const parseUberPDF = async (arrayBuffer, sourceFilename = '') => {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items.map(item => item.str).join(' ');
      fullText += ' ' + pageStr;
    }

    // Regex extraction
    const mMonth = fullText.match(/(September|October|November|December|January)\s+(\d{4})/i);
    const monthStr = mMonth ? `${mMonth[1]} ${mMonth[2]}` : '未知月份';

    const mOrders = fullText.match(/銷售額\s*\(\s*(\d+)\s*訂單\s*\)\s*\$([\d,]+\.\d{2})/);
    const orderCount = mOrders ? parseInt(mOrders[1], 10) : 0;
    const grossSales = mOrders ? parseFloat(mOrders[2].replace(/,/g, '')) : 0;

    const mNet = fullText.match(/(?:淨總計|淨銷售額)\s*\$([\d,]+\.\d{2})/);
    const netPayout = mNet ? parseFloat(mNet[1].replace(/,/g, '')) : 0;

    const mFee = fullText.match(/平台服務費\s*-\$([\d,]+\.\d{2})/);
    const platformFee = mFee ? parseFloat(mFee[1].replace(/,/g, '')) : 0;

    const mPromo = fullText.match(/商品優惠\s*-\$([\d,]+\.\d{2})/);
    const promoDiscount = mPromo ? parseFloat(mPromo[1].replace(/,/g, '')) : 0;

    const mAd = fullText.match(/廣告費用\s*-\$([\d,]+\.\d{2})/);
    const adExpenseGross = mAd ? parseFloat(mAd[1].replace(/,/g, '')) : 0;

    const mCredit = fullText.match(/廣告點數\s*\$([\d,]+\.\d{2})/);
    const adCredit = mCredit ? parseFloat(mCredit[1].replace(/,/g, '')) : 0;

    const mStmtNum = fullText.match(/#([0-9A-Z]{6,12})/);
    const stmtNum = mStmtNum ? `#${mStmtNum[1]}` : (sourceFilename || 'UBER_' + Date.now().toString().slice(-6));

    return {
      platform: 'uber',
      platformName: 'Uber Eats',
      periodName: `Uber Eats 每月帳單 (${monthStr})`,
      statementNumber: stmtNum,
      orderCount,
      grossSales: Math.round(grossSales),
      platformFee: Math.round(platformFee),
      promoDiscount: Math.round(promoDiscount),
      adExpense: Math.max(0, Math.round(adExpenseGross - adCredit)),
      adjustments: 0,
      netPayout: Math.round(netPayout),
      status: '已撥款',
      payoutDate: monthStr,
      sourceFilename,
      details: {
        adExpenseGross,
        adCredit,
        netSales: netPayout
      }
    };
  };

  // Main File Input Handler (Supports .zip, .xlsx, .pdf)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus(`正在讀取檔案 ${file.name}...`);

    try {
      const fileNameLower = file.name.toLowerCase();
      const parsedItems = [];

      if (fileNameLower.endsWith('.zip')) {
        setProcessingStatus('正在解壓縮 ZIP 封裝包 (包含 Foodpanda / Uber 報表)...');
        const zip = await JSZip.loadAsync(file);
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const entryNameLower = relativePath.toLowerCase();

          if (entryNameLower.endsWith('.xlsx')) {
            setProcessingStatus(`解析 Excel 表格: ${relativePath}...`);
            const arrayBuf = await zipEntry.async('arraybuffer');
            const wb = XLSX.read(arrayBuf, { type: 'array' });
            const parsed = parseFoodpandaWorkbook(wb, relativePath);
            parsedItems.push(parsed);
          } else if (entryNameLower.endsWith('.pdf') && !entryNameLower.includes('__macosx')) {
            setProcessingStatus(`解析 PDF 文件: ${relativePath}...`);
            const arrayBuf = await zipEntry.async('arraybuffer');
            try {
              const parsed = await parseUberPDF(arrayBuf, relativePath);
              if (parsed.orderCount > 0 || parsed.grossSales > 0) {
                parsedItems.push(parsed);
              }
            } catch (err) {
              console.warn('Skip non-uber PDF or parse failed:', relativePath, err);
            }
          }
        }
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
        setProcessingStatus('正在解析 Foodpanda Excel 帳單...');
        const arrayBuf = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuf, { type: 'array' });
        const parsed = parseFoodpandaWorkbook(wb, file.name);
        parsedItems.push(parsed);
      } else if (fileNameLower.endsWith('.pdf')) {
        setProcessingStatus('正在解析 Uber Eats / Foodpanda PDF 帳單...');
        const arrayBuf = await file.arrayBuffer();
        const parsed = await parseUberPDF(arrayBuf, file.name);
        parsedItems.push(parsed);
      } else {
        alert('請上傳 .zip 壓縮包、.xlsx Excel 對帳單或 .pdf 帳單文件！');
        setIsProcessing(false);
        return;
      }

      if (parsedItems.length === 0) {
        alert('檔案讀取完成，但未發現可識別的 Uber Eats 或 Foodpanda 帳單數據。');
      } else {
        setImportModalData(parsedItems);
      }
    } catch (err) {
      console.error(err);
      alert('解析帳單檔案失敗: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!importModalData || importModalData.length === 0) return;
    const newItems = importModalData.map(item => ({
      ...item,
      id: 'stmt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      importedAt: new Date().toISOString().split('T')[0]
    }));

    // Prevent duplicates by statementNumber
    const existingNums = new Set(statements.map(s => s.statementNumber));
    const filteredNew = newItems.filter(item => !existingNums.has(item.statementNumber));

    const updated = [...filteredNew, ...statements];
    saveStatements(updated);
    setImportModalData(null);
    alert(`🎉 成功匯入 ${newItems.length} 份外送對帳單！已納入系統營運財務對帳中心。`);
  };

  const handleDeleteStatement = (id) => {
    if (!confirm('確定要從紀錄中刪除這筆對帳單嗎？')) return;
    const updated = statements.filter(s => s.id !== id);
    saveStatements(updated);
  };

  // Filtered view
  const filteredStatements = statements.filter(s => {
    if (activePlatform === 'all') return true;
    return s.platform === activePlatform;
  });

  // Calculate Totals
  const totalGross = filteredStatements.reduce((sum, s) => sum + (s.grossSales || 0), 0);
  const totalNet = filteredStatements.reduce((sum, s) => sum + (s.netPayout || 0), 0);
  const totalFee = filteredStatements.reduce((sum, s) => sum + (s.platformFee || 0), 0);
  const totalPromo = filteredStatements.reduce((sum, s) => sum + (s.promoDiscount || 0), 0);
  const totalOrders = filteredStatements.reduce((sum, s) => sum + (s.orderCount || 0), 0);
  const avgCommissionRate = totalGross > 0 ? ((totalFee / totalGross) * 100).toFixed(1) : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
      {/* Top Banner & Upload Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🛵</span>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              雙外送平台對帳與電子帳單管理中心
            </h3>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              backgroundColor: 'rgba(5, 150, 105, 0.12)',
              color: '#059669',
              padding: '3px 8px',
              borderRadius: '12px'
            }}>
              Uber Eats ＆ Foodpanda 支援
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            支援直接匯入 Uber Eats 每月明細 PDF、Foodpanda 附件 Excel (.xlsx) 或官方 Payout 封裝包 (.zip)，自動統計各期銷售、抽成抽比、行銷折抵與撥款實收淨額。
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#0284c7',
            color: 'white',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
          }}>
            <span>📂 匯入帳單 (ZIP / Excel / PDF)</span>
            <input
              type="file"
              accept=".zip,.xlsx,.xls,.pdf"
              style={{ display: 'none' }}
              disabled={isProcessing}
              onChange={handleFileSelect}
            />
          </label>
        </div>
      </div>

      {/* Loading indicator */}
      {isProcessing && (
        <div style={{
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          border: '1px solid #0284c7',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          color: '#0284c7',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
          <span>{processingStatus || '正在分析外送帳單中，請稍候...'}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>外送訂單總數</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-main)', marginTop: '4px' }}>
            {totalOrders.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>單</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            涵蓋已匯入的 {filteredStatements.length} 期對帳結算
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>外送總銷售額 (標價流水)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0284c7', marginTop: '4px' }}>
            NT$ {totalGross.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            消費者點購商品總價 (未扣抽成)
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>平台抽成佣金總計</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>
            -NT$ {totalFee.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
            平均抽成抽比: {avgCommissionRate}%
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>店家最終實收 (撥款淨額)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
            NT$ {totalNet.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#059669', marginTop: '4px' }}>
            實收佔比: {totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : 0}% (扣除折扣與廣告)
          </div>
        </div>
      </div>

      {/* Platform Tabs & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: `全部平台 (${statements.length})` },
            { id: 'uber', label: `Uber Eats (${statements.filter(s => s.platform === 'uber').length})` },
            { id: 'panda', label: `Foodpanda 熊貓 (${statements.filter(s => s.platform === 'panda').length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePlatform(tab.id)}
              style={{
                padding: '7px 16px',
                borderRadius: '20px',
                fontSize: '0.84rem',
                fontWeight: activePlatform === tab.id ? 'bold' : 'normal',
                backgroundColor: activePlatform === tab.id ? 'var(--primary)' : 'var(--bg-card)',
                color: activePlatform === tab.id ? 'white' : 'var(--text-main)',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          提示：點擊任一期帳單可展開各週別撥款與扣款明細。
        </div>
      </div>

      {/* Statements Table */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>平台 / 週期名稱</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>帳單編號</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>訂單數</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>銷售總額</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>平台抽成</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>行銷與折扣</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>店家實收淨額</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>撥款狀態</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    尚無該平台之外送對帳單。請點擊上方按鈕上傳帳單檔案。
                  </td>
                </tr>
              ) : (
                filteredStatements.map(stmt => {
                  const isUber = stmt.platform === 'uber';
                  return (
                    <tr
                      key={stmt.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 'bold',
                            backgroundColor: isUber ? '#000000' : '#D70F64',
                            color: 'white'
                          }}>
                            {isUber ? 'Uber' : '熊貓'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{stmt.periodName}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>匯入時間: {stmt.importedAt}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {stmt.statementNumber}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold' }}>
                        {stmt.orderCount} 筆
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0284c7' }}>
                        NT$ {stmt.grossSales.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#dc2626' }}>
                        -NT$ {stmt.platformFee.toLocaleString()}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ({stmt.grossSales > 0 ? ((stmt.platformFee / stmt.grossSales) * 100).toFixed(1) : 0}%)
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#d97706' }}>
                        -NT$ {(stmt.promoDiscount + stmt.adExpense).toLocaleString()}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          促銷: ${stmt.promoDiscount} | 廣告: ${stmt.adExpense}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: '900',
                          color: stmt.netPayout >= 0 ? '#059669' : '#dc2626'
                        }}>
                          NT$ {stmt.netPayout.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: stmt.netPayout >= 0 ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                          color: stmt.netPayout >= 0 ? '#059669' : '#dc2626'
                        }}>
                          {stmt.status || '已撥款'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setActiveDetailItem(stmt)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--bg-body)',
                              color: 'var(--text-main)',
                              cursor: 'pointer'
                            }}
                          >
                            🔍 明細
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStatement(stmt.id)}
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.78rem',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#dc2626',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Preview Modal */}
      {importModalData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            width: '680px',
            maxWidth: '95%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                📥 匯入外送對帳單預覽確認
              </h3>
              <button
                type="button"
                onClick={() => setImportModalData(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              系統已成功自動識別 <strong>{importModalData.length}</strong> 份對帳資料，請核對以下統計金額：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {importModalData.map((item, idx) => (
                <div key={idx} style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-body)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.92rem' }}>
                      {item.platformName} - {item.periodName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      訂單: {item.orderCount} 筆 | 銷售額: NT$ {item.grossSales.toLocaleString()} | 抽成: NT$ {item.platformFee.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#059669' }}>
                      NT$ {item.netPayout.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>預計撥款淨額</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setImportModalData(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)'
                }}
              >
                🚀 確認匯入此批對帳單 ({importModalData.length} 筆)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {activeDetailItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            width: '560px',
            maxWidth: '95%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold' }}>
                  📄 {activeDetailItem.platformName} 對帳明細
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  帳單編號: {activeDetailItem.statementNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailItem(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <span>對帳週期</span>
                <strong>{activeDetailItem.periodName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <span>完成訂單數量</span>
                <strong>{activeDetailItem.orderCount} 筆</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                <span>商品銷售總額 (Gross)</span>
                <strong>NT$ {activeDetailItem.grossSales.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', color: '#dc2626' }}>
                <span>平台服務費 (佣金抽成)</span>
                <strong>-NT$ {activeDetailItem.platformFee.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', color: '#d97706' }}>
                <span>商家商品折扣 / 優惠</span>
                <strong>-NT$ {activeDetailItem.promoDiscount.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', color: '#d97706' }}>
                <span>廣告行銷開銷</span>
                <strong>-NT$ {activeDetailItem.adExpense.toLocaleString()}</strong>
              </div>
              {activeDetailItem.adjustments !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', color: '#6366f1' }}>
                  <span>其他調整 / 設備期租 / 沖抵</span>
                  <strong>{activeDetailItem.adjustments > 0 ? `-$${activeDetailItem.adjustments}` : `+$${Math.abs(activeDetailItem.adjustments)}`}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 6px 0', fontSize: '1.15rem' }}>
                <span style={{ fontWeight: 'bold' }}>本期撥款實收 (Net)</span>
                <strong style={{ color: '#059669', fontSize: '1.25rem' }}>NT$ {activeDetailItem.netPayout.toLocaleString()}</strong>
              </div>
            </div>

            {/* Extra sub-cycles for Uber */}
            {activeDetailItem.details?.cycles && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  週期雙週撥款拆解：
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activeDetailItem.details.cycles.map((c, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-body)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.period} ({c.orders}單)</span>
                      <span>實收: <strong>NT$ {c.net.toLocaleString()}</strong> (匯款日: {c.date})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveDetailItem(null)}
              style={{
                marginTop: '10px',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              關閉明細
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
