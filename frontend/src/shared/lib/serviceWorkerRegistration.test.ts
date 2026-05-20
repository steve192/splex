import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

type ListenerMap = Record<string, ((event: Event) => void)[]>;

function makeServiceWorkerEnv(initialController: object | null) {
  const listeners: ListenerMap = {};
  const updateCalls = { count: 0 };
  const registerCalls: { url: string; options?: RegistrationOptions }[] = [];
  const reload = vi.fn();

  const sw = {
    controller: initialController,
    register: vi.fn(async (url: string, options?: RegistrationOptions) => {
      registerCalls.push({ url, options });
      return {
        update: vi.fn(async () => {
          updateCalls.count += 1;
        })
      };
    }),
    addEventListener: vi.fn((event: string, handler: (event: Event) => void) => {
      (listeners[event] ??= []).push(handler);
    })
  };

  return {
    listeners,
    updateCalls,
    registerCalls,
    reload,
    install() {
      vi.stubGlobal("navigator", { serviceWorker: sw });
      vi.stubGlobal("location", { reload });
    }
  };
}

describe("ensureServiceWorkerRegistration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("registers /sw.js with updateViaCache=none", async () => {
    const env = makeServiceWorkerEnv(null);
    env.install();
    const { ensureServiceWorkerRegistration } = await import("./serviceWorker");
    await ensureServiceWorkerRegistration();
    expect(env.registerCalls).toHaveLength(1);
    expect(env.registerCalls[0]).toEqual({ url: "/sw.js", options: { updateViaCache: "none" } });
  });

  it("triggers an explicit update check after registration", async () => {
    const env = makeServiceWorkerEnv(null);
    env.install();
    const { ensureServiceWorkerRegistration } = await import("./serviceWorker");
    await ensureServiceWorkerRegistration();
    expect(env.updateCalls.count).toBe(1);
  });

  it("does not attach the reload listener when there's no prior controller", async () => {
    const env = makeServiceWorkerEnv(null);
    env.install();
    const { ensureServiceWorkerRegistration } = await import("./serviceWorker");
    await ensureServiceWorkerRegistration();
    expect(env.listeners.controllerchange).toBeUndefined();
  });

  it("attaches a controllerchange listener that reloads when an existing SW is updated", async () => {
    const env = makeServiceWorkerEnv({ /* existing controller */ });
    env.install();
    const { ensureServiceWorkerRegistration } = await import("./serviceWorker");
    await ensureServiceWorkerRegistration();
    expect(env.listeners.controllerchange).toHaveLength(1);
    env.listeners.controllerchange[0](new Event("controllerchange"));
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  it("guards against reload loops by reloading at most once per page load", async () => {
    const env = makeServiceWorkerEnv({ /* existing controller */ });
    env.install();
    const { ensureServiceWorkerRegistration } = await import("./serviceWorker");
    await ensureServiceWorkerRegistration();
    const handler = env.listeners.controllerchange[0];
    handler(new Event("controllerchange"));
    handler(new Event("controllerchange"));
    expect(env.reload).toHaveBeenCalledTimes(1);
  });
});
