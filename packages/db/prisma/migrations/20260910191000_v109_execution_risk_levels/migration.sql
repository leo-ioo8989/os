-- V1.09 additive migration. Existing GREEN/YELLOW/RED risk identifiers remain valid.
ALTER TYPE "RiskLevel" ADD VALUE 'HIGH';
ALTER TYPE "RiskLevel" ADD VALUE 'CRITICAL';
