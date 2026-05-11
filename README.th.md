# MFC PVD DIY Tools

**ภาษา:** [English](README.md) · **ไทย**

> **วางแผน MFC PVD ของคุณ — แบบ DIY**
> เลือกกองทุนที่คุณเชื่อมั่น ปรับสัดส่วนเอง แล้วดูแผน DIY ของคุณทำงานจริง — พร้อมเพดานของโบรกเกอร์ในตัว

แอป Single-Page แบบโต้ตอบรองรับ 2 ภาษา (EN / TH) สำหรับสมาชิกกองทุนสำรองเลี้ยงชีพ (PVD) บนแพลตฟอร์ม MFC ใช้เปรียบเทียบทุกกองทุน สร้างพอร์ตของตัวเอง ปรับสัดส่วนได้ทันที และดูประมาณการ 4 ปีข้างหน้า — ทุกอย่างทำในเบราว์เซอร์ ไม่มี backend ไม่ต้องใช้ Excel

> **ข้อจำกัดความรับผิด** ผลลัพธ์ทั้งหมดมาจากการวิเคราะห์เชิงกฎ (rule-based) บนข้อมูล NAV ย้อนหลัง **ไม่ใช่คำแนะนำการลงทุนที่ได้รับการรับรอง** ผลตอบแทนในอดีตไม่ได้รับประกันผลในอนาคต โปรเจกต์นี้เป็นโปรเจกต์ส่วนตัวที่ไม่เกี่ยวข้องและไม่ได้รับการสนับสนุนจาก MFC Asset Management

---

## สิ่งที่คุณจะได้

**ข้อมูลอ้างอิง** (แสดงตลอด ไม่ต้องกรอกข้อมูล):
- **Policy Performance** — กราฟเส้นย้อนหลังหลายปีของทั้ง 32 กองทุน MPF เลือกเปิด/ปิดได้ทุกชุด
- **Technical Analysis Ranking** — คะแนนรวมจาก MA-6/12, MACD, RSI-14 และ Fibonacci Retracement บนข้อมูลรายเดือน
- **Broker Constraints (DIY Plan)** — กติกาการจัดสรร 12 ข้อที่ engine บังคับใช้อัตโนมัติ
- **Policy Rankings & Recommendations** — เรียงตามผลตอบแทนเฉลี่ย 4 ปี พร้อมสัญญาณ Buy / Hold / Sell ของแต่ละกองทุน

**การวิเคราะห์เฉพาะคุณ** (หลังกรอก 2 ส่วน):
- **1. พอร์ตปัจจุบันของคุณ** — มูลค่ารวม + ผลตอบแทน YTD + ตารางสัดส่วนปัจจุบัน
- **2. กลยุทธ์** — เลือกกองทุนที่ต้องการ engine จะสร้างพอร์ตจากกองที่คุณเลือกเท่านั้น
- **3. พอร์ตที่ปรับแต่ง (Customized Portfolio)** — แถบสรุป (มูลค่ารวม / YTD / กำไรประจำปีโดยประมาณ) ปรับ % ของแต่ละกองทุนได้ทันที พร้อมตรวจกติกาโบรกเกอร์และคำนวณผลตอบแทนคาดการณ์แบบเรียลไทม์
- **4. เปรียบเทียบของเดิมกับของใหม่** — พอร์ตปัจจุบัน vs พอร์ตที่ปรับแต่ง โดยจะใช้ % YTD ที่กรอกมาคำนวณผลตอบแทนถ้ามี
- **5. เมื่อไหร่ควรสลับกองทุน** — เงื่อนไขการสลับที่อิงกับกลยุทธ์ของคุณ

---

## วิธีรันบนเครื่อง

```bash
npm install
npm start          # เปิดที่ http://localhost:4400
```

Build สำหรับ production:

```bash
npm run build      # ผลลัพธ์อยู่ใน dist/
```

---

## จุดเด่น

