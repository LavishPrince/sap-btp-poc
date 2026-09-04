variable "keycloak_admin_username" { type = string }
variable "keycloak_admin_password" {
  type      = string
  sensitive = true
}
variable "keycloak_url" { type = string }

variable "realm_name" { type = string }
variable "realm_display_name" { type = string }

variable "client_id" { type = string }
variable "client_name" { type = string }

variable "valid_redirect_uris" { type = list(string) }
variable "web_origins" { type = list(string) }

variable "application_roles" { type = list(string) }
