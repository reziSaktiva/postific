-- T-148 (spike MCP, ADR-139): tabel plugin `jwt` dan `@better-auth/oauth-provider`.
-- Additive: hanya CREATE TABLE/INDEX baru, tidak menyentuh tabel yang ada.
-- Sementara; T-149 memutuskan bentuk akhir. Rollback: DROP kelima tabel di bawah.
-- RLS diaktifkan tanpa policy karena tabel ini menyimpan token dan kunci privat
-- JWKS: akses hanya lewat Prisma (koneksi owner), tidak lewat anon key.

-- CreateTable
CREATE TABLE "identity_jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "identity_jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_oauth_client" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "disabled" BOOLEAN DEFAULT false,
    "skipConsent" BOOLEAN,
    "enableEndSession" BOOLEAN,
    "subjectType" TEXT,
    "scopes" TEXT[],
    "userId" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "name" TEXT,
    "uri" TEXT,
    "icon" TEXT,
    "contacts" TEXT[],
    "tos" TEXT,
    "policy" TEXT,
    "softwareId" TEXT,
    "softwareVersion" TEXT,
    "softwareStatement" TEXT,
    "redirectUris" TEXT[],
    "postLogoutRedirectUris" TEXT[],
    "tokenEndpointAuthMethod" TEXT,
    "grantTypes" TEXT[],
    "responseTypes" TEXT[],
    "public" BOOLEAN,
    "type" TEXT,
    "requirePKCE" BOOLEAN,
    "referenceId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "identity_oauth_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_oauth_refresh_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "referenceId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3),
    "revoked" TIMESTAMP(3),
    "authTime" TIMESTAMP(3),
    "scopes" TEXT[],

    CONSTRAINT "identity_oauth_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_oauth_access_token" (
    "id" TEXT NOT NULL,
    "token" TEXT,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "refreshId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3),
    "scopes" TEXT[],

    CONSTRAINT "identity_oauth_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_oauth_consent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "referenceId" TEXT,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "identity_oauth_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_oauth_client_userId_idx" ON "identity_oauth_client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_oauth_client_clientId_key" ON "identity_oauth_client"("clientId");

-- CreateIndex
CREATE INDEX "identity_oauth_refresh_token_clientId_idx" ON "identity_oauth_refresh_token"("clientId");

-- CreateIndex
CREATE INDEX "identity_oauth_refresh_token_sessionId_idx" ON "identity_oauth_refresh_token"("sessionId");

-- CreateIndex
CREATE INDEX "identity_oauth_refresh_token_userId_idx" ON "identity_oauth_refresh_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_oauth_refresh_token_token_key" ON "identity_oauth_refresh_token"("token");

-- CreateIndex
CREATE INDEX "identity_oauth_access_token_clientId_idx" ON "identity_oauth_access_token"("clientId");

-- CreateIndex
CREATE INDEX "identity_oauth_access_token_sessionId_idx" ON "identity_oauth_access_token"("sessionId");

-- CreateIndex
CREATE INDEX "identity_oauth_access_token_userId_idx" ON "identity_oauth_access_token"("userId");

-- CreateIndex
CREATE INDEX "identity_oauth_access_token_refreshId_idx" ON "identity_oauth_access_token"("refreshId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_oauth_access_token_token_key" ON "identity_oauth_access_token"("token");

-- CreateIndex
CREATE INDEX "identity_oauth_consent_clientId_idx" ON "identity_oauth_consent"("clientId");

-- CreateIndex
CREATE INDEX "identity_oauth_consent_userId_idx" ON "identity_oauth_consent"("userId");


-- EnableRls
ALTER TABLE "identity_jwks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_oauth_client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_oauth_refresh_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_oauth_access_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_oauth_consent" ENABLE ROW LEVEL SECURITY;
