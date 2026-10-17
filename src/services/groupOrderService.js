import { supabase } from '../supabaseClient';

/**
 * Real-time Collaborative Group Ordering Service (即時多人協同揪團點餐服務)
 * 透過 Supabase system_settings 儲存房間狀態與即時購物車，並使用 Realtime Channel 達成多手機即時同步。
 */

// 產生容易輸入辨識的 6 位數房間代碼 (如: GR-8821)
export const generateRoomCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomStr = '';
  for (let i = 0; i < 4; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GR-${randomStr}`;
};

/**
 * 建立揪團房間
 */
export const createGroupRoom = async ({ hostName = '主揪', storeCode = 'dragon', storeName = '龍城麵線', deadline = '' }) => {
  try {
    const roomCode = generateRoomCode();
    const hostToken = 'host_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    
    const roomData = {
      roomCode,
      storeCode,
      storeName,
      hostName: hostName.trim() || '主揪',
      hostToken,
      deadline: deadline || '',
      status: 'open', // 'open' | 'locked' | 'submitted'
      orderNumber: null,
      createdAt: new Date().toISOString(),
      items: []
    };

    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        key: `group_room:${roomCode}`,
        value: roomData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      .select();

    if (error) {
      console.error('Failed to create group room in DB:', error);
      throw error;
    }

    // 儲存主揪身分標記在本地 localStorage
    try {
      localStorage.setItem(`group_host_token_${roomCode}`, hostToken);
      localStorage.setItem('last_active_group_room', roomCode);
    } catch (e) {
      console.warn('Could not save host token to localStorage:', e);
    }

    return roomData;
  } catch (err) {
    console.error('createGroupRoom error:', err);
    throw err;
  }
};

/**
 * 取得揪團房間資料
 */
export const getGroupRoom = async (roomCode) => {
  if (!roomCode) return null;
  const cleanCode = String(roomCode).trim().toUpperCase();
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', `group_room:${cleanCode}`)
      .maybeSingle();

    if (error) {
      console.error('getGroupRoom error:', error);
      return null;
    }

    return data?.value || null;
  } catch (err) {
    console.error('getGroupRoom exception:', err);
    return null;
  }
};

/**
 * 檢查當前使用者是否為該房間之主揪
 */
export const isHostOfRoom = (roomData) => {
  if (!roomData || !roomData.roomCode) return false;
  try {
    const savedToken = localStorage.getItem(`group_host_token_${roomData.roomCode}`);
    return !!savedToken && savedToken === roomData.hostToken;
  } catch {
    return false;
  }
};

/**
 * 監聽揪團房間狀態變動 (Supabase Realtime + 定期 Polling 雙重保障)
 */
export const subscribeGroupRoom = (roomCode, onUpdate) => {
  if (!roomCode) return () => {};
  const cleanCode = String(roomCode).trim().toUpperCase();

  // 1. Supabase Realtime Channel
  const channelName = `group_room_channel_${cleanCode}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase.channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'system_settings',
        filter: `key=eq.group_room:${cleanCode}`
      },
      (payload) => {
        if (payload?.new?.value) {
          onUpdate(payload.new.value);
        }
      }
    )
    .subscribe();

  // 2. Fallback polling 每 4 秒拉取一次，防止行動網路跳轉或斷線時漏接推播
  const pollTimer = setInterval(async () => {
    const room = await getGroupRoom(cleanCode);
    if (room) {
      onUpdate(room);
    }
  }, 4000);

  return () => {
    clearInterval(pollTimer);
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn('Error removing channel:', e);
    }
  };
};

/**
 * 成員或主揪加入品項至揪團購物車
 */
