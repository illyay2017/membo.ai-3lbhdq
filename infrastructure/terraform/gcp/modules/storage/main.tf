# Provider configuration for Google Cloud Platform
# Version: ~> 4.0
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Local variables for common resource configurations
locals {
  common_labels = merge(
    var.labels,
    {
      managed-by   = "terraform"
      project      = "membo-ai"
      environment  = var.environment
    }
  )
}

# Static assets bucket configuration
resource "google_storage_bucket" "static_assets" {
  name          = "${var.project_id}-static-${var.environment}"
  location      = var.location
  storage_class = var.storage_class
  
  # Enable uniform bucket-level access for enhanced security
  uniform_bucket_level_access = true
  
  # Configure versioning based on variable
  versioning {
    enabled = var.enable_versioning
  }
  
  # CORS configuration for web access
  cors {
    origin          = var.cors_origins
    method          = var.cors_methods
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  # Apply common labels
  labels = local.common_labels
}

# Media storage bucket configuration
resource "google_storage_bucket" "media_storage" {
  name          = "${var.project_id}-media-${var.environment}"
  location      = var.location
  storage_class = var.storage_class
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = var.enable_versioning
  }
  
  # Lifecycle rule for media file management
  lifecycle_rule {
    condition {
      age = 90
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
  
  # CORS configuration for media uploads
  cors {
    origin          = var.cors_origins
    method          = ["GET", "PUT", "POST", "HEAD", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  labels = local.common_labels
}

# Backup storage bucket configuration
resource "google_storage_bucket" "backups" {
  name          = "${var.project_id}-backups-${var.environment}"
  location      = var.location
  storage_class = "NEARLINE"  # Cost-optimized storage for backups
  
  uniform_bucket_level_access = true
  
  # Always enable versioning for backups
  versioning {
    enabled = true
  }
  
  # Lifecycle rule for backup retention
  lifecycle_rule {
    condition {
      age = var.backup_retention_days
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
  
  labels = local.common_labels
}

# Output definitions for bucket details
output "static_bucket" {
  value = {
    name = google_storage_bucket.static_assets.name
    url  = "gs://${google_storage_bucket.static_assets.name}"
  }
  description = "Static assets bucket details"
}

output "media_bucket" {
  value = {
    name = google_storage_bucket.media_storage.name
    url  = "gs://${google_storage_bucket.media_storage.name}"
  }
  description = "Media storage bucket details"
}

output "backup_bucket" {
  value = {
    name = google_storage_bucket.backups.name
  }
  description = "Backup storage bucket name"
}