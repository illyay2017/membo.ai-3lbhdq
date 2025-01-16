# Provider configuration for Google Cloud Platform
# hashicorp/google v4.0
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  database_name  = "membo"
  instance_name  = "membo-${var.environment}"
  common_labels = {
    project     = "membo-ai"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Primary PostgreSQL database instance
resource "google_sql_database_instance" "main" {
  name                = local.instance_name
  database_version    = var.database_version
  region             = var.region
  deletion_protection = true
  project            = var.project_id

  settings {
    tier              = var.database_tier
    availability_type = var.availability_type
    disk_size         = 100  # GB
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                    = "02:00"  # 2 AM UTC
      location                      = var.region
      backup_retention_settings {
        retained_backups = var.backup_retention_days
        retention_unit   = "COUNT"
      }
      point_in_time_recovery_enabled = var.enable_point_in_time_recovery
      transaction_log_retention_days = 7
    }

    maintenance_window {
      day          = var.maintenance_window_day
      hour         = var.maintenance_window_hour
      update_track = "stable"
    }

    ip_configuration {
      ipv4_enabled    = false  # Private IP only
      private_network = var.network_id
      require_ssl     = var.require_ssl
      ssl_mode        = "VERIFY_X509"
    }

    database_flags = var.database_flags

    insights_config {
      query_insights_enabled    = true
      query_string_length      = 1024
      record_application_tags  = true
      record_client_address    = false  # Privacy consideration
    }

    user_labels = local.common_labels
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Main application database
resource "google_sql_database" "main" {
  name      = local.database_name
  instance  = google_sql_database_instance.main.name
  charset   = "UTF8"
  collation = "en_US.UTF8"
  project   = var.project_id
}

# Outputs for other modules to consume
output "database_instance" {
  description = "The created database instance"
  value = {
    name              = google_sql_database_instance.main.name
    connection_name   = google_sql_database_instance.main.connection_name
    private_ip_address = google_sql_database_instance.main.private_ip_address
  }
  sensitive = true
}

output "database_name" {
  description = "The name of the created database"
  value       = google_sql_database.main.name
}