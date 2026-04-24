-- CreateTable
CREATE TABLE "TestNumberMapping" (
    "id" UUID NOT NULL,
    "senderPhoneNumber" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestNumberMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestNumberMapping_senderPhoneNumber_key" ON "TestNumberMapping"("senderPhoneNumber");

-- CreateIndex
CREATE INDEX "TestNumberMapping_senderPhoneNumber_idx" ON "TestNumberMapping"("senderPhoneNumber");

-- CreateIndex
CREATE INDEX "TestNumberMapping_tenantId_idx" ON "TestNumberMapping"("tenantId");

-- AddForeignKey
ALTER TABLE "TestNumberMapping" ADD CONSTRAINT "TestNumberMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
