import { expect, test } from "bun:test";
import { createMarksTransport } from "@/features/marks/marks-transport";
import { applyMarkChangePath, readMarksPath } from "@/paths";

function recordingPost(reply: string) {
  const posts: [string, string][] = [];

  const transport = createMarksTransport((path, body) => {
    posts.push([path, body]);

    return Promise.resolve(reply);
  });

  return { transport, posts };
}

test("a change is posted to the apply route with its owner, and the reply is decoded", async () => {
  const { transport, posts } = recordingPost("other-account");

  const result = await transport.applyMarkChange("user_a", {
    kind: "set",
    code: "ZMB",
    state: "want",
  });

  expect(posts).toEqual([[applyMarkChangePath(), "owner=user_a&kind=set&code=ZMB&state=want"]]);
  expect(result).toEqual({ ok: false, reason: "other-account" });
});

test("a read is posted to the read route and decodes the snapshot", async () => {
  const { transport, posts } = recordingPost("owner=user_a&status=ok&ZMB=want");

  expect(await transport.readMarks("user_a")).toEqual({
    ok: true,
    ownerId: "user_a",
    marks: { ZMB: "want" },
  });
  expect(posts).toEqual([[readMarksPath(), "owner=user_a"]]);
});

test("a reply that is no snapshot reads as a failed snapshot for the expected owner", async () => {
  const { transport } = recordingPost("<html>Bad gateway</html>");

  expect(await transport.readMarks("user_a")).toEqual({ ok: false, ownerId: "user_a" });
});