- **UI ที่ขัดเกลามาอย่างดี** — ใช้ system font, สี token ที่ผ่านการปรับ, เส้นคั่นบาง, ปุ่ม pill รองรับทั้งธีมสว่างและมืด เปลี่ยนได้จากปุ่มบน header
- **สองภาษา** — มีปุ่มสลับ EN / TH บน header (ค่าเริ่มต้นเป็น EN) ข้อความในแอป ผลลัพธ์จาก engine ชื่อกองทุน และกติกาโบรกเกอร์ถูกแปลทั้งหมด ส่วนศัพท์เทคนิค (RSI, MACD, Strong Buy ฯลฯ) คงเป็นภาษาอังกฤษทั้งสองโหมด
- **ฟอร์มที่ apply อัตโนมัติ** — ไม่มีปุ่ม Set / Submit ทุกการเปลี่ยนแปลงจะ debounce แล้วรันวิเคราะห์ใหม่เอง
- **จัดสรรเฉพาะกองที่เลือก (Strict bias-only)** — เมื่อคุณเลือกกองทุน พอร์ตที่ปรับแต่งจะใช้ *เฉพาะ* กองนั้นภายใต้เพดานของโบรกเกอร์ DIY ถ้าเพดานทำให้รวมไม่ถึง 100% ระบบจะแสดงช่องว่างให้เห็นชัดเจน ไม่แอบเติมด้วยกองที่คุณไม่ได้เลือก
- **ปรับ % ได้** — ตารางพอร์ตที่ปรับแต่งกดแก้ % รายแถวได้ตรง ๆ การตรวจกติกา ผลตอบแทนคาดการณ์ และกราฟจะอัปเดตทันที
- **กราฟเรียลไทม์** — Chart.js แบบ doughnut + bar + line เลื่อนเมาส์ลงบนเส้นเพื่อดูค่าของแต่ละกองทุน ณ จุดเวลานั้น สลับธีมหรือสลับภาษา กราฟจะ redraw ทำให้สีและ label ตรงกันเสมอ

---

## วิธีคำนวณการจัดสรร (ไม่ใช้ LLM)

```
score(fund) = themeMatch × 3
            + rsiBonus × 2          (RSI 30-45 → +3, 45-55 → +1.5, >70 → -2)
            + techBonus × 0.5

themeMatch = Σ tag_weights[tag] + fund_weights[code]   // กองที่ผู้ใช้เลือกจะได้ +3 ต่อกอง

allocate:
  ถ้าผู้ใช้เลือกกองทุน → โหมด STRICT BIAS-ONLY
    แบ่งเท่ากันระหว่างกองที่เลือก แล้วเกลี่ยส่วนที่เหลือภายในกลุ่มนั้น
    เคารพเพดานของโบรกเกอร์ DIY (R1-R12) + เพดานสัดส่วนหุ้นของธีม
  ถ้าไม่ได้เลือก → โหมด DEFAULT
    กันสัดส่วน hedge ขั้นต่ำ จัดให้กองที่ได้คะแนนสูงสุด แล้วเติมส่วนที่เหลือด้วย bond / hedge
```

ลอจิกทั้งหมดอยู่ใน `src/app/services/analysis-engine.service.ts` ดู `recomputeForAllocations()` ซึ่งเป็น entry point ที่ฟีเจอร์ปรับ % เรียกใช้

---

## สถาปัตยกรรม

```
src/app/
├── app.component.{ts,html,scss}      ← shell, header, footer, ปุ่มสลับภาษา + ธีม
├── components/
│   ├── static-overview.component.ts  ← กราฟ + ตารางอ้างอิง 3 ตาราง (แสดงตลอด)
│   ├── portfolio-input.component.ts  ← Section 1 (auto-applies)
│   ├── theme-selector.component.ts   ← Section 2 (Strategy, fund picker แบบ custom-only)
│   └── analysis-output.component.ts  ← Sections 3-5 (Customized Portfolio + Compare + Switch)
├── services/
│   ├── analysis-engine.service.ts    ← engine แนะนำพอร์ตแบบ deterministic
│   ├── theme.service.ts              ← signal ของธีม light/dark + บันทึกใน localStorage
│   └── i18n.service.ts               ← dictionary EN/TH + ฟังก์ชันแปล
├── models/types.ts                   ← interfaces ที่ใช้ร่วมกัน
└── utils/chart.util.ts               ← ลงทะเบียน Chart.js + helper cssVar
```

