/**
 * Notifications System
 * Create and manage user notifications
 */

import { supabaseAdmin } from './client';

export interface Notification {
  id?: string;
  user_address: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  data?: unknown;
  read?: boolean;
  created_at?: string;
}

/**
 * Create a notification
 */
export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert([notification])
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(userAddress: string, limit: number = 50): Promise<Notification[]> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_address', userAddress)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Notification[];
}

/**
 * Get unread count
 */
export async function getUnreadCount(userAddress: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_address', userAddress)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark all as read
 */
export async function markAllAsRead(userAddress: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_address', userAddress)
    .eq('read', false);

  if (error) throw error;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}
