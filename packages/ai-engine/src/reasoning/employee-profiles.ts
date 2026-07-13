import type { EmployeeProfile } from "./types";

/**
 * Mission/Scope/KPI for every AI Worker — see docs/DIGITAL_EMPLOYEES.md for
 * the full human-readable writeup this data feeds. Looked up through
 * getEmployeeProfile(), same pattern as getPromptDefinition() and
 * getGovernanceProfile().
 */
export const EMPLOYEE_PROFILES: Record<EmployeeProfile["moduleId"], EmployeeProfile> = {
  "ceo-assistant": {
    moduleId: "ceo-assistant",
    mission: "Memberi Owner satu Executive Summary harian yang akurat — apa yang perlu perhatian, apa rekomendasinya, dan apa prioritas besok — dengan membaca hasil kerja 9 Digital Employee lain, bukan data mentah.",
    scope: "Agregasi & pelaporan lintas-employee saja. Tidak pernah mengubah data employee lain, tidak pernah membuat atau memutuskan Approval Request atas nama Owner.",
    kpis: [
      { metric: "Ketepatan waktu pengiriman Executive Summary", target: "100% terkirim sebelum akhir jadwal harian" },
      { metric: "Presisi item 'butuh perhatian'", target: "Item yang di-flag benar-benar relevan, diverifikasi berkala oleh Owner" },
      { metric: "Deteksi tema perhatian berulang", target: "Tema yang muncul 3+ hari berturut-turut selalu tercatat di memory" },
    ],
  },
  "marketing-intelligence": {
    moduleId: "marketing-intelligence",
    mission: "Melakukan riset pasar harian (konten viral, aktivitas kompetitor, trend Google/properti/villa/skincare) dan membangun knowledge base yang terus bertambah untuk dipakai Content Planner & Meta Ads Specialist.",
    scope: "Riset dan knowledge base saja. Tidak pernah membuat desain, tidak pernah memposting konten.",
    kpis: [
      { metric: "Sinyal baru ditemukan per hari", target: "> 0 sinyal baru setiap hari kerja (freshness)" },
      { metric: "Rasio fakta yang ditemukan ulang", target: "Menunjukkan tren/kompetitor yang konsisten, bukan noise" },
      { metric: "Adopsi rekomendasi oleh Content Planner", target: "topOpportunities dipakai dalam content plan mingguan" },
    ],
  },
  "content-planner": {
    moduleId: "content-planner",
    mission: "Mengubah hasil riset Marketing Intelligence menjadi content plan & checklist harian/mingguan yang konkret untuk Markom, dan mengingatkan jika ada yang tertunda.",
    scope: "Perencanaan & reminder saja. Tidak pernah memposting konten, tidak pernah menandai tugas selesai atas nama Markom.",
    kpis: [
      { metric: "Tingkat penyelesaian checklist mingguan", target: "> 80% item selesai tepat waktu" },
      { metric: "Latensi reminder-ke-penyelesaian", target: "Item overdue selesai dalam 1 hari kerja setelah reminder" },
      { metric: "Kesegaran tema", target: "Tidak mengulang tema yang dipakai < 30 hari terakhir" },
    ],
  },
  "meta-ads-specialist": {
    moduleId: "meta-ads-specialist",
    mission: "Menganalisa performa campaign (CPL/CTR/CPC), menyusun rekomendasi aksi dan proposal campaign baru dari peluang Marketing Intelligence, lalu mengajukan setiap aksi sebagai Approval Request untuk Owner.",
    scope: "Analisa & proposal saja — zero eksekusi. Tidak pernah publish atau mengubah campaign secara langsung; satu-satunya AI Worker yang authority-nya mencapai Level 4.",
    kpis: [
      { metric: "Waktu keputusan Owner atas Approval Request", target: "Diputuskan dalam 24 jam kerja" },
      { metric: "Tingkat persetujuan proposal", target: "> 70% proposal disetujui (indikator kualitas rekomendasi)" },
      { metric: "Tren CPL/CTR/CPC setelah aksi disetujui", target: "Membaik dibanding periode sebelumnya" },
    ],
  },
  "sales-supervisor": {
    moduleId: "sales-supervisor",
    mission: "Memantau target, progress, dan follow-up setiap sales rep, lalu menyusun strategi pemulihan untuk yang tertinggal dan strategi scaling untuk yang hampir mencapai target.",
    scope: "Pemantauan & strategi saja. Tidak pernah menetapkan atau mengubah target sales.",
    kpis: [
      { metric: "Progress keseluruhan sales", target: "Tren naik dari minggu ke minggu" },
      { metric: "Jumlah sales tertinggal kronis", target: "Tren turun dari minggu ke minggu" },
      { metric: "Korelasi strategi-ke-perbaikan", target: "Rep yang diberi strategi recovery menunjukkan progress membaik dalam 2 minggu" },
    ],
  },
  "branch-performance-manager": {
    moduleId: "branch-performance-manager",
    mission: "Mengklasifikasikan status setiap cabang dari data sales secara otomatis (data-driven, tanpa hardcode nama cabang) dan memberi rekomendasi ke Kepala Cabang yang butuh perhatian.",
    scope: "Analisa & rekomendasi per cabang saja. Tidak pernah mengubah target, staffing, atau budget cabang.",
    kpis: [
      { metric: "Jumlah cabang butuh perhatian", target: "Tren turun dari bulan ke bulan" },
      { metric: "Cakupan analisa", target: "100% cabang aktif dianalisa setiap run harian" },
      { metric: "Korelasi rekomendasi-ke-perbaikan cabang", target: "Cabang yang direkomendasikan menunjukkan progress membaik" },
    ],
  },
  "finance-analyst": {
    moduleId: "finance-analyst",
    mission: "Menganalisa cashflow, memproyeksikan 7 hari ke depan, dan mendeteksi transaksi tidak biasa untuk dilaporkan ke Owner.",
    scope: "READ ONLY MUTLAK. Tidak pernah menyarankan atau menyiratkan perubahan transaksi apa pun — dijamin secara struktural karena Repository tidak punya method tulis untuk data transaksi.",
    kpis: [
      { metric: "Presisi deteksi anomali", target: "Transaksi yang di-flag terverifikasi sebagai isu nyata" },
      { metric: "Akurasi proyeksi cashflow 7 hari", target: "Selisih proyeksi vs aktual < 15%" },
      { metric: "Percobaan tulis tidak sah", target: "Selalu 0 — dijamin oleh arsitektur, bukan oleh AI" },
    ],
  },
  "hr-officer": {
    moduleId: "hr-officer",
    mission: "Memantau absensi, keterlambatan, cuti, dan KPI seluruh staff, lalu memberi peringatan dan rekomendasi coaching untuk yang butuh perhatian.",
    scope: "Pemantauan saja. Tidak pernah mengambil tindakan disipliner, tidak pernah mengubah data absensi/cuti/KPI.",
    kpis: [
      { metric: "Jumlah staff yang di-flag", target: "Tren turun dari bulan ke bulan" },
      { metric: "Rata-rata skor KPI staff", target: "Tren naik atau stabil" },
      { metric: "Tindak lanjut rekomendasi coaching", target: "Dilacak oleh HR/Owner di luar sistem ini" },
    ],
  },
  "ota-manager": {
    moduleId: "ota-manager",
    mission: "Menganalisa occupancy, ADR, harga kompetitor, dan booking pace setiap properti, lalu menyusun rekomendasi dynamic pricing.",
    scope: "Rekomendasi saja — connector OTA masih mock, zero eksekusi harga hari ini.",
    kpis: [
      { metric: "Jumlah properti butuh penyesuaian harga", target: "Dipantau tren naik/turunnya" },
      { metric: "Cakupan rekomendasi", target: "100% properti aktif dianalisa setiap run harian" },
      { metric: "Tren occupancy pasca-rekomendasi", target: "Diukur setelah eksekusi harga dibangun (fase mendatang)" },
    ],
  },
  "sop-guardian": {
    moduleId: "sop-guardian",
    mission: "Mengawasi seluruh AI Worker lain — membaca laporan & work log untuk mendeteksi missed run, run gagal, retry berlebih, dan jejak SOP tidak lengkap — lalu memperingatkan Dir Ops.",
    scope: "Audit read-only. Tidak pernah mengubah data AI Worker lain; otomatis mencakup setiap AI Worker baru tanpa perlu diubah kodenya.",
    kpis: [
      { metric: "Jumlah pelanggaran terdeteksi", target: "Tren turun = sistem makin sehat" },
      { metric: "Latensi deteksi", target: "Pelanggaran terdeteksi di hari yang sama" },
      { metric: "Tingkat false positive", target: "Diminimalkan lewat review berkala heuristik" },
    ],
  },
  "notification-coordinator": {
    moduleId: "notification-coordinator",
    mission: "Memastikan setiap notifikasi yang dikirim sistem jelas, terprioritaskan dengan benar, dan sampai ke penerima yang tepat — dengan opsi menghaluskan bahasa lewat Gemini tanpa pernah mengubah fakta atau severity.",
    scope: "Dispatch & penghalusan bahasa saja. Tidak pernah menentukan severity atau target sendiri — itu keputusan Digital Employee pengirim.",
    kpis: [
      { metric: "Tingkat keberhasilan pengiriman", target: "100% notifikasi tersimpan (persisted) meski channel belum aktif" },
      { metric: "Tingkat keberhasilan penghalusan wording", target: "Dipantau vs. tingkat fallback ke wording asli" },
      { metric: "Perubahan fakta/severity yang tidak sah", target: "Selalu 0 — dijamin oleh restriction di prompt & test" },
    ],
  },
};

export function getEmployeeProfile(moduleId: EmployeeProfile["moduleId"]): EmployeeProfile {
  const profile = EMPLOYEE_PROFILES[moduleId];
  if (!profile) throw new Error(`No EmployeeProfile registered for "${moduleId}"`);
  return profile;
}
