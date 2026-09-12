-- Organization-scoped OAuth integration vault. Secrets are application-encrypted before persistence.
CREATE TABLE "ConnectedIntegration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountId" TEXT,
  "accountLabel" TEXT,
  "accessTokenEnc" TEXT NOT NULL,
  "refreshTokenEnc" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ConnectedIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConnectedIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConnectedIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConnectedIntegration_org_provider_account_key" ON "ConnectedIntegration"("organizationId", "provider", "accountId");
CREATE INDEX "ConnectedIntegration_org_provider_idx" ON "ConnectedIntegration"("organizationId", "provider", "revokedAt");
