# ==============================================================================
# VPC, Internet Gateway, Subnets, and NAT Gateway Setup (Multi-AZ ap-south-1)
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# Internet Gateway for Public Traffic (ALB Ingress & NAT Egress)
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# Public Subnets (for ALB & NAT Gateways)
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Type = "Public"
  }
}

# Private Application Subnets (for ECS Fargate Tasks & EventBridge Runners)
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-${var.environment}-private-${var.availability_zones[count.index]}"
    Type = "PrivateApp"
  }
}

# ------------------------------------------------------------------------------
# Where ECS tasks run
# ------------------------------------------------------------------------------
# enable_nat_gateway = false (lean): tasks run in PUBLIC subnets with a public IP for outbound
#   internet (ECR pulls, Secrets Manager, Razorpay/Meta APIs). Inbound is still restricted to the
#   ALB by the ecs_tasks security group. No NAT gateway, no Elastic IP.
# enable_nat_gateway = true: tasks run in PRIVATE subnets and egress through a NAT gateway.
locals {
  nat_gateway_count    = var.enable_nat_gateway ? (var.enable_nat_gateway_per_az ? length(var.public_subnet_cidrs) : 1) : 0
  ecs_subnet_ids       = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
  ecs_subnet_cidrs     = var.enable_nat_gateway ? var.private_subnet_cidrs : var.public_subnet_cidrs
  ecs_assign_public_ip = !var.enable_nat_gateway
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count  = local.nat_gateway_count
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.igw]
}

# NAT Gateway for Outbound Internet Egress from Private Subnets (Supabase DB & External Webhooks)
resource "aws_nat_gateway" "nat" {
  count         = local.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-gw-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.igw]
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Tables for Private Subnets
resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  # Default route only when a NAT gateway exists; otherwise these subnets (incl. RDS) stay fully private
  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = var.enable_nat_gateway_per_az ? aws_nat_gateway.nat[count.index].id : aws_nat_gateway.nat[0].id
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt-${var.availability_zones[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Private Database Subnets (for RDS PostgreSQL)
resource "aws_subnet" "database" {
  count                   = length(var.database_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.database_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "${var.project_name}-${var.environment}-database-${var.availability_zones[count.index]}"
    Type = "Database"
  }
}

# Route Table Association for Database Subnets
resource "aws_route_table_association" "database" {
  count          = length(var.database_subnet_cidrs)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
