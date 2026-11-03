#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Executes pre-flight migrations and deploys updated image to ECS (Linux / CI)
# ==============================================================================

AWS_REGION="${1:-ap-south-1}"
CLUSTER_NAME="${2:-tailor-management-production-cluster}"
SERVICE_NAME="${3:-tailor-management-production-service}"

echo "=========================================================="
echo " Tailor Management System - ECS Fargate Deployment"
echo " Cluster: ${CLUSTER_NAME}"
echo " Service: ${SERVICE_NAME}"
echo " Region:  ${AWS_REGION}"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

echo "[1/3] Executing Database Pre-Flight Migration Guard..."
(cd "${BACKEND_DIR}" && node scripts/deploy-migrations.js)

echo "[2/3] Triggering zero-downtime rolling deployment on ECS..."
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${SERVICE_NAME}" \
  --force-new-deployment \
  --region "${AWS_REGION}" > /dev/null

echo "[3/3] Waiting for new ECS tasks to become healthy and ready..."
aws ecs wait services-stable \
  --cluster "${CLUSTER_NAME}" \
  --services "${SERVICE_NAME}" \
  --region "${AWS_REGION}"

echo "✔ ECS Fargate rolling deployment completed successfully!"
