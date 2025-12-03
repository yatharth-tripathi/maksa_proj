/**
 * Notifications API
 * Get and manage notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
} from '@/lib/supabase/notifications';

export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get('userAddress');
    const action = request.nextUrl.searchParams.get('action');

    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }

    if (action === 'unread-count') {
      const count = await getUnreadCount(userAddress);
      return NextResponse.json({ count });
    }

    const notifications = await getNotifications(userAddress);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notification = await createNotification(body);
    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, userAddress, action } = body;

    if (action === 'mark-all-read' && userAddress) {
      await markAllAsRead(userAddress);
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await markAsRead(notificationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
