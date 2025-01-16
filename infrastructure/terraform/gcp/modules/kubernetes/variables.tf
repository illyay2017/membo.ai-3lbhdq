# Cluster Naming
variable "cluster_name_prefix" {
  type        = string
  description = "Prefix for the GKE cluster name"
  default     = "membo"

  validation {
    condition     = length(var.cluster_name_prefix) > 0
    error_message = "Cluster name prefix must not be empty"
  }
}

# Network Configuration
variable "vpc_network" {
  type        = string
  description = "Name of the VPC network for GKE cluster"

  validation {
    condition     = length(var.vpc_network) > 0
    error_message = "VPC network name must not be empty"
  }
}

variable "cluster_secondary_range_name" {
  type        = string
  description = "Secondary IP range name for pods"
  default     = "pods"
}

variable "services_secondary_range_name" {
  type        = string
  description = "Secondary IP range name for services"
  default     = "services"
}

# Cluster Version Management
variable "cluster_version" {
  type        = string
  description = "GKE cluster version"
  default     = "1.27"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.cluster_version))
    error_message = "Cluster version must be in format X.Y"
  }
}

variable "release_channel" {
  type        = string
  description = "Release channel for GKE cluster version updates"
  default     = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE"], var.release_channel)
    error_message = "Release channel must be one of: RAPID, REGULAR, STABLE"
  }
}

# Security Features
variable "enable_workload_identity" {
  type        = bool
  description = "Enable Workload Identity for GKE cluster"
  default     = true
}

variable "enable_network_policy" {
  type        = bool
  description = "Enable Calico network policy for GKE cluster"
  default     = true
}

variable "master_authorized_networks" {
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  description = "List of master authorized networks"
  default     = []
}

# Maintenance Configuration
variable "maintenance_window_start" {
  type        = string
  description = "Start time for maintenance window in RFC3339 format"
  default     = "2023-01-01T00:00:00Z"
}

variable "maintenance_window_end" {
  type        = string
  description = "End time for maintenance window in RFC3339 format"
  default     = "2023-01-01T04:00:00Z"
}

variable "maintenance_recurrence" {
  type        = string
  description = "RFC5545 RRULE for maintenance window recurrence"
  default     = "FREQ=WEEKLY;BYDAY=SA,SU"
}

# Node Pool Configuration
variable "node_pools" {
  type = map(object({
    min_count     = number
    max_count     = number
    machine_type  = string
    disk_size_gb  = number
    disk_type     = string
    auto_repair   = bool
    auto_upgrade  = bool
    preemptible   = bool
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Configuration for GKE node pools"
  default = {
    frontend-pool = {
      min_count     = 2
      max_count     = 10
      machine_type  = "e2-standard-2"
      disk_size_gb  = 100
      disk_type     = "pd-standard"
      auto_repair   = true
      auto_upgrade  = true
      preemptible   = false
      labels = {
        pool        = "frontend"
        environment = "production"
      }
      taints = []
    }
    api-pool = {
      min_count     = 3
      max_count     = 15
      machine_type  = "e2-standard-4"
      disk_size_gb  = 100
      disk_type     = "pd-ssd"
      auto_repair   = true
      auto_upgrade  = true
      preemptible   = false
      labels = {
        pool        = "api"
        environment = "production"
      }
      taints = []
    }
    worker-pool = {
      min_count     = 2
      max_count     = 8
      machine_type  = "e2-standard-2"
      disk_size_gb  = 100
      disk_type     = "pd-standard"
      auto_repair   = true
      auto_upgrade  = true
      preemptible   = true
      labels = {
        pool        = "worker"
        environment = "production"
      }
      taints = []
    }
  }
}