# Provider configuration for GCP
# version: ~> 4.0
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

# Local variables for resource naming consistency
locals {
  network_name = var.network_name
  subnet_name  = "${var.network_name}-subnet"
  router_name  = "${var.network_name}-router"
  nat_name     = "${var.network_name}-nat"
}

# VPC Network with enhanced security configuration
resource "google_compute_network" "vpc_network" {
  name                            = local.network_name
  project                         = var.project_id
  auto_create_subnetworks        = false
  routing_mode                   = "REGIONAL"
  delete_default_routes_on_create = true
  mtu                            = 1460
}

# Private subnet with secondary ranges for Kubernetes
resource "google_compute_subnetwork" "private_subnet" {
  name                     = local.subnet_name
  network                  = google_compute_network.vpc_network.id
  region                   = var.region
  project                  = var.project_id
  ip_cidr_range           = var.subnet_cidr
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pod-range"
    ip_cidr_range = var.pod_cidr
  }

  secondary_ip_range {
    range_name    = "service-range"
    ip_cidr_range = var.service_cidr
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling       = 0.5
    metadata           = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT gateway
resource "google_compute_router" "router" {
  name    = local.router_name
  network = google_compute_network.vpc_network.id
  region  = var.region
  project = var.project_id

  bgp {
    asn = 64514
    advertise_mode = "CUSTOM"
    advertised_groups = ["ALL_SUBNETS"]
  }
}

# Cloud NAT configuration with logging and optimized settings
resource "google_compute_router_nat" "nat_gateway" {
  name                               = local.nat_name
  router                            = google_compute_router.router.name
  region                            = var.region
  project                           = var.project_id
  nat_ip_allocate_option           = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  min_ports_per_vm                  = 64
  udp_idle_timeout_sec              = 30
  tcp_established_idle_timeout_sec   = 1200

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Internal firewall rules with zero-trust model
resource "google_compute_firewall" "internal_rules" {
  name        = "${var.network_name}-internal"
  network     = google_compute_network.vpc_network.id
  project     = var.project_id
  description = "Internal firewall rules following zero-trust security model"
  
  source_ranges = var.allowed_internal_ranges
  
  allow {
    protocol = "tcp"
    ports    = ["443", "8080", "9090"]
  }

  allow {
    protocol = "udp"
    ports    = ["53"]
  }

  allow {
    protocol = "icmp"
  }

  priority = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Outputs for reference by other modules
output "network_id" {
  description = "The ID of the VPC network"
  value       = google_compute_network.vpc_network.id
}

output "subnet_id" {
  description = "The ID of the private subnet"
  value       = google_compute_subnetwork.private_subnet.id
}

output "nat_ip" {
  description = "The NAT gateway IP addresses"
  value       = google_compute_router_nat.nat_gateway.nat_ips
}