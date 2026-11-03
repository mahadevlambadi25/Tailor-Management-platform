# ==============================================================================
# IAM Roles & Policies for ECS Fargate & EventBridge
# ==============================================================================

# 1. ECS Task Execution Role (Used by ECS agent to pull images & fetch secrets)
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-execution-role"
  }
}

# Attach standard AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy allowing ECS execution role to read secrets from AWS Secrets Manager
resource "aws_iam_policy" "ecs_secrets_policy" {
  name        = "${var.project_name}-${var.environment}-ecs-secrets-policy"
  description = "Allows ECS tasks to read environment secrets from AWS Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn,
          "${aws_secretsmanager_secret.app_secrets.arn}*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_secrets_policy.arn
}

# 2. ECS Task Role (Used by the Node.js application process at runtime)
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-role"
  }
}

# 3. EventBridge Scheduler Role (Allows EventBridge to invoke ecs:RunTask)
resource "aws_iam_role" "eventbridge_invocation_role" {
  name = "${var.project_name}-${var.environment}-eventbridge-ecs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-eventbridge-ecs-role"
  }
}

resource "aws_iam_policy" "eventbridge_run_task_policy" {
  name        = "${var.project_name}-${var.environment}-eventbridge-run-task-policy"
  description = "Allows EventBridge to trigger scheduled Fargate tasks"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:*:task-definition/${var.project_name}-${var.environment}-nudge-worker:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_execution_role.arn,
          aws_iam_role.ecs_task_role.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eventbridge_run_task_attach" {
  role       = aws_iam_role.eventbridge_invocation_role.name
  policy_arn = aws_iam_policy.eventbridge_run_task_policy.arn
}
