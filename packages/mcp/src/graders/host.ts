// What a Flux host gives a template, as declarations for the template-mode
// typecheck (`fluxnative-ui-grade --root`). They mirror the fluxbuilder-template
// dashboard's mocks (`dashboard/src/flux/{index.ts,mock.ts,ai.ts,Video.tsx,
// navigation.tsx}`), which `tool/typecheck_templates.py` compiles templates
// against; `flux/glass` is the kit's own web host (`packages/glass/hosts/web/
// glass.tsx`), the file that dashboard vendors. Skia and the reanimated shim
// are `any`: a screen that uses them is not checked against them.

/** `node_modules/flux/index.d.ts`: the bridge (`import flux from 'flux'`) and `Video`. */
export const FLUX_INDEX = `import type { ComponentType } from 'react';

export type AiError = 'rate_limited' | 'quota' | 'blocked' | 'offline' | 'unavailable';
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiError; retryAfterMs?: number };
export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: { uri: string; kind: 'image' | 'audio' }[];
};
export type AiText = { text: string; aborted?: true };
export type AiImages = { uris: string[]; aborted?: true };
export type AiQuota = { remaining: number | null; resetsAt?: string };
export type FluxAi = {
  chat(
    input: { messages: AiMessage[]; purpose?: string },
    opts?: { onDelta?: (text: string) => void; signal?: AbortSignal },
  ): Promise<AiResult<AiText>>;
  generateImage(
    prompt: string,
    opts?: { count?: number; aspect?: '1:1' | '3:4' | '9:16'; onProgress?: (progress: number) => void; signal?: AbortSignal },
  ): Promise<AiResult<AiImages>>;
  transcribe(audio: { uri: string }, opts?: { signal?: AbortSignal }): Promise<AiResult<AiText>>;
  describeImage(image: { uri: string }, question?: string, opts?: { signal?: AbortSignal }): Promise<AiResult<AiText>>;
  quota(): Promise<AiQuota>;
};

export type FluxProduct = {
  id: string;
  name: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  was?: number;
  category: string;
  image: string;
  images?: string[];
  currency: string;
  shortDescription?: string;
  featured?: boolean;
};
export type FluxCartLine = { productId: string; variationId?: string; title: string; quantity: number; price: number; image: string };
export type FluxCart = { currency: string; subtotal: number; count: number; lines: FluxCartLine[] };
export type FluxSession = { userId: string; displayName: string; email: string; avatar?: string };
export type FluxBridge = {
  catalog: {
    list: (query?: { page?: number; limit?: number; search?: string; featured?: boolean }) => Promise<{ items: FluxProduct[] }>;
    get: (id: string) => Promise<FluxProduct | null>;
  };
  cart: {
    get: () => Promise<FluxCart>;
    add: (productId: string, options?: { quantity?: number; variationId?: string }) => Promise<FluxCart>;
    update: (productId: string, quantity: number, options?: { variationId?: string }) => Promise<FluxCart>;
    remove: (productId: string, options?: { variationId?: string }) => Promise<FluxCart>;
    checkout: () => void;
  };
  nav: { push: (route: string, params?: Record<string, unknown>) => void; switchTab?: (tab: string) => void };
  auth: { session: () => Promise<FluxSession>; login: () => Promise<FluxSession>; logout: () => Promise<null> };
  storage: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> };
  ui: { toast: (message: string) => void; haptic: (kind?: string) => void };
  app: { version: () => Promise<string> };
  data?: {
    query: (source: string, op: string, payload?: unknown) => Promise<unknown>;
    mutate: (source: string, op: string, payload?: unknown) => Promise<unknown>;
  };
  files: { pick: (options?: Record<string, unknown>) => Promise<{ url: string } | null> };
  ai?: FluxAi;
  on: (event: string, callback: (payload: unknown) => void) => () => void;
  setBackHandler: (handler: (() => boolean) | null) => void;
};

declare const bridge: FluxBridge;
export default bridge;

export type VideoPlaybackState = 'playing' | 'paused' | 'blocked' | 'error';
export interface VideoProps {
  source: { uri: string };
  poster?: string;
  width: number;
  height: number;
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain';
  playRequest?: number;
  onPlaybackStateChange?: (state: VideoPlaybackState) => void;
}
export declare const Video: ComponentType<VideoProps>;
`;

/** `node_modules/flux/navigation.d.ts`: the host's stack navigator. */
export const FLUX_NAVIGATION = `import type { ComponentType, ReactElement, ReactNode } from 'react';

type RouteState = { key: number; name: string; params: Record<string, unknown> };
type Navigation = {
  push: (name: string, params?: Record<string, unknown>) => void;
  replace: (name: string, params?: Record<string, unknown>) => void;
  pop: () => boolean;
  popToRoot: () => boolean;
  canGoBack: () => boolean;
};
type ScreenMap = Record<string, ComponentType<{ navigation: Navigation; route: RouteState }>>;

export declare function useNavigation(): Navigation;
export declare function useRoute(): RouteState;
export declare function createStackNavigator(screens: ScreenMap, options?: { initialRouteName?: string }): () => ReactElement;
export declare function NavigationContainer(props: { children: ReactNode }): ReactElement;
declare const navigation: {
  createStackNavigator: typeof createStackNavigator;
  useNavigation: typeof useNavigation;
  useRoute: typeof useRoute;
  NavigationContainer: typeof NavigationContainer;
};
export default navigation;
`;

/** Added to the stubs only when the kit's web host file is not there (an npm install of this package). */
export const FLUX_GLASS_STUB = `declare module 'flux/glass';
`;

/** A root file of every template-mode program: modules the hosts provide that have no types here. */
export const HOST_STUBS = `declare module '@shopify/react-native-skia';
declare module 'react-native-reanimated';
`;
