import { Injectable, effect, signal } from '@angular/core';

export type Lang = 'en' | 'th';

const STORAGE_KEY = 'mfc-lang';

/**
 * English display names for the 32 MFC PVD policy codes.
 * In TH mode we fall back to whatever Thai name the data source provides.
 */
const EN_FUND_NAMES: Record<string, string> = {
  MPF01: '[MPF01] Government Bonds',
  MPF02: '[MPF02] Fixed Income',
  MPF03: '[MPF03] Thai Equity',
  MPF04: '[MPF04] Short-term Bonds',
  MPF05: '[MPF05] Global Bonds',
  MPF06: '[MPF06] Global Equity',
  MPF07: '[MPF07] Gold',
  MPF08: '[MPF08] Thai Islamic Equity',
  MPF09: '[MPF09] Thai Real Estate',
  MPF10: '[MPF10] Thai SET50 Index',
  MPF11: '[MPF11] Thai Large Cap',
  MPF12: '[MPF12] Thai Mid/Small Cap',
  MPF13: '[MPF13] Domestic & Global Real Estate',
  MPF14: '[MPF14] Thai Dividend Equity',
  MPF15: '[MPF15] Technology Equity',
  MPF16: '[MPF16] China A-Shares',
  MPF17: '[MPF17] Sustainable Energy',
  MPF18: '[MPF18] Emerging Markets Equity',
  MPF19: '[MPF19] European Equity',
  MPF20: '[MPF20] Domestic & Global Bonds',
  MPF21: '[MPF21] Thai Concentrated (≤30 stocks)',
  MPF22: '[MPF22] Balanced 75/25',
  MPF23: '[MPF23] Global Concentrated (≤50 stocks)',
  MPF24: '[MPF24] Money Market',
  MPF25: '[MPF25] Indian Equity',
  MPF26: '[MPF26] Vietnam Equity',
  MPF27: '[MPF27] Asian Equity',
  MPF28: '[MPF28] US Equity',
  MPF29: '[MPF29] Consumer Trends Equity',
  MPF30: '[MPF30] Asia Technology Equity',
  MPF31: '[MPF31] Healthcare Equity',
  MPF32: '[MPF32] Global Real Estate',
};

/** Category (group_name) Thai → English. Covers every unique value in ranking.json + info.json. */
const EN_CATEGORIES: Record<string, string> = {
  'หุ้นต่างประเทศ':                                   'International Equity',
  'หุ้นต่างประเทศ (เฉพาะหมวดอุตสาหกรรม)':              'International Equity (Sector)',
  'หุ้นไทย':                                          'Thai Equity',
  'ทองคำ':                                            'Gold',
  'ผสม':                                             'Mixed',
  'ผสม (หุ้นไทยไม่จำกัด)':                            'Mixed (Unrestricted Thai Equity)',
  'ตราสารหนี้':                                       'Fixed Income',
  'ตราสารหนี้ต่างประเทศ':                             'Global Fixed Income',
  'ตราสารหนี้ระยะสั้น':                               'Short-term Bonds',
  'ตลาดเงิน':                                        'Money Market',
  'อสังหาริมทรัพย์':                                  'Real Estate',
};

/** Translate the recommendation phrase emoji+verb form used in ranking.json. */
const EN_RECOMMENDATION: Record<string, string> = {
  'ซื้อ': 'Buy',
  'ถือ': 'Hold',
  'ขาย': 'Sell',
};

/**
 * English labels for the DIY broker constraint rules in constraints.json.
 * Keyed by rule id so both the Compliance grid and the standalone Broker
 * Constraints section pick up the same translation.
 */
const EN_CONSTRAINTS: Record<string, string> = {
  R1:  'Asia Technology Equity',
  R2:  'Technology Equity',
  R3:  'Sustainable Energy',
  R4:  'Healthcare Equity',
  R5:  'Tech + Energy + Healthcare combined',
  R6:  'Domestic & Global Fixed Income',
  R7:  'Real Estate combined',
  R8:  'Gold',
  R9:  'Gold + Real Estate + Global Bonds combined',
  R10: 'Thai Real Estate',
  R11: 'Domestic & Global Real Estate',
  R12: 'Global Real Estate',
};

