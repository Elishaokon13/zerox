import {
  MiniAppNotificationDetails,
  type SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/miniapp-sdk";
import { getUserNotificationDetails } from "@/lib/notification";

const appUrl = process.env.NEXT_PUBLIC_URL || "";

type SendFrameNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

type SendBulkNotificationResult = {
  successfulTokens: string[];
  invalidTokens: string[];
  rateLimitedTokens: string[];
  totalSent: number;
  totalFailed: number;
};

export async function sendFrameNotification({
  fid,
  title,
  body,
  notificationDetails,
}: {
  fid: number;
  title: string;
  body: string;
  notificationDetails?: MiniAppNotificationDetails | null;
}): Promise<SendFrameNotificationResult> {
  if (!notificationDetails) {
    notificationDetails = await getUserNotificationDetails(fid);
  }
  if (!notificationDetails) {
    return { state: "no_token" };
  }

  const response = await fetch(notificationDetails.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title,
      body,
      targetUrl: appUrl,
      tokens: [notificationDetails.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json();

  if (response.status === 200) {
    const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
    if (responseBody.success === false) {
      return { state: "error", error: responseBody.error.errors };
    }

    if (responseBody.data.result.rateLimitedTokens.length) {
      return { state: "rate_limit" };
    }

    return { state: "success" };
  }

  return { state: "error", error: responseJson };
}

// New function to send notifications to all users
export async function sendBulkNotification({
  title,
  body,
  targetUrl = appUrl,
  notificationId,
}: {
  title: string;
  body: string;
  targetUrl?: string;
  notificationId?: string;
}): Promise<SendBulkNotificationResult> {
  const { getAllActiveNotificationTokens } = await import('@/lib/notification');
  
  const result: SendBulkNotificationResult = {
    successfulTokens: [],
    invalidTokens: [],
    rateLimitedTokens: [],
    totalSent: 0,
    totalFailed: 0,
  };

  try {
    // Get all active notification tokens
    const tokens = await getAllActiveNotificationTokens();
    
    console.log('=== BULK NOTIFICATION DEBUG ===');
    console.log('Available tokens:', tokens.length);
    console.log('First few tokens:', tokens.slice(0, 3));
    
    if (tokens.length === 0) {
      console.log('No active notification tokens found');
      return result;
    }

    console.log(`Sending notification to ${tokens.length} users`);
    console.log('Title:', title);
    console.log('Body:', body);
    console.log('Target URL:', targetUrl);

    // Group tokens by URL (different Farcaster clients might have different URLs)
    const tokensByUrl = new Map<string, string[]>();
    tokens.forEach(token => {
      if (!tokensByUrl.has(token.url)) {
        tokensByUrl.set(token.url, []);
      }
      tokensByUrl.get(token.url)!.push(token.token);
    });

    console.log('URLs found:', Array.from(tokensByUrl.keys()));
    console.log('Tokens per URL:', Object.fromEntries(
      Array.from(tokensByUrl.entries()).map(([url, tokens]) => [url, tokens.length])
    ));

    // Send to each URL in batches of 100 (Farcaster limit)
    for (const [url, urlTokens] of tokensByUrl) {
      console.log(`Processing URL: ${url} with ${urlTokens.length} tokens`);
      
      const batches = [];
      for (let i = 0; i < urlTokens.length; i += 100) {
        batches.push(urlTokens.slice(i, i + 100));
      }

      console.log(`Created ${batches.length} batches for ${url}`);

      for (const [batchIndex, batch] of batches.entries()) {
        try {
          console.log(`Sending batch ${batchIndex + 1}/${batches.length} to ${url} (${batch.length} tokens)`);
          
          // Use the correct Farcaster notification format
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notificationId: notificationId || `bulk-${Date.now()}`,
              title,
              body,
              targetUrl,
              tokens: batch,
            }),
          });

          console.log(`Response from ${url}:`, response.status, response.statusText);

          if (response.status === 200) {
            const responseJson = await response.json();
            console.log(`Response body from ${url}:`, responseJson);
            
            // Handle successful tokens
            if (responseJson.successfulTokens) {
              result.successfulTokens.push(...responseJson.successfulTokens);
              result.totalSent += responseJson.successfulTokens.length;
            }
            
            // Handle invalid tokens
            if (responseJson.invalidTokens) {
              result.invalidTokens.push(...responseJson.invalidTokens);
              result.totalFailed += responseJson.invalidTokens.length;
            }
            
            // Handle rate limited tokens
            if (responseJson.rateLimitedTokens) {
              result.rateLimitedTokens.push(...responseJson.rateLimitedTokens);
            }
          } else {
            console.error(`Failed to send batch to ${url}:`, response.status);
            const errorText = await response.text();
            console.error(`Error response:`, errorText);
            result.totalFailed += batch.length;
          }
        } catch (error) {
          console.error(`Error sending batch to ${url}:`, error);
          result.totalFailed += batch.length;
        }
      }
    }

    console.log(`Bulk notification completed: ${result.totalSent} sent, ${result.totalFailed} failed`);
    console.log('=== END BULK NOTIFICATION DEBUG ===');
    
  } catch (error) {
    console.error('Bulk notification failed:', error);
  }

  return result;
}
