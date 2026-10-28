import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { ReportSheet } from '@/components/ReportSheet';
import { Coin, CoinPrice } from '@/components/Coin';
import { RoomChat } from '@/components/RoomChat';
import { RoomView } from '@/components/RoomView';
import { Button, ErrorBox, Header, Loader, Screen, Text } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { mmss } from '@/lib/format';
import { qk, useMe } from '@/lib/queries';
import type { LiveRoom } from '@/lib/types';
import { useRoomLive } from '@/lib/useRoom';
import { useRemaining } from '@/lib/useLiveSession';
import { callGradient, colors, font, radius, space } from '@/theme';

type Detail = LiveRoom & { isMember: boolean; endsAt: string | null };
type Joined = { endsAt: string | null };

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['room', id], queryFn: () => api<Detail>(`/rooms/${id}`), staleTime: 0 });
  const [joined, setJoined] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; poor?: boolean } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [hostLive, setHostLive] = useState(false);
  const [reporting, setReporting] = useState(false);
  const me = useMe();
  const balance = me.data?.walletBalance ?? 0;

  const refreshMoney = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.me });
    void qc.invalidateQueries({ queryKey: qk.wallet });
    void qc.invalidateQueries({ queryKey: ['rooms'] });
  }, [qc]);

  const live = useRoomLive(joined ? id : undefined, {
    onEnded: () => {
      setOver('Host ne room khatam kar diya. Dhanyavaad!');
      refreshMoney();
    },
    onKicked: (r) => {
      setOver(r === 'BALANCE_EXHAUSTED' ? 'Balance khatam ho gaya, isliye aap room se bahar aa gaye. Recharge karke wapas aa sakte hain.' : 'Host ne aapko room se hata diya.');
      refreshMoney();
    },
    onLimit: (e) => setEndsAt(e),
  });

  const d = q.data;
  const remaining = useRemaining(endsAt, joined && !over);
  const low = remaining !== null && remaining <= 120;

  // Pehle se andar hain (app band hui thi): seedha rejoin
  const join = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Joined>(`/rooms/${id}/join`, { method: 'POST' });
      setEndsAt(r.endsAt);
      setJoined(true);
      refreshMoney();
    } catch (e) {
      setErr({ msg: errorMessage(e), poor: e instanceof ApiError && e.code === 'INSUFFICIENT_BALANCE' });
    } finally {
      setBusy(false);
    }
  }, [id, refreshMoney]);

  useEffect(() => {
    if (d?.isMember && !joined && !over && !q.isFetching) void join();
  }, [d?.isMember, joined, over, join, q.isFetching]);

  const leave = useCallback(async () => {
    try {
      await api(`/rooms/${id}/leave`, { method: 'POST' });
    } catch {
      /* server sweep sambhal lega */
    }
    qc.removeQueries({ queryKey: ['room', id] });
    refreshMoney();
    router.back();
  }, [id, refreshMoney, qc]);

  // Screen se bahar jaate hi room chhodna (back button, swipe)
  useEffect(
    () => () => {
      if (joined) void api(`/rooms/${id}/leave`, { method: 'POST' }).catch(() => undefined);
      qc.removeQueries({ queryKey: ['room', id] });
    },
    [joined, id, qc],
  );

  if (q.isLoading) return (<Screen><Header title="Room" /><Loader /></Screen>);
  if (!d) return (<Screen><Header title="Room" /><ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Screen>);

  const video = d.type === 'VIDEO';

  // ---------- Join se pehle: preview ----------
  if (!joined && !over) {
    const ended = d.status !== 'LIVE';
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Live room" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
          <Avatar name={d.host.displayName} uri={d.host.avatarUrl} size={110} ring />
          <Text style={{ fontFamily: font.bold, fontSize: 22, textAlign: 'center' }}>{d.title}</Text>
          <Text variant="small">Host: {d.host.displayName}{d.host.language ? ` · ${d.host.language}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Ionicons name={video ? 'videocam' : 'mic'} size={15} color={colors.primaryDark} />
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.primaryDark }}>{video ? 'Video room' : 'Voice room'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Ionicons name="people" size={15} color={colors.primaryDark} />
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.primaryDark }}>{d.listeners} sun rahe hain</Text>
            </View>
          </View>
          {d.ratePerMin > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Coin size={18} />
              <Text style={{ fontFamily: font.semibold, fontSize: 16 }}>{Math.round(d.ratePerMin / 100)} coins / minute</Text>
            </View>
          ) : (
            <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.success }}>Free room</Text>
          )}
          <View style={{ alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 9 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14 }}>Room kaise kaam karta hai</Text>
            {[
              [d.ratePerMin > 0 ? 'cash-outline' : 'gift-outline', d.ratePerMin > 0 ? `Andar jaate hi ${Math.round(d.ratePerMin / 100)} coins/min shuru. Yeh wahi rate hai jo host ${video ? 'video' : 'voice'} baat ke liye leta hai.` : 'Is room mein aana free hai.'],
              ['time-outline', 'Paisa sirf jitni der room mein rahe utne minute ka katta hai. Bahar aate hi katna band.'],
              [video ? 'videocam-outline' : 'mic-outline', `Host ${video ? 'live video' : 'bolta hai'} aur aap sunte${video ? '/dekhte' : ''} hain. Aap chat kar sakte hain aur gift bhej sakte hain.`],
              ['gift-outline', 'Gift bhejne par aapka naam chat mein highlight hota hai. Gift ke coins alag se katte hain.'],
              ['flag-outline', 'Kuch galat lage to room ke andar upar wale flag se report kar sakte hain.'],
            ].map(([ic, t]) => (
              <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name={ic as keyof typeof Ionicons.glyphMap} size={17} color={colors.primary} style={{ marginTop: 1 }} />
                <Text variant="small" style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
          {d.ratePerMin > 0 ? (
            <Text variant="small" style={{ textAlign: 'center', color: balance >= d.ratePerMin * 2 ? colors.textMuted : colors.danger }}>
              Aapka balance {Math.round(balance / 100)} coins · lagbhag {Math.floor(balance / d.ratePerMin)} minute chalega
            </Text>
          ) : null}
          {err ? <Text variant="small" color={colors.danger} style={{ textAlign: 'center' }}>{err.msg}</Text> : null}
        </View>
        <View style={{ padding: space.xl, gap: space.sm }}>
          {err?.poor ? <Button title="Wallet recharge karein" icon="wallet" onPress={() => router.push('/wallet')} /> : null}
          <Button title={ended ? 'Room khatam ho chuka hai' : 'Room mein jayein'} icon="enter-outline" disabled={ended} loading={busy} onPress={() => void join()} />
        </View>
      </Screen>
    );
  }

  // ---------- Room ke andar ----------
  return (
    <LinearGradient colors={[...callGradient]} style={{ flex: 1 }}>
      <RoomView roomId={id} video={video} host={false} onStatus={(s) => setHostLive(s.hostLive)} />
      <Screen edges={['top', 'bottom']} style={{ backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 }}>
            <Pressable
              onPress={() =>
                over
                  ? router.back()
                  : Alert.alert('Room chhodein?', d.ratePerMin > 0 ? 'Jitne minute rahe utna hi paisa katega.' : 'Aap kabhi bhi wapas aa sakte hain.', [
                      { text: 'Ruko', style: 'cancel' },
                      { text: 'Chhodein', style: 'destructive', onPress: () => void leave() },
                    ])
              }
              accessibilityLabel="Room chhodein"
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{d.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{d.host.displayName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="people" size={14} color={colors.white} />
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.white }}>{live.listeners ?? d.listeners}</Text>
            </View>
            <Pressable onPress={() => setReporting(true)} accessibilityLabel="Report karein" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <Ionicons name="flag-outline" size={19} color={colors.white} />
            </Pressable>
          </View>
          {remaining !== null && !over ? (
            <Pressable onPress={() => low && router.push('/wallet')} style={{ alignSelf: 'center', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: low ? 'rgba(214,69,69,0.85)' : 'rgba(0,0,0,0.4)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Ionicons name="time-outline" size={14} color={colors.white} />
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>Balance se bacha samay {mmss(remaining)}{low ? ' · Recharge' : ''}</Text>
            </Pressable>
          ) : null}

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl }}>
            {over ? (
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Ionicons name="checkmark-circle" size={56} color="#7CF0AC" />
                <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.white, textAlign: 'center' }}>{over}</Text>
                <Button title="Wapas jayein" onPress={() => router.back()} />
              </View>
            ) : !video ? (
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Avatar name={d.host.displayName} uri={d.host.avatarUrl} size={130} ring />
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: hostLive ? '#7CF0AC' : 'rgba(255,255,255,0.7)' }}>{hostLive ? 'Host live hain' : 'Host ke judne ka intezaar...'}</Text>
              </View>
            ) : !hostLive ? (
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Host ke judne ka intezaar...</Text>
            ) : null}
          </View>

          {!over ? <RoomChat messages={live.messages} onSend={live.send} rightSpace={0} /> : null}
          {d.ratePerMin > 0 && !over ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
              <Text style={{ fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Room rate</Text>
              <CoinPrice paise={d.ratePerMin} size={11} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>/min</Text>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Screen>
      {reporting ? <ReportSheet vendorId={d.host.id} context={`Room: ${d.title}`} onClose={() => setReporting(false)} /> : null}
    </LinearGradient>
  );
}
