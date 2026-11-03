<#
.SYNOPSIS
  Builds the production Docker image and pushes it to Amazon ECR.
.PARAMETER AwsRegion
  The AWS region (defaults to ap-south-1).
.PARAMETER ImageTag
  The Docker image tag (defaults to git commit SHA or 'latest').
#>
param(
  [string]$AwsRegion = "ap-south-1",
  [string]$ImageTag = ""
)

$ErrorActionPreference = "Stop"

if (-not $ImageTag) {
  try {
    $ImageTag = $(git rev-parse --short HEAD).Trim()
  } catch {
    $ImageTag = "latest"
  }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Tailor Management System - ECR Image Build & Push       " -ForegroundColor Cyan
Write-Host " Region:    $AwsRegion" -ForegroundColor Cyan
Write-Host " Image Tag: $ImageTag" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Fetch AWS Account ID
Write-Host "`n[1/4] Retrieving AWS Account ID..." -ForegroundColor Yellow
$AwsAccountId = (aws sts get-caller-identity --query "Account" --output text).Trim()
if (-not $AwsAccountId) {
  Write-Error "Failed to retrieve AWS Account ID. Please ensure 'aws configure' is set."
}
$EcrRepo = "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com/tailor-management-backend"

# 2. Authenticate Docker with Amazon ECR
Write-Host "[2/4] Logging in to Amazon ECR ($EcrRepo)..." -ForegroundColor Yellow
aws ecr get-login-password --region $AwsRegion | docker login --username AWS --password-stdin "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com"

# 3. Build Docker Image using production multi-stage Dockerfile
Write-Host "`n[3/4] Building Docker container image..." -ForegroundColor Yellow
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")
docker build -t "${EcrRepo}:${ImageTag}" -t "${EcrRepo}:latest" "$BackendDir"

# 4. Push to ECR
Write-Host "`n[4/4] Pushing images to ECR..." -ForegroundColor Yellow
docker push "${EcrRepo}:${ImageTag}"
docker push "${EcrRepo}:latest"

Write-Host "`n✔ Successfully pushed image to ECR:" -ForegroundColor Green
Write-Host "  - ${EcrRepo}:${ImageTag}" -ForegroundColor Green
Write-Host "  - ${EcrRepo}:latest" -ForegroundColor Green
