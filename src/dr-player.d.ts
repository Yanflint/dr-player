// TypeScript-определения для @deepreview/player.
// Stage 8a эпика dr-player-v1 (2026-05-23). Соответствуют public API из
// `src/index.js` (JSDoc-аннотации). Hand-written; держится синхронно с
// runtime'ом, проверяется compile'ом + tests перед publish'ом.
//
// Stage 8b (2026-05-23, ADR-0010): Lottie больше не часть .dr.zip формата.
// Lottie-слои в legacy .dr.zip → graceful skip + counter `skippedLottieLayers`
// в LoadedPayload / MountedPayload (optional, проставляется только если > 0).
//
// Bundle подключается как IIFE → `window.DrPlayer.Player`. Эти типы
// описывают тот же объект.

declare namespace DrPlayer {
  /**
   * Структурированный envelope для `error` event payload и для Error из
   * `await player.load()` reject.
   */
  export type ErrorPayload = {
    code: ErrorCode;
    message: string;
    cause?: unknown;
  };

  export type ErrorCode =
    | 'LOAD_FAILED'
    | 'PARSE_FAILED'
    | 'FORMAT_VERSION_MISMATCH'
    | 'MOUNT_FAILED'
    | 'RUNTIME_ERROR';

  /** Enum-объект, экспортируется в bundle через `DrPlayer.ERROR_CODES`. */
  export const ERROR_CODES: Readonly<Record<ErrorCode, ErrorCode>>;

  /** Payload `loaded` event. */
  export type LoadedPayload = {
    layerCount: number;
    triggers: string[];
    inputs: unknown[];
    /** Опционально в V1.x (резерв). */
    duration?: number;
    /**
     * Stage 8b (ADR-0010): количество Lottie-слоёв в legacy `.dr.zip`,
     * которые dr-player пропустит при render'е. Всегда присутствует (0 если
     * Lottie-слоёв нет). Разработчик может среагировать (warning UI,
     * telemetry).
     */
    skippedLottieLayers: number;
  };

  /** Payload `mounted` event. */
  export type MountedPayload = {
    width: number;
    height: number;
    /**
     * Stage 8b (ADR-0010): дублирует counter из LoadedPayload — присутствует
     * ТОЛЬКО если > 0 (опциональное поле). Подтверждение того, что render-loop
     * увидел Lottie-слои и пропустил.
     */
    skippedLottieLayers?: number;
  };

  /** Payload `trigger` event. */
  export type TriggerPayload = {
    name: string;
    source: 'external' | 'internal';
  };

  /** Payload custom `event:<name>` event. */
  export type CustomEventPayload = {
    payload: unknown;
  };

  /** Map событий → их payload-типов. Используется в `on`/`off`. */
  export type EventMap = {
    loaded: LoadedPayload;
    error: ErrorPayload;
    mounted: MountedPayload;
    unmounted: Record<string, never>;
    trigger: TriggerPayload;
    [event: `event:${string}`]: CustomEventPayload;
  };

  export type PlayerOptions = {
    /**
     * Если true — `<dr-player>` следит за viewport через
     * IntersectionObserver (threshold 0.1); вне поля видимости sprite RAF /
     * video pause, при возврате — resume. Default: true.
     *
     * Для лент с десятками виджетов — обязательно true. Для fullscreen-баннера
     * — false.
     */
    autoPause?: boolean;
  };

  export class Player {
    constructor(opts?: PlayerOptions);

    /**
     * Загрузить `.dr.zip` (URL строкой или Blob). Resolves когда snapshot
     * готов к `mount()`; emit `loaded` event. На ошибку — emit `error` +
     * reject Promise с `{ code, message, cause? }`.
     */
    load(input: string | Blob): Promise<void>;

    /**
     * Создать `<dr-player>` внутри `el` (closed Shadow DOM), render'ить
     * первый кадр + запустить runtime. Sync API.
     */
    mount(el: HTMLElement): void;

    /** Снять плеер со страницы. Идемпотент. */
    unmount(): void;

    /**
     * Запустить триггер по имени. Возвращает true если был хотя бы один
     * зарегистрированный handler. Emit `trigger` event с
     * `source: 'external'`.
     */
    trigger(name: string): boolean;

    /**
     * Установить значение named input. До mount — warning + no-op. После
     * mount — value хранится в inputsState, граф (V1.x) сможет читать через
     * input-ноды.
     */
    set(input: string, value: unknown): void;

    /** Subscribe на event. Один cb регистрируется единожды. */
    on<E extends keyof EventMap>(event: E, cb: (payload: EventMap[E]) => void): void;
    on(event: string, cb: (payload: unknown) => void): void;

    /** Unsubscribe. */
    off<E extends keyof EventMap>(event: E, cb: (payload: EventMap[E]) => void): void;
    off(event: string, cb: (payload: unknown) => void): void;

    /** Final cleanup: unmount + revoke blob URLs + clear listeners. */
    destroy(): void;
  }
}

export = DrPlayer;
export as namespace DrPlayer;
