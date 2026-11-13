terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }

  # Remote state: private, versioned, AES-256 encrypted bucket (HTTPS-only policy).
  # State contains generated secrets (RDS password, JWT secrets) - never use local state.
  # use_lockfile = S3-native state locking (OpenTofu >= 1.10), no DynamoDB table needed.
  backend "s3" {
    bucket       = "tailor-management-tofu-state-885072868605"
    key          = "production/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TailorManagementSystem"
      Environment = var.environment
      ManagedBy   = "OpenTofu"
    }
  }
}
