#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Builds the production Docker image and pushes it to Amazon ECR (Linux / CI)
# ==============================================================================

AWS_REGION="${1:-ap-south-1}"
IMAGE_TAG="${2:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"

echo "=========================================================="
echo " Tailor Management System - ECR Image Build & Push"
echo " Region:    ${AWS_REGION}"
echo " Image Tag: ${IMAGE_TAG}"
echo "=========================================================="

echo "[1/4] Retrieving AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/tailor-management-backend"

echo "[2/4] Logging in to Amazon ECR (${ECR_REPO})..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "[3/4] Building production Docker container..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

docker build \
  -t "${ECR_REPO}:${IMAGE_TAG}" \
  -t "${ECR_REPO}:latest" \
  "${BACKEND_DIR}"

echo "[4/4] Pushing images to Amazon ECR..."
docker push "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:latest"

echo "✔ Successfully pushed images to ECR:"
echo "  - ${ECR_REPO}:${IMAGE_TAG}"
echo "  - ${ECR_REPO}:latest"
