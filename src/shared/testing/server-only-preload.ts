import { plugin } from "bun";

plugin({
  name: "server-only-in-tests",
  setup(build) {
    build.onLoad({ filter: /node_modules\/server-only\/index\.js$/ }, () => ({
      contents: "",
      loader: "js",
    }));
  },
});
