import { plugin } from "bun";

process.env.TURSO_DATABASE_URL ??= "file::memory:";

plugin({
  name: "server-only-in-tests",
  setup(build) {
    build.onLoad({ filter: /node_modules\/server-only\/index\.js$/ }, () => ({
      contents: "",
      loader: "js",
    }));
  },
});
