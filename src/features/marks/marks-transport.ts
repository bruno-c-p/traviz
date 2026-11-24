import type { MarksTransport } from "@/features/marks/marks-owner";
import {
  decodeMarkChangeResult,
  decodeMarksSnapshot,
  encodeMarkChangeRequest,
  encodeOwner,
} from "@/features/marks/marks-wire";
import { applyMarkChangePath, readMarksPath } from "@/paths";

export type PostText = (path: string, body: string) => Promise<string>;

export function createMarksTransport(postText: PostText): MarksTransport {
  return {
    applyMarkChange: async (expectedOwnerId, change) =>
      decodeMarkChangeResult(
        await postText(applyMarkChangePath(), encodeMarkChangeRequest({ expectedOwnerId, change })),
      ),
    readMarks: async (expectedOwnerId) =>
      decodeMarksSnapshot(await postText(readMarksPath(), encodeOwner(expectedOwnerId))) ?? {
        ok: false,
        ownerId: expectedOwnerId,
      },
  };
}

export const postWithFetch: PostText = async (path, body) => {
  const response = await fetch(path, {
    method: "POST",
    body: new URLSearchParams(body),
    credentials: "same-origin",
    keepalive: true,
  });

  return response.text();
};
