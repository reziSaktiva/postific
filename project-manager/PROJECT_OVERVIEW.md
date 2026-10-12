# PROJECT OVERVIEW

## Metadata

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Project Name | Postific                                  |
| Version      | 0.1.0                                     |
| Status       | Active                                    |
| Owner        | Rezi                                      |
| Last Updated | 2026-07-21                                |

---

# Project Summary

Postific adalah platform berbasis web yang membantu pengguna mengelola seluruh aktivitas media sosial dari satu dashboard.

Project ini dikembangkan sebagai alternatif modern dari Buffer (buffer.com) dengan fokus pada pengalaman pengguna yang sederhana, cepat, dan mudah digunakan.

Integrasi dengan berbagai platform media sosial akan menggunakan **Outstand API**, sehingga aplikasi dapat berfokus pada pengalaman pengguna dan fitur bisnis tanpa perlu membangun integrasi media sosial dari nol.

---

# Product Vision

Membangun platform Social Media Management modern yang memungkinkan marketing team, startup, dan digital agency mengelola aktivitas media sosial secara efisien melalui satu dashboard terpusat.

---

# Project Goals

### Short Term

* Membangun Minimum Viable Product (MVP)
* Menyediakan pengalaman publishing yang stabil
* Memiliki arsitektur yang mudah dikembangkan
* Menyelesaikan fitur inti sebelum fitur tambahan

### Long Term

* Menjadi alternatif Buffer
* Mendukung berbagai platform media sosial
* Memiliki arsitektur yang scalable
* Mendukung AI untuk membantu pembuatan konten
* Mendukung kolaborasi tim dan workflow yang lebih kompleks

---

# Target Users

Primary Users:

* Marketing Team

Secondary Users:

* Startup
* Digital Agency

Future Users:

* Enterprise

---

# MVP Scope

Fitur utama yang direncanakan pada MVP:

* Workspace
* Publishing
* Analytics
* Engagement
* AI Assistant
* Start Page

---

# Supported Social Platforms

Platform media sosial yang didukung aplikasi (ADR-037; via Outstand):

1. Instagram
2. Facebook
3. Twitter / X
4. LinkedIn
5. TikTok
6. YouTube
7. Threads
8. Pinterest

Source of Truth enum: `SocialPlatform` di `packages/shared`.

---

# Technical Overview

| Category            | Decision                   |
| ------------------- | -------------------------- |
| Repository Strategy | Hybrid Monorepo            |
| Runtime             | Bun                        |
| Framework           | Next.js                    |
| Language            | TypeScript                 |
| Architecture        | Modular Monolith           |
| Design Pattern      | Domain-Driven Design (DDD) |
| Database            | Supabase PostgreSQL        |
| ORM                 | Prisma                     |
| Data Access         | Prisma (CRUD) + Supabase client (Realtime, Storage) |
| Auth                | Better Auth                |
| Storage             | Supabase Storage           |
| Deployment          | Railway                    |
| CI                  | GitHub Actions             |
| Lint / Format       | ESLint + Prettier          |
| Pre-commit          | Lefthook + lint-staged     |
| Test Runner         | Vitest                     |
| Env / Secrets       | Railway Variables + `.env.local` (native) |
| Dependencies        | Bun workspaces; `^` ranges (sisa kode Astryx yang belum termigrasi tetap exact pin); root `bun.lockb`; update manual |
| Styling             | Tailwind CSS *(styling langsung komponen shadcn/ui)* |
| UI Components       | shadcn/ui *(ADR-097, membalik ADR-041 — migrasi dari Astryx incremental per route-segment)* |
| External Provider   | Outstand API               |

---

# Development Principles

Project ini dikembangkan dengan prinsip berikut:

* Documentation First
* Business First
* Domain-Driven Design
* AI Friendly Development
* Maintainability over Complexity
* Scalability by Design
* Iterative Development

---

# Developer Profile & Working Preferences

Section ini mendokumentasikan siapa yang mengerjakan project ini dan bagaimana preferensi kerjanya, agar AI Assistant dapat berkolaborasi secara konsisten tanpa harus dijelaskan ulang setiap sesi.

Berbeda dengan section lain di dokumen ini, section ini **boleh bertambah** seiring waktu setiap kali preferensi baru ditemukan dalam sesi kerja — namun tetap harus mencatat hanya preferensi yang **sudah terkonfirmasi**, bukan asumsi.

**Profil:**

* Solo developer (Rezi) — tidak ada tim lain saat ini.
* Membangun project ini sambil menyusun dokumentasi secara paralel (Documentation First).

**Preferensi Kerja yang Terkonfirmasi:**

* Bahasa komunikasi dan dokumentasi: **Bahasa Indonesia**.
* Perubahan struktural (folder, path, aturan) harus dieksekusi lengkap sampai seluruh dokumen terkait konsisten — tidak boleh setengah jalan.
* Setiap inkonsistensi yang ditemukan AI harus disebutkan secara eksplisit ke user, bukan didiamkan atau diperbaiki secara diam-diam.
* Lebih menyukai struktur dokumentasi yang rapi dan tidak ambigu dibandingkan kecepatan — good documentation dianggap lebih penting daripada langsung coding.
* Terbuka mendiskusikan ulang keputusan dokumentasi (governance, klasifikasi dokumen) jika ditemukan potensi inkonsistensi jangka panjang.

**Cara Menambah Entry Baru:**

Jika sesi kerja mengungkap preferensi baru (misal: gaya review kode, cara approve keputusan, kebiasaan komunikasi), tambahkan sebagai bullet baru di atas. Jangan menghapus entry lama kecuali user secara eksplisit menyatakan preferensi tersebut sudah tidak berlaku.

---

# Related Documents

→ ARCHITECTURE_OVERVIEW.md
→ PROJECT_STATE.md
→ PROJECT_RULES.md
→ DECISIONS.md
→ ../context/ctx-design.md
→ ../product-discovery/README.md
→ ../product-discovery/01-business/README.md
→ ../product-discovery/02-product/README.md
→ ../product-discovery/04-ux/README.md
→ ../product-discovery/05-architecture/README.md
→ ../product-discovery/06-engineering/README.md
→ ../product-discovery/06-engineering/design-tokens.md