# Project configuration
variable "project_id" {
  type        = string
  description = "The GCP project ID where networking resources will be created"
  validation {
    condition     = length(var.project_id) > 0 && can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens"
  }
}

# Regional configuration
variable "region" {
  type        = string
  description = "Primary GCP region for networking resources deployment"
  default     = "us-central1"
  validation {
    condition     = can(regex("^[a-z]+-[a-z]+\\d+$", var.region))
    error_message = "Region must be a valid GCP region name"
  }
}

variable "secondary_regions" {
  type        = list(string)
  description = "List of secondary regions for high availability deployment"
  default     = ["us-east1", "us-west1"]
  validation {
    condition     = alltrue([for r in var.secondary_regions : can(regex("^[a-z]+-[a-z]+\\d+$", r))])
    error_message = "All secondary regions must be valid GCP region names"
  }
}

# Network configuration
variable "network_name" {
  type        = string
  description = "Name of the VPC network to be created"
  default     = "membo-vpc"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,62}[a-z0-9]$", var.network_name))
    error_message = "Network name must start with a letter, end with a letter or number, and be 1-63 characters"
  }
}

variable "subnet_cidr" {
  type        = string
  description = "CIDR range for the private subnet"
  default     = "10.0.0.0/20"
  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0)) && split("/", var.subnet_cidr)[1] >= 16 && split("/", var.subnet_cidr)[1] <= 24
    error_message = "Subnet CIDR must be a valid IPv4 CIDR block between /16 and /24"
  }
}

variable "pod_cidr" {
  type        = string
  description = "CIDR range for Kubernetes pods"
  default     = "10.1.0.0/16"
  validation {
    condition     = can(cidrhost(var.pod_cidr, 0)) && split("/", var.pod_cidr)[1] >= 16 && split("/", var.pod_cidr)[1] <= 20
    error_message = "Pod CIDR must be a valid IPv4 CIDR block between /16 and /20"
  }
}

variable "service_cidr" {
  type        = string
  description = "CIDR range for Kubernetes services"
  default     = "10.2.0.0/16"
  validation {
    condition     = can(cidrhost(var.service_cidr, 0)) && split("/", var.service_cidr)[1] >= 16 && split("/", var.service_cidr)[1] <= 20
    error_message = "Service CIDR must be a valid IPv4 CIDR block between /16 and /20"
  }
}

variable "allowed_internal_ranges" {
  type        = list(string)
  description = "List of CIDR ranges allowed for internal communication following zero-trust model"
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
  validation {
    condition     = alltrue([for cidr in var.allowed_internal_ranges : can(cidrhost(cidr, 0))])
    error_message = "All internal ranges must be valid IPv4 CIDR blocks"
  }
}

# Cloud NAT configuration
variable "enable_cloud_nat" {
  type        = bool
  description = "Enable Cloud NAT for private instance internet access"
  default     = true
}

variable "nat_ip_allocate_option" {
  type        = string
  description = "How external IPs should be allocated for Cloud NAT"
  default     = "AUTO_ONLY"
  validation {
    condition     = contains(["AUTO_ONLY", "MANUAL_ONLY"], var.nat_ip_allocate_option)
    error_message = "NAT IP allocation must be either AUTO_ONLY or MANUAL_ONLY"
  }
}