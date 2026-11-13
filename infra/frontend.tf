# ==============================================================================
# Frontend Hosting: Amazon S3 (Private Bucket) + CloudFront CDN + OAC
# ==============================================================================

data "aws_caller_identity" "current" {}

locals {
  frontend_bucket_name = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${var.project_name}-${var.environment}-frontend-${data.aws_caller_identity.current.account_id}"
  s3_origin_id         = "S3-${local.frontend_bucket_name}"
  alb_origin_id        = "ALB-${var.project_name}-${var.environment}"
}

# ------------------------------------------------------------------------------
# 1. Private S3 Bucket for Frontend Static Assets
# ------------------------------------------------------------------------------

resource "aws_s3_bucket" "frontend" {
  bucket        = local.frontend_bucket_name
  force_destroy = false

  tags = {
    Name = local.frontend_bucket_name
  }
}

# Enforce bucket owner ownership (disables ACLs)
resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Block all public access at the S3 bucket level
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback safety
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-Side Encryption at Rest (AES-256)
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ------------------------------------------------------------------------------
# 2. CloudFront Origin Access Control (OAC)
# ------------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-${var.environment}-frontend-oac"
  description                       = "Origin Access Control for ${var.project_name} frontend static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ------------------------------------------------------------------------------
# 3. S3 Bucket Policy: Access strictly granted to CloudFront Distribution
# ------------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# ------------------------------------------------------------------------------
# 4. CloudFront Function: React Router SPA fallback (S3 behavior only)
# ------------------------------------------------------------------------------
# Rewrites client-side routes (no file extension in the last path segment, e.g. /orders/123)
# to /index.html. Real files (/assets/app.js, /sw.js, /manifest.json) pass through unchanged,
# and a missing asset still returns its real error instead of HTML. Not attached to /api/*.

resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.project_name}-${var.environment}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite SPA client-side routes to /index.html"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var lastSegment = request.uri.substring(request.uri.lastIndexOf('/') + 1);
      if (lastSegment.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

# ------------------------------------------------------------------------------
# 5. Amazon CloudFront CDN Distribution
# ------------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} ${var.environment} Frontend SPA Distribution"
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  aliases             = var.frontend_custom_domain != "" ? [var.frontend_custom_domain] : []

  # S3 Static Assets Origin
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # ALB Dynamic API Origin (Routes /api/* directly to ECS backend via ALB)
  dynamic "origin" {
    for_each = var.enable_cloudfront_api_proxy ? [1] : []
    content {
      domain_name = aws_lb.main.dns_name
      origin_id   = local.alb_origin_id

      custom_origin_config {
        http_port                = 80
        https_port               = 443
        origin_protocol_policy   = var.acm_certificate_arn != "" ? "https-only" : "http-only"
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_keepalive_timeout = 60
        origin_read_timeout      = 60
      }
    }
  }

  # Default Cache Behavior (S3 Frontend Assets)
  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS Managed CachingOptimized policy ID
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # SPA routing on the S3 behavior only (see aws_cloudfront_function.spa_router)
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # Ordered Cache Behavior: Proxies /api/* requests to ALB without CORS restrictions
  dynamic "ordered_cache_behavior" {
    for_each = var.enable_cloudfront_api_proxy ? [1] : []
    content {
      path_pattern           = "/api/*"
      target_origin_id       = local.alb_origin_id
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      # AWS Managed CachingDisabled policy ID (no caching for dynamic REST APIs)
      cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

      # AWS Managed AllViewerExceptHostHeader origin request policy ID
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    }
  }

  # No distribution-wide custom_error_response: it would also rewrite /api/* 403/404 responses
  # from the backend into index.html with HTTP 200. SPA fallback is handled by spa_router instead.

  # SSL / HTTPS Configuration
  viewer_certificate {
    cloudfront_default_certificate = var.cloudfront_acm_certificate_arn == "" ? true : false
    acm_certificate_arn            = var.cloudfront_acm_certificate_arn != "" ? var.cloudfront_acm_certificate_arn : null
    ssl_support_method             = var.cloudfront_acm_certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.cloudfront_acm_certificate_arn != "" ? "TLSv1.2_2021" : null
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend-cf"
  }
}

