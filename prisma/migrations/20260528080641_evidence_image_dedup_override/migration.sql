-- AlterTable
ALTER TABLE `Complaint` ADD COLUMN `dedupOverrideAt` DATETIME(3) NULL,
    ADD COLUMN `dedupOverrideReason` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EvidenceImage` (
    `id` VARCHAR(191) NOT NULL,
    `complaintId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `phash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvidenceImage_complaintId_idx`(`complaintId`),
    INDEX `EvidenceImage_createdAt_idx`(`createdAt`),
    INDEX `EvidenceImage_phash_idx`(`phash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Complaint_dedupOverrideAt_idx` ON `Complaint`(`dedupOverrideAt`);

-- AddForeignKey
ALTER TABLE `EvidenceImage` ADD CONSTRAINT `EvidenceImage_complaintId_fkey` FOREIGN KEY (`complaintId`) REFERENCES `Complaint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
