# Digital Employees — Complete Reference

Sprint 3A completes all 11 AI Workers to production-ready status, with **no
external integration** — WhatsApp, MK Connect, Meta, OTA, Email, and
Telegram remain adapters only (see `docs/CONNECTORS.md`). Every field
below is grounded in real, tested code — nothing here is aspirational.

## How to read this document

Ten fields are **mechanically identical** for all 10 cadence-scheduled
employees (Reasoning Flow, Output Formatter, Knowledge Retrieval
mechanism, Retry Strategy, Error Handling, Audit Log) because they all run
through the same shared pipeline (`runReasoning()`). Rather than repeat
identical prose 10 times, those are described once in "System-Wide
Mechanics" below, and each employee's section links back to it — only the
employee-specific *data* (queries, categories, recipients) is repeated per
employee. The Notification Coordinator is the one exception — it does not
run through `runReasoning()` (see its own section).

## System-Wide Mechanics (identical for all 10 employees)

### Workflow

Every employee's `runDaily()` runs its own deterministic business logic
first (`logic.ts` — unchanged since Sprint 1, still what produces
`AIReport.data`), then hands off to the Reasoning Engine for the "thinking"
layer:

```
Observe → Collect Context → Retrieve Memory → Retrieve Knowledge → Reason
  → Generate Recommendation → Determine Approval Level → Generate Notification
  → Audit → Save Memory
```

See `docs/REASONING_FLOW.md` for the full sequence diagram. Sprint 3A
additions: **Determine Approval Level** (governance-computed, never
self-reported by the model — `determineApprovalLevel()`,
`packages/ai-engine/src/reasoning/reasoning-engine.ts`) and **Generate
Notification** (`buildNotificationObject()`,
`packages/ai-engine/src/reasoning/notification-object.ts`).

### Reasoning Flow

Fixed 10-step pipeline, bounded retry, never throws to the caller. Full
detail: `docs/REASONING_FLOW.md`.

### Output Formatter

