# Provider and Terraform Configuration
terraform {
  required_version = ">= 1.0.0"
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

  backend "gcs" {
    bucket = "${var.project_id}-terraform-state"
    prefix = "terraform/state"
  }
}

# Provider Configuration
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"

  default_labels = local.common_labels
  request_timeout = "60s"
  user_project_override = true
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"

  default_labels = local.common_labels
  request_timeout = "60s"
  user_project_override = true
}

# Local Variables
locals {
  project_name = "membo-ai"
  common_labels = {
    project         = "membo-ai"
    environment     = var.environment
    managed_by      = "terraform"
    cost_center     = "infrastructure"
    security_level  = "high"
    compliance      = "gdpr"
    last_updated    = formatdate("YYYY-MM-DD", timestamp())
  }

  backup_config = {
    enabled         = true
    retention_days  = 30
    schedule        = "0 */4 * * *"
  }

  network_name = "${local.project_name}-${var.environment}-vpc"
  subnet_name  = "${local.project_name}-${var.environment}-subnet"
}

# Networking Module
module "networking" {
  source = "./modules/networking"
  
  project_id                  = var.project_id
  region                      = var.region
  environment                = var.environment
  network_name               = local.network_name
  subnet_name                = local.subnet_name
  enable_security_policy     = true
  enable_cloud_nat          = true
  enable_private_google_access = true
  
  vpc_config = {
    routing_mode             = "GLOBAL"
    auto_create_subnetworks = false
    mtu                     = 1460
  }

  subnet_config = {
    ip_cidr_range           = var.network_config.subnet_cidr
    enable_flow_logs        = var.network_config.enable_flow_logs
    private_ip_google_access = true
  }
}

# Kubernetes Module
module "kubernetes" {
  source = "./modules/kubernetes"
  
  project_id              = var.project_id
  region                  = var.region
  environment            = var.environment
  network_id             = module.networking.network_id
  subnet_id              = module.networking.subnet_id
  
  cluster_config = {
    name                  = "${local.project_name}-${var.environment}-gke"
    node_count           = var.environment == "production" ? 3 : 1
    machine_type         = var.environment == "production" ? "e2-standard-4" : "e2-standard-2"
    min_master_version   = "1.27"
    enable_autopilot     = false
  }

  security_config = {
    enable_workload_identity   = true
    enable_binary_authorization = true
    enable_network_policy      = true
    enable_shielded_nodes     = true
  }
}

# Database Module
module "database" {
  source = "./modules/database"
  
  project_id          = var.project_id
  region              = var.region
  environment        = var.environment
  network_id         = module.networking.network_id
  
  instance_config = {
    name              = "${local.project_name}-${var.environment}-db"
    database_version  = "POSTGRES_14"
    tier              = var.environment == "production" ? "db-custom-8-32768" : "db-custom-2-8192"
  }

  high_availability_config = {
    enable_replication = var.environment == "production"
    backup_region     = var.backup_region
    backup_retention_days = local.backup_config.retention_days
  }
}

# Storage Module
module "storage" {
  source = "./modules/storage"
  
  project_id          = var.project_id
  region              = var.region
  environment        = var.environment
  
  bucket_config = {
    static_bucket_name = "${local.project_name}-${var.environment}-static"
    media_bucket_name  = "${local.project_name}-${var.environment}-media"
    backup_bucket_name = "${local.project_name}-${var.environment}-backup"
  }

  security_config = {
    enable_versioning  = true
    enable_encryption  = true
    enable_object_lifecycle = true
    retention_period  = local.backup_config.retention_days
  }
}

# Outputs
output "kubernetes_cluster_endpoint" {
  description = "GKE cluster endpoints"
  value = {
    primary = module.kubernetes.cluster_endpoint
    backup  = module.kubernetes.backup_cluster_endpoint
  }
  sensitive = true
}

output "database_connection" {
  description = "Database connection details"
  value = {
    primary = module.database.database_instance
    replica = module.database.replica_instance
  }
  sensitive = true
}

output "storage_buckets" {
  description = "Storage bucket details"
  value = {
    static  = module.storage.static_bucket
    media   = module.storage.media_bucket
    backup  = module.storage.backup_bucket
  }
}

output "network_info" {
  description = "Network configuration details"
  value = {
    network_id = module.networking.network_id
    subnet_id  = module.networking.subnet_id
    security_policy_id = module.networking.security_policy_id
  }
}