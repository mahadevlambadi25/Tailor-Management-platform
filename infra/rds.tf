# ==============================================================================
# Amazon RDS PostgreSQL Database Instance & Networking
# ==============================================================================

# Database Subnet Group across Multi-AZ Private Database Subnets
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet-group"
  description = "Database subnet group for ${var.project_name} RDS PostgreSQL"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# Dedicated RDS Security Group: Ingress restricted strictly to ECS Tasks
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Controls access to RDS PostgreSQL instance strictly from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL port 5432 ingress strictly from ECS task security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# Secure random master password generation if not explicitly provided
resource "random_password" "db_password" {
  count            = var.db_password == "" ? 1 : 0
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  db_password = var.db_password != "" ? var.db_password : random_password.db_password[0].result
}

# Custom PostgreSQL 16 Parameter Group
resource "aws_db_parameter_group" "postgres16" {
  name        = "${var.project_name}-${var.environment}-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group for Tailor Management RDS PostgreSQL 16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot" # how AWS stores this parameter; avoids a perpetual plan diff
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "60000" # 60 seconds to release abandoned transactions
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pg16-params"
  }
}

# AWS RDS PostgreSQL Instance (Cost-conscious t4g.micro for initial launch)
resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  # Engine Specification (Compatible with Prisma v5.22.0)
  # Major version only: AWS picks the current default 16.x minor in ap-south-1 (16.3 is retired there)
  # and auto_minor_version_upgrade can move it forward without causing plan drift.
  engine         = "postgres"
  engine_version = "16"

  # Sizing & Storage
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage # Storage autoscaling up to 100 GB
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database Credentials & Port
  db_name  = var.db_name
  username = var.db_username
  password = local.db_password
  port     = 5432

  # Networking & Security
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  # Reliability, Backups & Maintenance
  multi_az              = var.db_multi_az
  backup_retention_period = var.db_backup_retention_period
  backup_window         = "02:00-03:00" # UTC
  maintenance_window    = "Mon:03:00-Mon:04:00" # UTC
  copy_tags_to_snapshot = true

  # Deletion Protection & Snapshots
  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-postgres-final-snapshot"

  # Upgrades & Performance
  auto_minor_version_upgrade            = true
  performance_insights_enabled         = true
  performance_insights_retention_period = 7 # Free tier retention (7 days)

  lifecycle {
    ignore_changes = [
      password,
      latest_restorable_time
    ]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

# Store RDS credentials and connection strings in AWS Secrets Manager
resource "aws_secretsmanager_secret" "rds_credentials" {
  name                    = "${var.project_name}/${var.environment}/rds-credentials"
  description             = "Master credentials and connection strings for ${var.project_name} RDS PostgreSQL"
  recovery_window_in_days = var.secrets_recovery_window_in_days

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "rds_credentials" {
  secret_id = aws_secretsmanager_secret.rds_credentials.id

  secret_string = jsonencode({
    engine       = "postgres"
    host         = aws_db_instance.postgres.address
    port         = aws_db_instance.postgres.port
    username     = var.db_username
    password     = local.db_password
    database     = var.db_name
    DATABASE_URL = "postgresql://${var.db_username}:${urlencode(local.db_password)}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require"
    DIRECT_URL   = "postgresql://${var.db_username}:${urlencode(local.db_password)}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require"
  })

  lifecycle {
    ignore_changes = [
      secret_string
    ]
  }
}

