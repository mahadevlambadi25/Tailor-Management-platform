<#
.SYNOPSIS
  Executes pre-flight migrations and deploys updated image to ECS Fargate service.
.PARAMETER AwsRegion
  The AWS region (defaults to ap-south-1).
.PARAMETER ClusterName
  Name of the ECS cluster.
.PARAMETER ServiceName
  Name of the ECS service.
#>
param(
  [string]$AwsRegion = "ap-south-1",
  [string]$ClusterName = "tailor-management-production-cluster",
  [string]$ServiceName = "tailor-management-production-service"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Tailor Management System - ECS Fargate Deployment        " -ForegroundColor Cyan
Write-Host " Cluster: $ClusterName" -ForegroundColor Cyan
Write-Host " Service: $ServiceName" -ForegroundColor Cyan
Write-Host " Region:  $AwsRegion" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Run Pre-flight Database Migration Guard
Write-Host "`n[1/3] Executing Database Pre-Flight Migration Guard..." -ForegroundColor Yellow
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")
Push-Location $BackendDir
try {
  node scripts/deploy-migrations.js
  if ($LASTEXITCODE -ne 0) {
    throw "Database migration deployment failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

# 2. Trigger Rolling Deployment on ECS Fargate
Write-Host "`n[2/3] Triggering zero-downtime rolling deployment on ECS..." -ForegroundColor Yellow
aws ecs update-service `
  --cluster $ClusterName `
  --service $ServiceName `
  --force-new-deployment `
  --region $AwsRegion | Out-Null

# 3. Wait for Service Stability
Write-Host "`n[3/3] Waiting for new ECS tasks to become healthy and ready..." -ForegroundColor Yellow
aws ecs wait services-stable `
  --cluster $ClusterName `
  --services $ServiceName `
  --region $AwsRegion

Write-Host "`n✔ ECS Fargate rolling deployment completed successfully!" -ForegroundColor Green
