variable "aws_region" {
  description = "The AWS region to deploy infrastructure in."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment name (e.g. production, staging, dev)."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Name prefix for all AWS resources."
  type        = string
  default     = "tailor-management"
}

variable "vpc_cidr" {
  description = "CIDR block for the Virtual Private Cloud."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones within the region to distribute subnets."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB & NAT Gateways)."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private application subnets (ECS Fargate tasks)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "container_port" {
  description = "Port exposed by the Docker container."
  type        = number
  default     = 5000
}

variable "fargate_cpu" {
  description = "vCPU units allocated for the ECS Fargate task (256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "fargate_memory" {
  description = "Memory (in MB) allocated for the ECS Fargate task."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Initial number of ECS web tasks (autoscaling adjusts it afterwards between min_capacity and max_capacity)."
  type        = number
  default     = 1
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks for autoscaling."
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks for autoscaling."
  type        = number
  default     = 4
}

variable "image_tag" {
  description = "Docker image tag to deploy from ECR."
  type        = string
  default     = "latest"
}

variable "acm_certificate_arn" {
  description = "Optional AWS Certificate Manager (ACM) ARN for HTTPS listener on ALB. Leave empty for HTTP-only during initial setup."
  type        = string
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Additional allowed CORS origins (comma-separated). The CloudFront domain and frontend_custom_domain are always allowed automatically."
  type        = string
  default     = ""
}

variable "enable_nat_gateway" {
  description = "false (default, lean): ECS tasks run in public subnets with a public IP and inbound restricted to the ALB; no NAT gateway or Elastic IP. true: tasks run in private subnets behind a NAT gateway."
  type        = bool
  default     = false
}

variable "enable_nat_gateway_per_az" {
  description = "Set to true for high-availability multi-NAT gateways (1 per AZ), or false for single NAT to save cost in staging."
  type        = bool
  default     = false
}

# ==============================================================================
# RDS PostgreSQL Configuration
# ==============================================================================

variable "database_subnet_cidrs" {
  description = "CIDR blocks for private database subnets (RDS PostgreSQL)."
  type        = list(string)
  default     = ["10.0.30.0/24", "10.0.40.0/24"]
}

variable "db_name" {
  description = "Name of the initial PostgreSQL database created on RDS."
  type        = string
  default     = "tailor_management"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL."
  type        = string
  default     = "tailor_admin"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL. If left empty, a secure random password is automatically generated."
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_instance_class" {
  description = "Compute instance class for RDS PostgreSQL (db.t4g.micro is cost-conscious for initial launch)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in gigabytes (gp3 SSD)."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage threshold in gigabytes for RDS storage autoscaling."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Specifies if the RDS instance is multi-AZ (set false for cost savings in initial phase; true for HA production)."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enables deletion protection on the RDS instance to prevent accidental teardown."
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated daily backups."
  type        = number
  default     = 7
}

# ==============================================================================
# Frontend Hosting (S3 + CloudFront CDN) Configuration
# ==============================================================================

variable "frontend_bucket_name" {
  description = "Optional custom name for frontend S3 bucket. If empty, automatically generated from project, environment, and account ID."
  type        = string
  default     = ""
}

variable "cloudfront_price_class" {
  description = "CloudFront price class (PriceClass_200 includes India edge locations in ap-south-1)."
  type        = string
  default     = "PriceClass_200"
}

variable "enable_cloudfront_api_proxy" {
  description = "When true, proxies /api/* through CloudFront to ALB to provide a unified domain and eliminate CORS overhead."
  type        = bool
  default     = true
}

variable "frontend_custom_domain" {
  description = "Optional custom domain name for frontend (e.g. app.tailorsystem.com)."
  type        = string
  default     = ""
}

variable "cloudfront_acm_certificate_arn" {
  description = "ACM Certificate ARN in us-east-1 for CloudFront custom domain HTTPS. Leave empty to use default *.cloudfront.net certificate."
  type        = string
  default     = ""
}

# ==============================================================================
# CI/CD Deployment & GitHub Actions OIDC Configuration
# ==============================================================================

variable "github_repository" {
  description = "Exact GitHub repository ('owner/repo') allowed to assume the deploy role via OIDC. Wildcards are rejected."
  type        = string
  default     = "mahadevlambadi25/Tailor-Management-platform"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must be an exact 'owner/repo' value; wildcards are not allowed."
  }
}

variable "github_deploy_branch" {
  description = "The only branch whose GitHub Actions runs may assume the deploy role (must match the deploy workflow trigger)."
  type        = string
  default     = "main"

  validation {
    condition     = can(regex("^[A-Za-z0-9_./-]+$", var.github_deploy_branch))
    error_message = "github_deploy_branch must be an exact branch name; wildcards are not allowed."
  }
}

# ==============================================================================
# Secrets Manager & Optional Third-Party Credentials
# ==============================================================================

variable "secrets_recovery_window_in_days" {
  description = "Days a deleted Secrets Manager secret stays recoverable (7-30). Protects against accidental 'tofu destroy'."
  type        = number
  default     = 7

  validation {
    condition     = var.secrets_recovery_window_in_days >= 7 && var.secrets_recovery_window_in_days <= 30
    error_message = "secrets_recovery_window_in_days must be between 7 and 30."
  }
}

# Leave empty until real credentials exist. Empty values are NOT written to Secrets Manager and NOT
# injected into ECS; the backend then fails closed (payment/webhook signature checks reject requests).
# Supply via TF_VAR_* environment variables, never in a committed file.
variable "razorpay_key_id" {
  description = "Razorpay key ID (rzp_live_... or rzp_test_...). Optional."
  type        = string
  default     = ""
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay key secret. Optional."
  type        = string
  default     = ""
  sensitive   = true
}

variable "razorpay_webhook_secret" {
  description = "Razorpay webhook signing secret. Optional."
  type        = string
  default     = ""
  sensitive   = true
}

variable "whatsapp_verify_token" {
  description = "Meta WhatsApp webhook verify token. Optional."
  type        = string
  default     = ""
  sensitive   = true
}

variable "whatsapp_app_secret" {
  description = "Meta WhatsApp app secret used to verify webhook signatures. Optional."
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_github_oidc_provider" {
  description = "Whether to create the GitHub Actions OIDC provider in the AWS account if it does not already exist."
  type        = bool
  default     = true
}

variable "github_oidc_provider_arn" {
  description = "Optional existing GitHub Actions OIDC provider ARN if already registered in the AWS account."
  type        = string
  default     = ""
}
