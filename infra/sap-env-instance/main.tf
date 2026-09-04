terraform {
  required_providers {
    btp = {
      source = "SAP/btp"
    }
    cloudfoundry = {
      source = "cloudfoundry/cloudfoundry"
    }
  }
}

provider "btp" {
  globalaccount = "a00c450ctrial"
}


provider "cloudfoundry" {
  # OpenTofu pulls the API URL from the environment instance as soon as it's created
  api_url = jsondecode(btp_subaccount_environment_instance.cloudfoundry.labels)["API Endpoint"]
}

resource "btp_subaccount_environment_instance" "cloudfoundry" {
  subaccount_id    = "13e8a7a4-edd1-400d-9fee-f4ba78e0be10"
  name             = "api_service_${terraform.workspace}"
  environment_type = "cloudfoundry"
  service_name     = "cloudfoundry"
  plan_name        = "trial"
  # ATTENTION: some regions offer multiple environments of a kind and you must explicitly select the target environment in which
  # the instance shall be created using the parameter landscape label.
  # available environments can be looked up using the btp_subaccount_environments datasource
  parameters = jsonencode({
    instance_name = "api_service_${terraform.workspace}"
  })
}

resource "cloudfoundry_space" "app_space" {
  name = terraform.workspace
  org  = jsondecode(btp_subaccount_environment_instance.cloudfoundry.labels)["Org ID"]
}

resource "cloudfoundry_space_role" "manager_role" {
  username = "vinay.dg@quation.in"
  type     = "space_developer"
  space    = cloudfoundry_space.app_space.id
}
