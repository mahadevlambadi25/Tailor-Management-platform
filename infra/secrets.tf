# ==============================================================================
# AWS Secrets Manager for Production Credentials
# ==============================================================================
#
# Two secrets feed the ECS tasks:
#   1. rds-credentials  (rds.tf)  -> DATABASE_URL / DIRECT_URL built from the real RDS endpoint
#   2. backend-secrets  (here)    -> JWT signing secrets (generated) + optional third-party keys
#
# No placeholder values are ever written. Optional third-party keys (Razorpay, WhatsApp) are only
# stored and injected when a real value is supplied via TF_VAR_*; otherwise the backend fails closed.
# Values live in OpenTofu state, so state MUST be kept in the encrypted remote S3 backend.

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = false
}

locals {
  optional_third_party_secrets = {
    RAZORPAY_KEY_ID         = var.razorpay_key_id
    RAZORPAY_KEY_SECRET     = var.razorpay_key_secret
    RAZORPAY_WEBHOOK_SECRET = var.razorpay_webhook_secret
    WHATSAPP_VERIFY_TOKEN   = var.whatsapp_verify_token
    WHATSAPP_APP_SECRET     = var.whatsapp_app_secret
  }

  # Names only (not values) are needed in plain text to build the ECS secret references
  configured_third_party_secret_names = sort([
    for name, value in local.optional_third_party_secrets : name if nonsensitive(value != "")
  ])

  backend_secret_names = concat(["JWT_SECRET", "JWT_REFRESH_SECRET"], local.configured_third_party_secret_names)

  backend_secret_values = merge(
    {
      JWT_SECRET         = random_password.jwt_secret.result
      JWT_REFRESH_SECRET = random_password.jwt_refresh_secret.result
    },
    { for name in local.configured_third_party_secret_names : name => local.optional_third_party_secrets[name] }
  )

  # ECS "secrets" entries shared by the web service and the nudge worker
  ecs_database_secrets = [
    { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.rds_credentials.arn}:DATABASE_URL::" },
    { name = "DIRECT_URL", valueFrom = "${aws_secretsmanager_secret.rds_credentials.arn}:DIRECT_URL::" }
  ]

  ecs_backend_secrets = [
    for name in local.backend_secret_names : { name = name, valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:${name}::" }
  ]
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/${var.environment}/backend-secrets"
  description             = "JWT signing secrets and optional third-party credentials for the Tailor Management System backend"
  recovery_window_in_days = var.secrets_recovery_window_in_days

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets"
  }
}

# Managed fully by OpenTofu: change values through TF_VAR_* and re-apply, then force a new ECS
# deployment so running tasks pick them up. Manual console edits will be overwritten on next apply.
resource "aws_secretsmanager_secret_version" "backend" {
  secret_id     = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode(local.backend_secret_values)
}
