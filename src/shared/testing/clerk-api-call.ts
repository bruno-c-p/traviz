const [method = "GET", path = "", body] = process.argv.slice(2);
const secretKey = process.env.CLERK_SECRET_KEY ?? "";
const apiUrl = process.env.TRAVIZ_CLERK_API_URL ?? "https://api.clerk.com";

const response = await fetch(`${apiUrl}/v1${path}`, {
  method,
  headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
  body,
});

const text = await response.text();

if (!response.ok) {
  console.error(
    `Clerk Backend API answered ${response.status} for ${method} ${path.split("?")[0]}`,
  );
  process.exit(1);
}

process.stdout.write(text);
