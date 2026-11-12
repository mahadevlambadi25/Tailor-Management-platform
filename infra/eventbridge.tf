# ==============================================================================
# Amazon EventBridge Scheduled Task for Trial Nudge Worker
# ==============================================================================

# Task Definition for the Standalone Nudge Worker
resource "aws_ecs_task_definition" "nudge_worker" {
  family                   = "${var.project_name}-${var.environment}-nudge-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256" # 0.25 vCPU is sufficient for batch cycle evaluation
  memory                   = "512" # 512 MB RAM
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name         = "nudge-worker"
      image        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential    = true
      command      = ["node", "scripts/run-nudge-worker.js"] # Standalone entrypoint (runStandalone)

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "ENABLE_BACKGROUND_SCHEDULER", value = "false" },
        { name = "CONVERSION_V1", value = "true" }
      ]

      # Same sources as the web service: RDS URL from rds-credentials, JWT (required by config at
      # startup in production) and any configured third-party keys from backend-secrets
      secrets = concat(local.ecs_database_secrets, local.ecs_backend_secrets)

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "nudge-worker"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-nudge-worker-task"
  }
}

# EventBridge Rule: Triggers every 30 minutes between 08:30 and 21:00 IST (03:00 - 15:30 UTC)
resource "aws_cloudwatch_event_rule" "nudge_schedule" {
  name                = "${var.project_name}-${var.environment}-nudge-schedule"
  description         = "Triggers the standalone conversion trial nudge cycle every 30 minutes during shop hours"
  schedule_expression = "cron(0/30 3-15 ? * * *)" # UTC schedule mapping to IST daytime

  tags = {
    Name = "${var.project_name}-${var.environment}-nudge-schedule"
  }
}

# EventBridge Target: Invokes ECS Fargate RunTask
resource "aws_cloudwatch_event_target" "nudge_worker_target" {
  rule      = aws_cloudwatch_event_rule.nudge_schedule.name
  target_id = "TriggerNudgeWorker"
  arn       = aws_ecs_cluster.main.arn
  role_arn  = aws_iam_role.eventbridge_invocation_role.arn

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.nudge_worker.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = local.ecs_subnet_ids
      security_groups  = [aws_security_group.ecs_tasks.id]
      assign_public_ip = local.ecs_assign_public_ip
    }
  }
}
