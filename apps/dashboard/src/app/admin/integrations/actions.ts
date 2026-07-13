"use server";

import { revalidatePath } from "next/cache";
import { CONNECTOR_TYPES, type ConnectorType } from "@mkh/shared";
import { getConnectorManager } from "@mkh/integrations";

function connectorFrom(formData: FormData): ConnectorType {
  const value = formData.get("connector");
  if (typeof value !== "string" || !CONNECTOR_TYPES.includes(value as ConnectorType)) {
    throw new Error(`Invalid connector: ${String(value)}`);
  }
  return value as ConnectorType;
}

/** Drains this connector's currently-due pending retry jobs — see ConnectorManager.retryAllPendingFor. */
export async function retryConnectorAction(formData: FormData): Promise<void> {
  const connector = connectorFrom(formData);
  await getConnectorManager().retryAllPendingFor(connector);
  revalidatePath("/admin/integrations");
}

/** Re-runs the connector's health check and, if unhealthy, disables it — see ConnectorManager.disableIfUnhealthy. */
export async function healthCheckAction(formData: FormData): Promise<void> {
  const connector = connectorFrom(formData);
  await getConnectorManager().disableIfUnhealthy(connector);
  revalidatePath("/admin/integrations");
}

export async function disableConnectorAction(formData: FormData): Promise<void> {
  const connector = connectorFrom(formData);
  getConnectorManager().disable(connector);
  revalidatePath("/admin/integrations");
}

export async function enableConnectorAction(formData: FormData): Promise<void> {
  const connector = connectorFrom(formData);
  getConnectorManager().enable(connector);
  revalidatePath("/admin/integrations");
}
