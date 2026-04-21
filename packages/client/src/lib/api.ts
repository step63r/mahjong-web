export interface AuthUserDto {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error?: string }).error)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return body as T;
}

export async function loginWithIdToken(idToken: string): Promise<AuthUserDto> {
  const response = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  return parseJsonOrThrow<AuthUserDto>(response);
}

export async function getMyProfile(idToken: string): Promise<AuthUserDto> {
  const response = await fetch(`${SERVER_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  return parseJsonOrThrow<AuthUserDto>(response);
}
