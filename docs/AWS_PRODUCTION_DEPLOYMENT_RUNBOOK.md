# Tailor Management System (TMS)
## AWS Production Deployment Runbook (ap-south-1)

This runbook guides you through deploying the Tailor Management System SaaS on **Amazon Web Services (ap-south-1 Mumbai)** using **OpenTofu / Terraform**, **Amazon ECS on AWS Fargate**, **Application Load Balancer (ALB)**, and **Amazon EventBridge**.

---

### Architecture Overview

- **Compute:** Amazon ECS on AWS Fargate (Serverless Containers).
- **Container Registry:** Amazon Elastic Container Registry (ECR).
- **Ingress & Routing:** Application Load Balancer (ALB) with `/ready` health checking.
- **Background Cron:** Amazon EventBridge triggering `scripts/run-nudge-worker.js`.
- **Database:** Supabase PostgreSQL (Transaction mode port `6543`, session mode port `5432`).
- **Secrets:** AWS Secrets Manager (`tailor-management/production/backend-secrets`).
- **Logs & Observability:** Amazon CloudWatch Logs (`/ecs/tailor-management-production-backend`).

---

### Step 1: Prerequisites

Ensure you have the following installed on your administrative machine:
1. **AWS CLI v2** (`aws --version`) configured with administrator credentials for `ap-south-1`:
   ```bash
   aws configure
   # Default region: ap-south-1
   # Default output: json
   ```
2. **OpenTofu** (`tofu --version` >= 1.6) or **Terraform** (`terraform --version` >= 1.5).
3. **Docker Engine / Desktop** (`docker --version`).

---

### Step 2: Provision Infrastructure with OpenTofu

Navigate to the `infra/` directory:

```bash
cd infra
```

1. **Initialize OpenTofu:**
   ```bash
   tofu init
   ```

2. **Review Execution Plan:**
   ```bash
   tofu plan
   ```

3. **Apply Infrastructure:**
   ```bash
   tofu apply -auto-approve
   ```

4. **Note Down the Outputs:**
   When OpenTofu completes, note the printed outputs:
   - `alb_dns_name`: Public URL of your load balancer (e.g. `tailor-management-prod-alb-123456789.ap-south-1.elb.amazonaws.com`).
   - `ecr_repository_url`: Image push URL (e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com/tailor-management-backend`).
   - `secrets_manager_name`: Name of the secret holding production credentials.

---

### Step 3: Populate Production Secrets in AWS Secrets Manager

Before launching tasks, populate the Secrets Manager secret with your actual Supabase credentials and JWT secrets:

```bash
aws secretsmanager put-secret-value \
  --secret-id "tailor-management/production/backend-secrets" \
  --region "ap-south-1" \
  --secret-string '{
    "DATABASE_URL": "postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
    "DIRECT_URL": "postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    "JWT_SECRET": "YOUR_STRONG_32_CHAR_JWT_SECRET_HERE",
    "JWT_REFRESH_SECRET": "YOUR_STRONG_32_CHAR_REFRESH_SECRET_HERE",
    "RAZORPAY_KEY_ID": "rzp_live_your_actual_key",
    "RAZORPAY_KEY_SECRET": "your_live_razorpay_secret",
    "RAZORPAY_WEBHOOK_SECRET": "your_razorpay_webhook_secret",
    "WHATSAPP_VERIFY_TOKEN": "your_meta_webhook_verify_token",
    "WHATSAPP_APP_SECRET": "your_meta_app_secret"
  }'
```

---

### Step 4: Build and Push Docker Container to Amazon ECR

Run the automated build & push script:

**On Windows (PowerShell):**
```powershell
.\deploy\build-and-push-ecr.ps1 -AwsRegion "ap-south-1"
```

**On Linux / macOS:**
```bash
chmod +x ./deploy/build-and-push-ecr.sh
./deploy/build-and-push-ecr.sh ap-south-1
```

This builds the multi-stage Dockerfile and pushes both the commit SHA tag and `latest` tag to your ECR repository.

---

### Step 5: Execute Pre-Flight Database Migrations

Run the database migration guard to ensure all indexes are valid and applied:

```bash
cd backend
node scripts/deploy-migrations.js
cd ..
```

---

### Step 6: Deploy to ECS Fargate (Zero Downtime)

Trigger a rolling update on the ECS Fargate cluster:

**On Windows (PowerShell):**
```powershell
.\deploy\deploy-ecs.ps1 -AwsRegion "ap-south-1"
```

**On Linux / macOS:**
```bash
chmod +x ./deploy/deploy-ecs.sh
./deploy/deploy-ecs.sh ap-south-1
```

This updates the running ECS service and waits until the new tasks pass the `/ready` health check on the ALB Target Group.

---

### Step 7: Verify Live Production Health

1. **Verify Liveness Probe:**
   ```bash
   curl -i http://<ALB_DNS_NAME>/health
   # Expected HTTP 200: {"status":"ok","version":"1.0.0",...}
   ```

2. **Verify Database Readiness Probe:**
   ```bash
   curl -i http://<ALB_DNS_NAME>/ready
   # Expected HTTP 200: {"status":"ready","database":"connected",...}
   ```

3. **Check CloudWatch Logs:**
   ```bash
   aws logs tail /ecs/tailor-management-production-backend --follow --region ap-south-1
   ```

4. **Verify Scheduled EventBridge Execution:**
   EventBridge will automatically invoke `scripts/run-nudge-worker.js` every 30 minutes during IST business hours. Verify its execution in CloudWatch logs under the `nudge-worker` log prefix.

---

### Rollback Procedure

If any issue occurs during deployment:
1. Revert to the previous stable Docker image tag in the ECS Task Definition:
   ```bash
   aws ecs update-service \
     --cluster tailor-management-production-cluster \
     --service tailor-management-production-service \
     --force-new-deployment \
     --region ap-south-1
   ```
2. Or roll back using OpenTofu:
   ```bash
   cd infra
   tofu apply -var="image_tag=PREVIOUS_STABLE_SHA"
   ```
