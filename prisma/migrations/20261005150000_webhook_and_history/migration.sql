-- AlterTable
ALTER TABLE "switchbot_credential" ADD COLUMN "webhookEnabledAt" DATETIME;
ALTER TABLE "switchbot_credential" ADD COLUMN "webhookSecretHash" TEXT;

-- CreateTable
CREATE TABLE "sensor_reading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "temperature" REAL,
    "humidity" REAL,
    "co2" INTEGER,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sensor_reading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sensor_reading_userId_deviceId_recordedAt_idx" ON "sensor_reading"("userId", "deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "sensor_reading_recordedAt_idx" ON "sensor_reading"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "switchbot_credential_webhookSecretHash_key" ON "switchbot_credential"("webhookSecretHash");

