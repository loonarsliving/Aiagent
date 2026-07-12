# Standard Operating Procedures (SOP)

Every AI employee's SOP is declared in code (`sop: EmployeeSOP` in each
module's `module.ts`) and enforced in practice by `WorkLogger` — each step
below corresponds to a `log.step(...)` call inside the employee's task
method, which writes a persisted `WorkLogEntry` you can query via the MCP
server's `list_work_log` tool. `offsetMinutes` is minutes after the
cadence's scheduled start time; it's documentation today (the scheduler
runs the whole task at the scheduled time, not step-by-step), not an
enforced sub-schedule.

Every step in a `runDaily`/`runWeekly`/`runMonthly` call runs inside
`runEmployeeTask`'s retry loop (`packages/ai-engine/src/core/agent-runner.ts`):
up to `MAX_RETRY_ATTEMPTS` tries (default 3, `packages/shared/src/config.ts`),
exponential backoff between attempts. No employee "just fails" on a
transient error — a `status: "error"` report is only ever returned after
every retry is exhausted, and each retry attempt is itself a `status:
"retry"` entry in the work log.

Default schedule times (Asia/Makassar): see
`packages/database/src/seed-data.ts` `DEFAULT_SCHEDULE` — weekly runs
Monday, monthly runs the 1st. Any employee can also be run on demand via
the manual-trigger service (`pnpm employee:trigger -- --module=<id>
--cadence=<daily|weekly|monthly>`, or `triggerEmployee()` from
`@mkh/scheduler` directly — see `docs/ARCHITECTURE.md`).

---

## 1. Marketing Intelligence AI — Kepala Riset Marketing

