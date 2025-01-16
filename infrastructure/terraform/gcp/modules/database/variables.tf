variable "database_version" {
  type        = string
  description = "PostgreSQL version for the Cloud SQL instance"
  default     = "POSTGRES_14"

  validation {
    condition     = can(regex("^POSTGRES_[0-9]+$", var.database_version))
    error_message = "Database version must be in format POSTGRES_XX"
  }
}

variable "database_tier" {
  type        = string
  description = "The machine type to use for the database instance"
  default     = "db-custom-4-16384"

  validation {
    condition     = can(regex("^db-.*", var.database_tier))
    error_message = "Database tier must start with db-"
  }
}

variable "availability_type" {
  type        = string
  description = "Availability type for the database instance (REGIONAL or ZONAL)"
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "ZONAL"], var.availability_type)
    error_message = "Availability type must be either REGIONAL or ZONAL"
  }
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups"
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days"
  }
}

variable "enable_point_in_time_recovery" {
  type        = bool
  description = "Enable point-in-time recovery for the database instance"
  default     = true
}

variable "network_id" {
  type        = string
  description = "VPC network ID where the database instance will be deployed"

  validation {
    condition     = length(var.network_id) > 0
    error_message = "Network ID must not be empty"
  }
}

variable "require_ssl" {
  type        = bool
  description = "Require SSL/TLS for all database connections"
  default     = true
}

variable "database_flags" {
  type = list(object({
    name  = string
    value = string
  }))
  description = "Database flags for instance configuration"
  default = [
    {
      name  = "log_min_duration_statement"
      value = "300"
    },
    {
      name  = "log_checkpoints"
      value = "on"
    }
  ]
}

variable "maintenance_window_day" {
  type        = number
  description = "Day of week for maintenance window (1-7)"
  default     = 7

  validation {
    condition     = var.maintenance_window_day >= 1 && var.maintenance_window_day <= 7
    error_message = "Maintenance window day must be between 1 and 7"
  }
}

variable "maintenance_window_hour" {
  type        = number
  description = "Hour of day for maintenance window (0-23)"
  default     = 23

  validation {
    condition     = var.maintenance_window_hour >= 0 && var.maintenance_window_hour <= 23
    error_message = "Maintenance window hour must be between 0 and 23"
  }
}