import { z } from "zod";

const messageSchema = z.object({
  id: z.number().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
  sessionId: z.string().optional(),
});

type CdpMessage = z.infer<typeof messageSchema>;

export type CdpParams = Readonly<
  Record<string, string | number | boolean | readonly string[] | undefined>
>;

export const noResult = z.object({});

export class CdpConnection {
  private nextId = 1;
  private isClosed = false;
  readonly droppedEvents = new Map<string, number>();
  private readonly socket: WebSocket;
  private readonly pending = new Map<number, (message: CdpMessage) => void>();
  private readonly listeners = new Map<string, Set<(message: CdpMessage) => void>>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      this.dispatch(messageSchema.parse(JSON.parse(String(event.data))));
    });
    socket.addEventListener("close", () => {
      this.isClosed = true;

      for (const settle of this.pending.values())
        settle({ error: { message: "Chrome closed the connection." } });

      this.pending.clear();
    });
  }

  static async open(url: string): Promise<CdpConnection> {
    const socket = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error(`Cannot connect to ${url}`)));
    });

    return new CdpConnection(socket);
  }

  send<T>(
    method: string,
    resultSchema: z.ZodType<T>,
    params: CdpParams = {},
    sessionId?: string,
  ): Promise<T> {
    if (this.isClosed) return Promise.reject(new Error(`${method}: Chrome closed the connection.`));

    const id = this.nextId++;

    this.socket.send(JSON.stringify({ id, method, params, sessionId }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, (message) => {
        if (message.error) {
          reject(new Error(`${method}: ${message.error.message}`));

          return;
        }

        const result = resultSchema.safeParse(message.result);

        if (result.success) resolve(result.data);
        else reject(new Error(`${method} returned an unexpected result: ${result.error.message}`));
      });
    });
  }

  on<T>(
    method: string,
    sessionId: string,
    paramsSchema: z.ZodType<T>,
    listener: (params: T) => void,
  ): () => void {
    const key = `${sessionId}:${method}`;
    const listeners = this.listeners.get(key) ?? new Set();

    const handler = (message: CdpMessage): void => {
      const params = paramsSchema.safeParse(message.params);

      if (params.success) listener(params.data);
      else this.droppedEvents.set(method, (this.droppedEvents.get(method) ?? 0) + 1);
    };

    listeners.add(handler);
    this.listeners.set(key, listeners);

    return () => listeners.delete(handler);
  }

  close(): void {
    this.socket.close();
  }

  private dispatch(message: CdpMessage): void {
    if (message.id !== undefined) {
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);

      return;
    }

    if (message.method === undefined) return;

    for (const handler of this.listeners.get(`${message.sessionId ?? ""}:${message.method}`) ?? [])
      handler(message);
  }
}
