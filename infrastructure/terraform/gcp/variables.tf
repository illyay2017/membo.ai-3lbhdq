# Project Configuration
variable "project_id" {
  type        = string
  description = "The GCP project ID where all resources will be created"
  validation {
    condition     = length(var.project_id) > 0 && can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens"
  }
}

# Regional Configuration
variable "region" {
  type        = string
  description = "Primary GCP region for resource deployment"
  default     = "us-central1"
  validation {
    condition     = can(regex("^[a-z]+-[a-z]+\\d+$", var.region))
    error_message = "Region must be a valid GCP region name (e.g., us-central1)"
  }
}

variable "backup_region" {
  type        = string
  description = "Secondary GCP region for disaster recovery"
  default     = "us-east1"
  validation {
    condition     = var.backup_region != var.region && can(regex("^[a-z]+-[a-z]+\\d+$", var.backup_region))
    error_message = "Backup region must be different from primary region and be a valid GCP region name"
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (production or staging)"
  default     = "production"
  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "Environment must be either production or staging"
  }
}

# High Availability Configuration
variable "enable_high_availability" {
  type        = bool
  description = "Enable high availability features across services"
  default     = true
}

# Resource Labeling
variable "resource_labels" {
  type        = map(string)
  description = "Common labels to be applied to all resources"
  default = {
    project        = "membo-ai"
    managed-by     = "terraform"
    environment    = "production"
    created-by     = "terraform"
    business-unit  = "engineering"
    cost-center    = "infrastructure"
  }
  validation {
    condition     = length(var.resource_labels) > 0
    error_message = "At least one resource label must be defined"
  }
}

# Terraform State Configuration
variable "terraform_state_bucket" {
  type        = string
  description = "GCS bucket name for storing Terraform state"
  default     = "membo-terraform-state-production"
  validation {
    condition     = can(regex("^[a-z0-9][-a-z0-9]*[a-z0-9]$", var.terraform_state_bucket))
    error_message = "State bucket name must conform to GCS naming requirements"
  }
}

# Network Configuration
variable "network_config" {
  type = object({
    vpc_name                    = string
    subnet_cidr                 = string
    enable_private_google_access = bool
    enable_flow_logs            = bool
  })
  description = "Network configuration parameters"
  default = {
    vpc_name                    = "membo-vpc-production"
    subnet_cidr                 = "10.0.0.0/20"
    enable_private_google_access = true
    enable_flow_logs            = true
  }
}

# Security Configuration
variable "security_config" {
  type = object({
    enable_cloud_armor              = bool
    enable_identity_aware_proxy     = bool
    enable_security_command_center  = bool
    allowed_ip_ranges              = list(string)
  })
  description = "Security-related configuration parameters"
  default = {
    enable_cloud_armor             = true
    enable_identity_aware_proxy    = true
    enable_security_command_center = true
    allowed_ip_ranges             = []
  }
}