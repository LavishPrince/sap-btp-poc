data "cloudfoundry_domain" "default_shared" {
  name = "cfapps.us10-001.hana.ondemand.com" # Replace with your specific platform's shared domain name
}

resource "cloudfoundry_route" "keycloak_route" {
  space  = cloudfoundry_space.app_space.id
  domain = data.cloudfoundry_domain.default_shared.id
  host   = "keycloak-dev"
}
resource "cloudfoundry_route" "sap_poc_app" {
  space  = cloudfoundry_space.app_space.id
  domain = data.cloudfoundry_domain.default_shared.id
  host   = "sap-poc-app"
}
resource "cloudfoundry_route" "sap_poc_api" {
  space  = cloudfoundry_space.app_space.id
  domain = data.cloudfoundry_domain.default_shared.id
  host   = "sap-poc-api"
}

# Define your slim Keycloak App
resource "cloudfoundry_app" "keycloak" {
  name         = "keycloak-slim"
  docker_image = "quay.io/keycloak/keycloak:latest"

  health_check_type = "process" # Force a network port check
  space_name        = cloudfoundry_space.app_space.name
  org_name          = jsondecode(btp_subaccount_environment_instance.cloudfoundry.labels)["Org Name"]
  instances         = 1
  memory            = "1024M"
  disk_quota        = "1024M"

  command = "/opt/keycloak/bin/kc.sh start --http-port=$PORT --http-enabled=true --proxy-headers=xforwarded --hostname-strict=false"


  #   service_bindings = [
  #     {
  #         service_instance = cloudfoundry_service_instance.postgres_instance.name
  #         params           = jsonencode({})
  #     }
  #   ]

  environment = {
    KC_DB                   = "postgres"
    KC_DB_SCHEMA            = "keycloak"
    KC_DB_USERNAME          = jsondecode(cloudfoundry_service_credential_binding.postgres_key.credential_binding).credentials.username
    KC_DB_PASSWORD          = jsondecode(cloudfoundry_service_credential_binding.postgres_key.credential_binding).credentials.password
    KC_DB_URL_HOST          = jsondecode(cloudfoundry_service_credential_binding.postgres_key.credential_binding).credentials.hostname
    KC_DB_URL_PORT          = jsondecode(cloudfoundry_service_credential_binding.postgres_key.credential_binding).credentials.port
    KC_DB_URL_DATABASE      = jsondecode(cloudfoundry_service_credential_binding.postgres_key.credential_binding).credentials.dbname
    KEYCLOAK_ADMIN          = "admin"
    KEYCLOAK_ADMIN_PASSWORD = "StrongSecurePassword123!"
    KC_LOG_LEVEL            = "INFO"
  }

  routes = [{
    route = cloudfoundry_route.keycloak_route.url
  }]
}

resource "cloudfoundry_service_credential_binding" "postgres_key" {
  name             = "keycloak-db-credentials"
  type             = "key" # Breaks the cycle (does not require app ID)
  service_instance = cloudfoundry_service_instance.postgres_instance.id
}