import type { PositionPayload, PositionRecord } from "./types";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "请求失败");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchPositions() {
  const response = await fetch("/api/positions");
  return parseResponse<PositionRecord[]>(response);
}

export async function createPosition(payload: PositionPayload) {
  const response = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PositionRecord>(response);
}

export async function updatePosition(id: string, payload: PositionPayload) {
  const response = await fetch(`/api/positions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PositionRecord>(response);
}

export async function deletePosition(id: string) {
  const response = await fetch(`/api/positions/${id}`, { method: "DELETE" });
  return parseResponse<void>(response);
}
