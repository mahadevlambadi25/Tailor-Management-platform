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
