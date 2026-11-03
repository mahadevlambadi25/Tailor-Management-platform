# ==============================================================================
# Application Load Balancer (ALB) & Target Group
# ==============================================================================

resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# ALB Target Group for ECS Fargate Tasks (target_type = "ip")
resource "aws_lb_target_group" "app" {
  name                 = "${var.project_name}-${var.environment}-tg"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30 # Matches Node.js server.close() draining window

  health_check {
    enabled             = true
    path                = "/ready" # Verifies both Express process and PostgreSQL connectivity
    port                = tostring(var.container_port)
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-tg"
  }
}

# HTTP Listener on Port 80
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.acm_certificate_arn != "" ? "redirect" : "forward"

    # If ACM cert exists, redirect 80 -> 443; otherwise forward directly to target group
    dynamic "redirect" {
      for_each = var.acm_certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = var.acm_certificate_arn == "" ? aws_lb_target_group.app.arn : null
  }
}

# HTTPS Listener on Port 443 (Active only when ACM Certificate ARN is supplied)
resource "aws_lb_listener" "https" {
  count             = var.acm_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
