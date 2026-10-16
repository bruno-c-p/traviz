import { createSignInToken, findSeededUserId } from "@/shared/testing/clerk-dev";

const userId = findSeededUserId();

if (!userId) {
  console.error("The dev test user does not exist. Run bun run setup first.");
  process.exit(1);
}

console.log(createSignInToken(userId));
