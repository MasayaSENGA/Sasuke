-- CreateTable
CREATE TABLE "remote_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "power" TEXT,
    "temperature" INTEGER,
    "mode" INTEGER,
    "fanSpeed" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "remote_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "remote_state_userId_deviceId_key" ON "remote_state"("userId", "deviceId");
