# ==============================================================================
# AWS Secrets Manager for Production Credentials
# ==============================================================================

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/${var.environment}/backend-secrets"
  description             = "Production environment secrets for Tailor Management System backend"
  recovery_window_in_days = 0 # Immediate deletion on destroy for dev/testing ease

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets"
  }
}

# Initial placeholder secret value (replace with live production credentials via AWS Console / CLI)
resource "aws_secretsmanager_secret_version" "initial_placeholder" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL            = "postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    DIRECT_URL              = "postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    JWT_SECRET              = "CHANGE_ME_PRODUCTION_JWT_SECRET_32_CHARS_MIN"
    JWT_REFRESH_SECRET      = "CHANGE_ME_PRODUCTION_JWT_REFRESH_SECRET_32_CHARS"
    RAZORPAY_KEY_ID         = "rzp_test_placeholder"
    RAZORPAY_KEY_SECRET     = "placeholder_razorpay_secret"
    RAZORPAY_WEBHOOK_SECRET = "placeholder_razorpay_webhook_secret"
    WHATSAPP_VERIFY_TOKEN   = "tailor_whatsapp_verify_token_prod"
    WHATSAPP_APP_SECRET     = "tailor_whatsapp_app_secret_prod"
  })

  lifecycle {
    ignore_changes = [secret_string] # Prevents OpenTofu from overwriting manually updated secrets
  }
}