จัดการ state ด้วย Angular signals (ไม่มี NgRx, ไม่ใช้ RxJS หนัก) โหลด HTTP ครั้งเดียวด้วย `forkJoin` ตอนเปิดแอป ทุก component ใช้ `OnDestroy` ของตัวเองเพื่อทำความสะอาด Chart instance และ timer

---

## แหล่งข้อมูล

ไฟล์ asset ทั้งหมดอยู่ใน `src/assets/` และโหลดครั้งเดียวตอนเปิดแอป:

| ไฟล์ | หน้าที่ |
|---|---|
| `info.json` | Metadata ของกองทุน (policy code, fund name, group, ระดับความเสี่ยง) |
| `fund_tags.json` | Theme tag ของแต่ละ policy + tag legend |
| `combined_data.json` | การเปลี่ยนแปลง NAV รายเดือนของแต่ละ policy ปี 2019-2026 |
| `technical.json` | MA-6/12, MACD, RSI-14, Fibonacci ของแต่ละกอง + คะแนนรวม (คำนวณไว้แล้ว) |
| `constraints.json` | กติกาการจัดสรรของโบรกเกอร์ DIY (R1-R12) |
| `ranking.json` | Policy rankings + `avg_return` 4 ปี (ใช้ทั้งใน rankings table และ `avg_4yr` ของ engine) |

วิธีอัปเดตข้อมูล: เปลี่ยน JSON เหล่านี้ ส่วน "Data through" ที่ footer อ่านจาก `technical.json#generated_date`

---

## ปรับแต่ง

| ต้องการ… | แก้ที่ไหน |
|---|---|
| เพิ่มกองทุนใหม่ | `info.json` + `fund_tags.json` + ใส่ NAV รายเดือนใน `combined_data.json` |
| เปลี่ยน tag ของกองทุน | `fund_tags.json` — ดู `tag_legend` สำหรับ tag ที่ใช้ได้ |
| เปลี่ยนกติกาโบรกเกอร์ | `constraints.json` — label `R1`–`R12` แปลใน `i18n.service.ts` |
| เพิ่มชื่อกองเป็นภาษาอังกฤษ | `EN_FUND_NAMES` ใน `i18n.service.ts` (key เป็นรหัส MPF) |
| ปรับ scoring | `scoreFund()` / `buildRecommended()` ใน `analysis-engine.service.ts` |
| เพิ่ม preset กลยุทธ์ (อนาคต) | ไฟล์ `themes.json` ยังอยู่ ถอดการเชื่อมออกแล้วแต่รักษา format ไว้ |

---

## ความปลอดภัย

- ตั้ง Content Security Policy ใน `index.html` ระบุ allowlist ของ Google Fonts และ twemoji CDN อย่างชัดเจน
- ไม่มี `[innerHTML]`, ไม่มี `eval`, ไม่มี `bypassSecurityTrust*` ในโค้ดเลย
- ใช้ `localStorage` เก็บแค่ค่า `mfc-theme` และ `mfc-lang` — ไม่เก็บ PII ไม่เก็บข้อมูลพอร์ต
- input ของผู้ใช้ทั้งหมดผ่านการ interpolate ของ Angular ตัวเลขถูก clamp ที่ขอบของ engine

---

## Tech stack

- Angular 18 (standalone components, signals, signal-based effects)
- TypeScript 5.4
- Chart.js 4.4 (doughnut + bar + line)
- SCSS พร้อม design tokens (CSS custom properties สำหรับธีม light + dark)
- ไม่มี state library ภายนอก — Angular signals พอแล้ว
- ไม่มี backend — JSON ทุกไฟล์ bundle ตอน build

---

## License

เผยแพร่ภายใต้ [MIT License](LICENSE) — ใช้ ดัดแปลง และ host ได้ฟรี

repo นี้คือ **open-source core** เวอร์ชัน **Pro** จะมาแยก เช่นฟีเจอร์ *Recommended Portfolio* ที่ engine จัดให้ (multi-signal scoring) จะอยู่ใน private repository ส่วนการแก้บั๊กและการ contribute ใน core ยินดีรับ
