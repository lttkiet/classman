import type { CenterRole } from "@prisma/client";
import type { ResourceName } from "@/lib/validation";

const managerRoles: CenterRole[] = ["OWNER", "MANAGER"];

export function canCreateResource(role: CenterRole, resource: ResourceName) {
  return managerRoles.includes(role) || ["sessions", "notes", "progress"].includes(resource);
}

export function canUpdateResource(role: CenterRole, resource: ResourceName) {
  return managerRoles.includes(role) || ["sessions", "notes", "assignments", "progress"].includes(resource);
}

export function canDeleteResource(role: CenterRole) {
  return managerRoles.includes(role);
}

export function canSeeAllCenterRecords(role: CenterRole) {
  return managerRoles.includes(role);
}
