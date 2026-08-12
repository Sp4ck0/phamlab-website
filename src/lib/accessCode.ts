const KEY = "phamlab.accessCode";

export function loadAccessCode(): string | undefined {
  return localStorage.getItem(KEY) || undefined;
}

export function saveAccessCode(code: string) {
  localStorage.setItem(KEY, code.trim());
}

export function clearAccessCode() {
  localStorage.removeItem(KEY);
}
