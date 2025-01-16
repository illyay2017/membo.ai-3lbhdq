# Provider configuration
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

# Primary GKE cluster resource
resource "google_container_cluster" "primary" {
  name     = "${var.cluster_name_prefix}-${var.region}"
  location = var.region
  network  = var.vpc_network

  # Enable Autopilot mode for simplified management
  enable_autopilot = false

  # Use VPC-native networking
  networking_mode = "VPC_NATIVE"
  
  # Configure IP allocation policy
  ip_allocation_policy {
    cluster_secondary_range_name  = var.cluster_secondary_range_name
    services_secondary_range_name = var.services_secondary_range_name
  }

  # Release channel configuration
  release_channel {
    channel = var.release_channel
  }

  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable network policy
  network_policy {
    enabled  = var.enable_network_policy
    provider = "CALICO"
  }

  # Configure maintenance window
  maintenance_policy {
    recurring_window {
      start_time = var.maintenance_window_start
      end_time   = var.maintenance_window_end
      recurrence = var.maintenance_recurrence
    }
  }

  # Configure private cluster settings
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block = "172.16.0.0/28"  # Reserved CIDR for master
  }

  # Configure master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1
}

# Node pools configuration
resource "google_container_node_pool" "pools" {
  for_each = var.node_pools

  name       = each.key
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = each.value.min_count

  # Autoscaling configuration
  autoscaling {
    min_node_count = each.value.min_count
    max_node_count = each.value.max_count
  }

  # Node configuration
  node_config {
    machine_type = each.value.machine_type
    disk_size_gb = each.value.disk_size_gb
    disk_type    = each.value.disk_type
    preemptible  = each.value.preemptible

    # Enable workload identity on nodes
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Labels
    labels = each.value.labels

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Dynamic taints
    dynamic "taint" {
      for_each = each.value.taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }
  }

  # Management configuration
  management {
    auto_repair  = each.value.auto_repair
    auto_upgrade = each.value.auto_upgrade
  }
}

# Outputs
output "cluster_id" {
  description = "The unique identifier of the GKE cluster"
  value       = google_container_cluster.primary.id
}

output "cluster_endpoint" {
  description = "The IP address of the GKE cluster master endpoint"
  value       = google_container_cluster.primary.endpoint
}

output "cluster_ca_certificate" {
  description = "The public certificate authority of the GKE cluster"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "node_pools" {
  description = "The list of node pools associated with the cluster"
  value = {
    for pool in google_container_node_pool.pools :
    pool.name => {
      name        = pool.name
      node_count  = pool.node_count
      machine_type = pool.node_config[0].machine_type
    }
  }
}