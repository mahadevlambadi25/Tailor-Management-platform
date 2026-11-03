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
  description = "Desired number of running ECS Web task instances."
  type        = number
  default     = 2
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

variable "enable_nat_gateway_per_az" {
  description = "Set to true for high-availability multi-NAT gateways (1 per AZ), or false for single NAT to save cost in staging."
  type        = bool
  default     = false
}
