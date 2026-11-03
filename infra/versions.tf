terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50.0"
    }
  }

  # Uncomment and configure for remote state management in S3 + DynamoDB
  # backend "s3" {
  #   bucket         = "tailor-management-tofu-state-ap-south-1"
  #   key            = "production/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "tailor-management-tofu-locks"
  #   encrypt        = true
  # }
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
