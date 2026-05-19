/*
  Warnings:

  - You are about to drop the column `departement` on the `personnes_physiques` table. All the data in the column will be lost.
  - You are about to drop the column `poste` on the `personnes_physiques` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "personnes_physiques_email_key";

-- AlterTable
ALTER TABLE "personnes_physiques" DROP COLUMN "departement",
DROP COLUMN "poste",
ALTER COLUMN "email" SET DATA TYPE VARCHAR(500);
