import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { NativeModules, PermissionsAndroid, Platform, Pressable, TurboModuleRegistry, View } from 'react-native';
import type { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';
import { api, errorMessage } from '@/lib/api';
import { colors, font, radius } from '@/theme';
import { Text } from './ui';

type AgoraModule = typeof import('react-native-agora');
type CallProps = { sessionId: string; video: boolean; onEnd: () => void };

/** Native Agora module is build mein juda hai ya nahi (Expo Go mein nahi hota). Yeh check error nahi phenkta. */
function agoraIsLinked(): boolean {
  try {
    return TurboModuleRegistry.get('AgoraRtcNg') != null || NativeModules.AgoraRtcNg != null;
  } catch {
    return false;
  }
}

let agoraModule: AgoraModule | null | undefined;
/**
 * Agora native module hai: Expo Go mein hota hi nahi, aur import karte hi error deta hai (poori app gir jaati).
 * Isliye pehle check karte hain ki juda hai ya nahi, aur import sirf call screen par karte hain.
 * (Metro dev mein module load ka error try/catch se pakda nahi jaata, isliye import se pehle check zaroori hai.)
 */
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
 * Asli audio/video call (Agora). Token server deta hai, sirf ACTIVE session ke participants ko.
 * Note: Expo Go mein nahi chalta; development build chahiye (README dekhein).
 */
export function CallView(props: CallProps) {
  const agora = loadAgora();
  if (!agora) return <CallUnavailable onEnd={props.onEnd} />;
  return <AgoraCall {...props} agora={agora} />;
}

function CallUnavailable({ onEnd }: { onEnd: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 30, gap: 24 }}>
      <Text style={{ color: colors.white, textAlign: 'center', fontFamily: font.medium, paddingHorizontal: 30 }}>
        Call ki awaaz/video ke liye development build chahiye. Expo Go mein call nahi chalti. Chat normal chalegi.
      </Text>
      <Pressable onPress={onEnd} accessibilityLabel="End" style={{ alignSelf: 'center', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger }}>
          <Ionicons name="call" size={26} color={colors.white} />
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.white }}>End</Text>
      </Pressable>
    </View>
  );
}

function AgoraCall({ sessionId, video, onEnd, agora }: CallProps & { agora: AgoraModule }) {
  const { ChannelProfileType, ClientRoleType, createAgoraRtcEngine, RtcSurfaceView } = agora;
  const engine = useRef<IRtcEngine | null>(null);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(video);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: () => setJoined(true),
      onUserJoined: (_c, uid) => setRemoteUid(uid),
      onUserOffline: () => setRemoteUid(null),
      onError: (code, msg) => setError(`Call error (${code}) ${msg ?? ''}`),
    };
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (video) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          const res = await PermissionsAndroid.requestMultiple(perms);
          if (Object.values(res).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
            setError('Call ke liye microphone' + (video ? ' aur camera' : '') + ' ki anumati dein');
            return;
          }
        }
        const t = await api<{ appId: string; channel: string; uid: number; token: string }>(`/sessions/${sessionId}/rtc-token`, { method: 'POST' });
        if (cancelled) return;
        const e = createAgoraRtcEngine();
        engine.current = e;
        e.initialize({ appId: t.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
        e.registerEventHandler(handler);
        e.enableAudio();
        if (video) {
          e.enableVideo();
          e.startPreview();
        }
        e.joinChannel(t.token, t.channel, t.uid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: video,
          autoSubscribeAudio: true,
          autoSubscribeVideo: video,
        });
        e.setEnableSpeakerphone(video);
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
  }, [sessionId, video]);

  const ctrl = (icon: keyof typeof Ionicons.glyphMap, label: string, on: boolean, onPress: () => void, danger = false) => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.danger : on ? colors.white : 'rgba(255,255,255,0.18)' }}>
        <Ionicons name={icon} size={26} color={danger ? colors.white : on ? colors.text : colors.white} />
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.white }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      {video && remoteUid !== null ? <RtcSurfaceView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} canvas={{ uid: remoteUid }} /> : null}
      {video && joined && !camOff ? (
        <View style={{ position: 'absolute', top: 16, right: 16, width: 110, height: 160, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: colors.white }}>
          <RtcSurfaceView style={{ flex: 1 }} canvas={{ uid: 0 }} zOrderMediaOverlay />
        </View>
      ) : null}

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 30 }}>
        {error ? (
          <Text style={{ color: colors.white, textAlign: 'center', marginBottom: 20, fontFamily: font.medium }}>{error}</Text>
        ) : !joined ? (
          <Text style={{ color: colors.white, textAlign: 'center', marginBottom: 20 }}>Connect ho raha hai...</Text>
        ) : remoteUid === null ? (
          <Text style={{ color: colors.white, textAlign: 'center', marginBottom: 20 }}>Doosri taraf ke judne ka intezaar...</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
          {ctrl(muted ? 'mic-off' : 'mic', muted ? 'Unmute' : 'Mute', muted, () => {
            engine.current?.muteLocalAudioStream(!muted);
            setMuted(!muted);
          })}
          {video
            ? ctrl(camOff ? 'videocam-off' : 'videocam', camOff ? 'Camera on' : 'Camera off', camOff, () => {
                engine.current?.muteLocalVideoStream(!camOff);
                setCamOff(!camOff);
              })
            : ctrl('volume-high', 'Speaker', speaker, () => {
                engine.current?.setEnableSpeakerphone(!speaker);
                setSpeaker(!speaker);
              })}
          {video ? ctrl('camera-reverse', 'Flip', false, () => engine.current?.switchCamera()) : null}
          {ctrl('call', 'End', false, onEnd, true)}
        </View>
      </View>
    </View>
  );
}