**Daily** (06:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Analisa trend Google/Properti/Villa/Skincare |
| 15 | Riset konten viral Instagram & TikTok |
| 30 | Analisa kompetitor |
| 60 | Membuat insight & rekomendasi |
| 75 | Menyimpan hasil ke knowledge base |
| 90 | Mengirim Market Intelligence Report ke Markom (via Notification Coordinator) |

**Weekly** (Senin, 06:30): mengumpulkan laporan harian seminggu terakhir → menyusun Weekly Strategy.

**Monthly** (tgl 1, 06:00): meninjau seluruh knowledge base → menyusun retrospective & rekomendasi.

**Memory**: own knowledge base (`@mkh/memory`), category-agnostic — viral
content, competitor activity, trend signals, deduplicated with `timesSeen`.

Outputs: Market Intelligence Report (daily), Weekly Strategy, Daily
Recommendation, Content Checklist (raw content ideas — not the assigned,
tracked checklist; that's Content Planner's job).

## 2. Content Planner AI — Perencana Konten

**Daily** (07:30)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca laporan Marketing Intelligence terbaru |
| 10 | Mengecek tema konten yang sudah pernah dipakai (memory) |
| 15 | Menyusun content plan & checklist harian Markom (judul, jenis konten, hook, CTA, caption, deadline, status) |
| 20 | Menyimpan tema konten ke memory |
| 25 | Mengirim reminder untuk konten belum selesai (via Notification Coordinator) |
| 30 | Mengirim laporan content plan harian |

**Weekly** (Senin, 07:45): menyusun checklist baru dari ide konten terbaru.

**Monthly** (tgl 1, 07:30): mengumpulkan laporan harian sebulan terakhir → rekap tingkat penyelesaian Markom.

**Memory**: own knowledge base, category `content-theme-used` — avoids
repeating the same theme while ideas are fresh.

## 3. Meta Ads Specialist AI — Spesialis Meta Ads

**Daily** (08:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca performa campaign |
| 15 | Menghitung CPL/CTR/CPC & membandingkan campaign |
| 20 | Membaca peluang dari Marketing Intelligence |
| 22 | Menyusun proposal campaign baru jika ada peluang (objective, audience, budget, creative recommendation, waktu publish) |
| 25 | Membuat Approval Request — status **WAITING OWNER APPROVAL** |
| 30 | Mengirim notifikasi jika ada campaign perlu perhatian |
| 35 | Mengirim laporan analisa harian |

**Weekly** (Senin, 09:00): membandingkan performa antar hari, mengidentifikasi campaign dengan masalah berulang.

**Monthly** (tgl 1, 08:00): rekap approval & performa ads sebulan.

**Memory**: own knowledge base, category `campaign-proposal` — avoids
proposing the same new campaign twice.

Scope boundary: analysis + recommendation + Approval Request only. Every
proposal (budget adjustment or brand-new campaign) is created with status
`pending` — i.e. **WAITING OWNER APPROVAL** — and never auto-published. No
publish/execute step exists in this phase (see `docs/ROADMAP.md`).

## 4. Sales Supervisor AI — Pengawas Penjualan

**Daily** (12:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca data sales |
| 10 | Menghitung target vs progress |
| 15 | Menyusun strategi pemulihan (rep jauh dari target) / scaling (rep hampir mencapai target) |
| 18 | Menyimpan riwayat follow-up ke memory |
| 20 | Mengirim notifikasi ke Dir Ops jika ada yang perlu perhatian |
| 25 | Mengirim laporan harian |

**Weekly** (Senin, 12:30): menilai tren progress & sales yang kronis tertinggal.

**Monthly** (tgl 1, 12:00): rekap target bulanan.

**Memory**: own knowledge base, category `rep-follow-up-history`.

Read-only — never writes sales data.

## 5. Branch Performance Manager AI — Manajer Performa Cabang

**Daily** (12:15)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca target, progress, dan aktivitas per cabang |
| 8 | Mengelompokkan data per cabang (murni data-driven — tidak ada cabang yang di-hardcode) |
| 12 | Mengklasifikasikan status setiap cabang (healthy / needs_attention / critical) |
| 16 | Menyusun rekomendasi untuk Kepala Cabang masing-masing |
| 18 | Menyimpan riwayat rekomendasi ke memory |
| 20 | Mengirim notifikasi untuk cabang yang butuh perhatian |
| 25 | Mengirim laporan harian |

**Weekly** (Senin, 12:45): menilai tren performa tiap cabang.

**Monthly** (tgl 1, 12:30): rekap performa cabang bulanan.

**Memory**: own knowledge base, category `branch-recommendation-history`.

"Setiap cabang mempunyai AI sendiri" is satisfied by being fully
data-driven — a new branch appearing in the sales data automatically gets
its own section in the next report, no code change needed. Read-only.

## 6. Finance Analyst AI — Analis Keuangan

**Daily** (15:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca transaksi |
| 10 | Membuat prediksi cashflow |
| 15 | Mendeteksi pengeluaran tidak biasa |
| 17 | Menyimpan riwayat anomali ke memory |
| 20 | Mengirim laporan untuk Owner (via Notification Coordinator) |

**Weekly** (Senin, 15:30): ringkasan finansial mingguan.

**Monthly** (tgl 1, 15:00): laporan finansial bulanan.

**Memory**: own knowledge base, category `anomaly-history`.

Read Only — never mutates transactions, only analisa, cashflow, warning, forecast.

## 7. HR Officer AI — Petugas HR

**Daily** (15:15)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca absensi, keterlambatan, cuti, dan KPI |
| 10 | Menandai staff dengan isu (absensi/keterlambatan/cuti/KPI) |
| 14 | Menyusun rekomendasi coaching |
| 17 | Menyimpan riwayat flag ke memory |
| 20 | Mengirim peringatan ke HR/Owner jika ada staff yang perlu perhatian |
| 25 | Mengirim laporan harian |

**Weekly** (Senin, 15:45): menilai staff dengan isu kronis.

**Monthly** (tgl 1, 15:30): rekap HR bulanan.

**Memory**: own knowledge base, category `staff-flag-history`.

Read-only — never mengubah data absensi/cuti/KPI, hanya memantau dan
memberi peringatan + rekomendasi coaching.

## 8. OTA Manager AI — Manajer OTA & Dynamic Pricing

**Daily** (15:30)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca occupancy, ADR, competitor price, booking pace per properti |
| 12 | Menyusun rekomendasi dynamic pricing |
| 15 | Menyimpan riwayat rekomendasi harga ke memory |
| 18 | Mengirim notifikasi untuk properti yang butuh penyesuaian harga |
| 20 | Mengirim laporan harian |

**Weekly** (Senin, 16:00): menilai tren okupansi per properti.

**Monthly** (tgl 1, 16:00): rekap OTA bulanan.

**Memory**: own knowledge base, category `pricing-history`.

Belum konek OTA sungguhan — `OTAConnector` di-mock
(`packages/connectors/src/adapters/mock/mock-ota.adapter.ts`), tapi
seluruh SOP di atas sudah siap dijalankan begitu OTA API diaktifkan
(satu adapter baru + satu baris di `registry.ts`, zero perubahan logic).

## 9. SOP Guardian AI — Penjaga SOP Perusahaan

**Daily** (17:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca laporan & work log seluruh AI lain |
| 10 | Memeriksa missed run, run gagal, retry berlebih, dan struktur SOP (langkah-langkah work log tidak lengkap) |
| 13 | Menyimpan riwayat pelanggaran ke memory |
| 15 | Mengirim peringatan untuk setiap pelanggaran SOP |
| 18 | Mengirim laporan kepatuhan SOP harian |

**Weekly** (Senin, 17:30): menilai AI yang kronis melanggar SOP.

**Monthly** (tgl 1, 17:00): rekap kepatuhan SOP bulanan.

**Memory**: own knowledge base, category `violation-history`.

Watches every other employee automatically via `AI_MODULE_IDS` (no
hardcoded list) — a newly added employee is covered the moment it's added
to that list, no SOP Guardian code change needed. Read-only auditor: never
modifies another employee's data, only observes and warns.

## 10. CEO Assistant AI — Asisten Eksekutif

**Daily** (18:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca laporan harian 9 AI lain (menjalankan yang belum jalan hari ini) |
| 20 | Menyusun Executive Summary |
| 23 | Menyimpan tema perhatian berulang ke memory |
| 25 | Mengirim Executive Summary ke Owner (via Notification Coordinator) |

**Weekly** (Senin, 18:30): rollup mingguan dari Executive Summary 7 hari terakhir.

**Monthly** (tgl 1, 19:00): laporan bulanan untuk Owner (board-style report).

**Memory**: own knowledge base, category `attention-theme-history` — tracks
which attention themes keep recurring day over day, separate from every
other employee's memory.

Output: hal yang perlu perhatian (`attentionNeeded`, aggregated across all
9 siblings), rekomendasi (`recommendations`), dan prioritas besok
(`tomorrowPriorities`).

## Notification Coordinator — `packages/notifications`

Not a cadence-scheduled `AIEmployee` (it's an always-on dispatch service,
not a daily/weekly/monthly worker — see `docs/ARCHITECTURE.md` for why
that's a distinct kind of thing), but every employee above routes 100% of
its alerts through it. `notify()` is the single funnel: no employee is
allowed to call a `NotificationChannel` directly. Currently backed by the
`dummy` channel (console log + persisted `NotificationMessage`);
WhatsApp/Telegram/Email/Push adapters exist as inert skeletons, activated
one at a time by setting their env vars — no employee code changes when
that happens.

## Manual trigger — `packages/scheduler/src/manual-trigger.ts`

Every employee above can be run outside its normal schedule via
`triggerEmployee({ moduleId, cadence, requestedBy })` — the exact same
`runEmployeeTask`/`ScheduleRunRecord` codepath as a scheduled run, tagged
`scheduledTime: "manual"` and `triggeredBy: "manual"` so manual runs are
distinguishable in history. No UI: a CLI wrapper
(`pnpm employee:trigger -- --module=<id> --cadence=<daily|weekly|monthly>
--by=<who>`) exists today; `triggerEmployee()` itself is what MK Connect
will call directly once that integration is authorized.
