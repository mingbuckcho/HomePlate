import { http } from "@/shared/api/http";
import type {
  SignUpRequest,
  LoginRequest,
  LoginResponse,
} from "@/shared/api/types";

/**
 * Swagger: AuthController
 * - POST /auth/email/request, POST /auth/email/verify, POST /auth/signup, POST /auth/login, ...
 */

export async function requestEmailCode(email: string): Promise<void> {
  await http.post("/auth/email/request", { email });
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  await http.post("/auth/email/verify", { email, code });
}

export async function signUp(body: SignUpRequest): Promise<void> {
  await http.post("/auth/signup", body);
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/auth/login", body);
  return data;
}

export async function logout(): Promise<void> {
  await http.post("/auth/logout");
}

export async function refreshToken(): Promise<string> {
  const { data } = await http.post<string>("/auth/refresh");
  return data;
}
