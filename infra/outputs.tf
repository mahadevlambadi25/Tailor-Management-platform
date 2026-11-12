# ==============================================================================
# OpenTofu Infrastructure Outputs
# ==============================================================================

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer. Point your DNS (e.g. api.tailorsystem.com) or frontend proxy to this endpoint."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "The Amazon ECR Repository URL to tag and push backend Docker images to."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS Fargate cluster."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS Web API service."
  value       = aws_ecs_service.app.name
}

output "secrets_manager_arn" {
  description = "ARN of the AWS Secrets Manager secret holding production credentials."
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "secrets_manager_name" {
  description = "Name of the AWS Secrets Manager secret to populate with live Supabase credentials."
  value       = aws_secretsmanager_secret.app_secrets.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for container logs."
  value       = aws_cloudwatch_log_group.ecs.name
}

# ==============================================================================
# RDS PostgreSQL Database Outputs
# ==============================================================================

output "rds_endpoint" {
  description = "Endpoint hostname of the RDS PostgreSQL instance."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Port number of the RDS PostgreSQL instance."
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "Database name of the RDS PostgreSQL instance."
  value       = aws_db_instance.postgres.db_name
}

output "rds_credentials_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret holding RDS connection strings and credentials."
  value       = aws_secretsmanager_secret.rds_credentials.arn
}

# ==============================================================================
# Frontend Hosting (S3 + CloudFront CDN) Outputs
# ==============================================================================

output "frontend_s3_bucket_name" {
  description = "Name of the private S3 bucket hosting frontend static assets."
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_s3_bucket_arn" {
  description = "ARN of the frontend S3 bucket."
  value       = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution for cache invalidations during CI/CD deploy."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution default domain name (e.g. dxxxxxxxxxxxx.cloudfront.net)."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Primary URL to access the frontend web application."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

# ==============================================================================
# CI/CD Deployment Outputs
# ==============================================================================

output "github_actions_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC for automated deployments."
  value       = aws_iam_role.github_actions.arn
}

output "ecs_migration_task_definition_arn" {
  description = "ARN of the database migration one-off ECS task definition."
  value       = aws_ecs_task_definition.migration.arn
}

output "ecs_migration_task_definition_family" {
  description = "Family name of the database migration ECS task definition."
  value       = aws_ecs_task_definition.migration.family
}
