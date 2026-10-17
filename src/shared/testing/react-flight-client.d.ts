declare module "next/dist/compiled/react-server-dom-turbopack/client.edge" {
  export function createFromReadableStream<T>(
    stream: ReadableStream<Uint8Array>,
    options: {
      serverConsumerManifest: { moduleMap: object; serverModuleMap: null; moduleLoading: null };
    },
  ): Promise<T>;
}
