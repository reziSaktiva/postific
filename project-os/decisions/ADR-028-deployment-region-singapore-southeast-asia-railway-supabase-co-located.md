## Decision ADR-028

### Title

Deployment Region — Singapore / Southeast Asia (Railway + Supabase Co-located)

### Status

Accepted

### Date

2026-07-17

### Decision

Seluruh infrastruktur di-host di region **Singapore / Southeast Asia**:

- **Railway** — region Southeast Asia (Singapore).
- **Supabase** — region `ap-southeast-1` (Singapore).

Railway (compute) dan Supabase (data) di-**co-located** di region yang sama untuk meminimalkan round-trip antara aplikasi dan database. Keputusan ini berlaku untuk seluruh environment (production dan staging).

Detail lengkap: `product-discovery/06-engineering/deployment-infrastructure.md` (DI-D01).

### Reason

- Target market utama adalah **Marketing Team di Indonesia** — region SEA memberikan latency terendah ke user.
- Co-location Railway↔Supabase meminimalkan latency query, RLS, dan storage signed URL yang berada di jalur kritis UX.
- Panggilan ke Outstand API sebagian besar bersifat background/asinkron, sehingga latency ke provider tidak berada di jalur kritis.

### Alternatives Considered

- Region US (us-east/us-west) — ekosistem paling matang, tetapi latency tinggi ke user Indonesia.
- Region campur (mis. Supabase SG + Railway US) — menambah round-trip app↔DB pada setiap request, merugikan latency.

---
