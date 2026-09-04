terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
    }
  }
}

provider "keycloak" {
  client_id = "admin-cli"
  username  = var.keycloak_admin_username
  password  = var.keycloak_admin_password
  url       = var.keycloak_url
  client_timeout = 60
}

resource "keycloak_realm" "my_app_realm" {
  realm                = var.realm_name
  enabled              = true
  display_name         = var.realm_display_name
  ssl_required         = "external"
  login_theme          = "keycloak"
  registration_allowed = true
}

resource "keycloak_openid_client" "web_app_client" {
  realm_id              = keycloak_realm.my_app_realm.id
  client_id             = var.client_id
  name                  = var.client_name
  enabled               = true
  access_type           = "CONFIDENTIAL"
  standard_flow_enabled = true
  frontchannel_logout_enabled = true
  direct_access_grants_enabled = true

  valid_redirect_uris = var.valid_redirect_uris
  web_origins         = var.web_origins
}

resource "keycloak_role" "app_roles" {
  for_each    = toset(var.application_roles)
  realm_id    = keycloak_realm.my_app_realm.id
  name        = each.value
  description = "Managed role for ${each.value}"
}