Every reasoning call produces a `GovernedReasoningOutput`: the zod-validated
`ReasoningOutput` (priority, summary, recommendation, reason,
confidenceScore, needApproval, escalation, nextAction — see
`docs/REASONING_FLOW.md`'s "Output Engine" section) plus two Sprint 3A
additions:
- `approvalLevel: ApprovalLevel` — the Approval Matrix level (0-4) this
  recommendation was determined to require, computed deterministically.
- `notification: NotificationObject` — see "Notification Template"
  mechanism below.

### Knowledge Retrieval

Deterministic, top-K-only Retrieval Layer — never the whole knowledge
base. Full detail: `docs/KNOWLEDGE_RETRIEVAL.md`.

### Memory

Every employee has its own isolated `ai-reasoning-history` category (its
own past reasoning outputs) plus, for most employees, a second
business-fact memory category from Sprint 1 (listed per employee below).
Full detail: `docs/MEMORY_FLOW.md`.

### Notification Template

`buildNotificationObject(moduleId, output, approvalLevel)`
(`packages/ai-engine/src/reasoning/notification-object.ts`) turns every
successful reasoning call into a structured **Notification Object** — not
a live send:

```ts
interface NotificationObject {
  recipient: string;        // fixed per employee, matches its real notify() target
  priority: "low" | "medium" | "high" | "urgent";
  title: string;             // = ReasoningOutput.summary
  message: string;           // = ReasoningOutput.recommendation
  reason: string;             // = ReasoningOutput.reason
  suggestedAction: string;   // = ReasoningOutput.nextAction
  escalation: string | null;
  channel: "dummy" | "whatsapp" | "telegram" | "email" | "push"; // always "dummy" today — see below
  approvalLevel: 0 | 1 | 2 | 3 | 4;
  sourceModuleId: string;
  createdAt: string;
}
```

**Channel Placeholder**: `channel` is always `"dummy"` in this sprint.
Building a `NotificationObject` never calls `@mkh/notifications`'s
`notify()` or any external API — it's the AI's own structured notification
*recommendation*, separate from (and additive to) the deterministic
`notify()` call each employee's `logic.ts`/`module.ts` already makes for
its Sprint-1-proven business alerts. Wiring a real channel to actually
dispatch `NotificationObject`s is explicitly Sprint 3B+ work.

### Retry Strategy

Two independent, config-driven exponential-backoff retry loops — task-level
(`MAX_RETRY_ATTEMPTS`/`RETRY_BACKOFF_MS`) and reasoning-level
(`AI_RETRY_ATTEMPTS`/`AI_RETRY_BACKOFF_MS`). Non-retryable errors (e.g.
missing API key) skip straight to the audit log. See
`docs/AI_PROVIDER.md`.

### Error Handling

Never throws to the caller at any layer. A failed reasoning call returns
`{ failed: true, reason }`; the employee's own deterministic `AIReport`
is still returned successfully either way — an AI reasoning failure never
takes down the employee's core (Sprint 1) output.

### Audit Log

Every reasoning attempt — success or failure — writes exactly one
`AIReasoningLogEntry` (provider, model, response time, token usage, retry
count, status, error reason). Every SOP step also writes a `WorkLogEntry`.
See `docs/REASONING_FLOW.md`.

### Governance

Every employee has a `GovernanceProfile`
(`packages/security/src/governance.ts`) declaring Permission Level, Auto
Action Level, Requires Approval Level, Forbidden Actions, and
Escalation/Owner/Dir Ops/Branch Manager Approval Rules, classified against
the shared Approval Matrix (Level 0-4). Full detail:
`docs/AI_GOVERNANCE.md`. Every employee's Authority/Approval Rules section
below is pulled directly from that file — not re-invented per employee.

---

## 1. CEO Assistant

**Role**: Asisten Eksekutif — satu-satunya employee yang membaca hasil kerja 9 employee lain.
**Mission**: Memberi Owner satu Executive Summary harian yang akurat — apa yang perlu perhatian, rekomendasi, dan prioritas besok.
**Scope**: Agregasi & pelaporan lintas-employee saja. Tidak pernah mengubah data employee lain atau memutuskan Approval Request atas nama Owner.

**Authority (Governance)**: Permission Level **1** (Suggestion Only) · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: approving Approval Requests on Owner's behalf, modifying another employee's data, triggering a sibling run outside the existing freshness check.

**KPI**:
- Ketepatan waktu pengiriman Executive Summary — 100% terkirim sebelum akhir jadwal harian
- Presisi item "butuh perhatian" — diverifikasi berkala oleh Owner
- Deteksi tema perhatian berulang — tema 3+ hari berturut-turut selalu tercatat

**Daily Tasks**: Mulai bekerja → Membaca laporan harian 9 AI lain → Menyusun Executive Summary → Menyimpan tema perhatian berulang ke memory → Mengirim Executive Summary ke Owner → AI reasoning (Gemini) & rekomendasi.
**Weekly Tasks**: Mengumpulkan Executive Summary seminggu terakhir → Menyusun rollup mingguan.
**Monthly Tasks**: Mengumpulkan Executive Summary sebulan terakhir → Menyusun laporan bulanan untuk Owner.

**Decision Rules**: Prioritaskan item dengan dampak finansial atau risiko operasional terbesar; jika ada konflik prioritas antar-departemen, jelaskan trade-off, jangan memilih sepihak.
**Approval Rules**: Tidak ada — CEO Assistant tidak mengajukan atau memutuskan approval apa pun.
**Escalation Rules**: Escalate ke Owner langsung jika ada item confidence tinggi DAN dampak finansial signifikan (cashflow negatif, SOP violation berulang, sales jauh di bawah target); `escalation: null` jika semua normal.

**Memory**: `attention-theme-history` (Sprint 1 business memory) + `ai-reasoning-history` (own reasoning continuity).
**Knowledge Retrieval**: query = daily summary text; top-K = `AI_RETRIEVAL_TOP_K` (default 8).
**Notification Template**: recipient `owner`, e.g. `{ title: "Executive Summary — 13 Juli 2026", message: "...", priority: "medium", channel: "dummy" }`.
**Unit Tests**: `logic.test.ts`, `module.test.ts` (business logic + orchestration); `reasoning-engine.test.ts`, `governance.test.ts`, `notification-object.test.ts` (shared pipeline, exercised with this employee as the default test fixture).

---

## 2. Marketing Intelligence

**Role**: Kepala Riset Marketing.
**Mission**: Riset pasar harian (konten viral, kompetitor, trend Google/properti/villa/skincare) dan membangun knowledge base yang terus bertambah.
**Scope**: Riset dan knowledge base saja. Tidak pernah membuat desain atau memposting konten.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: publishing/scheduling content, writing to another employee's knowledge base.

**KPI**:
- Sinyal baru ditemukan per hari — > 0 setiap hari kerja
- Rasio fakta ditemukan ulang — menunjukkan tren konsisten, bukan noise
- Adopsi rekomendasi oleh Content Planner — `topOpportunities` dipakai di content plan

**Daily Tasks**: Mulai bekerja → Analisa trend Google/Properti/Villa/Skincare → Riset konten viral Instagram & TikTok → Analisa kompetitor → Membuat insight & rekomendasi → Menyimpan hasil ke knowledge base → Mengirim Market Intelligence Report ke Markom → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menyusun Weekly Strategy.
**Monthly Tasks**: Meninjau seluruh knowledge base → Menyusun retrospective & rekomendasi.

**Decision Rules**: Prioritaskan sinyal "rising" dengan engagement tinggi di atas "steady"/"declining"; sinyal baru lebih disorot daripada yang berulang tanpa perubahan.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Escalate hanya jika ada aktivitas kompetitor signifikan (kampanye besar, perubahan harga agresif) yang butuh respons cepat Owner/Markom.

**Memory**: business-fact knowledge base (multiple categories — viral content, competitor, trend per kategori) + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `markom`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 3. Content Planner

**Role**: Perencana Konten.
**Mission**: Mengubah hasil riset Marketing Intelligence menjadi content plan & checklist konkret untuk Markom, dan mengingatkan yang tertunda.
**Scope**: Perencanaan & reminder saja. Tidak pernah memposting konten atau menandai tugas selesai atas nama Markom.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: publishing content, marking checklist items complete on Markom's behalf.

**KPI**:
- Tingkat penyelesaian checklist mingguan — > 80% tepat waktu
- Latensi reminder-ke-penyelesaian — selesai dalam 1 hari kerja
- Kesegaran tema — tidak mengulang tema < 30 hari terakhir

**Daily Tasks**: Mulai bekerja → Membaca laporan Marketing Intelligence terbaru → Mengecek tema konten yang sudah dipakai → Menyusun content plan & checklist harian Markom → Menyimpan tema konten ke memory → Mengirim reminder untuk konten belum selesai → Mengirim laporan content plan harian → AI reasoning.
**Weekly Tasks**: Menyusun checklist baru untuk minggu ini dari ide konten terbaru.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap tingkat penyelesaian Markom.

**Decision Rules**: Prioritaskan konten dengan tema paling segar dan deadline paling dekat; konten overdue disebut eksplisit sebagai risiko.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Escalate ke Marketing Lead jika konten overdue > separuh checklist minggu ini.

**Memory**: `content-theme-used` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `markom`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 4. Meta Ads Specialist

**Role**: Spesialis Meta Ads.
**Mission**: Menganalisa performa campaign (CPL/CTR/CPC), menyusun rekomendasi & proposal campaign baru dari peluang Marketing Intelligence, mengajukan setiap aksi sebagai Approval Request untuk Owner.
**Scope**: Analisa & proposal saja — **zero eksekusi**. Satu-satunya employee yang authority-nya mencapai Level 4.

**Authority (Governance)**: Permission Level **4** · Auto Action Level 1 (analysis/drafting is automatic) · **Requires Approval Level 4 (Owner)**. Forbidden: publishing/modifying a live campaign, auto-approving its own proposal, bypassing `createApprovalRequest()`. This is real, enforced code — `@mkh/security`'s `canApprove()` restricts `decideOnApproval()` to the `owner` role, not just a governance label.

**KPI**:
- Waktu keputusan Owner atas Approval Request — diputuskan dalam 24 jam kerja
- Tingkat persetujuan proposal — > 70%
- Tren CPL/CTR/CPC setelah aksi disetujui — membaik

**Daily Tasks**: Mulai bekerja → Membaca performa campaign → Menghitung CPL/CTR/CPC & membandingkan campaign → Membaca peluang dari Marketing Intelligence → Menyusun proposal campaign baru jika ada peluang → Membuat Approval Request (status WAITING OWNER APPROVAL) → Mengirim notifikasi jika ada campaign perlu perhatian → Mengirim laporan analisa harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Membandingkan performa antar hari.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap approval & performa ads.

**Decision Rules**: Campaign dengan CPL jauh di atas rata-rata dan tren memburuk diprioritaskan untuk pause/turun budget; CPL rendah + lead tinggi diprioritaskan scaling.
**Approval Rules**: `needApproval` harus selalu `true` untuk setiap aksi yang mengubah budget atau membuat campaign baru — enforced by prompt AND by the fact no execute path exists.
**Escalation Rules**: Escalate ke Owner jika campaign menghabiskan budget signifikan dengan CPL terus memburuk 3+ hari berturut-turut.

**Memory**: `campaign-proposal` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `owner`, `approvalLevel: 4`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`, `workflow.test.ts` (Approval Request lifecycle).

---

## 5. Sales Supervisor

**Role**: Pengawas Penjualan.
**Mission**: Memantau target/progress/follow-up setiap rep, menyusun strategi pemulihan untuk yang tertinggal dan scaling untuk yang hampir mencapai target.
**Scope**: Pemantauan & strategi saja. Tidak pernah menetapkan atau mengubah target sales.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: writing sales data (no such Repository method exists), assigning/reassigning a rep's target or territory.

**KPI**:
- Progress keseluruhan sales — tren naik minggu ke minggu
- Jumlah sales tertinggal kronis — tren turun
- Korelasi strategi-ke-perbaikan — rep dengan strategi recovery membaik dalam 2 minggu

**Daily Tasks**: Mulai bekerja → Membaca data sales → Menghitung target vs progress → Menyusun strategi pemulihan/scaling per rep → Menyimpan riwayat follow-up ke memory → Mengirim notifikasi ke Dir Ops jika perlu → Mengirim laporan harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menilai tren progress & sales kronis tertinggal.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap target bulanan.

**Decision Rules**: Rep dengan progress terendah DAN aktivitas paling lama tidak update mendapat prioritas follow-up tertinggi; rep hampir capai target diprioritaskan scaling.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Escalate ke Dir Ops jika rep lagging 3+ hari berturut-turut tanpa perbaikan.

**Memory**: `rep-follow-up-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `dir_ops`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 6. Branch Performance Manager

**Role**: Manajer Performa Cabang.
**Mission**: Mengklasifikasikan status setiap cabang dari data sales secara otomatis (data-driven, tanpa hardcode nama cabang) dan memberi rekomendasi ke Kepala Cabang.
**Scope**: Analisa & rekomendasi per cabang saja. Tidak pernah mengubah target, staffing, atau budget cabang.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable today (see below). Forbidden: directly changing a branch's target/staffing/budget.

**KPI**:
- Jumlah cabang butuh perhatian — tren turun bulan ke bulan
- Cakupan analisa — 100% cabang aktif setiap run harian
- Korelasi rekomendasi-ke-perbaikan cabang

**Daily Tasks**: Mulai bekerja → Membaca target/progress/aktivitas per cabang → Mengelompokkan data per cabang → Mengklasifikasikan status setiap cabang → Menyusun rekomendasi untuk Kepala Cabang → Menyimpan riwayat rekomendasi ke memory → Mengirim notifikasi untuk cabang butuh perhatian → Mengirim laporan harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menilai tren performa tiap cabang.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap performa cabang bulanan.

**Decision Rules**: Cabang "critical" butuh rekomendasi paling tegas (coaching intensif, evaluasi alokasi leads); "needs_attention" butuh pemantauan lebih ketat.
**Approval Rules**: None enforced today — `docs/AI_GOVERNANCE.md` documents this as the forward-looking Level 2 (Branch Manager) candidate once a real branch-level execute path exists.
**Escalation Rules**: Escalate ke Dir Ops jika ada cabang "critical" dua periode berturut-turut tanpa perbaikan.

**Memory**: `branch-recommendation-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `dir_ops`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 7. Finance Analyst

**Role**: Analis Keuangan.
**Mission**: Menganalisa cashflow, memproyeksikan 7 hari ke depan, mendeteksi transaksi tidak biasa untuk dilaporkan ke Owner.
**Scope**: **READ ONLY MUTLAK.** Tidak pernah menyarankan atau menyiratkan perubahan transaksi apa pun — dijamin secara struktural (Repository tidak punya method tulis untuk data transaksi) DAN secara prompt (RESTRICTION field).

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: suggesting any transaction change; any write to transactions/ledger.

**KPI**:
- Presisi deteksi anomali — transaksi ter-flag terverifikasi sebagai isu nyata
- Akurasi proyeksi cashflow 7 hari — selisih < 15%
- Percobaan tulis tidak sah — selalu 0 (dijamin arsitektur)

**Daily Tasks**: Mulai bekerja → Membaca transaksi → Membuat prediksi cashflow → Mendeteksi pengeluaran tidak biasa → Menyimpan riwayat anomali ke memory → Mengirim laporan untuk Owner → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menyusun ringkasan finansial mingguan.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun laporan finansial bulanan.

**Decision Rules**: Anomali dengan nilai nominal besar relatif kategori normalnya prioritas tertinggi; proyeksi cashflow negatif 7 hari = sinyal urgensi tinggi.
**Approval Rules**: Tidak ada — Finance Analyst tidak pernah mengajukan aksi apa pun.
**Escalation Rules**: Escalate ke Owner segera jika proyeksi cashflow 7 hari negatif, atau anomali di atas ambang wajar.

**Memory**: `anomaly-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `owner`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 8. HR Officer

**Role**: Petugas HR.
**Mission**: Memantau absensi, keterlambatan, cuti, dan KPI seluruh staff; memberi peringatan dan rekomendasi coaching.
**Scope**: Pemantauan saja. Tidak pernah mengambil tindakan disipliner atau mengubah data absensi/cuti/KPI.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: writing attendance/leave/KPI data; disciplinary action beyond coaching.

**KPI**:
- Jumlah staff yang di-flag — tren turun bulan ke bulan
- Rata-rata skor KPI staff — tren naik/stabil
- Tindak lanjut rekomendasi coaching — dilacak di luar sistem ini

**Daily Tasks**: Mulai bekerja → Membaca absensi/keterlambatan/cuti/KPI → Menandai staff dengan isu → Menyusun rekomendasi coaching → Menyimpan riwayat flag ke memory → Mengirim peringatan ke HR/Owner jika perlu → Mengirim laporan harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menilai staff dengan isu kronis.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap HR bulanan.

**Decision Rules**: Staff dengan multiple isu bersamaan mendapat prioritas coaching lebih tinggi daripada satu isu ringan.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Escalate ke HR Manager/Owner jika staff flagged berulang kali (kronis) tanpa perbaikan.

**Memory**: `staff-flag-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `hr`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 9. OTA Manager

**Role**: Manajer OTA & Dynamic Pricing.
**Mission**: Menganalisa occupancy, ADR, harga kompetitor, dan booking pace setiap properti; menyusun rekomendasi dynamic pricing.
**Scope**: Rekomendasi saja — connector OTA masih mock, zero eksekusi harga hari ini.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable today. Forbidden: applying a price change to any OTA channel (no execute path exists).

**KPI**:
- Jumlah properti butuh penyesuaian harga — dipantau tren
- Cakupan rekomendasi — 100% properti aktif setiap run harian
- Tren occupancy pasca-rekomendasi — diukur setelah eksekusi harga dibangun (fase mendatang)

**Daily Tasks**: Mulai bekerja → Membaca occupancy/ADR/competitor price/booking pace per properti → Menyusun rekomendasi dynamic pricing → Menyimpan riwayat rekomendasi harga ke memory → Mengirim notifikasi untuk properti butuh penyesuaian → Mengirim laporan harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menilai tren okupansi per properti.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap OTA bulanan.

**Decision Rules**: Properti occupancy tinggi + booking pace cepat layak naik harga; occupancy rendah + booking pace lambat layak turun harga mendekati kompetitor.
**Approval Rules**: None enforced today — `docs/AI_GOVERNANCE.md` documents the forward-looking Level 3 (Director Operations) candidate once a real pricing execute path exists, given its direct revenue impact.
**Escalation Rules**: Escalate ke Dir Ops jika properti occupancy sangat rendah beberapa hari berturut-turut.

**Memory**: `pricing-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `dir_ops`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 10. SOP Guardian

**Role**: Penjaga SOP Perusahaan.
**Mission**: Mengawasi seluruh AI Worker lain — membaca laporan & work log untuk mendeteksi missed run, run gagal, retry berlebih, jejak SOP tidak lengkap.
**Scope**: Audit read-only. Tidak pernah mengubah data AI Worker lain; otomatis mencakup setiap AI Worker baru (`AI_MODULE_IDS`-driven) tanpa perlu diubah kodenya.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: modifying another employee's data, suppressing a detected violation.

**KPI**:
- Jumlah pelanggaran terdeteksi — tren turun = sistem makin sehat
- Latensi deteksi — pelanggaran terdeteksi di hari yang sama
- Tingkat false positive — diminimalkan lewat review berkala

**Daily Tasks**: Mulai bekerja → Membaca laporan & work log seluruh AI lain → Memeriksa missed run/run gagal/retry berlebih/struktur SOP → Menyimpan riwayat pelanggaran ke memory → Mengirim peringatan untuk setiap pelanggaran → Mengirim laporan kepatuhan SOP harian → AI reasoning.
**Weekly Tasks**: Mengumpulkan laporan harian seminggu terakhir → Menilai AI yang kronis melanggar SOP.
**Monthly Tasks**: Mengumpulkan laporan harian sebulan terakhir → Menyusun rekap kepatuhan SOP bulanan.

**Decision Rules**: Missed run pada employee dengan dependency langsung lebih urgent; pelanggaran berulang (kronis) lebih urgent daripada kejadian sekali.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Escalate ke Dir Ops/Owner jika ada employee gagal berulang kali (kronis) atau > separuh roster gagal dalam satu hari.

**Memory**: `violation-history` + `ai-reasoning-history`.
**Knowledge Retrieval**: query = daily observation text; top-K = 8.
**Notification Template**: recipient `dir_ops`.
**Unit Tests**: `logic.test.ts`, `module.test.ts`.

---

## 11. Notification Coordinator

**Role**: Koordinator Notifikasi — bukan cadence-scheduled `AIEmployee` (deliberately excluded from `AI_MODULE_IDS`, see `docs/ARCHITECTURE.md`); an always-on dispatch service every employee routes through.
**Mission**: Memastikan setiap notifikasi yang dikirim sistem jelas, terprioritaskan dengan benar, dan sampai ke penerima yang tepat — dengan opsi menghaluskan bahasa lewat Gemini tanpa pernah mengubah fakta atau severity.
**Scope**: Dispatch & penghalusan bahasa saja. Tidak pernah menentukan severity atau target sendiri — itu keputusan Digital Employee pengirim.

**Authority (Governance)**: Permission Level **1** · Auto Action Level 1 · Requires Approval — not applicable. Forbidden: inventing facts/numbers/names not in the original message; changing severity/target; blocking a notification because Gemini is unavailable.

**KPI**:
- Tingkat keberhasilan pengiriman — 100% notifikasi tersimpan meski channel belum aktif
- Tingkat keberhasilan penghalusan wording — dipantau vs. tingkat fallback
- Perubahan fakta/severity tidak sah — selalu 0

**Daily/Weekly/Monthly Tasks**: Not applicable — it has no cadence, no `EmployeeSOP`. It runs synchronously, once per `notify()` call from any employee (potentially many times per day).

**Decision Rules**: Jika pesan asli sudah jelas dan ringkas, jangan diubah; hanya perhalus jika bahasa terlalu teknis untuk pembaca non-teknis.
**Approval Rules**: Tidak ada.
**Escalation Rules**: Tidak berlaku — tidak membuat keputusan eskalasi sendiri, hanya meneruskan severity yang sudah ditentukan pengirim.

**Memory**: None by design — "setiap pesan dinilai berdiri sendiri agar tidak ada bias dari histori pesan lain" (its own prompt's `memoryRule`).
**Knowledge Retrieval**: Not used — "konteksnya sudah lengkap dari pesan asli itu sendiri" (`knowledgeRule`).
**Reasoning Flow**: Does NOT run through `runReasoning()` (no `moduleId`/`runId`/work log of its own to correlate against). Instead: `refineNotificationWording()`
(`packages/notifications/src/ai-refinement.ts`) calls `@mkh/ai-provider` directly with its own compact system prompt — kept local to `@mkh/notifications` rather than imported from `@mkh/ai-engine`'s Prompt Engine specifically to avoid a circular package dependency (`ai-engine` already depends on `notifications`). See `docs/AI_PROVIDER.md`.
**Output Formatter**: A minimal `{ title, body }` JSON contract, validated inline (not the full `ReasoningOutput` schema — this worker doesn't produce a priority/recommendation/escalation, just wording).
**Notification Template**: N/A as a producer — it's the dispatcher every other employee's `NotificationObject`/`notify()` call eventually reaches.
**Retry Strategy**: None — a single attempt; any failure falls back to original wording rather than retrying (retrying a wording-polish call isn't worth the latency/cost for a non-critical enhancement).
**Error Handling**: Never throws, never blocks delivery — `notify()` always persists and dispatches even if refinement fails outright.
**Audit Log**: Logged via the standard structured logger (`notifications:ai-refinement` scope), not a persisted `AIReasoningLogEntry` (which is `AIModuleId`-scoped and this isn't a cadence-scheduled `AIModuleId`).
**Configuration**: `NOTIFY_AI_REFINEMENT_ENABLED` (default `true`) — operator escape hatch to disable entirely if API quota is tight. See `docs/AI_PROVIDER.md`.
**Unit Tests**: `ai-refinement.test.ts` (8 tests — success, code-fence stripping, provider failure, malformed/missing/empty JSON, prompt content, no-key fallback), `notification-service.test.ts` (2 tests covering the enable/disable flag).

---

## Cross-cutting verification

Every claim in this document is backed by a passing automated test. Run:

```
pnpm typecheck && pnpm test:coverage && pnpm build
```

See `docs/audits/SPRINT3A_AUDIT.md` for the full CTO review and score.
