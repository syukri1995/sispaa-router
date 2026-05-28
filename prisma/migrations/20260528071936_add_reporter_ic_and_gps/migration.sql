-- AlterTable
ALTER TABLE `Complaint` ADD COLUMN `gpsConfidence` DOUBLE NULL,
    ADD COLUMN `gpsLat` DOUBLE NULL,
    ADD COLUMN `gpsLng` DOUBLE NULL,
    ADD COLUMN `locationText` VARCHAR(191) NULL,
    ADD COLUMN `reporterIcHash` VARCHAR(191) NULL,
    ADD COLUMN `reporterIcLast4` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Complaint_reporterIcLast4_idx` ON `Complaint`(`reporterIcLast4`);
