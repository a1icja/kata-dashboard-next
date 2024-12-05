const TOKEN = process.env.TOKEN;  // In dev, set by .env file; in prod, set by GitHub Secret

async function checkRateLimit() {
  const response = await fetch("https://api.github.com", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch rate limit: ${response.status}`);
  }

  const rateLimitData = await response.json();

  // Get rate limit information from the headers
  const remainingLimit = response.headers.get("X-Ratelimit-Remaining");
  const resetTime = response.headers.get("X-Ratelimit-Reset");

  console.log(JSON.stringify(rateLimitData));
  console.log(`Remaining Rate Limit: ${remainingLimit}`);
  console.log(`Rate Limit Resets At: ${new Date(resetTime * 1000).toLocaleString()}`);
  
}

// Call this function in your main function or wherever appropriate
checkRateLimit();
