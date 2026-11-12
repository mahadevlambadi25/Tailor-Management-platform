# ==============================================================================
# Least-Privilege Security Groups
# ==============================================================================

# ALB Security Group: Public Ingress
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Controls public inbound traffic to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # HTTP Ingress
  ingress {
    description = "Allow inbound HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS Ingress
  ingress {
    description = "Allow inbound HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to ECS Tasks
  egress {
    description = "Allow outbound traffic to ECS tasks on application port"
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = local.ecs_subnet_cidrs # subnets where ECS tasks actually run (see vpc.tf)
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

# ECS Tasks Security Group: Isolated Private Ingress
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Allows inbound traffic only from the ALB and outbound internet egress via NAT"
  vpc_id      = aws_vpc.main.id

  # Inbound strictly from ALB Security Group
  ingress {
    description     = "Allow inbound HTTP from ALB only"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound Egress to Internet via NAT Gateway (for Supabase DB pooler 6543/5432 and HTTPS APIs)
  egress {
    description = "Allow outbound traffic to Supabase, external APIs, and AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  }
}
