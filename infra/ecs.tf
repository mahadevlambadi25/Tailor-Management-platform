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
        { name = "ENABLE_BACKGROUND_SCHEDULER", value = "false" }, # Suppressed on web fleet; handled by EventBridge
        { name = "STORAGE_PROVIDER", value = "local" },
        { name = "STORAGE_LOCAL_DIR", value = "./uploads" },
        { name = "DEFAULT_TENANT_SLUG", value = "royal-bespoke" },
        { name = "CONVERSION_V1", value = "true" }
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
        { name = "DIRECT_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DIRECT_URL::" },
        { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_REFRESH_SECRET::" },
        { name = "RAZORPAY_KEY_ID", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RAZORPAY_KEY_ID::" },
        { name = "RAZORPAY_KEY_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RAZORPAY_KEY_SECRET::" },
        { name = "RAZORPAY_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RAZORPAY_WEBHOOK_SECRET::" },
        { name = "WHATSAPP_VERIFY_TOKEN", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:WHATSAPP_VERIFY_TOKEN::" },
        { name = "WHATSAPP_APP_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:WHATSAPP_APP_SECRET::" }
      ]

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

# ECS Fargate Web Service
resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "backend-api"
    container_port   = var.container_port
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_standard
  ]

  lifecycle {
    ignore_changes = [task_definition] # Allows CI/CD deployment scripts to update image tags independently
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
