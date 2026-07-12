# Standard Operating Procedures (SOP)

Every AI employee's SOP is declared in code (`sop: EmployeeSOP` in each
module's `module.ts`) and enforced in practice by `WorkLogger` — each step
below corresponds to a `log.step(...)` call inside the employee's task
method, which writes a persisted `WorkLogEntry` you can query via the MCP
server's `list_work_log` tool. `offsetMinutes` is minutes after the
cadence's scheduled start time; it's documentation today (the scheduler
runs the whole task at the scheduled time, not step-by-step), not an
enforced sub-schedule.

Default schedule times (Asia/Makassar): see
`packages/database/src/seed-data.ts` `DEFAULT_SCHEDULE` — weekly runs
Monday, monthly runs the 1st.

---

## Marketing Intelligence AI — Kepala Riset Marketing

**Daily** (06:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Analisa trend Google/Properti/Villa/Skincare |
| 15 | Riset konten viral Instagram & TikTok |
| 30 | Analisa kompetitor |
| 60 | Membuat insight & rekomendasi |
| 75 | Menyimpan hasil ke knowledge base |
| 90 | Mengirim Market Intelligence Report |

**Weekly** (Senin, 06:30): mengumpulkan laporan harian seminggu terakhir → menyusun Weekly Strategy.

**Monthly** (tgl 1, 06:00): meninjau seluruh knowledge base → menyusun retrospective & rekomendasi.

Outputs: Market Intelligence Report (daily), Weekly Strategy, Daily
Recommendation, Content Checklist (raw content ideas — not the assigned,
tracked checklist; that's Marketing Operation's job).

## Marketing Operation AI — Koordinator Operasional Markom

**Daily** (07:30)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca laporan Marketing Intelligence terbaru |
| 15 | Menyusun/memperbarui checklist mingguan |
| 25 | Mengirim reminder untuk tugas belum selesai (via Notification Engine) |
| 30 | Mengirim laporan operasional |

**Weekly** (Senin, 07:45): menyusun checklist baru dari ide konten terbaru.

**Monthly** (tgl 1, 07:30): mengumpulkan laporan harian sebulan terakhir → rekap tingkat penyelesaian Markom.

## Meta Ads AI — Analis & Operator Meta Ads

**Daily** (08:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca performa campaign |
| 15 | Menghitung CPL/CTR/CPC & membandingkan campaign |
| 25 | Membuat Approval Request untuk campaign yang butuh aksi |
| 30 | Mengirim notifikasi jika ada campaign perlu perhatian |
| 35 | Mengirim laporan analisa harian |

**Weekly** (Senin, 09:00): membandingkan performa antar hari, mengidentifikasi campaign dengan masalah berulang.

**Monthly** (tgl 1, 08:00): rekap approval & performa ads sebulan.

Scope boundary: analysis + recommendation + Approval Request only. No
publish/execute step exists in this phase (see `docs/ROADMAP.md`).

## Sales Supervisor AI — Pengawas Penjualan

**Daily** (12:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca data sales |
| 10 | Menghitung target vs progress |
| 15 | Mendeteksi keterlambatan follow-up |
| 20 | Mengirim notifikasi ke Dir Ops jika ada yang tertinggal |
| 25 | Mengirim laporan harian |

**Weekly** (Senin, 12:30): menilai tren progress & sales yang kronis tertinggal.

**Monthly** (tgl 1, 12:00): rekap target bulanan.

Read-only — never writes sales data.

## Finance Analyst AI — Analis Keuangan

**Daily** (15:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca transaksi |
| 10 | Membuat prediksi cashflow |
| 15 | Mendeteksi pengeluaran tidak biasa |
| 20 | Mengirim laporan untuk Owner |

**Weekly** (Senin, 15:30): ringkasan finansial mingguan.

**Monthly** (tgl 1, 15:00): laporan finansial bulanan.

Read-only — never mutates transactions.

## CEO Assistant AI — Asisten Eksekutif

**Daily** (18:00)
| +min | Step |
|---|---|
| 0 | Mulai bekerja |
| 5 | Membaca laporan harian 5 AI lain (menjalankan yang belum jalan hari ini) |
| 20 | Menyusun Executive Summary |
| 25 | Mengirim Executive Summary ke Owner |

**Weekly** (Senin, 18:30): rollup mingguan dari Executive Summary 7 hari terakhir.

**Monthly** (tgl 1, 19:00): laporan bulanan untuk Owner (board-style report).

Output: hal yang perlu perhatian (`attentionNeeded`), rekomendasi
(`recommendations`), dan prioritas besok (`tomorrowPriorities`).
