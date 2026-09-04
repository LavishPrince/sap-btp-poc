resource "cloudfoundry_service_instance" "postgres_instance" {
  name                  = "database"
  space                 = cloudfoundry_space.app_space.id
  service_offering_name = "postgresql-db"
  service_plan_name     = "trial"
  type                  = "managed"
  parameters = jsonencode({
    engine_version = "17"
  })
  lifecycle {
    prevent_destroy = true
  }
  depends_on = [cloudfoundry_space_role.manager_role]
}

resource "cloudfoundry_service_credential_binding" "db_key" {
  name             = "ext_key"
  service_instance = cloudfoundry_service_instance.postgres_instance.id
  type             = "key"
}

data "archive_file" "bridge_zip" {
  type        = "zip"
  source_file = "${path.module}/run.sh"
  output_path = "${path.module}/bridge.zip"
}

resource "cloudfoundry_app" "tunnel_bridge" {
  name              = "db-tunnel-bridge"
  space_name        = cloudfoundry_space.app_space.name
  org_name          = jsondecode(btp_subaccount_environment_instance.cloudfoundry.labels)["Org Name"]
  instances         = 1
  memory            = "64M"
  disk_quota        = "64M"
  enable_ssh        = true
  path              = data.archive_file.bridge_zip.output_path
  source_code_hash  = data.archive_file.bridge_zip.output_base64sha256 # Triggers updates if run.sh changes
  command           = "bash run.sh"
  health_check_type = "process"
  buildpacks        = ["binary_buildpack"]
}

# cf ssh -L 5432:postgres-9f1fe7bf-937d-418c-b9a2-a60fbdadca16.cqryblsdrbcs.us-east-1.rds.amazonaws.com:3684 db-tunnel-bridge