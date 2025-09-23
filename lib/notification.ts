import type { MiniAppNotificationDetails } from "@farcaster/miniapp-sdk";
import { supabase } from "./supabase";

export async function getUserNotificationDetails(
  fid: number,
): Promise<MiniAppNotificationDetails | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('notification_token, notification_url')
      .eq('fid', fid)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      token: data.notification_token,
      url: data.notification_url,
    };
  } catch {
    return null;
  }
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails,
  address?: string,
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await supabase
      .from('user_notifications')
      .upsert({
        fid,
        address: address || null,
        notification_token: notificationDetails.token,
        notification_url: notificationDetails.url,
        is_active: true,
      }, { onConflict: 'fid' });
  } catch (error) {
    console.error('Failed to save notification details:', error);
  }
}

export async function deleteUserNotificationDetails(
  fid: number,
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await supabase
      .from('user_notifications')
      .update({ is_active: false })
      .eq('fid', fid);
  } catch (error) {
    console.error('Failed to delete notification details:', error);
  }
}

// New function to get all active notification tokens for bulk sending
export async function getAllActiveNotificationTokens(): Promise<MiniAppNotificationDetails[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('notification_token, notification_url')
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      token: item.notification_token,
      url: item.notification_url,
    }));
  } catch (error) {
    console.error('Failed to get notification tokens:', error);
    return [];
  }
}

// Function to get notification details by address
export async function getUserNotificationDetailsByAddress(
  address: string,
): Promise<MiniAppNotificationDetails | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('notification_token, notification_url')
      .eq('address', address.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      token: data.notification_token,
      url: data.notification_url,
    };
  } catch {
    return null;
  }
}