export const addItemToGroupRoom = async (roomCode, item, participantName) => {
  if (!roomCode) throw new Error('Missing roomCode');
  const cleanCode = String(roomCode).trim().toUpperCase();
  const room = await getGroupRoom(cleanCode);
  if (!room) throw new Error('揪團房間不存在或已過期');
  if (room.status === 'locked') throw new Error('主揪已截止點餐，無法再新增品項');
  if (room.status === 'submitted') throw new Error('此團體訂單已由主揪送單完成');

  const name = (participantName || '').trim() || '團員';
  const newCartItem = {
    ...item,
    cartId: item.cartId || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    forWhom: name,
    addedBy: name,
    addedAt: new Date().toISOString()
  };

  const updatedItems = [...(room.items || []), newCartItem];
  const updatedRoom = {
    ...room,
    items: updatedItems
  };

  const { error } = await supabase
    .from('system_settings')
    .update({
      value: updatedRoom,
      updated_at: new Date().toISOString()
    })
    .eq('key', `group_room:${cleanCode}`);

  if (error) {
    console.error('Failed to add item to room:', error);
    throw error;
  }

  return updatedRoom;
};

/**
 * 移除品項
 */
export const removeItemFromGroupRoom = async (roomCode, cartId) => {
  if (!roomCode) throw new Error('Missing roomCode');
  const cleanCode = String(roomCode).trim().toUpperCase();
  const room = await getGroupRoom(cleanCode);
  if (!room) throw new Error('房間不存在');
  if (room.status === 'locked' || room.status === 'submitted') {
    throw new Error('房間已鎖定或送出，無法修改');
  }

  const updatedItems = (room.items || []).filter(it => it.cartId !== cartId);
  const updatedRoom = {
    ...room,
    items: updatedItems
  };

  const { error } = await supabase
    .from('system_settings')
    .update({
      value: updatedRoom,
      updated_at: new Date().toISOString()
    })
    .eq('key', `group_room:${cleanCode}`);

  if (error) throw error;
  return updatedRoom;
};

/**
 * 更新品項數量
 */
export const updateItemQtyInGroupRoom = async (roomCode, cartId, delta) => {
  if (!roomCode) throw new Error('Missing roomCode');
  const cleanCode = String(roomCode).trim().toUpperCase();
  const room = await getGroupRoom(cleanCode);
  if (!room) throw new Error('房間不存在');
  if (room.status === 'locked' || room.status === 'submitted') {
    throw new Error('房間已鎖定或送出，無法修改');
  }

  let updatedItems = [];
  for (const it of (room.items || [])) {
    if (it.cartId === cartId) {
      const newQty = (it.quantity || 1) + delta;
      if (newQty > 0) {
        const unitPrice = it.price || (it.totalPrice && it.quantity ? Math.round(it.totalPrice / it.quantity) : 0);
        updatedItems.push({
          ...it,
          quantity: newQty,
          totalPrice: unitPrice * newQty
        });
      }
    } else {
      updatedItems.push(it);
    }
  }

  const updatedRoom = {
    ...room,
    items: updatedItems
  };

  const { error } = await supabase
    .from('system_settings')
    .update({
      value: updatedRoom,
      updated_at: new Date().toISOString()
    })
    .eq('key', `group_room:${cleanCode}`);

  if (error) throw error;
  return updatedRoom;
};

/**
 * 更新房間狀態 (例如: 鎖定截止點餐、完成送單)
 */
export const updateGroupRoomStatus = async (roomCode, status, orderNumber = null) => {
  if (!roomCode) throw new Error('Missing roomCode');
  const cleanCode = String(roomCode).trim().toUpperCase();
  const room = await getGroupRoom(cleanCode);
  if (!room) throw new Error('房間不存在');

  const updatedRoom = {
    ...room,
    status,
    orderNumber: orderNumber || room.orderNumber || null
  };

  const { error } = await supabase
    .from('system_settings')
    .update({
      value: updatedRoom,
      updated_at: new Date().toISOString()
    })
    .eq('key', `group_room:${cleanCode}`);

  if (error) throw error;
  return updatedRoom;
};

/**
 * 產生乾淨專屬的揪團點餐連結
 */
export const buildGroupOrderUrl = (roomCode, storeCode = 'dragon') => {
  try {
    const origin = window.location.origin;
    return `${origin}/?group=${encodeURIComponent(roomCode)}&store=${encodeURIComponent(storeCode)}`;
  } catch {
    return `https://dragon.twabc.com/?group=${roomCode}&store=${storeCode}`;
  }
};
