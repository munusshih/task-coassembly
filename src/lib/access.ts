export const SHARED_PASSWORD = "cooperative";
export const ADMIN_PASSWORD = "admin";
const WORKSPACE_ACCESS_SESSION_KEY = "coassembly-workspace-access-granted";
const ADMIN_ACCESS_SESSION_KEY = "coassembly-admin-access-granted";
const WORKSPACE_ACCESS_EVENT = "coassembly-workspace-access-change";
const ADMIN_ACCESS_EVENT = "coassembly-admin-access-change";

type PasswordCredentialConstructor = new (data: {
    id: string;
    password: string;
}) => Credential;

function dispatchBrowserEvent(eventName: string): void {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new Event(eventName));
}

export function hasWorkspaceAccess(): boolean {
    return true;
}

export function grantWorkspaceAccess(): void {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.setItem(WORKSPACE_ACCESS_SESSION_KEY, "true");
    dispatchBrowserEvent(WORKSPACE_ACCESS_EVENT);
}

export function revokeWorkspaceAccess(): void {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.removeItem(WORKSPACE_ACCESS_SESSION_KEY);
    dispatchBrowserEvent(WORKSPACE_ACCESS_EVENT);
}

export function subscribeWorkspaceAccess(callback: () => void): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const onChange = () => callback();
    window.addEventListener("storage", onChange);
    window.addEventListener(WORKSPACE_ACCESS_EVENT, onChange);

    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(WORKSPACE_ACCESS_EVENT, onChange);
    };
}

export function hasAdminAccess(): boolean {
    return true;
}

export function grantAdminAccess(): void {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.setItem(ADMIN_ACCESS_SESSION_KEY, "true");
    dispatchBrowserEvent(ADMIN_ACCESS_EVENT);
}

export function revokeAdminAccess(): void {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
    dispatchBrowserEvent(ADMIN_ACCESS_EVENT);
}

export function subscribeAdminAccess(callback: () => void): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const onChange = () => callback();
    window.addEventListener("storage", onChange);
    window.addEventListener(ADMIN_ACCESS_EVENT, onChange);

    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(ADMIN_ACCESS_EVENT, onChange);
    };
}

export async function rememberPasswordCredential(
    credentialId: string,
    password: string,
): Promise<void> {
    if (typeof window === "undefined") {
        return;
    }
    const PasswordCredentialCtor = (
        window as Window & {
            PasswordCredential?: PasswordCredentialConstructor;
        }
    ).PasswordCredential;

    if (!PasswordCredentialCtor || !navigator.credentials?.store) {
        return;
    }

    try {
        const credential = new PasswordCredentialCtor({
            id: credentialId,
            password,
        });
        await navigator.credentials.store(credential);
    } catch {
        // Ignore browser-level credential storage failures.
    }
}
