-- CreateTable
CREATE TABLE "tenant_setting" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ja',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY',
    "decimal_separator" CHAR(1) NOT NULL DEFAULT '.',
    "thousand_separator" CHAR(1) NOT NULL DEFAULT ',',
    "approval_flow_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_po_enabled" BOOLEAN NOT NULL DEFAULT false,
    "session_timeout_mins" INTEGER NOT NULL DEFAULT 30,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_policy" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "min_length" INTEGER NOT NULL DEFAULT 8,
    "require_uppercase" BOOLEAN NOT NULL DEFAULT true,
    "require_lowercase" BOOLEAN NOT NULL DEFAULT true,
    "require_number" BOOLEAN NOT NULL DEFAULT true,
    "require_special" BOOLEAN NOT NULL DEFAULT true,
    "expire_days" INTEGER NOT NULL DEFAULT 90,
    "history_count" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "subdomain" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "subscription_plan" VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    "subscription_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "trial_ends_at" TIMESTAMP(3),
    "billing_email" VARCHAR(255),
    "billing_address_line1" VARCHAR(255),
    "billing_address_line2" VARCHAR(255),
    "billing_city" VARCHAR(100),
    "billing_state" VARCHAR(100),
    "billing_postal_code" VARCHAR(20),
    "billing_country" VARCHAR(50),
    "logo_url" VARCHAR(255),
    "max_users" INTEGER NOT NULL DEFAULT 50,
    "sso_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ip_range" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ip_range" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_ip_range_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_domain" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_email_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_feature" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "feature_name" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "parent_id" UUID,
    "manager_id" UUID,
    "cost_center" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emp_account" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_code" VARCHAR(50),
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "job_title" VARCHAR(100),
    "department_id" UUID,
    "manager_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "avatar_url" VARCHAR(255),
    "preferred_language" VARCHAR(10),
    "approval_limit" DECIMAL(15,2),
    "default_cost_center" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "emp_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_account" (
    "id" UUID NOT NULL,
    "emp_account_id" UUID NOT NULL,
    "auth_method" VARCHAR(20) NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "reset_token" VARCHAR(255),
    "reset_expires" TIMESTAMP(3),
    "provider" VARCHAR(50),
    "provider_user_id" VARCHAR(255),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(50),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "login_account_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" UUID NOT NULL,
    "login_account_id" UUID NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "user_agent" VARCHAR(255) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failure_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_configuration" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_configuration_setting" (
    "id" UUID NOT NULL,
    "sso_configuration_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configuration_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emp_account_role" (
    "id" UUID NOT NULL,
    "emp_account_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emp_account_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "user_role" VARCHAR(50),
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(255),
    "ip_address" VARCHAR(50) NOT NULL,
    "user_agent" VARCHAR(255),
    "request_summary" TEXT,
    "response_status" INTEGER,
    "severity" VARCHAR(10) NOT NULL DEFAULT 'LOW',
    "log_type" VARCHAR(50) NOT NULL,
    "execution_time" INTEGER,
    "is_privileged" BOOLEAN NOT NULL DEFAULT false,
    "additional_info" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_detail" (
    "id" UUID NOT NULL,
    "audit_log_id" UUID NOT NULL,
    "detail_type" VARCHAR(50) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_log_record" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "user_id" UUID,
    "summary" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolution_note" TEXT,

    CONSTRAINT "anomaly_log_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_log_detail" (
    "id" UUID NOT NULL,
    "anomaly_log_record_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_log_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_setting_tenant_id_key" ON "tenant_setting"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_policy_tenant_id_key" ON "password_policy"("tenant_id");

-- CreateIndex
CREATE INDEX "password_policy_tenant_id_idx" ON "password_policy"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subdomain_key" ON "tenant"("subdomain");

-- CreateIndex
CREATE INDEX "tenant_ip_range_tenant_id_idx" ON "tenant_ip_range"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_email_domain_tenant_id_idx" ON "tenant_email_domain"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_feature_tenant_id_idx" ON "tenant_feature"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_tenant_id_feature_name_key" ON "tenant_feature"("tenant_id", "feature_name");

-- CreateIndex
CREATE INDEX "department_tenant_id_idx" ON "department"("tenant_id");

-- CreateIndex
CREATE INDEX "department_parent_id_idx" ON "department"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_tenant_id_code_key" ON "department"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "emp_account_tenant_id_idx" ON "emp_account"("tenant_id");

-- CreateIndex
CREATE INDEX "emp_account_department_id_idx" ON "emp_account"("department_id");

-- CreateIndex
CREATE INDEX "emp_account_email_idx" ON "emp_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emp_account_tenant_id_email_key" ON "emp_account"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "emp_account_tenant_id_employee_code_key" ON "emp_account"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "login_account_emp_account_id_idx" ON "login_account"("emp_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "login_account_auth_method_identifier_provider_key" ON "login_account"("auth_method", "identifier", "provider");

-- CreateIndex
CREATE INDEX "refresh_token_login_account_id_idx" ON "refresh_token"("login_account_id");

-- CreateIndex
CREATE INDEX "refresh_token_token_hash_idx" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "login_history_login_account_id_idx" ON "login_history"("login_account_id");

-- CreateIndex
CREATE INDEX "login_history_created_at_idx" ON "login_history"("created_at");

-- CreateIndex
CREATE INDEX "sso_configuration_tenant_id_idx" ON "sso_configuration"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sso_configuration_tenant_id_provider_key" ON "sso_configuration"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "sso_configuration_setting_sso_configuration_id_idx" ON "sso_configuration_setting"("sso_configuration_id");

-- CreateIndex
CREATE UNIQUE INDEX "sso_configuration_setting_sso_configuration_id_key_key" ON "sso_configuration_setting"("sso_configuration_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_name_key" ON "permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_resource_action_key" ON "permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_tenant_id_name_key" ON "role"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "emp_account_role_emp_account_id_role_id_key" ON "emp_account_role"("emp_account_id", "role_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_resource_idx" ON "audit_log"("resource");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "audit_log_detail_audit_log_id_idx" ON "audit_log_detail"("audit_log_id");

-- CreateIndex
CREATE INDEX "audit_log_detail_detail_type_idx" ON "audit_log_detail"("detail_type");

-- CreateIndex
CREATE INDEX "anomaly_log_record_type_idx" ON "anomaly_log_record"("type");

-- CreateIndex
CREATE INDEX "anomaly_log_record_user_id_idx" ON "anomaly_log_record"("user_id");

-- CreateIndex
CREATE INDEX "anomaly_log_record_detected_at_idx" ON "anomaly_log_record"("detected_at");

-- CreateIndex
CREATE INDEX "anomaly_log_detail_anomaly_log_record_id_idx" ON "anomaly_log_detail"("anomaly_log_record_id");

-- AddForeignKey
ALTER TABLE "tenant_setting" ADD CONSTRAINT "tenant_setting_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_ip_range" ADD CONSTRAINT "tenant_ip_range_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_domain" ADD CONSTRAINT "tenant_email_domain_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_feature" ADD CONSTRAINT "tenant_feature_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp_account" ADD CONSTRAINT "emp_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp_account" ADD CONSTRAINT "emp_account_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp_account" ADD CONSTRAINT "emp_account_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "emp_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_account" ADD CONSTRAINT "login_account_emp_account_id_fkey" FOREIGN KEY ("emp_account_id") REFERENCES "emp_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_login_account_id_fkey" FOREIGN KEY ("login_account_id") REFERENCES "login_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_login_account_id_fkey" FOREIGN KEY ("login_account_id") REFERENCES "login_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_configuration" ADD CONSTRAINT "sso_configuration_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_configuration_setting" ADD CONSTRAINT "sso_configuration_setting_sso_configuration_id_fkey" FOREIGN KEY ("sso_configuration_id") REFERENCES "sso_configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp_account_role" ADD CONSTRAINT "emp_account_role_emp_account_id_fkey" FOREIGN KEY ("emp_account_id") REFERENCES "emp_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp_account_role" ADD CONSTRAINT "emp_account_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_detail" ADD CONSTRAINT "audit_log_detail_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "audit_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_log_detail" ADD CONSTRAINT "anomaly_log_detail_anomaly_log_record_id_fkey" FOREIGN KEY ("anomaly_log_record_id") REFERENCES "anomaly_log_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
