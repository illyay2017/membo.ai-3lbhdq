# Kubernetes cluster outputs
output "kubernetes_cluster_endpoint" {
  description = "The endpoint for accessing the Kubernetes cluster"
  value       = module.kubernetes.cluster_endpoint
}

output "kubernetes_cluster_ca_certificate" {
  description = "The cluster CA certificate (base64 encoded) for cluster authentication"
  value       = module.kubernetes.cluster_ca_certificate
  sensitive   = true
}

output "kubernetes_node_pools" {
  description = "Details of the node pools in the GKE cluster"
  value       = module.kubernetes.node_pools
}

# Database outputs
output "database_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = module.database.database_instance.connection_name
}

output "database_private_ip" {
  description = "The private IP address of the Cloud SQL instance"
  value       = module.database.database_instance.private_ip_address
  sensitive   = true
}

output "database_name" {
  description = "The name of the primary database"
  value       = module.database.database_name
}

# Network security outputs
output "master_authorized_networks" {
  description = "The list of CIDR blocks authorized to access the Kubernetes master"
  value       = module.kubernetes.cluster_id != "" ? var.master_authorized_networks : []
}

# Resource identifiers
output "gke_cluster_id" {
  description = "The unique identifier of the GKE cluster"
  value       = module.kubernetes.cluster_id
}

output "database_instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = module.database.database_instance.name
}

# Operational outputs
output "database_backup_enabled" {
  description = "Indicates if automated backups are enabled for the database"
  value       = true
}

output "database_availability_type" {
  description = "The availability type of the database instance (REGIONAL or ZONAL)"
  value       = var.database_availability_type
}

# Maintenance window information
output "database_maintenance_window" {
  description = "The maintenance window configuration for the database"
  value = {
    day  = var.database_maintenance_window_day
    hour = var.database_maintenance_window_hour
  }
}

output "cluster_maintenance_window" {
  description = "The maintenance window configuration for the GKE cluster"
  value = {
    start_time = var.maintenance_window_start
    end_time   = var.maintenance_window_end
    recurrence = var.maintenance_recurrence
  }
}

# Security configuration outputs
output "database_ssl_required" {
  description = "Indicates if SSL connections are required for database access"
  value       = var.require_ssl
}

output "cluster_network_policy_enabled" {
  description = "Indicates if Calico network policy is enabled on the cluster"
  value       = var.enable_network_policy
}

output "workload_identity_enabled" {
  description = "Indicates if Workload Identity is enabled on the cluster"
  value       = var.enable_workload_identity
}

# Resource locations
output "resource_locations" {
  description = "Geographic location of deployed resources"
  value = {
    gke_cluster = var.region
    database    = var.region
  }
}