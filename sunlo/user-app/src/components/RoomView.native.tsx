import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { NativeModules, PermissionsAndroid, Platform, Pressable, TurboModuleRegistry, View } from 'react-native';
import type { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';
import { api, errorMessage } from '@/lib/api';
import { colors, font } from '@/theme';
import { Text } from './ui';

type AgoraModule = typeof import('react-native-agora');
export type RoomViewProps = { roomId: string; video: boolean; host: boolean; onStatus?: (s: { joined: boolean; hostLive: boolean; error: string | null }) => void };

function agoraIsLinked(): boolean {
  try {
    return TurboModuleRegistry.get('AgoraRtcNg') != null || NativeModules.AgoraRtcNg != null;
  } catch {
    return false;
  }
}
let agoraModule: AgoraModule | null | undefined;
function loadAgora(): AgoraModule | null {
  if (agoraModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      agoraModule = agoraIsLinked() ? ((require('react-native-agora') as AgoraModule | undefined) ?? null) : null;
    } catch {
      agoraModule = null;
    }
  }
  return agoraModule;
}

/**
 * Live room ki awaaz/video (Agora live-broadcast). Host = bolne wala (publisher), baaki sirf sunne/dekhne wale (audience).
 * Yeh sirf media dikhata hai (poori jagah gher kar); chat, gift, buttons parent screen mein hain.
 */
export function RoomView(props: RoomViewProps) {
  const agora = loadAgora();
  if (!agora) {
    return (
      <View style={{ position: 'absolute', left: 0, right: 0, top: 120, alignItems: 'center', paddingHorizontal: 30 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontFamily: font.medium, fontSize: 12.5 }}>Awaaz/video ke liye development build chahiye (Expo Go mein nahi chalta).</Text>
      </View>
    );
  }
  return <AgoraRoom {...props} agora={agora} />;
}

function AgoraRoom({ roomId, video, host, onStatus, agora }: RoomViewProps & { agora: AgoraModule }) {
  const { ChannelProfileType, ClientRoleType, createAgoraRtcEngine, RtcSurfaceView } = agora;
  const engine = useRef<IRtcEngine | null>(null);
  const [joined, setJoined] = useState(false);
  const [hostUid, setHostUid] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStatus?.({ joined, hostLive: host ? joined : hostUid !== null, error });
  }, [joined, hostUid, error, host, onStatus]);

  useEffect(() => {
    let cancelled = false;
    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: () => setJoined(true),
      onUserJoined: (_c, uid) => setHostUid(uid),
      onUserOffline: () => setHostUid(null),
      onError: (code, msg) => setError(`Room error (${code}) ${msg ?? ''}`),
    };
    (async () => {
      try {
        if (host && Platform.OS === 'android') {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (video) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          const res = await PermissionsAndroid.requestMultiple(perms);
          if (Object.values(res).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
            setError('Room ke liye microphone' + (video ? ' aur camera' : '') + ' ki anumati dein');
            return;
          }
        }
        const t = await api<{ appId: string; channel: string; uid: number; token: string }>(`/rooms/${roomId}/rtc-token`, { method: 'POST' });
        if (cancelled) return;
        const e = createAgoraRtcEngine();
        engine.current = e;
        e.initialize({ appId: t.appId, channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting });
        e.registerEventHandler(handler);
        e.enableAudio();
        if (video) e.enableVideo();
        if (host) {
          if (video) e.startPreview();
          e.joinChannel(t.token, t.channel, t.uid, { clientRoleType: ClientRoleType.ClientRoleBroadcaster, publishMicrophoneTrack: true, publishCameraTrack: video, autoSubscribeAudio: true, autoSubscribeVideo: false });
        } else {
          e.joinChannel(t.token, t.channel, t.uid, { clientRoleType: ClientRoleType.ClientRoleAudience, publishMicrophoneTrack: false, publishCameraTrack: false, autoSubscribeAudio: true, autoSubscribeVideo: video });
        }
        e.setEnableSpeakerphone(true);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      const e = engine.current;
      if (e) {
        e.unregisterEventHandler(handler);
        e.leaveChannel();
        e.release();
      }
      engine.current = null;
    };
  }, [roomId, video, host]);

  const btn = (icon: keyof typeof Ionicons.glyphMap, label: string, on: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.white : 'rgba(0,0,0,0.45)' }}>
      <Ionicons name={icon} size={22} color={on ? colors.text : colors.white} />
    </Pressable>
  );

  return (
    <>
      {video && !host && hostUid !== null ? <RtcSurfaceView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} canvas={{ uid: hostUid }} /> : null}
      {video && host && joined && !camOff ? <RtcSurfaceView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} canvas={{ uid: 0 }} /> : null}
      {host ? (
        <View style={{ position: 'absolute', right: 12, top: 130, gap: 10, zIndex: 5 }}>
          {btn(muted ? 'mic-off' : 'mic', muted ? 'Unmute' : 'Mute', muted, () => {
            engine.current?.muteLocalAudioStream(!muted);
            setMuted(!muted);
          })}
          {video
            ? btn(camOff ? 'videocam-off' : 'videocam', 'Camera', camOff, () => {
                engine.current?.muteLocalVideoStream(!camOff);
                setCamOff(!camOff);
              })
            : null}
          {video ? btn('camera-reverse', 'Flip', false, () => engine.current?.switchCamera()) : null}
        </View>
      ) : null}
      {error ? (
        <View style={{ position: 'absolute', top: 100, left: 16, right: 16 }}>
          <Text style={{ color: '#FFB4B4', textAlign: 'center', fontFamily: font.medium, fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}
    </>
  );
}