/** Translation dictionary. Keep keys flat + dot-namespaced for easy lookup. */
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    // App shell
    'app.title':            'Plan your MFC PVD — the DIY way',
    'app.subtitle':         'Pick the funds you believe in, customize the mix, and see your DIY plan come alive — broker caps built in.',
    'app.loading':          'Loading data…',
    'app.loadFailed':       'Data load failed.',
    'app.loadFailedDetail': 'Could not load required data. Refresh the page or check your connection.',
    'app.personalize':      'Personalize',
    'app.live':             'Live analysis',
    'app.strategy':         'Strategy:',
    'app.holdings':         'Holdings:',
    'app.promptPortfolio':  'Set your portfolio →',
    'app.promptStrategy':   'Pick at least one fund in Strategy →',
    'theme.toggleToDark':   'Switch to dark mode',
    'theme.toggleToLight':  'Switch to light mode',
    'footer.dataThrough':   'Data through',
    'footer.source':        'Source: MFC public NAV data',
    'footer.unofficial':    'Unofficial DIY tool — not affiliated with MFC Asset Management.',
    'footer.builtWith':     'Built with Angular + Chart.js',

    // Static Overview
    'static.graph.title':       'Policy Performance Over Time',
    'static.graph.desc':        'Monthly NAV change per policy, 2019–2026. Toggle policies on the left to compare.',
    'static.graph.selectAll':   'Select All',
    'static.graph.deselectAll': 'Deselect All',
    'static.graph.policies':    'Policies',
    'static.tech.title':        'Technical Analysis Ranking',
    'static.tech.desc':         'Composite score from MA, MACD, RSI-14, and Fibonacci Retracement on monthly data (2023–2026).',
    'static.tech.signalGuide':  'Signal Guide',
    'static.tech.guide.strongBuy':  'Score 6–8: All indicators bullish',
    'static.tech.guide.buy':        'Score 3–5: Majority bullish',
    'static.tech.guide.hold':       'Score −2 to 2: Mixed signals',
    'static.tech.guide.sell':       'Score −3 to −5: Majority bearish',
    'static.tech.guide.strongSell': 'Score −6 to −8: All indicators bearish',
    'static.constraints.title':  'Broker Constraints (DIY Plan)',
    'static.constraints.desc':   'Maximum allocation rules enforced by the DIY plan. The portfolio engine respects these caps automatically.',
    'static.rankings.title':     'Policy Rankings & Recommendations',
    'static.rankings.desc':      'Sorted by 4-year average return. Risk levels are MFC-published categories (1 = lowest, 5 = highest).',

    // Portfolio Input
    'portfolio.section':        '1. Your Current Portfolio',
    'portfolio.totalAssets':    'Total Assets',
    'portfolio.required':       'required',
    'portfolio.optional':       'optional',
    'portfolio.ytdReturn':      'YTD Return',
    'portfolio.holdings':       'Holdings',
    'portfolio.holdingsHint':   'Allocate your fund proportions (must total 100%).',
    'portfolio.colPolicy':      'Policy',
    'portfolio.colProportion':  'Proportion %',
    'portfolio.selectFund':     '-- select --',
    'portfolio.addFund':        '+ Add Fund',
    'portfolio.total':          'Total:',
    'portfolio.adjustHint':     'Adjust to 100% to feed the analysis.',
    'portfolio.activeHolding':  'holding active',
    'portfolio.activeHoldings': 'holdings active',
    'portfolio.removeFund':     'Remove fund',

    // Strategy / theme selector
    'strategy.section':         '2. Strategy',
    'strategy.desc':            'Pick the funds you want in your customized portfolio. The engine keeps DIY broker caps and your equity / hedge limits intact.',
    'strategy.yourFunds':       'Your Funds',
    'strategy.selected':        'selected',
    'strategy.filter':          'Filter by code or name…',
    'strategy.clearFilter':     'Clear filter',
    'strategy.clear':           'Clear',
    'strategy.noMatches':       'No funds match',
    'strategy.maxEquity':       'Max equity %',
    'strategy.minHedge':        'Min hedge %',
    'strategy.active':          'Active:',
    'strategy.fund':            'fund',
    'strategy.funds':           'funds',
    'strategy.empty':           'Pick at least one fund to customize your portfolio.',

    // Analysis Output
    'analysis.customized':         '3. Customized Portfolio',
    'analysis.customizedTag':      '(Next 4 Years)',
    'analysis.customizedDesc':     'Generated from your selected strategy. The portfolio uses only the funds you bias toward, respecting DIY broker caps and your equity / hedge limits.',
    'analysis.snapshotTotal':      'Total Assets',
    'analysis.snapshotYTD':        'YTD',
    'analysis.snapshotProfit':     'Annual Profit (proj.)',
    'analysis.shortBy':            'short by',
    'analysis.overBy':             'over by',
    'analysis.allocSum':           'Allocations sum to',
    'analysis.editOrAdd':          'Either edit the % below, or add another fund in Strategy.',
    'analysis.trim':               'Trim a row to bring the total back to 100%.',
    'analysis.colFund':            'Fund',
    'analysis.colPct':             '%',
    'analysis.colAvg4yr':          'Avg 4yr',
    'analysis.colRsi':             'RSI',
    'analysis.colEntry':           'Entry',
    'analysis.colFib':             'Fib',
    'analysis.colRole':            'Role',
    'analysis.colReason':          'Reason',
    'analysis.totalLabel':         'Total',
    'analysis.totalsAt100':        'Allocations sum to 100%.',
    'analysis.adjustTo100':        'Adjust to 100% — currently',
    'analysis.expectedPerYear':    'expected per year — based on 4-year averages',
    'analysis.compliance':         'Constraint Compliance (DIY Plan)',
    'analysis.pass':               'PASS',
    'analysis.fail':               'FAIL',
    'analysis.compareTitle':       '4. Old vs New Comparison',
    'analysis.metric':             'Metric',
    'analysis.current':            'Current',
    'analysis.customized2':        'Customized',
    'analysis.expectedReturn':     'Expected Return',
    'analysis.fromYTD':            'from YTD',
    'analysis.fromHoldings':       'from holdings',
    'analysis.riskProfile':        'Risk Profile',
    'analysis.inflationHedge':     'Inflation Hedge',
    'analysis.themeAlignment':     'Theme Alignment',
    'analysis.switchTitle':        '5. When to Switch Funds',
    'analysis.disclaimer':         'Disclaimer:',
    'analysis.disclaimerText':     'This is rule-based analysis on historical NAV data. NOT certified financial advice. Past performance ≠ future returns.',

    // Chart text
    'chart.customizedAllocation': 'Customized Allocation',
    'chart.allocationCompare':    'Allocation Compare',
    'chart.currentPct':           'Current %',
    'chart.customizedPct':        'Customized %',
    'chart.month.jan': 'Jan',
    'chart.month.feb': 'Feb',
    'chart.month.mar': 'Mar',
    'chart.month.apr': 'Apr',
    'chart.month.may': 'May',
    'chart.month.jun': 'Jun',
    'chart.month.jul': 'Jul',
    'chart.month.aug': 'Aug',
    'chart.month.sep': 'Sep',
    'chart.month.oct': 'Oct',
    'chart.month.nov': 'Nov',
    'chart.month.dec': 'Dec',

    // Custom Strategy display name
    'strategy.customName':        'Custom Strategy',

    // Engine: entry status (RSI-based)
    'entry.low_point':            'At bottom',
    'entry.base':                 'Base building',
    'entry.near_oversold':        'Near oversold',
    'entry.strong':               'Strong',
    'entry.overbought':           'Overbought',
    'entry.na':                   'N/A',

    // Engine: fund role
    'role.hedge':                 'Hedge',
    'role.conservative':          'Conservative',
    'role.growth':                'Growth',
    'role.balanced':              'Balanced',

    // Engine: reason fragments — {n}, {rsi}, {signal} are substituted at display.
    'reason.user_pick':           'User pick (+{n})',
    'reason.theme_match':         'Theme match ({n})',
    'reason.rsi_base':            'RSI {rsi} = base building',
    'reason.technical':           'Technical {signal}',
    'reason.inflation_hedge':     'Inflation hedge',
    'reason.diversifier':         'Diversifier',

    // Engine: switch criteria
    'switch.profit20.condition':       'Profit ≥ +20% on a fund',
    'switch.profit20.action':          'Take partial profit (sell 30-50%) → bond / gold',
    'switch.loss15.condition':         'Loss ≥ −15% on a fund',
    'switch.loss15.action':            'Stop-loss exit → re-evaluate thesis',
    'switch.theme_changed.condition':  'Strategy thesis no longer holds',
    'switch.theme_changed.action':     'Pick a new strategy + rerun the analysis',
    'switch.rsi75.condition':          'RSI > 75 on a holding',
    'switch.rsi75.action':             'Trim 25-50% to lock gains',
    'switch.oil_resolved.condition':   'Conflict resolves / oil < $70',
    'switch.oil_resolved.action':      'Reduce gold + energy → rotate to global equity',
    'switch.ai_top.condition':         'AI sector RSI > 80 broadly',
    'switch.ai_top.action':            'Trim TECH funds → take 50% off the table',
    'switch.rate_cut.condition':       'Central bank cuts rates 100bp+',
    'switch.rate_cut.action':          'Shift bonds → equity gradually',
    'switch.dividend_drop.condition':  'Dividend yield drops below 3%',
    'switch.dividend_drop.action':     'Rotate to higher-yield bonds or REITs',
    'switch.global_top.condition':     'Global equity RSI > 75 across regions',
    'switch.global_top.action':        'Trim winners, lock 30-50% gains',
  },
  th: {
    // App shell
    'app.title':            'วางแผน MFC PVD แบบ DIY',
    'app.subtitle':         'เลือกกองที่คุณมั่นใจ จัดสัดส่วนเอง แล้วดูแผน DIY ของคุณทำงาน — เคารพเพดานโบรกเกอร์อัตโนมัติ',
    'app.loading':          'กำลังโหลดข้อมูล…',
    'app.loadFailed':       'โหลดข้อมูลไม่สำเร็จ',
    'app.loadFailedDetail': 'โหลดข้อมูลที่จำเป็นไม่ได้ ลองรีเฟรชหน้าหรือเช็กการเชื่อมต่อ',
    'app.personalize':      'ปรับแต่ง',
    'app.live':             'วิเคราะห์แบบเรียลไทม์',
    'app.strategy':         'กลยุทธ์:',
    'app.holdings':         'จำนวนกอง:',
    'app.promptPortfolio':  'ตั้งค่าพอร์ตของคุณ →',
    'app.promptStrategy':   'เลือกอย่างน้อย 1 กองในกลยุทธ์ →',
    'theme.toggleToDark':   'เปลี่ยนเป็นโหมดมืด',
    'theme.toggleToLight':  'เปลี่ยนเป็นโหมดสว่าง',
    'footer.dataThrough':   'ข้อมูลถึง',
    'footer.source':        'แหล่งข้อมูล: NAV สาธารณะของ MFC',
    'footer.unofficial':    'เครื่องมือ DIY ไม่เป็นทางการ — ไม่ได้สังกัด MFC Asset Management',
    'footer.builtWith':     'พัฒนาด้วย Angular + Chart.js',

    // Static Overview
    'static.graph.title':       'ผลตอบแทนของแต่ละกองตามเวลา',
    'static.graph.desc':        'การเปลี่ยนแปลง NAV รายเดือนของแต่ละกอง ปี 2019–2026 เลือกกองด้านซ้ายเพื่อเปรียบเทียบ',
    'static.graph.selectAll':   'เลือกทั้งหมด',
    'static.graph.deselectAll': 'ยกเลิกทั้งหมด',
    'static.graph.policies':    'นโยบาย',
    'static.tech.title':        'อันดับการวิเคราะห์เชิงเทคนิค',
    'static.tech.desc':         'คะแนนรวมจาก MA, MACD, RSI-14 และ Fibonacci Retracement บนข้อมูลรายเดือน (2023–2026)',
    'static.tech.signalGuide':  'คู่มือสัญญาณ',
    'static.tech.guide.strongBuy':  'คะแนน 6–8: ทุกตัวชี้วัดเป็นบวก',
    'static.tech.guide.buy':        'คะแนน 3–5: ตัวชี้วัดส่วนใหญ่เป็นบวก',
    'static.tech.guide.hold':       'คะแนน −2 ถึง 2: สัญญาณผสม',
    'static.tech.guide.sell':       'คะแนน −3 ถึง −5: ตัวชี้วัดส่วนใหญ่เป็นลบ',
    'static.tech.guide.strongSell': 'คะแนน −6 ถึง −8: ทุกตัวชี้วัดเป็นลบ',
    'static.constraints.title':  'ข้อกำหนดของโบรกเกอร์ (แผน DIY)',
    'static.constraints.desc':   'กฎสัดส่วนสูงสุดที่แผน DIY กำหนด เครื่องมือจะเคารพข้อจำกัดเหล่านี้อัตโนมัติ',
    'static.rankings.title':     'อันดับและคำแนะนำของแต่ละนโยบาย',
    'static.rankings.desc':      'เรียงตามผลตอบแทนเฉลี่ย 4 ปี ระดับความเสี่ยงเป็นหมวดหมู่ที่ MFC ประกาศ (1 = ต่ำสุด, 5 = สูงสุด)',

    // Portfolio Input
    'portfolio.section':        '1. พอร์ตปัจจุบันของคุณ',
    'portfolio.totalAssets':    'มูลค่ารวม',
    'portfolio.required':       'จำเป็น',
    'portfolio.optional':       'ไม่บังคับ',
    'portfolio.ytdReturn':      'ผลตอบแทน YTD',
    'portfolio.holdings':       'กองที่ถือครอง',
    'portfolio.holdingsHint':   'จัดสัดส่วนของกอง (รวมกัน 100%)',
    'portfolio.colPolicy':      'นโยบาย',
    'portfolio.colProportion':  'สัดส่วน %',
    'portfolio.selectFund':     '-- เลือกกอง --',
    'portfolio.addFund':        '+ เพิ่มกอง',
    'portfolio.total':          'รวม:',
    'portfolio.adjustHint':     'ปรับให้ครบ 100% เพื่อเริ่มวิเคราะห์',
    'portfolio.activeHolding':  'กองทำงานอยู่',
    'portfolio.activeHoldings': 'กองทำงานอยู่',
    'portfolio.removeFund':     'ลบกอง',

    // Strategy
    'strategy.section':         '2. กลยุทธ์',
    'strategy.desc':            'เลือกกองที่ต้องการในพอร์ตปรับแต่งของคุณ เครื่องมือจะรักษาเพดานของแผน DIY และข้อจำกัด equity / hedge ที่ตั้งไว้',
    'strategy.yourFunds':       'กองของคุณ',
    'strategy.selected':        'เลือกแล้ว',
    'strategy.filter':          'ค้นหาด้วยรหัสหรือชื่อ…',
    'strategy.clearFilter':     'ล้างตัวกรอง',
    'strategy.clear':           'ล้าง',
    'strategy.noMatches':       'ไม่พบกองที่ตรงกับ',
    'strategy.maxEquity':       'หุ้นสูงสุด %',
    'strategy.minHedge':        'Hedge ขั้นต่ำ %',
    'strategy.active':          'กำลังใช้:',
    'strategy.fund':            'กอง',
    'strategy.funds':           'กอง',
    'strategy.empty':           'เลือกอย่างน้อย 1 กองเพื่อปรับแต่งพอร์ต',

    // Analysis Output
    'analysis.customized':         '3. พอร์ตปรับแต่ง',
    'analysis.customizedTag':      '(4 ปีข้างหน้า)',
    'analysis.customizedDesc':     'สร้างจากกลยุทธ์ที่คุณเลือก พอร์ตประกอบด้วยเฉพาะกองที่คุณเลือกไว้ โดยเคารพเพดาน DIY และขีดจำกัด equity / hedge',
    'analysis.snapshotTotal':      'มูลค่ารวม',
    'analysis.snapshotYTD':        'YTD',
    'analysis.snapshotProfit':     'กำไรต่อปี (คาด)',
    'analysis.shortBy':            'ขาด',
    'analysis.overBy':             'เกิน',
    'analysis.allocSum':           'สัดส่วนรวม',
    'analysis.editOrAdd':          'แก้ % ด้านล่าง หรือเพิ่มกองในกลยุทธ์',
    'analysis.trim':               'ลดสัดส่วนของบางแถวให้รวมเป็น 100%',
    'analysis.colFund':            'กอง',
    'analysis.colPct':             '%',
    'analysis.colAvg4yr':          'เฉลี่ย 4 ปี',
    'analysis.colRsi':             'RSI',
    'analysis.colEntry':           'จุดเข้า',
    'analysis.colFib':             'Fib',
    'analysis.colRole':            'บทบาท',
    'analysis.colReason':          'เหตุผล',
    'analysis.totalLabel':         'รวม',
    'analysis.totalsAt100':        'สัดส่วนรวมเป็น 100% แล้ว',
    'analysis.adjustTo100':        'ปรับให้ครบ 100% — ตอนนี้',
    'analysis.expectedPerYear':    'คาดการณ์ต่อปี — อ้างอิงค่าเฉลี่ย 4 ปี',
    'analysis.compliance':         'การปฏิบัติตามข้อกำหนด (แผน DIY)',
    'analysis.pass':               'ผ่าน',
    'analysis.fail':               'ไม่ผ่าน',
    'analysis.compareTitle':       '4. เปรียบเทียบเก่า vs ใหม่',
    'analysis.metric':             'ตัวชี้วัด',
    'analysis.current':            'ปัจจุบัน',
    'analysis.customized2':        'ปรับแต่ง',
    'analysis.expectedReturn':     'ผลตอบแทนคาดการณ์',
    'analysis.fromYTD':            'จาก YTD',
    'analysis.fromHoldings':       'จากพอร์ต',
    'analysis.riskProfile':        'ระดับความเสี่ยง',
    'analysis.inflationHedge':     'ป้องกันเงินเฟ้อ',
    'analysis.themeAlignment':     'สอดคล้องกับธีม',
    'analysis.switchTitle':        '5. เมื่อใดควรเปลี่ยนกอง',
    'analysis.disclaimer':         'ข้อจำกัดความรับผิดชอบ:',
    'analysis.disclaimerText':     'เป็นการวิเคราะห์ตามกฎจากข้อมูล NAV ย้อนหลัง ไม่ใช่คำแนะนำการลงทุนที่รับรอง ผลตอบแทนในอดีตไม่รับประกันอนาคต',

    // Chart text
    'chart.customizedAllocation': 'การจัดสรรพอร์ตปรับแต่ง',
    'chart.allocationCompare':    'เปรียบเทียบการจัดสรร',
    'chart.currentPct':           'ปัจจุบัน %',
    'chart.customizedPct':        'ปรับแต่ง %',
    'chart.month.jan': 'ม.ค.',
    'chart.month.feb': 'ก.พ.',
    'chart.month.mar': 'มี.ค.',
    'chart.month.apr': 'เม.ย.',
    'chart.month.may': 'พ.ค.',
    'chart.month.jun': 'มิ.ย.',
    'chart.month.jul': 'ก.ค.',
    'chart.month.aug': 'ส.ค.',
    'chart.month.sep': 'ก.ย.',
    'chart.month.oct': 'ต.ค.',
    'chart.month.nov': 'พ.ย.',
    'chart.month.dec': 'ธ.ค.',

    // Custom Strategy display name
    'strategy.customName':        'กลยุทธ์ปรับแต่ง',

    // Engine: entry status (RSI-based) — keep "Oversold"/"Overbought" as technical terms
    'entry.low_point':            'แตะจุดต่ำสุด',
    'entry.base':                 'กำลังตั้งฐาน',
    'entry.near_oversold':        'ใกล้ Oversold',
    'entry.strong':               'แข็งแกร่ง',
    'entry.overbought':           'Overbought',
    'entry.na':                   'N/A',

    // Engine: fund role
    'role.hedge':                 'ป้องกันความเสี่ยง',
    'role.conservative':          'อนุรักษ์',
    'role.growth':                'เติบโต',
    'role.balanced':              'สมดุล',

    // Engine: reason fragments — keep RSI, MACD, signal names in English (technical terms)
    'reason.user_pick':           'เลือกเอง (+{n})',
    'reason.theme_match':         'เข้าธีม ({n})',
    'reason.rsi_base':            'RSI {rsi} = ตั้งฐาน',
    'reason.technical':           'สัญญาณ Technical {signal}',
    'reason.inflation_hedge':     'ป้องกันเงินเฟ้อ',
    'reason.diversifier':         'กระจายความเสี่ยง',

    // Engine: switch criteria — keep technical bits (RSI, $70, bp, REITs, TECH) in English
    'switch.profit20.condition':       'กำไร ≥ +20% ในกองใดกอง',
    'switch.profit20.action':          'ขายทำกำไรบางส่วน (30-50%) → ย้ายเข้า bond / ทอง',
    'switch.loss15.condition':         'ขาดทุน ≥ −15% ในกองใดกอง',
    'switch.loss15.action':            'ตัดขาดทุน → ทบทวนแนวคิดใหม่',
    'switch.theme_changed.condition':  'แนวคิดของกลยุทธ์ไม่ใช่แล้ว',
    'switch.theme_changed.action':     'เลือกกลยุทธ์ใหม่ แล้วรันวิเคราะห์อีกครั้ง',
    'switch.rsi75.condition':          'RSI > 75 ในกองที่ถือ',
    'switch.rsi75.action':             'ลดสัดส่วน 25-50% เพื่อล็อกกำไร',
    'switch.oil_resolved.condition':   'สงครามคลี่คลาย / น้ำมัน < $70',
    'switch.oil_resolved.action':      'ลดทอง + พลังงาน → หมุนเข้า global equity',
    'switch.ai_top.condition':         'RSI ของกลุ่ม AI > 80 ทั้งกลุ่ม',
    'switch.ai_top.action':            'ลดสัดส่วนกอง TECH → ปลดล็อกกำไรครึ่งหนึ่ง',
    'switch.rate_cut.condition':       'ธนาคารกลางลดดอกเบี้ย 100bp+',
    'switch.rate_cut.action':          'เปลี่ยน bond → equity แบบค่อยเป็นค่อยไป',
    'switch.dividend_drop.condition':  'Dividend yield ต่ำกว่า 3%',
    'switch.dividend_drop.action':     'หมุนเข้า bond ผลตอบแทนสูง หรือ REITs',
    'switch.global_top.condition':     'RSI ของหุ้น global > 75 ทุกภูมิภาค',
    'switch.global_top.action':        'ลดสัดส่วน winners ล็อกกำไร 30-50%',
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.initial());

  constructor() {
    effect(() => {
      const l = this.lang();
      document.documentElement.setAttribute('lang', l);
      try {
        localStorage.setItem(STORAGE_KEY, l);
      } catch (err) {
        console.debug('Language persistence skipped:', err);
      }
    });
  }

  set(l: Lang) { this.lang.set(l); }
  toggle()    { this.lang.update(l => (l === 'en' ? 'th' : 'en')); }

  /** Translate a key. Falls back to English, then to the raw key if both miss. */
  t(key: string): string {
    return DICT[this.lang()][key] ?? DICT.en[key] ?? key;
  }

  /**
   * Translate a key and substitute {placeholders} with values from `params`.
   * Used for engine reason fragments (e.g. "User pick (+{n})").
   */
  tp(key: string, params: Record<string, string | number>): string {
    const template = this.t(key);
    return template.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = params[k];
      return v == null ? `{${k}}` : String(v);
    });
  }

  /**
   * Display the fund name for a policy code, switching to English in EN mode.
   * Falls back to the Thai source if we don't have a translation for that code.
   */
  fundName(code: string, fallback: string): string {
    if (this.lang() === 'en') return EN_FUND_NAMES[code] ?? fallback;
    return fallback;
  }

  /**
   * Translate a category (group_name). Returns the input unchanged when in TH
   * or when no mapping exists.
   */
  category(thai: string): string {
    if (this.lang() === 'en') return EN_CATEGORIES[thai] ?? thai;
    return thai;
  }

  /**
   * Translate a recommendation phrase like "🟢 ซื้อ" → "🟢 Buy" in EN mode.
   * Keeps the emoji and translates only the verb.
   */
  recommendation(thai: string): string {
    if (this.lang() !== 'en') return thai;
    if (!thai) return thai;
    let out = thai;
    for (const [th, en] of Object.entries(EN_RECOMMENDATION)) {
      out = out.replace(th, en);
    }
    return out;
  }

  /**
   * Translate a broker constraint rule label (R1-R12). Returns the Thai
   * fallback in TH mode or when the rule id is unknown.
   */
  constraintLabel(id: string, fallback: string): string {
    if (this.lang() === 'en') return EN_CONSTRAINTS[id] ?? fallback;
    return fallback;
  }

  private initial(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'th') return saved;
    } catch (err) {
      console.debug('Language persistence read failed; defaulting to EN:', err);
    }
    return 'en'; // EN default per product spec
  }
}
