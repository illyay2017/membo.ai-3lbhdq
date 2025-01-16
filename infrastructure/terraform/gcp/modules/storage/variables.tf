# Project identification variable
variable "project_id" {
  type        = string
  description = "The GCP project ID where storage resources will be created"
  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID must not be empty"
  }
}

# Environment specification
variable "environment" {
  type        = string
  description = "Deployment environment (production or staging)"
  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "Environment must be either production or staging"
  }
}

# Geographic location configuration
variable "location" {
  type        = string
  description = "GCP storage location for buckets"
  default     = "US-MULTI-REGION"
}

# Storage class specification
variable "storage_class" {
  type        = string
  description = "Storage class for buckets (STANDARD, NEARLINE, COLDLINE, ARCHIVE)"
  default     = "STANDARD"
  validation {
    condition     = contains(["STANDARD", "NEARLINE", "COLDLINE", "ARCHIVE"], var.storage_class)
    error_message = "Storage class must be one of: STANDARD, NEARLINE, COLDLINE, ARCHIVE"
  }
}

# Object versioning configuration
variable "enable_versioning" {
  type        = bool
  description = "Enable object versioning for buckets"
  default     = true
}

# Backup retention configuration
variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backup files"
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention days must be between 1 and 365"
  }
}

# CORS configuration - Origins
variable "cors_origins" {
  type        = list(string)
  description = "List of origins allowed for CORS"
  default     = ["*"]
}

# CORS configuration - Methods
variable "cors_methods" {
  type        = list(string)
  description = "List of HTTP methods allowed for CORS"
  default     = ["GET", "HEAD", "OPTIONS"]
}

# Resource labeling configuration
variable "labels" {
  type        = map(string)
  description = "Labels to apply to storage buckets"
  default = {
    managed-by = "terraform"
    project    = "membo-ai"
  }
}