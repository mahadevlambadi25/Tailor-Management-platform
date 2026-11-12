# ==============================================================================
# Amazon ECS Cluster, Task Definition & Fargate Service
# ==============================================================================

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

locals {
  cloudfront_frontend_url = "https://${aws_cloudfront_distribution.frontend.domain_name}"
  custom_frontend_url     = var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : ""

  # Browser-facing URL used for OAuth redirects (custom domain once configured, else CloudFront)
  primary_frontend_url = local.custom_frontend_url != "" ? local.custom_frontend_url : local.cloudfront_frontend_url

  # Browsers send Origin even on same-origin POSTs through the CloudFront /api/* proxy,
  # so the CloudFront domain itself must be allowed.
  frontend_origins = distinct(compact(concat(
    [local.cloudfront_frontend_url, local.custom_frontend_url],
    [for origin in split(",", var.cors_allowed_origins) : trimsuffix(trimspace(origin), "/")]
  )))

  # Proxy hops in front of Express: viewer -> CloudFront -> ALB -> task = 2; viewer -> ALB -> task = 1
  trust_proxy_hops = var.enable_cloudfront_api_proxy ? "2" : "1"
}

# Web API ECS Task Definition
resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-${var.environment}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.fargate_cpu)
  memory                   = tostring(var.fargate_memory)
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name         = "backend-api"
      image        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential    = true
      stopTimeout  = 30 # Allows 30 seconds for graceful SIGTERM HTTP draining before SIGKILL

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "CORS_ORIGIN", value = join(",", local.frontend_origins) },
        { name = "FRONTEND_URL", value = local.primary_frontend_url },
        { name = "GOOGLE_CALLBACK_URL", value = "${local.primary_frontend_url}/api/v1/auth/google/callback" },
        { name = "TRUST_PROXY", value = local.trust_proxy_hops },
        { name = "ENABLE_BACKGROUND_SCHEDULER", value = "false" }, # Suppressed on web fleet; handled by EventBridge
        # Local disk is ephemeral on Fargate. Safe today only because no route writes uploads
        # (storageService has no callers); switch to an S3 provider before enabling file uploads.
        { name = "STORAGE_PROVIDER", value = "local" },
        { name = "STORAGE_LOCAL_DIR", value = "./uploads" },
        { name = "DEFAULT_TENANT_SLUG", value = "royal-bespoke" },
        { name = "CONVERSION_V1", value = "true" }
      ]

      secrets = concat(local.ecs_database_secrets, local.ecs_backend_secrets)

      healthCheck = {
        command     = ["CMD-SHELL", "curl -fsS http://localhost:5000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web-api"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-web-task"
  }
}

# Database Migration One-Off ECS Task Definition (Runs inside private VPC)
resource "aws_ecs_task_definition" "migration" {
  family                   = "${var.project_name}-${var.environment}-db-migration"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "migration-runner"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true
      command   = ["node", "scripts/deploy-migrations.js"]

      environment = [
        { name = "NODE_ENV", value = "production" }
      ]

      secrets = local.ecs_database_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "db-migration"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-db-migration-task"
  }
}

# ECS Fargate Web Service
resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = local.ecs_assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "backend-api"
    container_port   = var.container_port
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Stop a failing rollout (crash loop, failing /ready) and roll back to the last healthy task definition
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_standard,
    aws_iam_role_policy_attachment.ecs_secrets_attach,
    # Secret values must exist before the first task tries to read them
    aws_secretsmanager_secret_version.rds_credentials,
    aws_secretsmanager_secret_version.backend
  ]

  lifecycle {
    # task_definition: CI/CD updates image tags independently
    # desired_count: owned by Application Auto Scaling after creation
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-service"
  }
}

# Auto Scaling: Target Tracking Policy based on CPU Utilization
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "${var.project_name}-${var.environment}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
