// src/core/auth/sso/dto/sso-config.dto.ts

import { IsString, IsBoolean, IsOptional, IsEmail, IsUrl } from 'class-validator';

export class SsoConfigDto {
  @IsString()
  tenant_id: string;

  @IsString()
  provider: string;

  @IsString()
  @IsOptional()
  display_name?: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class AzureAdConfigDto {
  @IsString()
  azure_tenant_id: string;

  @IsString()
  azure_client_id: string;

  @IsString()
  azure_client_secret: string;

  @IsUrl()
  @IsOptional()
  azure_issuer_url?: string;

  @IsUrl()
  @IsOptional()
  callback_url?: string;
}

export class SsoTestDto {
  @IsString()
  @IsOptional()
  tenant_id?: string;

  @IsString()
  @IsOptional()
  test_type?: string;
}

export class SsoUserDto {
  @IsString()
  id: string;

  @IsString()
  tenant_id: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  job_title?: string;

  @IsString()
  @IsOptional()
  employee_code?: string;

  @IsString()
  status: string;
}

export class TenantDomainDto {
  @IsString()
  tenant_id: string;

  @IsString()
  domain: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}